import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type Stripe from "stripe";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@shared/schema";
import express from "express";
import request from "supertest";

// ── Webhook signature verification must pass for the route to fire ────────
// processWebhook reads STRIPE_WEBHOOK_SECRET first; a truthy value is enough
// because stripe.webhooks.constructEvent is mocked to return our synthetic
// event regardless of the raw payload/signature.
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_mock";

// ── Mock the Stripe client before any module that uses it is imported ──────
// vi.mock is hoisted by Vitest so it runs before static imports, ensuring
// WebhookHandlers receives the mocked client when it calls
// getUncachableStripeClient().
vi.mock("./stripeClient.js", () => ({
  getUncachableStripeClient: vi.fn(),
  getStripePublishableKey: vi.fn().mockResolvedValue("pk_test_mock"),
  getStripeSecretKey: vi.fn().mockResolvedValue("sk_test_mock"),
}));

import { WebhookHandlers } from "./webhookHandlers.js";
import { getUncachableStripeClient } from "./stripeClient.js";

// ── Database setup ────────────────────────────────────────────────────────
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run stripe webhook tests");
}

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

// ── Fixtures ──────────────────────────────────────────────────────────────
const TEST_EMAIL_PREFIX = `stripe-webhook-test-${Date.now()}`;
const STRIPE_SUBSCRIPTION_ID = `sub_webhook_test_${Date.now()}`;
let testAgentId: number;
let testSubscriptionId: number;
let testApp: ReturnType<typeof express>;

// Builds an invoice.paid event with a single line item whose period.end is one
// month out, mirroring the shape Stripe actually delivers.
function buildInvoicePaidEvent(stripeSubscriptionId: string): Stripe.Event {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    id: "evt_test_invoice_paid",
    type: "invoice.paid",
    data: {
      object: {
        id: "in_test_paid_1",
        subscription: stripeSubscriptionId,
        lines: {
          data: [{ period: { end: nowSec + 30 * 24 * 60 * 60 } }],
        },
      },
    },
  } as unknown as Stripe.Event;
}

// Mirrors the production webhook mount in server/index.ts: express.raw body so
// the handler receives a Buffer, then delegate to WebhookHandlers.processWebhook.
function buildWebhookApp() {
  const app = express();
  app.post(
    "/api/webhooks/stripe",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const signature = req.headers["stripe-signature"];
      if (!signature) {
        return res.status(400).json({ error: "Missing stripe-signature header" });
      }
      try {
        const sig = Array.isArray(signature) ? signature[0] : signature;
        await WebhookHandlers.processWebhook(req.body as Buffer, sig);
        res.status(200).json({ received: true });
      } catch (error: any) {
        res.status(400).json({ error: "Webhook processing error" });
      }
    },
  );
  return app;
}

// Wires the mocked stripe client so signature verification returns a chosen event.
function useMockStripeWithEvent(event: Stripe.Event) {
  const mockStripe = {
    webhooks: {
      constructEvent: vi.fn<() => Stripe.Event>().mockReturnValue(event),
    },
  };
  vi.mocked(getUncachableStripeClient).mockResolvedValue(
    mockStripe as unknown as Stripe,
  );
  return mockStripe;
}

beforeAll(async () => {
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: `${TEST_EMAIL_PREFIX}@example.com`,
      password: "x",
      firstName: "Webhook",
      lastName: "Tester",
      currentRank: "agent",
      highestRank: "agent",
    })
    .returning();
  testAgentId = agent.id;
}, 30000);

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(async () => {
  await db.delete(schema.commissions).where(eq(schema.commissions.agentId, testAgentId));
  await db.delete(schema.subscriptions).where(eq(schema.subscriptions.agentId, testAgentId));
  await db.delete(schema.agents).where(eq(schema.agents.id, testAgentId));
  await testPool.end();
});

// Inserts a Stripe-billed subscription starting "now" so the decay window is
// months1to3 (decayRate = 1.00), making the expected commission deterministic.
async function insertStripeSubscription(
  overrides: Partial<typeof schema.subscriptions.$inferInsert> = {},
) {
  const [sub] = await db
    .insert(schema.subscriptions)
    .values({
      agentId: testAgentId,
      merchantName: "Webhook Merchant",
      tier: "tier_1",
      monthlyAmount: "149",
      startDate: new Date(),
      stripeSubscriptionId: STRIPE_SUBSCRIPTION_ID,
      stripeCustomerId: "cus_webhook_test",
      billingStatus: "active",
      // This suite locks the LEGACY subscription commission math; create legacy
      // records explicitly so the going-forward v2026 default doesn't apply.
      commissionModel: "legacy",
      ...overrides,
    })
    .returning();
  testSubscriptionId = sub.id;
  return sub;
}

describe("POST /api/webhooks/stripe – invoice.paid fires subscription commissions", () => {
  beforeAll(() => {
    testApp = buildWebhookApp();
  });

  it("creates a commission for the linked agent when invoice.paid is received", async () => {
    const sub = await insertStripeSubscription();
    useMockStripeWithEvent(buildInvoicePaidEvent(STRIPE_SUBSCRIPTION_ID));

    await request(testApp)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "t=1,v1=mocksig")
      .set("Content-Type", "application/json")
      .send(Buffer.from(JSON.stringify({ id: "evt_test_invoice_paid" })))
      .expect(200);

    const commissions = await db
      .select()
      .from(schema.commissions)
      .where(eq(schema.commissions.subscriptionId, sub.id));

    const agentCommission = commissions.find((c) => c.agentId === testAgentId);
    expect(agentCommission).toBeDefined();
    expect(agentCommission!.type).toBe("subscription_commission");
    // tier_1: poolRate 0.25 × decay 1.00 (months1to3) × $149 = $37.25
    expect(Number(agentCommission!.amount)).toBeCloseTo(37.25, 2);

    await db.delete(schema.commissions).where(eq(schema.commissions.subscriptionId, sub.id));
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });

  it("calculates the tier_2 commission using pool rate × decay", async () => {
    const sub = await insertStripeSubscription({ tier: "tier_2", monthlyAmount: "397" });
    useMockStripeWithEvent(buildInvoicePaidEvent(STRIPE_SUBSCRIPTION_ID));

    await request(testApp)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "t=1,v1=mocksig")
      .set("Content-Type", "application/json")
      .send(Buffer.from(JSON.stringify({ id: "evt_test_invoice_paid" })))
      .expect(200);

    const [agentCommission] = await db
      .select()
      .from(schema.commissions)
      .where(eq(schema.commissions.subscriptionId, sub.id));

    expect(agentCommission).toBeDefined();
    // tier_2: poolRate 0.35 × decay 1.00 × $397 = $138.95
    expect(Number(agentCommission.amount)).toBeCloseTo(138.95, 2);

    await db.delete(schema.commissions).where(eq(schema.commissions.subscriptionId, sub.id));
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });

  it("does not fire a commission when the subscription is unknown", async () => {
    useMockStripeWithEvent(buildInvoicePaidEvent("sub_does_not_exist_xyz"));

    await request(testApp)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "t=1,v1=mocksig")
      .set("Content-Type", "application/json")
      .send(Buffer.from(JSON.stringify({ id: "evt_test_invoice_paid" })))
      .expect(200);

    const commissions = await db
      .select()
      .from(schema.commissions)
      .where(eq(schema.commissions.agentId, testAgentId));
    expect(commissions.length).toBe(0);
  });
});

// ── Upline override commissions ────────────────────────────────────────────
// Tests that both L1 and L2 sponsors earn subscription_residual overrides when
// invoice.paid fires for their downline agent's subscription.
//
// Formula (legacy model, months1to3 decay = 1.00):
//   L1 = monthlyAmount × poolRate × l1Rate × decayRate
//   L2 = monthlyAmount × poolRate × l2Rate × decayRate
// For tier_1 ($149, poolRate 0.25):
//   L1 = 149 × 0.25 × 0.10 × 1.00 = 3.725
//   L2 = 149 × 0.25 × 0.05 × 1.00 = 1.8625

describe("POST /api/webhooks/stripe – invoice.paid fires upline override commissions", () => {
  // Three-level chain: l2Sponsor → l1Sponsor → sellingAgent
  const UPLINE_EMAIL_PREFIX = `stripe-webhook-upline-${Date.now()}`;
  const UPLINE_STRIPE_SUB_ID = `sub_upline_test_${Date.now()}`;
  let l2SponsorId: number;
  let l1SponsorId: number;
  let sellingAgentId: number;
  let uplineSubId: number;
  let uplineApp: ReturnType<typeof express>;

  beforeAll(async () => {
    // L2 sponsor — top of chain (no sponsor)
    const [l2] = await db
      .insert(schema.agents)
      .values({
        email: `${UPLINE_EMAIL_PREFIX}-l2@example.com`,
        password: "x",
        firstName: "L2",
        lastName: "Sponsor",
        currentRank: "agent",
        highestRank: "agent",
      })
      .returning();
    l2SponsorId = l2.id;

    // L1 sponsor — sponsored by L2
    const [l1] = await db
      .insert(schema.agents)
      .values({
        email: `${UPLINE_EMAIL_PREFIX}-l1@example.com`,
        password: "x",
        firstName: "L1",
        lastName: "Sponsor",
        currentRank: "agent",
        highestRank: "agent",
        sponsorId: l2SponsorId,
      })
      .returning();
    l1SponsorId = l1.id;

    // Selling agent — sponsored by L1
    const [seller] = await db
      .insert(schema.agents)
      .values({
        email: `${UPLINE_EMAIL_PREFIX}-seller@example.com`,
        password: "x",
        firstName: "Selling",
        lastName: "Agent",
        currentRank: "agent",
        highestRank: "agent",
        sponsorId: l1SponsorId,
      })
      .returning();
    sellingAgentId = seller.id;

    // Stripe-billed tier_1 subscription for the selling agent
    const [sub] = await db
      .insert(schema.subscriptions)
      .values({
        agentId: sellingAgentId,
        merchantName: "Upline Merchant",
        tier: "tier_1",
        monthlyAmount: "149",
        startDate: new Date(),
        stripeSubscriptionId: UPLINE_STRIPE_SUB_ID,
        stripeCustomerId: "cus_upline_test",
        billingStatus: "active",
        // Lock to legacy model so pool×decay math applies
        commissionModel: "legacy",
      })
      .returning();
    uplineSubId = sub.id;

    uplineApp = buildWebhookApp();
  }, 30000);

  afterAll(async () => {
    // Clean commissions for all three agents, then subscriptions, then agents
    // (selling agent first so the sponsorId FK chain unwinds cleanly)
    for (const agentId of [sellingAgentId, l1SponsorId, l2SponsorId]) {
      await db
        .delete(schema.commissions)
        .where(eq(schema.commissions.agentId, agentId));
    }
    await db
      .delete(schema.subscriptions)
      .where(eq(schema.subscriptions.id, uplineSubId));
    await db
      .delete(schema.agents)
      .where(eq(schema.agents.id, sellingAgentId));
    await db
      .delete(schema.agents)
      .where(eq(schema.agents.id, l1SponsorId));
    await db
      .delete(schema.agents)
      .where(eq(schema.agents.id, l2SponsorId));
  });

  it("creates subscription_residual commissions for L1 and L2 sponsors with correct amounts and sourceAgentId", async () => {
    useMockStripeWithEvent(buildInvoicePaidEvent(UPLINE_STRIPE_SUB_ID));

    await request(uplineApp)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "t=1,v1=mocksig")
      .set("Content-Type", "application/json")
      .send(Buffer.from(JSON.stringify({ id: "evt_test_upline_paid" })))
      .expect(200);

    // Fetch all commissions linked to this subscription
    const commissions = await db
      .select()
      .from(schema.commissions)
      .where(eq(schema.commissions.subscriptionId, uplineSubId));

    // ── L1 sponsor ────────────────────────────────────────────────────────
    // 149 × 0.25 (poolRate) × 0.10 (l1Rate) × 1.00 (decay months1to3) = 3.725
    const l1Commission = commissions.find((c) => c.agentId === l1SponsorId);
    expect(l1Commission).toBeDefined();
    expect(l1Commission!.type).toBe("subscription_residual");
    expect(l1Commission!.sourceAgentId).toBe(sellingAgentId);
    expect(Number(l1Commission!.amount)).toBeCloseTo(3.725, 2);

    // ── L2 sponsor ────────────────────────────────────────────────────────
    // 149 × 0.25 (poolRate) × 0.05 (l2Rate) × 1.00 (decay months1to3) = 1.8625
    const l2Commission = commissions.find((c) => c.agentId === l2SponsorId);
    expect(l2Commission).toBeDefined();
    expect(l2Commission!.type).toBe("subscription_residual");
    expect(l2Commission!.sourceAgentId).toBe(sellingAgentId);
    // Handler stores toFixed(2) → 1.86; match to 2 decimal places
    expect(Number(l2Commission!.amount)).toBeCloseTo(1.86, 2);
  });
});
