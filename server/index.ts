import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { runMigrations } from "./migrations";
import { startScheduler } from "./scheduler";
import { logSchemaHealth } from "./schema-health";
import { WebhookHandlers, WebhookConfigError } from "./webhookHandlers";
import { getStripePublishableKey, getUncachableStripeClient } from "./stripeClient";
import { db } from "./db";
import { platformSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// CRITICAL: Register Stripe webhook route BEFORE express.json() middleware
// Stripe webhooks require raw Buffer body for signature verification
app.post(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      if (error instanceof WebhookConfigError) {
        // Misconfiguration (missing webhook secret): log the real detail
        // server-side only and return a safe, generic 400 so we never leak
        // configuration internals or surface a 500 to the caller.
        console.error('[Stripe Webhook] Configuration error:', error.message);
        return res.status(400).json({ error: 'Webhook not configured' });
      }
      console.error('[Stripe Webhook] Error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      const logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      log(logLine);
    }
  });

  next();
});

async function initStripe() {
  try {
    const stripe = await getUncachableStripeClient();

    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    if (!webhookBaseUrl || webhookBaseUrl === 'https://undefined') {
      console.warn('[Stripe] REPLIT_DOMAINS not set, skipping webhook setup');
      return;
    }

    const webhookUrl = `${webhookBaseUrl}/api/webhooks/stripe`;
    console.log(`[Stripe] Setting up webhook for ${webhookUrl}`);

    const [existingSecretRow] = await db.select()
      .from(platformSettings)
      .where(eq(platformSettings.key, 'stripe_webhook_secret'));

    if (existingSecretRow) {
      const existingEndpointIdRow = await db.select()
        .from(platformSettings)
        .where(eq(platformSettings.key, 'stripe_webhook_endpoint_id'));
      const endpointId = existingEndpointIdRow[0]?.value as string | undefined;

      if (endpointId) {
        try {
          const ep = await stripe.webhookEndpoints.retrieve(endpointId);
          if (ep.url === webhookUrl) {
            console.log('[Stripe] Webhook endpoint already configured');
            return;
          }
          console.warn(`[Stripe] Stored endpoint URL (${ep.url}) doesn't match expected (${webhookUrl}) — deleting old endpoint and recreating`);
          await stripe.webhookEndpoints.del(endpointId);
        } catch {
          console.warn('[Stripe] Stored endpoint no longer valid, recreating...');
        }
      } else {
        // Secret is stored but endpoint ID is missing — verify endpoint exists by URL before trusting the secret
        console.warn('[Stripe] Webhook secret found but endpoint ID missing — verifying by URL');
        const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
        const byUrl = endpoints.data.find((ep) => ep.url === webhookUrl);
        if (byUrl) {
          // Endpoint exists; store its ID for future checks (secret is already stored)
          await db.insert(platformSettings)
            .values({ key: 'stripe_webhook_endpoint_id', value: byUrl.id })
            .onConflictDoUpdate({
              target: platformSettings.key,
              set: { value: byUrl.id, updatedAt: new Date() },
            });
          console.log(`[Stripe] Webhook endpoint verified (${byUrl.id}), endpoint ID stored`);
          return;
        }
        // Endpoint not found — fall through to recreate it (secret will be refreshed below)
        console.warn('[Stripe] No matching endpoint found for URL, recreating...');
      }
    }

    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    const existing = endpoints.data.find((ep) => ep.url === webhookUrl);

    if (existing) {
      console.log(`[Stripe] Webhook endpoint exists (${existing.id}) but secret is unknown — deleting and recreating`);
      await stripe.webhookEndpoints.del(existing.id);
    }

    const endpoint = await stripe.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: [
        'invoice.paid',
        'invoice.payment_failed',
        'customer.subscription.deleted',
      ],
    });

    await db.insert(platformSettings)
      .values({ key: 'stripe_webhook_secret', value: endpoint.secret! })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value: endpoint.secret!, updatedAt: new Date() },
      });

    await db.insert(platformSettings)
      .values({ key: 'stripe_webhook_endpoint_id', value: endpoint.id })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value: endpoint.id, updatedAt: new Date() },
      });

    console.log(`[Stripe] Webhook endpoint created (${endpoint.id}) and secret stored`);
  } catch (error: any) {
    console.error('[Stripe] Init failed:', error.message);
    // Non-fatal - app continues without Stripe webhook if credentials aren't available
  }
}

(async () => {
  await runMigrations();
  startScheduler();
  await logSchemaHealth();
  await initStripe();

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
