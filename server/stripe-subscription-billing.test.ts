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
// that when routes.ts is loaded it receives the mocked module.
vi.mock("./stripeClient.js", () => ({
  getUncachableStripeClient: vi.fn(),
  getStripePublishableKey: vi.fn().mockResolvedValue("pk_test_mock"),
  getStripeSecretKey: vi.fn().mockResolvedValue("sk_test_mock"),
}));

import { registerRoutes } from "./routes.js";
import { getUncachableStripeClient } from "./stripeClient.js";

// ── Typed mock shapes ─────────────────────────────────────────────────────
// Only the fields read by POST /api/subscriptions are included.
interface MockCustomer {
  id: string;
  name: string;
  email: string;
}

interface MockSubscription {
  id: string;
  status: string;
  latest_invoice: {
    payment_intent: { status: string; client_secret: string | null };
  };
}

interface MockPaymentMethod {
  id: string;
  card: { last4: string; brand: string };
}

// Typed parameters for stripe.subscriptions.create so we can access them
// without falling back to implicit `any` from untyped mock.calls arrays.
interface SubscriptionCreateParams {
  customer: string;
  items: Array<{ price: string }>;
  default_payment_method: string;
  expand: string[];
}

// ── Database setup ────────────────────────────────────────────────────────
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run stripe billing tests");
}

// ── Guard: all three tier price IDs must be configured ───────────────────
// Failing here keeps the test suite a strict regression guard: if the env
// loses a price ID, tests fail immediately rather than passing vacuously.
const REQUIRED_PRICE_IDS = {
  tier_1: process.env.STRIPE_PRICE_TIER_1,
  tier_2: process.env.STRIPE_PRICE_TIER_2,
  tier_3: process.env.STRIPE_PRICE_TIER_3,
};

for (const [tier, priceId] of Object.entries(REQUIRED_PRICE_IDS)) {
  if (!priceId) {
    throw new Error(
      `STRIPE_PRICE_TIER_${tier.split("_")[1]} is not configured. ` +
        "All three tier price IDs must be set for billing tests to provide a meaningful regression guard."
    );
  }
}

// After the guard above every value is a non-empty string.
const EXPECTED_PRICE_IDS: Record<string, string> = REQUIRED_PRICE_IDS as Record<string, string>;

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

// ── Test helpers ──────────────────────────────────────────────────────────
const scryptAsync = promisify(scryptCallback);

async function hashPasswordForTest(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Reset mock call history before every test so counts don't bleed across cases
beforeEach(() => {
  vi.clearAllMocks();
});

// ── Shared test fixtures ──────────────────────────────────────────────────
const BILLING_AGENT_EMAIL_PREFIX = `stripe-billing-test-${Date.now()}`;
const BILLING_AGENT_PASSWORD = "BillingTestPass1!";
let billingAgentId: number;
let testApp: ReturnType<typeof express>;
let agentCookie: string[];

// Fake Stripe IDs returned by the mock
const MOCK_CUSTOMER_ID = "cus_test_mock_12345";
const MOCK_SUBSCRIPTION_ID = "sub_test_mock_67890";

// ── Mock Stripe client builder ────────────────────────────────────────────
// Returns a fresh mock client per test so call counts stay isolated.
// Typed mock functions allow accessing call args without escaping to `any`.
function buildMockStripeClient() {
  const mockCustomer: MockCustomer = {
    id: MOCK_CUSTOMER_ID,
    name: "Test Merchant",
    email: "merchant@example.com",
  };

  const mockSubscription: MockSubscription = {
    id: MOCK_SUBSCRIPTION_ID,
    status: "active",
    latest_invoice: {
      payment_intent: { status: "succeeded", client_secret: null },
    },
  };

  const mockPaymentMethod: MockPaymentMethod = {
    id: "pm_test_visa",
    card: { last4: "4242", brand: "visa" },
  };

  return {
    customers: {
      create: vi.fn<(params: Stripe.CustomerCreateParams) => Promise<MockCustomer>>()
        .mockResolvedValue(mockCustomer),
    },
    subscriptions: {
      create: vi.fn<(params: SubscriptionCreateParams) => Promise<MockSubscription>>()
        .mockResolvedValue(mockSubscription),
    },
    paymentMethods: {
      retrieve: vi.fn<(id: string) => Promise<MockPaymentMethod>>()
        .mockResolvedValue(mockPaymentMethod),
    },
  };
}

// Convenience type for the value returned by buildMockStripeClient
type MockStripeClient = ReturnType<typeof buildMockStripeClient>;

beforeAll(async () => {
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: `${BILLING_AGENT_EMAIL_PREFIX}@example.com`,
      password: await hashPasswordForTest(BILLING_AGENT_PASSWORD),
      firstName: "Billing",
      lastName: "Tester",
      currentRank: "agent",
      highestRank: "agent",
    })
    .returning();
  billingAgentId = agent.id;

  testApp = express();
  testApp.use(express.json());
  const httpServer = createServer(testApp);
  await registerRoutes(httpServer, testApp);

  const loginRes = await request(testApp)
    .post("/api/login")
    .send({
      username: `${BILLING_AGENT_EMAIL_PREFIX}@example.com`,
      password: BILLING_AGENT_PASSWORD,
    });
  agentCookie = loginRes.headers["set-cookie"] as unknown as string[];
}, 30000);

afterAll(async () => {
  await db
    .delete(schema.activityLog)
    .where(
      and(
        eq(schema.activityLog.entityType, "subscription"),
        eq(schema.activityLog.actorId, billingAgentId)
      )
    );
  await db
    .delete(schema.subscriptions)
    .where(eq(schema.subscriptions.agentId, billingAgentId));
  await db.delete(schema.agents).where(eq(schema.agents.id, billingAgentId));
  await testPool.end();
});

// Helper: configure the module-level mock to return a specific client
function useMockStripe(mockStripe: MockStripeClient) {
  vi.mocked(getUncachableStripeClient).mockResolvedValue(
    // The mock only implements the subset needed by the route; cast via unknown
    // to satisfy the full Stripe type without introducing an `any` escape.
    mockStripe as unknown as Stripe
  );
}

// ── POST /api/subscriptions – Stripe customer creation ───────────────────
describe("POST /api/subscriptions – creates a Stripe Customer for each tier", () => {
  const tiers = ["tier_1", "tier_2", "tier_3"] as const;

  for (const tier of tiers) {
    it(`calls stripe.customers.create for a ${tier} subscription submitted with a paymentMethodId`, async () => {
      const mockStripe = buildMockStripeClient();
      useMockStripe(mockStripe);

      const merchantName = `Test Merchant ${tier}`;
      const merchantEmail = `merchant-${tier}@example.com`;

      const res = await request(testApp)
        .post("/api/subscriptions")
        .set("Cookie", agentCookie)
        .send({ merchantName, merchantEmail, tier, paymentMethodId: "pm_test_visa" })
        .expect(201);

      expect(mockStripe.customers.create).toHaveBeenCalledTimes(1);
      expect(mockStripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: merchantName,
          email: merchantEmail,
          payment_method: "pm_test_visa",
        })
      );

      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, res.body.id));
    });
  }
});

// ── POST /api/subscriptions – correct price ID per tier ──────────────────
describe("POST /api/subscriptions – passes the correct STRIPE_PRICE_TIER_* price ID per tier", () => {
  const tiers = ["tier_1", "tier_2", "tier_3"] as const;

  for (const tier of tiers) {
    const expectedPriceId = EXPECTED_PRICE_IDS[tier];

    it(`passes ${expectedPriceId} (STRIPE_PRICE_TIER_${tier.split("_")[1]}) to stripe.subscriptions.create for ${tier}`, async () => {
      const mockStripe = buildMockStripeClient();
      useMockStripe(mockStripe);

      const res = await request(testApp)
        .post("/api/subscriptions")
        .set("Cookie", agentCookie)
        .send({
          merchantName: `Price ID Test ${tier}`,
          merchantEmail: `price-test-${tier}@example.com`,
          tier,
          paymentMethodId: "pm_test_visa",
        })
        .expect(201);

      expect(mockStripe.subscriptions.create).toHaveBeenCalledTimes(1);

      // mock.calls is typed because the mock function was given explicit generic params
      const [callArgs] = mockStripe.subscriptions.create.mock.calls[0];
      expect(callArgs.items).toEqual(
        expect.arrayContaining([expect.objectContaining({ price: expectedPriceId })])
      );
      expect(callArgs.customer).toBe(MOCK_CUSTOMER_ID);
      // The route must request invoice/payment_intent expansion so it can inspect
      // the initial payment status immediately after subscription creation.
      expect(callArgs.expand).toContain("latest_invoice.payment_intent");

      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, res.body.id));
    });
  }
});

// ── POST /api/subscriptions – customer ID linked in DB ───────────────────
describe("POST /api/subscriptions – links the Stripe Customer ID to the subscription record", () => {
  const tiers = ["tier_1", "tier_2", "tier_3"] as const;

  for (const tier of tiers) {
    it(`persists stripeCustomerId '${MOCK_CUSTOMER_ID}' on the DB record for ${tier}`, async () => {
      const mockStripe = buildMockStripeClient();
      useMockStripe(mockStripe);

      const res = await request(testApp)
        .post("/api/subscriptions")
        .set("Cookie", agentCookie)
        .send({
          merchantName: `Customer Link Test ${tier}`,
          merchantEmail: `link-test-${tier}@example.com`,
          tier,
          paymentMethodId: "pm_test_visa",
        })
        .expect(201);

      const subId: number = res.body.id;

      expect(res.body.stripeCustomerId).toBe(MOCK_CUSTOMER_ID);

      const [dbSub] = await db
        .select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.id, subId));

      expect(dbSub).toBeDefined();
      expect(dbSub.stripeCustomerId).toBe(MOCK_CUSTOMER_ID);

      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, subId));
    });
  }
});

// ── POST /api/subscriptions – subscription ID linked in DB ───────────────
describe("POST /api/subscriptions – links the Stripe Subscription ID to the subscription record", () => {
  it("persists stripeSubscriptionId on the DB record when tier_1 price ID is configured", async () => {
    const mockStripe = buildMockStripeClient();
    useMockStripe(mockStripe);

    const res = await request(testApp)
      .post("/api/subscriptions")
      .set("Cookie", agentCookie)
      .send({
        merchantName: "Sub ID Link Test",
        merchantEmail: "sub-id-test@example.com",
        tier: "tier_1",
        paymentMethodId: "pm_test_visa",
      })
      .expect(201);

    const subId: number = res.body.id;

    expect(res.body.stripeSubscriptionId).toBe(MOCK_SUBSCRIPTION_ID);

    const [dbSub] = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.id, subId));

    expect(dbSub).toBeDefined();
    expect(dbSub.stripeSubscriptionId).toBe(MOCK_SUBSCRIPTION_ID);

    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, subId));
  });
});

// ── POST /api/subscriptions – no Stripe calls without paymentMethodId ────
describe("POST /api/subscriptions – does NOT call Stripe when no paymentMethodId is provided", () => {
  it("creates a subscription without invoking Stripe when paymentMethodId is omitted", async () => {
    const res = await request(testApp)
      .post("/api/subscriptions")
      .set("Cookie", agentCookie)
      .send({
        merchantName: "Manual Merchant",
        merchantEmail: "manual@example.com",
        tier: "tier_1",
      })
      .expect(201);

    expect(getUncachableStripeClient).not.toHaveBeenCalled();

    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, res.body.id));
  });
});

// ── PATCH /api/subscriptions/:id/payment-method – retry with existing card ─
// Builds a mock Stripe client that supports paying an open invoice plus the
// card-attachment calls used by the new-card flow, so we can assert which
// calls the retry-with-existing-card path skips.
function buildRetryMockStripeClient(invoicePaid = true) {
  const openInvoice = { id: "in_test_open_1", status: "open" };
  return {
    paymentMethods: {
      attach: vi.fn().mockResolvedValue({ id: "pm_test_new" }),
      retrieve: vi.fn().mockResolvedValue({ id: "pm_test_new", card: { last4: "1111", brand: "mastercard" } }),
    },
    customers: {
      update: vi.fn().mockResolvedValue({ id: MOCK_CUSTOMER_ID }),
    },
    subscriptions: {
      update: vi.fn().mockResolvedValue({ id: MOCK_SUBSCRIPTION_ID }),
    },
    invoices: {
      list: vi.fn().mockResolvedValue({ data: [openInvoice] }),
      pay: vi.fn().mockResolvedValue({ id: openInvoice.id, status: invoicePaid ? "paid" : "open" }),
    },
  };
}

async function insertBillableSubscription(overrides: Partial<typeof schema.subscriptions.$inferInsert> = {}) {
  const [sub] = await db
    .insert(schema.subscriptions)
    .values({
      agentId: billingAgentId,
      merchantName: "Retry Test Merchant",
      tier: "tier_1",
      monthlyAmount: "199",
      startDate: new Date(),
      stripeCustomerId: MOCK_CUSTOMER_ID,
      stripeSubscriptionId: MOCK_SUBSCRIPTION_ID,
      stripePaymentMethodId: "pm_test_existing",
      cardLast4: "4242",
      cardBrand: "visa",
      billingStatus: "past_due",
      ...overrides,
    })
    .returning();
  return sub;
}

describe("PATCH /api/subscriptions/:id/payment-method – retry with card on file", () => {
  it("pays the open invoice with the existing payment method and skips re-attaching the card", async () => {
    const mockStripe = buildRetryMockStripeClient(true);
    useMockStripe(mockStripe as unknown as MockStripeClient);
    const sub = await insertBillableSubscription();

    const res = await request(testApp)
      .patch(`/api/subscriptions/${sub.id}/payment-method`)
      .set("Cookie", agentCookie)
      .send({})
      .expect(200);

    // Pays the existing card's open invoice
    expect(mockStripe.invoices.pay).toHaveBeenCalledTimes(1);
    const [, payOpts] = mockStripe.invoices.pay.mock.calls[0];
    expect(payOpts.payment_method).toBe("pm_test_existing");

    // Skips the new-card attachment flow entirely
    expect(mockStripe.paymentMethods.attach).not.toHaveBeenCalled();
    expect(mockStripe.customers.update).not.toHaveBeenCalled();
    expect(mockStripe.subscriptions.update).not.toHaveBeenCalled();

    // Card on file is preserved, billing flips to active
    expect(res.body.cardLast4).toBe("4242");
    expect(res.body.cardBrand).toBe("visa");
    expect(res.body.billingStatus).toBe("active");

    await db.delete(schema.activityLog).where(eq(schema.activityLog.entityId, sub.id));
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });

  it("returns the decline code when the existing card is declined again", async () => {
    const mockStripe = buildRetryMockStripeClient();
    mockStripe.invoices.pay = vi.fn().mockRejectedValue(
      Object.assign(new Error("Your card was declined."), { decline_code: "insufficient_funds" })
    );
    useMockStripe(mockStripe as unknown as MockStripeClient);
    const sub = await insertBillableSubscription();

    const res = await request(testApp)
      .patch(`/api/subscriptions/${sub.id}/payment-method`)
      .set("Cookie", agentCookie)
      .send({})
      .expect(200);

    expect(res.body.billingStatus).toBe("failed");
    expect(res.body.declineCode).toBe("insufficient_funds");

    await db.delete(schema.activityLog).where(eq(schema.activityLog.entityId, sub.id));
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });

  it("rejects a retry when there is no card on file", async () => {
    const mockStripe = buildRetryMockStripeClient();
    useMockStripe(mockStripe as unknown as MockStripeClient);
    const sub = await insertBillableSubscription({ stripePaymentMethodId: null, cardLast4: null, cardBrand: null });

    await request(testApp)
      .patch(`/api/subscriptions/${sub.id}/payment-method`)
      .set("Cookie", agentCookie)
      .send({})
      .expect(400);

    expect(mockStripe.invoices.pay).not.toHaveBeenCalled();

    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });
});

// ── POST /api/subscriptions – graceful fallback when STRIPE_PRICE_TIER_* missing ─
//
// When a tier's STRIPE_PRICE_TIER_* env var is not configured, the route MUST
// still succeed: it creates the Stripe Customer and persists the subscription
// record, but intentionally skips stripe.subscriptions.create (no billing
// starts). CONFIG.stripePriceIds in routes.ts is snapshotted from process.env
// at module-load time, so to simulate the missing config we must delete the env
// var, reset the module registry, and re-import routes.ts into a fresh app.
describe("POST /api/subscriptions – gracefully skips billing when the tier price ID is missing", () => {
  const TARGET_TIER = "tier_1" as const;
  const MISSING_AGENT_EMAIL = `stripe-missing-price-test-${Date.now()}@example.com`;
  const MISSING_AGENT_PASSWORD = "MissingPricePass1!";

  let missingApp: ReturnType<typeof express>;
  let missingCookie: string[];
  let missingAgentId: number;
  let missingMockStripe: MockStripeClient;
  let savedPriceId: string | undefined;

  beforeAll(async () => {
    // Clear the tier price ID before re-importing routes.ts so its CONFIG
    // snapshot sees an unset STRIPE_PRICE_TIER_1.
    savedPriceId = process.env.STRIPE_PRICE_TIER_1;
    delete process.env.STRIPE_PRICE_TIER_1;

    vi.resetModules();
    // Re-import the (still-mocked) stripe client and routes so the freshly
    // evaluated CONFIG reflects the missing env var.
    const stripeClientMod = await import("./stripeClient.js");
    const routesMod = await import("./routes.js");

    missingMockStripe = buildMockStripeClient();
    vi.mocked(stripeClientMod.getUncachableStripeClient).mockResolvedValue(
      missingMockStripe as unknown as Stripe
    );

    const [agent] = await db
      .insert(schema.agents)
      .values({
        email: MISSING_AGENT_EMAIL,
        password: await hashPasswordForTest(MISSING_AGENT_PASSWORD),
        firstName: "Missing",
        lastName: "Price",
        currentRank: "agent",
        highestRank: "agent",
      })
      .returning();
    missingAgentId = agent.id;

    missingApp = express();
    missingApp.use(express.json());
    const httpServer = createServer(missingApp);
    await routesMod.registerRoutes(httpServer, missingApp);

    const loginRes = await request(missingApp)
      .post("/api/login")
      .send({ username: MISSING_AGENT_EMAIL, password: MISSING_AGENT_PASSWORD });
    missingCookie = loginRes.headers["set-cookie"] as unknown as string[];
  }, 30000);

  afterAll(async () => {
    // Restore the env var so later module loads / other files are unaffected.
    if (savedPriceId !== undefined) {
      process.env.STRIPE_PRICE_TIER_1 = savedPriceId;
    }
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.agentId, missingAgentId));
    await db.delete(schema.agents).where(eq(schema.agents.id, missingAgentId));
    vi.resetModules();
  });

  it("returns 201 and links the Stripe Customer but never calls stripe.subscriptions.create", async () => {
    const res = await request(missingApp)
      .post("/api/subscriptions")
      .set("Cookie", missingCookie)
      .send({
        merchantName: "Missing Price Merchant",
        merchantEmail: "missing-price@example.com",
        tier: TARGET_TIER,
        paymentMethodId: "pm_test_visa",
      })
      .expect(201);

    // Customer is still created and linked…
    expect(missingMockStripe.customers.create).toHaveBeenCalledTimes(1);
    expect(res.body.stripeCustomerId).toBe(MOCK_CUSTOMER_ID);

    // …but no subscription/billing is started because the price ID is missing.
    expect(missingMockStripe.subscriptions.create).not.toHaveBeenCalled();

    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, res.body.id));
  });

  it("persists a stripeCustomerId but leaves stripeSubscriptionId null on the DB record", async () => {
    const res = await request(missingApp)
      .post("/api/subscriptions")
      .set("Cookie", missingCookie)
      .send({
        merchantName: "Missing Price DB Merchant",
        merchantEmail: "missing-price-db@example.com",
        tier: TARGET_TIER,
        paymentMethodId: "pm_test_visa",
      })
      .expect(201);

    const subId: number = res.body.id;

    const [dbSub] = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.id, subId));

    expect(dbSub).toBeDefined();
    expect(dbSub.stripeCustomerId).toBe(MOCK_CUSTOMER_ID);
    expect(dbSub.stripeSubscriptionId).toBeNull();

    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, subId));
  });
});
