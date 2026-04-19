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
import { eq } from "drizzle-orm";
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
    })
    .returning();
  return sub;
}

async function cleanupAgent(agentId: number) {
  await db
    .delete(schema.commissions)
    .where(eq(schema.commissions.agentId, agentId));
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

    await cleanupAgent(agent.id);
  });
});

// ── Opt-out path ──────────────────────────────────────────────────────────────

describe("calculate-commissions – emailOnCommissionEarned: false", () => {
  it("does NOT send a commission earned email when emailOnCommissionEarned is false", async () => {
    const agent = await createAgent("comm-off", { emailOnCommissionEarned: false });
    await createActiveSubscription(agent.id); // sub created but email should be suppressed

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

    await cleanupAgent(agent.id);
  });
});

// ── subscription_residual type ────────────────────────────────────────────────

describe("calculate-commissions – subscription_residual commission type", () => {
  it("sends an email with 'Subscription Residual' as commissionType for subs older than 12 months", async () => {
    const thirteenMonthsAgo = new Date();
    thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 13);

    const agent = await createAgent("comm-residual", { emailOnCommissionEarned: true });
    await createActiveSubscription(agent.id, thirteenMonthsAgo);

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

    await cleanupAgent(agent.id);
  });
});
