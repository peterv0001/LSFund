import { db } from './db';
import { subscriptions, platformSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { storage } from './storage';
import { maybeNotifyAdminsAgentLostLastSubscription } from './adminAlerts';
import { emailService } from './email';
import { fireSubscriptionV2026, fireSubscriptionLegacy, type AgencyModel } from './commissionEngine';
import Stripe from 'stripe';
import { getUncachableStripeClient } from './stripeClient';

/**
 * Thrown when the Stripe webhook secret is not configured (neither the
 * STRIPE_WEBHOOK_SECRET env var nor a stripe_webhook_secret platform_settings
 * row exists). Callers should treat this as a server-side configuration problem:
 * log the detail internally and return a safe, generic 400 to the caller rather
 * than surfacing a 500 with the raw message.
 */
export class WebhookConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookConfigError';
  }
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const envSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, 'stripe_webhook_secret'));
    const dbSecret = row?.value as string | undefined;
    const webhookSecret = envSecret || dbSecret;

    if (!webhookSecret) {
      throw new WebhookConfigError('[Webhook] No STRIPE_WEBHOOK_SECRET env var or stripe_webhook_secret in platform_settings — cannot verify signature');
    }

    const stripe = await getUncachableStripeClient();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    console.log(`[Webhook] Processing event: ${event.type}`);

    switch (event.type) {
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        if (subId) {
          await WebhookHandlers.handleInvoicePaid(subId, invoice);
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        if (subId) {
          await WebhookHandlers.handleInvoicePaymentFailed(subId);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await WebhookHandlers.handleSubscriptionDeleted(sub.id);
        break;
      }
      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }
  }

  static async handleInvoicePaid(stripeSubscriptionId: string, invoiceData: any): Promise<void> {
    const [sub] = await db.select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));

    if (!sub) {
      console.log(`[Webhook] No subscription found for stripeSubscriptionId: ${stripeSubscriptionId}`);
      return;
    }

    const now = new Date();
    const periodEnd = invoiceData.lines?.data?.[0]?.period?.end
      ? new Date(invoiceData.lines.data[0].period.end * 1000)
      : null;

    await db.update(subscriptions)
      .set({
        billingStatus: 'active',
        lastChargedAt: now,
        nextBillingDate: periodEnd,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, sub.id));

    console.log(`[Webhook] Subscription ${sub.id} billing status set to active`);

    await WebhookHandlers.fireCommissions(sub, now);
  }

  static async handleInvoicePaymentFailed(stripeSubscriptionId: string): Promise<void> {
    const [sub] = await db.select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));

    if (!sub) return;

    // Stripe delivers webhooks at-least-once and dunning can fire several
    // payment_failed events for the same past-due subscription. Only alert the
    // agent on the transition INTO past_due so repeated failures for the same
    // outstanding issue don't spam their inbox.
    const alreadyPastDue = sub.billingStatus === 'past_due';

    await db.update(subscriptions)
      .set({ billingStatus: 'past_due', updatedAt: new Date() })
      .where(eq(subscriptions.id, sub.id));

    console.log(`[Webhook] Subscription ${sub.id} billing status set to past_due`);

    storage.logActivity({
      actorId: sub.agentId,
      actorType: 'system',
      action: 'billing_failed',
      entityType: 'subscription',
      entityId: sub.id,
      description: `Payment failed for ${sub.tier} subscription for merchant "${sub.merchantName}"`,
      details: { stripeSubscriptionId },
      ipAddress: null,
      userAgent: null,
    }).catch(console.error);

    storage.createNotification({
      agentId: sub.agentId,
      type: 'system',
      title: 'Payment Failed',
      message: `A payment failed for your ${sub.tier} subscription for merchant "${sub.merchantName}". Please update payment information.`,
    }).catch(console.error);

    // Fire-and-forget transactional email alerting the agent, respecting their
    // email preferences. Failures are logged, never thrown, so the webhook still
    // returns 200 to Stripe. Suppressed when the subscription was already
    // past_due (duplicate webhook delivery / repeated dunning failure).
    if (alreadyPastDue) {
      console.log(`[Webhook] Subscription ${sub.id} already past_due; skipping duplicate payment-failed email`);
      return;
    }
    storage.getAgent(sub.agentId).then((agent) => {
      if (!agent?.email) return;
      const prefs = (agent.emailPreferences as { emailOnPaymentFailed?: boolean } | null) ?? {};
      if (prefs.emailOnPaymentFailed === false) return;
      return emailService.sendSubscriptionPaymentFailedEmail(agent.email, {
        firstName: agent.firstName,
        merchantName: sub.merchantName,
        tier: sub.tier,
      });
    }).catch((err) => console.error('[Webhook] Failed to send payment failed email:', err));
  }

  static async handleSubscriptionDeleted(stripeSubscriptionId: string): Promise<void> {
    const [sub] = await db.select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));

    if (!sub) return;

    // Mark both the billing status AND the subscription status as cancelled so
    // that getActiveSubscriptionCount correctly reflects the deletion and the
    // last-subscription alert can fire accurately.
    await db.update(subscriptions)
      .set({ billingStatus: 'cancelled', status: 'cancelled', updatedAt: new Date() })
      .where(eq(subscriptions.id, sub.id));

    console.log(`[Webhook] Subscription ${sub.id} billing status set to cancelled`);

    // Alert admins if the agent just lost their last active subscription.
    // Awaited so callers (e.g. tests) can rely on the alert being persisted.
    const agent = await storage.getAgent(sub.agentId);
    if (agent) {
      await maybeNotifyAdminsAgentLostLastSubscription(
        agent.id,
        `${agent.firstName} ${agent.lastName}`,
      ).catch((err) => console.error('[AdminAlert] last-sub alert error (webhook):', err));
    }
  }

  private static async fireCommissions(sub: any, now: Date): Promise<void> {
    try {
      const startDate = new Date(sub.startDate);
      const monthsSinceStart = Math.floor(
        (now.getTime() - startDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000)
      );
      const periodDateV2026 = now.toISOString().split('T')[0];

      // v2026 subscription engine — NEW subscriptions only. Legacy records below
      // keep the original pool×decay math untouched.
      if (sub.commissionModel === 'v2026') {
        const agent = await storage.getAgent(sub.agentId);
        if (!agent) {
          console.log(`[Webhook] No agent ${sub.agentId} for v2026 subscription ${sub.id}; skipping commission`);
          return;
        }
        const { producerAmount } = await fireSubscriptionV2026(storage, {
          sub,
          agent: {
            distributorTier: agent.distributorTier,
            agencyModel: agent.agencyModel as AgencyModel,
            residualStatus: agent.residualStatus,
            membershipActive: agent.status === 'active',
          },
          monthsSinceStart,
          periodDate: periodDateV2026,
          acceleratorRates: [],
        });
        console.log(`[Webhook] Fired v2026 commissions for subscription ${sub.id}, producer: $${producerAmount.toFixed(2)}`);
        return;
      }

      const periodDate = now.toISOString().split('T')[0];
      const { producerAmount } = await fireSubscriptionLegacy(storage, {
        sub,
        monthsSinceStart,
        periodDate,
      });
      console.log(`[Webhook] Fired legacy commissions for subscription ${sub.id}, producer: $${producerAmount.toFixed(2)}`);
    } catch (err) {
      console.error(`[Webhook] Failed to fire commissions for subscription ${sub.id}:`, err);
    }
  }
}
