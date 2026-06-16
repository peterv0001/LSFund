/**
 * Tests verifying that commission earned emails are sent (or suppressed) when
 * POST /api/admin/subscriptions/calculate-commissions runs.
 *
 * emailService is fully mocked so no real emails are ever sent and no
 * RESEND_API_KEY is required.
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray, like } from "drizzle-orm";
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
  throw new Error("DATABASE_URL must be set to run commission email tests");
}

const scryptAsync = promisify(scryptCallback);

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const TS = Date.now();
const AGENT_EMAIL_PREFIX = `comm-email-agent-${TS}`;
const ADMIN_EMAIL_PREFIX = `comm-email-admin-${TS}`;
const PASSWORD = "CommEmail1!";

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
};

async function createAgent(suffix: string, prefs: CommissionEmailPrefs = {}) {
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: `${AGENT_EMAIL_PREFIX}-${suffix}@example.com`,
      password: await hashPassword(PASSWORD),
      firstName: "Commission",
      lastName: "Tester",
      currentRank: "agent",
      highestRank: "agent",
      emailPreferences: prefs,
    })
    .returning();
  return agent;
}

/**
 * Creates an active subscription eligible for commission calculation.
 * billingStatus is left null so the route treats it as a legacy active sub.
 *
 * @param agentId   The owning agent's ID
 * @param startDate Optional start date; defaults to "2 months ago" (produces
 *                  subscription_commission type). Pass a date >12 months ago
 *                  to trigger subscription_residual.
 */
async function createActiveSubscription(agentId: number, startDate?: Date) {
  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

  const [sub] = await db
    .insert(schema.subscriptions)
    .values({
      agentId,
      merchantName: "Commission Test Merchant",
      tier: "tier_1",
      monthlyAmount: "199.00",
      status: "active",
      startDate: startDate ?? twoMonthsAgo,
      // This suite locks the LEGACY calculate-commissions email/notification
      // behavior; create legacy records so the v2026 default doesn't apply
      // (notably tier_1 residual = 0% under v2026 would fire no commission).
      commissionModel: "legacy",
    })
    .returning();
  return sub;
}

// Finds every agent this file created, identified by its unique per-run email
// prefixes. Used by the file-level safety-net afterAll so leaked rows from a
// crashed test (active subscriptions, commissions) cannot pollute later test
// files' global calculate-commissions runs and trigger FK violations.
async function findThisFilesAgentIds(): Promise<number[]> {
  const rows = await db
    .select({ id: schema.agents.id })
    .from(schema.agents)
    .where(like(schema.agents.email, `comm-email-%${TS}%`));
  return rows.map((r) => r.id);
}

// Returns the IDs of every active subscription the global calculate-commissions
// route will process. Capture this BEFORE calling the route, then pass the IDs
// to cleanupCommissionsForSubscriptions afterward so the commissions the route
// inserts (for ALL active subs, including any leaked from other files) are
// removed and cannot become orphaned FK references in a later test file's run.
async function getActiveSubscriptionIdsForCommissionRoute(): Promise<number[]> {
  const rows = await db
    .select({ id: schema.subscriptions.id })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.status, "active"));
  return rows.map((r) => r.id);
}

async function cleanupCommissionsForSubscriptions(subIds: number[]) {
  const ids = Array.from(new Set(subIds));
  if (ids.length === 0) return;
  await db
    .delete(schema.commissions)
    .where(inArray(schema.commissions.subscriptionId, ids));
}

async function cleanupAgent(agentId: number) {
  await db
    .delete(schema.commissions)
    .where(eq(schema.commissions.agentId, agentId));
  await db
    .delete(schema.notifications)
    .where(eq(schema.notifications.agentId, agentId));
  await db
    .delete(schema.subscriptions)
    .where(eq(schema.subscriptions.agentId, agentId));
  await db.delete(schema.agents).where(eq(schema.agents.id, agentId));
}

function shortDelay(ms = 50) {
  return new Promise((r) => setTimeout(r, ms));
}

beforeAll(async () => {
  const [admin] = await db
    .insert(schema.agents)
    .values({
      email: `${ADMIN_EMAIL_PREFIX}@example.com`,
      password: await hashPassword(PASSWORD),
      firstName: "Admin",
      lastName: "CommEmail",
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
    .send({ username: `${ADMIN_EMAIL_PREFIX}@example.com`, password: PASSWORD });
  adminCookie = loginRes.headers["set-cookie"] as unknown as string[];
}, 30000);

afterAll(async () => {
  await db.delete(schema.agents).where(eq(schema.agents.id, adminId));
  await testPool.end();
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe("calculate-commissions – emailOnCommissionEarned: true", () => {
  it("sends a commission earned email when emailOnCommissionEarned is true", async () => {
    const agent = await createAgent("comm-on", { emailOnCommissionEarned: true });
    await createActiveSubscription(agent.id);

    const touchedSubIds = await getActiveSubscriptionIdsForCommissionRoute();
    try {
      const res = await request(testApp)
        .post("/api/admin/subscriptions/calculate-commissions")
        .set("Cookie", adminCookie)
        .expect(200);

      expect(res.body.processed).toBeGreaterThanOrEqual(1);

      await shortDelay();

      expect(emailService.sendCommissionEarnedEmail).toHaveBeenCalled();
      expect(emailService.sendCommissionEarnedEmail).toHaveBeenCalledWith(
        agent.email,
        expect.objectContaining({
          firstName: agent.firstName,
          commissionType: "Subscription Commission",
        })
      );
    } finally {
      await cleanupCommissionsForSubscriptions(touchedSubIds);
      await cleanupAgent(agent.id);
    }
  });
});

// ── Opt-out path ──────────────────────────────────────────────────────────────

describe("calculate-commissions – emailOnCommissionEarned: false", () => {
  it("does NOT send a commission earned email when emailOnCommissionEarned is false", async () => {
    const agent = await createAgent("comm-off", { emailOnCommissionEarned: false });
    await createActiveSubscription(agent.id); // sub created but email should be suppressed

    const touchedSubIds = await getActiveSubscriptionIdsForCommissionRoute();
    try {
      const res = await request(testApp)
        .post("/api/admin/subscriptions/calculate-commissions")
        .set("Cookie", adminCookie)
        .expect(200);

      expect(res.body.processed).toBeGreaterThanOrEqual(1);

      await shortDelay();

      // The call should either not have been made for this agent at all, or
      // if other agents' commissions happened to run, it should never have been
      // called with this agent's email address.
      const calls = (emailService.sendCommissionEarnedEmail as ReturnType<typeof vi.fn>).mock.calls;
      const calledForThisAgent = calls.some((args: unknown[]) => args[0] === agent.email);
      expect(calledForThisAgent).toBe(false);
    } finally {
      await cleanupCommissionsForSubscriptions(touchedSubIds);
      await cleanupAgent(agent.id);
    }
  });
});

// ── subscription_residual type ────────────────────────────────────────────────

describe("calculate-commissions – subscription_residual commission type", () => {
  it("sends an email with 'Subscription Residual' as commissionType for subs older than 12 months", async () => {
    const thirteenMonthsAgo = new Date();
    thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 13);

    const agent = await createAgent("comm-residual", { emailOnCommissionEarned: true });
    await createActiveSubscription(agent.id, thirteenMonthsAgo);

    const touchedSubIds = await getActiveSubscriptionIdsForCommissionRoute();
    try {
      await request(testApp)
        .post("/api/admin/subscriptions/calculate-commissions")
        .set("Cookie", adminCookie)
        .expect(200);

      await shortDelay();

      expect(emailService.sendCommissionEarnedEmail).toHaveBeenCalled();
      expect(emailService.sendCommissionEarnedEmail).toHaveBeenCalledWith(
        agent.email,
        expect.objectContaining({
          firstName: agent.firstName,
          commissionType: "Subscription Residual",
        })
      );
    } finally {
      await cleanupCommissionsForSubscriptions(touchedSubIds);
      await cleanupAgent(agent.id);
    }
  });
});

// ── In-app notification tests ─────────────────────────────────────────────────

describe("calculate-commissions – in-app notification for subscription_commission", () => {
  it("creates a commission_earned in-app notification with correct title and message", async () => {
    const agent = await createAgent("notif-comm", { emailOnCommissionEarned: true });
    const sub = await createActiveSubscription(agent.id);

    const touchedSubIds = await getActiveSubscriptionIdsForCommissionRoute();
    try {
      const res = await request(testApp)
        .post("/api/admin/subscriptions/calculate-commissions")
        .set("Cookie", adminCookie)
        .expect(200);

      expect(res.body.processed).toBeGreaterThanOrEqual(1);

      const notifs = await db
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.agentId, agent.id));

      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe("commission_earned");
      expect(notifs[0].title).toBe("Subscription Commission Earned!");
      expect(notifs[0].message).toContain("Subscription Commission");
      expect(notifs[0].message).toContain(sub.merchantName);
      expect(notifs[0].isRead).toBe(false);
    } finally {
      await cleanupCommissionsForSubscriptions(touchedSubIds);
      await cleanupAgent(agent.id);
    }
  });
});

describe("calculate-commissions – in-app notification for subscription_residual", () => {
  it("creates a commission_earned notification with 'Subscription Residual' for subs older than 12 months", async () => {
    const thirteenMonthsAgo = new Date();
    thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 13);

    const agent = await createAgent("notif-residual", { emailOnCommissionEarned: true });
    const sub = await createActiveSubscription(agent.id, thirteenMonthsAgo);

    const touchedSubIds = await getActiveSubscriptionIdsForCommissionRoute();
    try {
      await request(testApp)
        .post("/api/admin/subscriptions/calculate-commissions")
        .set("Cookie", adminCookie)
        .expect(200);

      const notifs = await db
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.agentId, agent.id));

      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe("commission_earned");
      expect(notifs[0].title).toBe("Subscription Residual Earned!");
      expect(notifs[0].message).toContain("Subscription Residual");
      expect(notifs[0].message).toContain(sub.merchantName);
      expect(notifs[0].isRead).toBe(false);
    } finally {
      await cleanupCommissionsForSubscriptions(touchedSubIds);
      await cleanupAgent(agent.id);
    }
  });
});

describe("calculate-commissions – notification created even when email is opted out", () => {
  it("creates an in-app notification regardless of emailOnCommissionEarned preference", async () => {
    const agent = await createAgent("notif-no-email", { emailOnCommissionEarned: false });
    await createActiveSubscription(agent.id);

    const touchedSubIds = await getActiveSubscriptionIdsForCommissionRoute();
    try {
      const res = await request(testApp)
        .post("/api/admin/subscriptions/calculate-commissions")
        .set("Cookie", adminCookie)
        .expect(200);

      expect(res.body.processed).toBeGreaterThanOrEqual(1);

      const notifs = await db
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.agentId, agent.id));

      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe("commission_earned");

      await shortDelay();

      const calls = (emailService.sendCommissionEarnedEmail as ReturnType<typeof vi.fn>).mock.calls;
      const calledForThisAgent = calls.some((args: unknown[]) => args[0] === agent.email);
      expect(calledForThisAgent).toBe(false);
    } finally {
      await cleanupCommissionsForSubscriptions(touchedSubIds);
      await cleanupAgent(agent.id);
    }
  });
});

// ── Binary bonus & sponsor override coverage ──────────────────────────────────
//
// The same emailOnCommissionEarned preference gate that controls subscription
// commission emails also guards binary bonus emails (POST
// /api/admin/commissions/calculate) and sponsor override emails (deal approval
// via POST /api/admin/deals/:id/approve).  These tests exercise both paths so a
// regression that removes either preference check is caught.

/**
 * Create an agent with an explicit rank and (optionally) a binary placement.
 * Binary bonuses are only calculated for builder/leader/director/partner agents,
 * so the upline agent must be created with one of those ranks.
 */
async function createRankedAgent(
  suffix: string,
  rank: string,
  prefs: CommissionEmailPrefs = {},
  placement?: { placementId: number; leg: "left" | "right" }
) {
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: `${AGENT_EMAIL_PREFIX}-${suffix}@example.com`,
      password: await hashPassword(PASSWORD),
      firstName: "Commission",
      lastName: "Tester",
      currentRank: rank,
      highestRank: rank,
      emailPreferences: prefs,
      placementId: placement?.placementId,
      leg: placement?.leg,
    })
    .returning();
  return agent;
}

/**
 * Create a funded deal so its companyRevenue counts toward leg volume.
 * getLegVolume only sums deals with status 'funded' created since the start of
 * the current week, and new rows default createdAt to now().
 */
async function createFundedDeal(agentId: number, revenue = "10000.00") {
  const [deal] = await db
    .insert(schema.deals)
    .values({
      agentId,
      merchantName: "Volume Merchant",
      loanAmount: "50000.00",
      companyRevenue: revenue,
      status: "funded",
    })
    .returning();
  return deal;
}

/**
 * Create a pending deal (eligible for admin approval).  gbrAmount drives the
 * sponsor-override amount in the commission waterfall.
 */
async function createPendingDeal(agentId: number, gbrAmount = "10000.00") {
  const [deal] = await db
    .insert(schema.deals)
    .values({
      agentId,
      merchantName: "Approval Merchant",
      loanAmount: "50000.00",
      companyRevenue: gbrAmount,
      gbrAmount,
      status: "pending",
      // These suites lock the LEGACY MCA waterfall (MAC sponsor overrides);
      // create legacy deals so the going-forward v2026 default doesn't apply.
      commissionModel: "legacy",
    })
    .returning();
  return deal;
}

async function cleanupAgentFull(agentId: number) {
  await db.delete(schema.holdbacks).where(eq(schema.holdbacks.agentId, agentId));
  await db.delete(schema.commissions).where(eq(schema.commissions.agentId, agentId));
  await db.delete(schema.notifications).where(eq(schema.notifications.agentId, agentId));
  await db.delete(schema.deals).where(eq(schema.deals.agentId, agentId));
  await db.delete(schema.subscriptions).where(eq(schema.subscriptions.agentId, agentId));
  await db.delete(schema.agents).where(eq(schema.agents.id, agentId));
}

describe("binary bonus calculation – emailOnCommissionEarned gate", () => {
  it("sends a binary bonus email when emailOnCommissionEarned is true", async () => {
    // Upline builder agent earns the binary bonus.
    const upline = await createRankedAgent("binary-on", "builder", {
      emailOnCommissionEarned: true,
    });
    // Both legs need funded volume so the weaker leg volume is > 0.
    const left = await createRankedAgent("binary-on-left", "agent", {}, {
      placementId: upline.id,
      leg: "left",
    });
    const right = await createRankedAgent("binary-on-right", "agent", {}, {
      placementId: upline.id,
      leg: "right",
    });
    await createFundedDeal(left.id);
    await createFundedDeal(right.id);

    await request(testApp)
      .post("/api/admin/commissions/calculate")
      .set("Cookie", adminCookie)
      .expect(200);

    await shortDelay();

    const calls = (emailService.sendCommissionEarnedEmail as ReturnType<typeof vi.fn>).mock.calls;
    const callForUpline = calls.find((args: unknown[]) => args[0] === upline.email);
    expect(callForUpline).toBeDefined();
    expect(callForUpline![1]).toEqual(
      expect.objectContaining({
        firstName: upline.firstName,
        commissionType: "Binary Bonus",
      })
    );

    await cleanupAgentFull(left.id);
    await cleanupAgentFull(right.id);
    await cleanupAgentFull(upline.id);
  });

  it("does NOT send a binary bonus email when emailOnCommissionEarned is false", async () => {
    const upline = await createRankedAgent("binary-off", "builder", {
      emailOnCommissionEarned: false,
    });
    const left = await createRankedAgent("binary-off-left", "agent", {}, {
      placementId: upline.id,
      leg: "left",
    });
    const right = await createRankedAgent("binary-off-right", "agent", {}, {
      placementId: upline.id,
      leg: "right",
    });
    await createFundedDeal(left.id);
    await createFundedDeal(right.id);

    await request(testApp)
      .post("/api/admin/commissions/calculate")
      .set("Cookie", adminCookie)
      .expect(200);

    await shortDelay();

    // The binary bonus commission row should still be created (proving the
    // agent was processed) even though the email is suppressed.
    const bonusCommissions = await db
      .select()
      .from(schema.commissions)
      .where(eq(schema.commissions.agentId, upline.id));
    expect(bonusCommissions.some((c) => c.type === "binary_bonus")).toBe(true);

    const calls = (emailService.sendCommissionEarnedEmail as ReturnType<typeof vi.fn>).mock.calls;
    const calledForUpline = calls.some((args: unknown[]) => args[0] === upline.email);
    expect(calledForUpline).toBe(false);

    await cleanupAgentFull(left.id);
    await cleanupAgentFull(right.id);
    await cleanupAgentFull(upline.id);
  });
});

describe("deal approval sponsor override – emailOnCommissionEarned gate", () => {
  it("sends a sponsor override email to the sponsor when emailOnCommissionEarned is true", async () => {
    const sponsor = await createRankedAgent("override-on-sponsor", "agent", {
      emailOnCommissionEarned: true,
    });
    const downline = await createRankedAgent("override-on-downline", "agent", {});
    // Link the downline to the sponsor so getUpline returns the sponsor.
    await db
      .update(schema.agents)
      .set({ sponsorId: sponsor.id })
      .where(eq(schema.agents.id, downline.id));
    const deal = await createPendingDeal(downline.id);

    await request(testApp)
      .post(`/api/admin/deals/${deal.id}/approve`)
      .set("Cookie", adminCookie)
      .expect(200);

    await shortDelay();

    const calls = (emailService.sendCommissionEarnedEmail as ReturnType<typeof vi.fn>).mock.calls;
    const callForSponsor = calls.find((args: unknown[]) => args[0] === sponsor.email);
    expect(callForSponsor).toBeDefined();
    expect(callForSponsor![1]).toEqual(
      expect.objectContaining({
        firstName: sponsor.firstName,
        commissionType: "L1 Sponsor Override",
      })
    );

    await cleanupAgentFull(downline.id);
    await cleanupAgentFull(sponsor.id);
  });

  it("does NOT send a sponsor override email when the sponsor's emailOnCommissionEarned is false", async () => {
    const sponsor = await createRankedAgent("override-off-sponsor", "agent", {
      emailOnCommissionEarned: false,
    });
    const downline = await createRankedAgent("override-off-downline", "agent", {});
    await db
      .update(schema.agents)
      .set({ sponsorId: sponsor.id })
      .where(eq(schema.agents.id, downline.id));
    const deal = await createPendingDeal(downline.id);

    await request(testApp)
      .post(`/api/admin/deals/${deal.id}/approve`)
      .set("Cookie", adminCookie)
      .expect(200);

    await shortDelay();

    // The sponsor override commission row should still be created (proving the
    // waterfall ran) even though the email is suppressed.
    const sponsorCommissions = await db
      .select()
      .from(schema.commissions)
      .where(eq(schema.commissions.agentId, sponsor.id));
    expect(sponsorCommissions.some((c) => c.type === "mac_sponsor_l1")).toBe(true);

    const calls = (emailService.sendCommissionEarnedEmail as ReturnType<typeof vi.fn>).mock.calls;
    const calledForSponsor = calls.some((args: unknown[]) => args[0] === sponsor.email);
    expect(calledForSponsor).toBe(false);

    await cleanupAgentFull(downline.id);
    await cleanupAgentFull(sponsor.id);
  });
});

// =========================================================
// File-level safety net. Registered last, so it runs FIRST (afterAll hooks run
// in reverse registration order). It purges every row this file created — child
// rows first, then subscriptions, then the agents themselves — keyed off this
// run's unique email prefix. This guarantees no leaked active subscription or
// orphaned commission survives a crashed test to collide with another test
// file's global calculate-commissions run.
// =========================================================
afterAll(async () => {
  const ids = await findThisFilesAgentIds();
  if (ids.length === 0) return;
  const subRows = await db
    .select({ id: schema.subscriptions.id })
    .from(schema.subscriptions)
    .where(inArray(schema.subscriptions.agentId, ids));
  const subIds = subRows.map((r) => r.id);
  if (subIds.length > 0) {
    await db.delete(schema.commissions).where(inArray(schema.commissions.subscriptionId, subIds));
  }
  await db.delete(schema.commissions).where(inArray(schema.commissions.agentId, ids));
  await db.delete(schema.notifications).where(inArray(schema.notifications.agentId, ids));
  await db.delete(schema.holdbacks).where(inArray(schema.holdbacks.agentId, ids));
  await db.delete(schema.deals).where(inArray(schema.deals.agentId, ids));
  await db.delete(schema.activityLog).where(inArray(schema.activityLog.actorId, ids));
  await db.delete(schema.subscriptions).where(inArray(schema.subscriptions.agentId, ids));
  await db.delete(schema.agents).where(inArray(schema.agents.id, ids));
});
