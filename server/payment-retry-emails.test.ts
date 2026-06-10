/**
 * Tests verifying that the agent payment-retry flow
 * (PATCH /api/subscriptions/:id/payment-method) honors each agent's
 * notification preferences when deciding whether to dispatch the
 * "payment successful" / "payment failed" emails, and that an in-app
 * notification is always created regardless of those preferences.
 *
 * Both the Stripe client and emailService are mocked so no real Stripe
 * calls or emails are ever made and no RESEND_API_KEY is required.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type Stripe from "stripe";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import * as schema from "@shared/schema";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import { scrypt as scryptCallback, randomBytes } from "crypto";
import { promisify } from "util";

// ── Mock the Stripe client before any module that uses it is imported ──────
// vi.mock is hoisted by Vitest so it runs before static imports, ensuring
// routes.ts receives the mocked module when it loads.
vi.mock("./stripeClient.js", () => ({
  getUncachableStripeClient: vi.fn(),
  getStripePublishableKey: vi.fn().mockResolvedValue("pk_test_mock"),
  getStripeSecretKey: vi.fn().mockResolvedValue("sk_test_mock"),
}));

// ── Mock emailService so no real emails are sent ──────────────────────────
vi.mock("./email.js", () => ({
  emailService: {
    sendPaymentRetrySuccessEmail: vi.fn().mockResolvedValue(undefined),
    sendPaymentRetryFailedEmail: vi.fn().mockResolvedValue(undefined),
    sendSubscriptionPausedEmail: vi.fn().mockResolvedValue(undefined),
    sendSubscriptionCancelledEmail: vi.fn().mockResolvedValue(undefined),
    sendSubscriptionReactivatedEmail: vi.fn().mockResolvedValue(undefined),
    sendSubscriptionExpiredEmail: vi.fn().mockResolvedValue(undefined),
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendDealFundedEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendTeamSignupEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

import { registerRoutes } from "./routes.js";
import { getUncachableStripeClient } from "./stripeClient.js";
import { emailService } from "./email.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run payment-retry email tests");
}

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const scryptAsync = promisify(scryptCallback);

const TS = Date.now();
const AGENT_EMAIL_PREFIX = `payment-retry-email-${TS}`;
const PASSWORD = "PaymentRetry1!";

const MOCK_CUSTOMER_ID = "cus_retry_mock_12345";
const MOCK_SUBSCRIPTION_ID = "sub_retry_mock_67890";

let testApp: ReturnType<typeof express>;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

type EmailPrefs = {
  emailOnPaymentRetrySuccess?: boolean;
  emailOnPaymentRetryFailed?: boolean;
};

async function createAgent(suffix: string, prefs: EmailPrefs = {}) {
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: `${AGENT_EMAIL_PREFIX}-${suffix}@example.com`,
      password: await hashPassword(PASSWORD),
      firstName: "Retry",
      lastName: "Tester",
      currentRank: "agent",
      highestRank: "agent",
      emailPreferences: prefs,
    })
    .returning();
  return agent;
}

async function insertBillableSubscription(agentId: number) {
  const [sub] = await db
    .insert(schema.subscriptions)
    .values({
      agentId,
      merchantName: "Test Merchant",
      tier: "tier_1",
      monthlyAmount: "199.00",
      startDate: new Date(),
      stripeCustomerId: MOCK_CUSTOMER_ID,
      stripeSubscriptionId: MOCK_SUBSCRIPTION_ID,
      stripePaymentMethodId: "pm_test_existing",
      cardLast4: "4242",
      cardBrand: "visa",
      billingStatus: "past_due",
    })
    .returning();
  return sub;
}

// Mock Stripe client supporting the retry-with-existing-card path.
// When invoicePaid is true the open invoice pays successfully (billing → active);
// when false, invoices.pay rejects (billing → failed).
function buildRetryMockStripeClient(invoicePaid: boolean) {
  const openInvoice = { id: "in_test_open_1", status: "open" };
  const payFn = invoicePaid
    ? vi.fn().mockResolvedValue({ id: openInvoice.id, status: "paid" })
    : vi.fn().mockRejectedValue(
        Object.assign(new Error("Your card was declined."), {
          decline_code: "insufficient_funds",
        })
      );
  return {
    paymentMethods: {
      attach: vi.fn().mockResolvedValue({ id: "pm_test_new" }),
      retrieve: vi.fn().mockResolvedValue({
        id: "pm_test_new",
        card: { last4: "1111", brand: "mastercard" },
      }),
    },
    customers: {
      update: vi.fn().mockResolvedValue({ id: MOCK_CUSTOMER_ID }),
    },
    subscriptions: {
      update: vi.fn().mockResolvedValue({ id: MOCK_SUBSCRIPTION_ID }),
    },
    invoices: {
      list: vi.fn().mockResolvedValue({ data: [openInvoice] }),
      pay: payFn,
    },
  };
}

function useMockStripe(mockStripe: ReturnType<typeof buildRetryMockStripeClient>) {
  vi.mocked(getUncachableStripeClient).mockResolvedValue(
    mockStripe as unknown as Stripe
  );
}

async function loginAs(email: string): Promise<string[]> {
  const res = await request(testApp)
    .post("/api/login")
    .send({ username: email, password: PASSWORD });
  return res.headers["set-cookie"] as unknown as string[];
}

async function getNotificationsForAgent(agentId: number) {
  return db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.agentId, agentId));
}

async function cleanupAgent(agentId: number) {
  await db
    .delete(schema.activityLog)
    .where(
      and(
        eq(schema.activityLog.entityType, "subscription"),
        eq(schema.activityLog.actorId, agentId)
      )
    );
  await db
    .delete(schema.notifications)
    .where(eq(schema.notifications.agentId, agentId));
  await db
    .delete(schema.subscriptions)
    .where(eq(schema.subscriptions.agentId, agentId));
  await db.delete(schema.agents).where(eq(schema.agents.id, agentId));
}

// The route fires the email/notification work after responding
// (storage.getAgent(...).then(...)), so allow it a moment to run.
function shortDelay(ms = 50) {
  return new Promise((r) => setTimeout(r, ms));
}

beforeAll(async () => {
  testApp = express();
  testApp.use(express.json());
  const httpServer = createServer(testApp);
  await registerRoutes(httpServer, testApp);
}, 30000);

afterAll(async () => {
  await testPool.end();
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Success email respects emailOnPaymentRetrySuccess ──────────────────────
describe("payment retry – success email preference", () => {
  it("sends a success email when the card update resolves billing and the preference is enabled", async () => {
    const agent = await createAgent("success-on", {
      emailOnPaymentRetrySuccess: true,
      emailOnPaymentRetryFailed: true,
    });
    const sub = await insertBillableSubscription(agent.id);
    useMockStripe(buildRetryMockStripeClient(true));
    const cookie = await loginAs(agent.email);

    await request(testApp)
      .patch(`/api/subscriptions/${sub.id}/payment-method`)
      .set("Cookie", cookie)
      .send({})
      .expect(200);

    await shortDelay();
    expect(emailService.sendPaymentRetrySuccessEmail).toHaveBeenCalledOnce();
    expect(emailService.sendPaymentRetrySuccessEmail).toHaveBeenCalledWith(
      agent.email,
      expect.objectContaining({ merchantName: "Test Merchant" })
    );
    expect(emailService.sendPaymentRetryFailedEmail).not.toHaveBeenCalled();

    await cleanupAgent(agent.id);
  });

  it("does NOT send a success email when emailOnPaymentRetrySuccess is false", async () => {
    const agent = await createAgent("success-off", {
      emailOnPaymentRetrySuccess: false,
      emailOnPaymentRetryFailed: true,
    });
    const sub = await insertBillableSubscription(agent.id);
    useMockStripe(buildRetryMockStripeClient(true));
    const cookie = await loginAs(agent.email);

    await request(testApp)
      .patch(`/api/subscriptions/${sub.id}/payment-method`)
      .set("Cookie", cookie)
      .send({})
      .expect(200);

    await shortDelay();
    expect(emailService.sendPaymentRetrySuccessEmail).not.toHaveBeenCalled();

    await cleanupAgent(agent.id);
  });

  it("creates a success in-app notification even when emailOnPaymentRetrySuccess is false", async () => {
    const agent = await createAgent("success-notif", {
      emailOnPaymentRetrySuccess: false,
      emailOnPaymentRetryFailed: false,
    });
    const sub = await insertBillableSubscription(agent.id);
    useMockStripe(buildRetryMockStripeClient(true));
    const cookie = await loginAs(agent.email);

    await request(testApp)
      .patch(`/api/subscriptions/${sub.id}/payment-method`)
      .set("Cookie", cookie)
      .send({})
      .expect(200);

    await shortDelay();
    const notifs = await getNotificationsForAgent(agent.id);
    expect(
      notifs.some((n) => n.title === "Payment Successful: Test Merchant")
    ).toBe(true);

    await cleanupAgent(agent.id);
  });
});

// ── Failure email respects emailOnPaymentRetryFailed ───────────────────────
describe("payment retry – failure email preference", () => {
  it("sends a failure email when the retry is declined and the preference is enabled", async () => {
    const agent = await createAgent("fail-on", {
      emailOnPaymentRetrySuccess: true,
      emailOnPaymentRetryFailed: true,
    });
    const sub = await insertBillableSubscription(agent.id);
    useMockStripe(buildRetryMockStripeClient(false));
    const cookie = await loginAs(agent.email);

    await request(testApp)
      .patch(`/api/subscriptions/${sub.id}/payment-method`)
      .set("Cookie", cookie)
      .send({})
      .expect(200);

    await shortDelay();
    expect(emailService.sendPaymentRetryFailedEmail).toHaveBeenCalledOnce();
    expect(emailService.sendPaymentRetryFailedEmail).toHaveBeenCalledWith(
      agent.email,
      expect.objectContaining({ merchantName: "Test Merchant" })
    );
    expect(emailService.sendPaymentRetrySuccessEmail).not.toHaveBeenCalled();

    await cleanupAgent(agent.id);
  });

  it("does NOT send a failure email when emailOnPaymentRetryFailed is false", async () => {
    const agent = await createAgent("fail-off", {
      emailOnPaymentRetrySuccess: true,
      emailOnPaymentRetryFailed: false,
    });
    const sub = await insertBillableSubscription(agent.id);
    useMockStripe(buildRetryMockStripeClient(false));
    const cookie = await loginAs(agent.email);

    await request(testApp)
      .patch(`/api/subscriptions/${sub.id}/payment-method`)
      .set("Cookie", cookie)
      .send({})
      .expect(200);

    await shortDelay();
    expect(emailService.sendPaymentRetryFailedEmail).not.toHaveBeenCalled();

    await cleanupAgent(agent.id);
  });

  it("creates a failure in-app notification even when emailOnPaymentRetryFailed is false", async () => {
    const agent = await createAgent("fail-notif", {
      emailOnPaymentRetrySuccess: false,
      emailOnPaymentRetryFailed: false,
    });
    const sub = await insertBillableSubscription(agent.id);
    useMockStripe(buildRetryMockStripeClient(false));
    const cookie = await loginAs(agent.email);

    await request(testApp)
      .patch(`/api/subscriptions/${sub.id}/payment-method`)
      .set("Cookie", cookie)
      .send({})
      .expect(200);

    await shortDelay();
    const notifs = await getNotificationsForAgent(agent.id);
    expect(
      notifs.some((n) => n.title === "Payment Failed: Test Merchant")
    ).toBe(true);

    await cleanupAgent(agent.id);
  });
});

// ── Missing preference keys default to enabled ─────────────────────────────
describe("payment retry – default behavior with no preference keys", () => {
  it("sends a success email by default when no preference keys are set", async () => {
    const agent = await createAgent("default-success", {});
    const sub = await insertBillableSubscription(agent.id);
    useMockStripe(buildRetryMockStripeClient(true));
    const cookie = await loginAs(agent.email);

    await request(testApp)
      .patch(`/api/subscriptions/${sub.id}/payment-method`)
      .set("Cookie", cookie)
      .send({})
      .expect(200);

    await shortDelay();
    expect(emailService.sendPaymentRetrySuccessEmail).toHaveBeenCalledOnce();

    await cleanupAgent(agent.id);
  });

  it("sends a failure email by default when no preference keys are set", async () => {
    const agent = await createAgent("default-fail", {});
    const sub = await insertBillableSubscription(agent.id);
    useMockStripe(buildRetryMockStripeClient(false));
    const cookie = await loginAs(agent.email);

    await request(testApp)
      .patch(`/api/subscriptions/${sub.id}/payment-method`)
      .set("Cookie", cookie)
      .send({})
      .expect(200);

    await shortDelay();
    expect(emailService.sendPaymentRetryFailedEmail).toHaveBeenCalledOnce();

    await cleanupAgent(agent.id);
  });
});
