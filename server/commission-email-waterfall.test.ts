/**
 * Tests verifying that the "commission earned" email is actually sent (or
 * suppressed) based on each recipient agent's emailOnCommissionEarned
 * preference, across the three deal/binary commission notification paths:
 *
 *   1. MAC sponsor override  (triggerCommissionWaterfall → POST /api/admin/deals/:id/approve)
 *   2. TFC fulfillment       (triggerCommissionWaterfall → POST /api/admin/deals/:id/approve)
 *   3. Binary bonus          (POST /api/admin/commissions/calculate)
 *
 * The subscription_commission / subscription_residual paths are covered
 * separately in commission-emails.test.ts.
 *
 * emailService is fully mocked so no real emails are ever sent and no
 * RESEND_API_KEY is required.
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@shared/schema";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import { registerRoutes } from "./routes.js";
import { scrypt as scryptCallback, randomBytes } from "crypto";
import { promisify } from "util";

// ── Mock emailService BEFORE routes are imported ──────────────────────────────
vi.mock("./email.js", () => ({
  emailService: {
    sendSubscriptionPausedEmail: vi.fn().mockResolvedValue(undefined),
    sendSubscriptionCancelledEmail: vi.fn().mockResolvedValue(undefined),
    sendSubscriptionReactivatedEmail: vi.fn().mockResolvedValue(undefined),
    sendSubscriptionExpiredEmail: vi.fn().mockResolvedValue(undefined),
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendDealFundedEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendTeamSignupEmail: vi.fn().mockResolvedValue(undefined),
    sendCommissionEarnedEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

import { emailService } from "./email.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run commission email waterfall tests");
}

const scryptAsync = promisify(scryptCallback);

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const TS = Date.now();
const EMAIL_PREFIX = `comm-wf-${TS}`;
const PASSWORD = "CommWf1!";

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

let testApp: ReturnType<typeof express>;
let adminId: number;
let adminCookie: string[];

type CommissionEmailPrefs = {
  emailOnCommissionEarned?: boolean;
  emailOnDealFunded?: boolean;
};

let agentSeq = 0;

async function createAgent(
  opts: {
    prefs?: CommissionEmailPrefs;
    sponsorId?: number;
    placementId?: number;
    leg?: "left" | "right";
    currentRank?: "agent" | "builder" | "leader" | "director" | "partner";
  } = {}
) {
  agentSeq += 1;
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: `${EMAIL_PREFIX}-${agentSeq}@example.com`,
      password: await hashPassword(PASSWORD),
      firstName: "Waterfall",
      lastName: `Tester${agentSeq}`,
      currentRank: opts.currentRank ?? "agent",
      highestRank: opts.currentRank ?? "agent",
      status: "active",
      sponsorId: opts.sponsorId ?? null,
      placementId: opts.placementId ?? null,
      leg: opts.leg ?? null,
      emailPreferences: opts.prefs ?? {},
    })
    .returning();
  return agent;
}

/**
 * Create a pending MCA deal owned by `agentId`. companyRevenue and gbrAmount
 * default to a non-zero value so the waterfall produces commissions.
 */
async function createDeal(
  agentId: number,
  opts: { fulfillmentAgentId?: number; status?: "pending" | "funded" } = {}
) {
  const [deal] = await db
    .insert(schema.deals)
    .values({
      agentId,
      merchantName: "Waterfall Test Merchant",
      loanAmount: "50000.00",
      companyRevenue: "10000.00",
      gbrAmount: "10000.00",
      fulfillmentAgentId: opts.fulfillmentAgentId ?? null,
      status: opts.status ?? "pending",
      // This suite locks the LEGACY MCA waterfall; create legacy deals so the
      // going-forward v2026 default doesn't apply.
      commissionModel: "legacy",
    })
    .returning();
  return deal;
}

async function cleanup(agentIds: number[], dealIds: number[] = []) {
  if (agentIds.length > 0) {
    await db.delete(schema.holdbacks).where(inArray(schema.holdbacks.agentId, agentIds));
    await db.delete(schema.commissions).where(inArray(schema.commissions.agentId, agentIds));
    await db.delete(schema.notifications).where(inArray(schema.notifications.agentId, agentIds));
    await db.delete(schema.deals).where(inArray(schema.deals.agentId, agentIds));
  }
  if (dealIds.length > 0) {
    await db
      .delete(schema.activityLog)
      .where(
        inArray(
          schema.activityLog.entityId,
          dealIds
        )
      );
  }
  if (agentIds.length > 0) {
    await db.delete(schema.agents).where(inArray(schema.agents.id, agentIds));
  }
}

function shortDelay(ms = 50) {
  return new Promise((r) => setTimeout(r, ms));
}

function callsForEmail(email: string): unknown[][] {
  const calls = (emailService.sendCommissionEarnedEmail as ReturnType<typeof vi.fn>).mock.calls;
  return calls.filter((args: unknown[]) => args[0] === email);
}

beforeAll(async () => {
  const [admin] = await db
    .insert(schema.agents)
    .values({
      email: `${EMAIL_PREFIX}-admin@example.com`,
      password: await hashPassword(PASSWORD),
      firstName: "Admin",
      lastName: "CommWf",
      currentRank: "agent",
      highestRank: "agent",
      isAdmin: true,
    })
    .returning();
  adminId = admin.id;

  testApp = express();
  testApp.use(express.json());
  const httpServer = createServer(testApp);
  await registerRoutes(httpServer, testApp);

  const loginRes = await request(testApp)
    .post("/api/login")
    .send({ username: `${EMAIL_PREFIX}-admin@example.com`, password: PASSWORD });
  adminCookie = loginRes.headers["set-cookie"] as unknown as string[];
}, 30000);

afterAll(async () => {
  await db.delete(schema.agents).where(eq(schema.agents.id, adminId));
  await testPool.end();
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ── 1. MAC sponsor override path ──────────────────────────────────────────────

describe("deal approval waterfall – MAC sponsor override email", () => {
  it("sends a commission earned email to the sponsor when emailOnCommissionEarned is true", async () => {
    const sponsor = await createAgent({ prefs: { emailOnCommissionEarned: true } });
    const primary = await createAgent({ sponsorId: sponsor.id });
    const deal = await createDeal(primary.id);

    await request(testApp)
      .post(`/api/admin/deals/${deal.id}/approve`)
      .set("Cookie", adminCookie)
      .expect(200);

    await shortDelay();

    const sponsorCalls = callsForEmail(sponsor.email);
    expect(sponsorCalls.length).toBe(1);
    expect(sponsorCalls[0][1]).toEqual(
      expect.objectContaining({
        firstName: sponsor.firstName,
        commissionType: "L1 Sponsor Override",
      })
    );

    await cleanup([sponsor.id, primary.id], [deal.id]);
  });

  it("does NOT send a commission earned email to the sponsor when emailOnCommissionEarned is false", async () => {
    const sponsor = await createAgent({ prefs: { emailOnCommissionEarned: false } });
    const primary = await createAgent({ sponsorId: sponsor.id });
    const deal = await createDeal(primary.id);

    await request(testApp)
      .post(`/api/admin/deals/${deal.id}/approve`)
      .set("Cookie", adminCookie)
      .expect(200);

    await shortDelay();

    expect(callsForEmail(sponsor.email).length).toBe(0);

    await cleanup([sponsor.id, primary.id], [deal.id]);
  });
});

// ── 2. TFC fulfillment path ───────────────────────────────────────────────────

describe("deal approval waterfall – TFC fulfillment email", () => {
  it("sends a commission earned email to the fulfillment agent when emailOnCommissionEarned is true", async () => {
    const fulfillment = await createAgent({ prefs: { emailOnCommissionEarned: true } });
    const primary = await createAgent();
    const deal = await createDeal(primary.id, { fulfillmentAgentId: fulfillment.id });

    await request(testApp)
      .post(`/api/admin/deals/${deal.id}/approve`)
      .set("Cookie", adminCookie)
      .expect(200);

    await shortDelay();

    const fulfillmentCalls = callsForEmail(fulfillment.email);
    expect(fulfillmentCalls.length).toBe(1);
    expect(fulfillmentCalls[0][1]).toEqual(
      expect.objectContaining({
        firstName: fulfillment.firstName,
        commissionType: "Transaction Fulfillment Compensation (TFC)",
      })
    );

    await cleanup([fulfillment.id, primary.id], [deal.id]);
  });

  it("does NOT send a commission earned email to the fulfillment agent when emailOnCommissionEarned is false", async () => {
    const fulfillment = await createAgent({ prefs: { emailOnCommissionEarned: false } });
    const primary = await createAgent();
    const deal = await createDeal(primary.id, { fulfillmentAgentId: fulfillment.id });

    await request(testApp)
      .post(`/api/admin/deals/${deal.id}/approve`)
      .set("Cookie", adminCookie)
      .expect(200);

    await shortDelay();

    expect(callsForEmail(fulfillment.email).length).toBe(0);

    await cleanup([fulfillment.id, primary.id], [deal.id]);
  });
});

// ── 2a. Deal funded email to the primary (owning) agent ──────────────────────
//
// The deal's owning agent gets a separate "Deal Funded" email gated by the
// emailOnDealFunded preference (not emailOnCommissionEarned). Both the legacy
// and v2026 waterfalls have this gate.

function dealFundedCallsForEmail(email: string): unknown[][] {
  const calls = (emailService.sendDealFundedEmail as ReturnType<typeof vi.fn>).mock.calls;
  return calls.filter((args: unknown[]) => args[0] === email);
}

describe("deal approval waterfall – deal funded email (legacy)", () => {
  it("sends a deal funded email to the owning agent when emailOnDealFunded is true", async () => {
    const primary = await createAgent({ prefs: { emailOnDealFunded: true } });
    const deal = await createDeal(primary.id);

    await request(testApp)
      .post(`/api/admin/deals/${deal.id}/approve`)
      .set("Cookie", adminCookie)
      .expect(200);

    await shortDelay();

    const calls = dealFundedCallsForEmail(primary.email);
    expect(calls.length).toBe(1);
    expect(calls[0][1]).toEqual(
      expect.objectContaining({
        firstName: primary.firstName,
        merchantName: deal.merchantName,
        amount: Number(deal.loanAmount),
      })
    );

    await cleanup([primary.id], [deal.id]);
  });

  it("sends a deal funded email when the preference is absent (default on)", async () => {
    const primary = await createAgent(); // prefs: {}
    const deal = await createDeal(primary.id);

    await request(testApp)
      .post(`/api/admin/deals/${deal.id}/approve`)
      .set("Cookie", adminCookie)
      .expect(200);

    await shortDelay();

    expect(dealFundedCallsForEmail(primary.email).length).toBe(1);

    await cleanup([primary.id], [deal.id]);
  });

  it("does NOT send a deal funded email when emailOnDealFunded is false", async () => {
    const primary = await createAgent({ prefs: { emailOnDealFunded: false } });
    const deal = await createDeal(primary.id);

    await request(testApp)
      .post(`/api/admin/deals/${deal.id}/approve`)
      .set("Cookie", adminCookie)
      .expect(200);

    await shortDelay();

    expect(dealFundedCallsForEmail(primary.email).length).toBe(0);

    await cleanup([primary.id], [deal.id]);
  });
});

describe("deal approval waterfall – deal funded email (v2026)", () => {
  async function createV2026Deal(agentId: number) {
    const [deal] = await db
      .insert(schema.deals)
      .values({
        agentId,
        merchantName: "Waterfall V2026 Merchant",
        loanAmount: "50000.00",
        companyRevenue: "10000.00",
        gbrAmount: "10000.00",
        status: "pending",
        commissionModel: "v2026",
      })
      .returning();
    return deal;
  }

  it("sends a deal funded email to the owning agent when emailOnDealFunded is true", async () => {
    const primary = await createAgent({ prefs: { emailOnDealFunded: true } });
    const deal = await createV2026Deal(primary.id);

    await request(testApp)
      .post(`/api/admin/deals/${deal.id}/approve`)
      .set("Cookie", adminCookie)
      .expect(200);

    await shortDelay();

    expect(dealFundedCallsForEmail(primary.email).length).toBe(1);

    await cleanup([primary.id], [deal.id]);
  });

  it("does NOT send a deal funded email when emailOnDealFunded is false", async () => {
    const primary = await createAgent({ prefs: { emailOnDealFunded: false } });
    const deal = await createV2026Deal(primary.id);

    await request(testApp)
      .post(`/api/admin/deals/${deal.id}/approve`)
      .set("Cookie", adminCookie)
      .expect(200);

    await shortDelay();

    expect(dealFundedCallsForEmail(primary.email).length).toBe(0);

    await cleanup([primary.id], [deal.id]);
  });
});

// ── 2b. v2026 MCA accelerator path ────────────────────────────────────────────
//
// Proves that the v2026 MCA engine sources real, per-record accelerators
// (subscription attachment + repeat merchant) and persists a non-zero
// accelerator payout (fast_start) to the opening agent when a funded deal
// qualifies. Independent agency model → no upline override, isolating the
// accelerator math.

describe("deal approval waterfall – v2026 MCA accelerator", () => {
  it("persists a fast_start accelerator (sub-attachment + repeat-merchant) for a qualifying v2026 deal", async () => {
    const agent = await createAgent();
    const MERCHANT = `Accel Merchant ${TS}`;

    // Prior funded deal for the SAME merchant → repeat-merchant accelerator (+1%).
    const [priorDeal] = await db
      .insert(schema.deals)
      .values({
        agentId: agent.id,
        merchantName: MERCHANT,
        loanAmount: "40000.00",
        companyRevenue: "8000.00",
        gbrAmount: "8000.00",
        status: "funded",
        commissionModel: "legacy",
      })
      .returning();

    // The deal under test (v2026), gross 10000.
    const [deal] = await db
      .insert(schema.deals)
      .values({
        agentId: agent.id,
        merchantName: MERCHANT,
        loanAmount: "50000.00",
        companyRevenue: "10000.00",
        gbrAmount: "10000.00",
        status: "pending",
        commissionModel: "v2026",
      })
      .returning();

    // Subscription paired to this deal → subscription-attachment accelerator (+1%).
    const [sub] = await db
      .insert(schema.subscriptions)
      .values({
        agentId: agent.id,
        merchantName: MERCHANT,
        tier: "tier_3",
        monthlyAmount: "697.00",
        status: "active",
        startDate: new Date(),
        mcaPairedDealId: deal.id,
        commissionModel: "v2026",
      })
      .returning();

    await request(testApp)
      .post(`/api/admin/deals/${deal.id}/approve`)
      .set("Cookie", adminCookie)
      .expect(200);

    await shortDelay();

    const commissions = await db
      .select()
      .from(schema.commissions)
      .where(eq(schema.commissions.agentId, agent.id));

    const fastStart = commissions.find((c) => c.type === "fast_start" && c.dealId === deal.id);
    expect(fastStart).toBeDefined();
    // gross 10000 × (0.01 sub-attachment + 0.01 repeat-merchant) = 200.00
    expect(fastStart!.amount).toBe("200.00");

    // Opening-agent producer payout (independent → full 32.5% opening pool),
    // 70% immediately released: 10000 × 0.325 × 0.70 = 2275.00
    const macPrimary = commissions.find((c) => c.type === "mac_primary" && c.dealId === deal.id);
    expect(macPrimary!.amount).toBe("2275.00");

    await db.delete(schema.commissions).where(eq(schema.commissions.agentId, agent.id));
    await db.delete(schema.holdbacks).where(eq(schema.holdbacks.agentId, agent.id));
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
    await db.delete(schema.notifications).where(eq(schema.notifications.agentId, agent.id));
    await cleanup([agent.id], [deal.id, priorDeal.id]);
  });
});

// ── 3. Binary bonus path ──────────────────────────────────────────────────────
//
// The binary bonus route pays the weaker leg. We place one funded-deal child on
// each leg of the earner so that min(left, right) > 0 triggers a bonus.

async function buildBinaryTree(prefs: CommissionEmailPrefs) {
  const earner = await createAgent({ prefs, currentRank: "builder" });
  const leftChild = await createAgent({ placementId: earner.id, leg: "left" });
  const rightChild = await createAgent({ placementId: earner.id, leg: "right" });
  // Funded deals supply the leg volume that drives the binary bonus.
  const leftDeal = await createDeal(leftChild.id, { status: "funded" });
  const rightDeal = await createDeal(rightChild.id, { status: "funded" });
  return { earner, leftChild, rightChild, leftDeal, rightDeal };
}

describe("binary bonus calculation – commission earned email", () => {
  it("sends a commission earned email to the earner when emailOnCommissionEarned is true", async () => {
    const { earner, leftChild, rightChild, leftDeal, rightDeal } = await buildBinaryTree({
      emailOnCommissionEarned: true,
    });

    await request(testApp)
      .post("/api/admin/commissions/calculate")
      .set("Cookie", adminCookie)
      .expect(200);

    await shortDelay();

    const earnerCalls = callsForEmail(earner.email);
    expect(earnerCalls.length).toBe(1);
    expect(earnerCalls[0][1]).toEqual(
      expect.objectContaining({
        firstName: earner.firstName,
        commissionType: "Binary Bonus",
      })
    );

    await cleanup(
      [earner.id, leftChild.id, rightChild.id],
      [leftDeal.id, rightDeal.id]
    );
  });

  it("does NOT send a commission earned email to the earner when emailOnCommissionEarned is false", async () => {
    const { earner, leftChild, rightChild, leftDeal, rightDeal } = await buildBinaryTree({
      emailOnCommissionEarned: false,
    });

    await request(testApp)
      .post("/api/admin/commissions/calculate")
      .set("Cookie", adminCookie)
      .expect(200);

    await shortDelay();

    expect(callsForEmail(earner.email).length).toBe(0);

    await cleanup(
      [earner.id, leftChild.id, rightChild.id],
      [leftDeal.id, rightDeal.id]
    );
  });
});
