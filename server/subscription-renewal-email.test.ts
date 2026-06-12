/**
 * Tests for the renewal/extension confirmation email.
 *
 * Covers PATCH /api/admin/subscriptions/:id/end-date sending a "subscription
 * renewed" email when the end date is pushed into the future, and the
 * reactivation email reflecting the new end date.
 *
 * emailService is fully mocked so no real emails are ever sent and no
 * RESEND_API_KEY is required.
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import * as schema from "@shared/schema";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import { registerRoutes } from "./routes.js";
import { scrypt as scryptCallback, randomBytes } from "crypto";
import { promisify } from "util";

vi.mock("./email.js", () => ({
  emailService: {
    sendSubscriptionPausedEmail: vi.fn().mockResolvedValue(undefined),
    sendSubscriptionCancelledEmail: vi.fn().mockResolvedValue(undefined),
    sendSubscriptionReactivatedEmail: vi.fn().mockResolvedValue(undefined),
    sendSubscriptionRenewedEmail: vi.fn().mockResolvedValue(undefined),
    sendSubscriptionExpiredEmail: vi.fn().mockResolvedValue(undefined),
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendDealFundedEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendTeamSignupEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

import { emailService } from "./email.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run renewal-email tests");
}

const scryptAsync = promisify(scryptCallback);

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const TS = Date.now();
const AGENT_EMAIL_PREFIX = `renewal-agent-${TS}`;
const ADMIN_EMAIL_PREFIX = `renewal-admin-${TS}`;
const PASSWORD = "Renewal1!";

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

let testApp: ReturnType<typeof express>;
let adminId: number;

type EmailPrefs = { emailOnReactivated?: boolean };

async function createAgent(suffix: string, prefs: EmailPrefs = {}) {
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: `${AGENT_EMAIL_PREFIX}-${suffix}@example.com`,
      password: await hashPassword(PASSWORD),
      firstName: "Renew",
      lastName: "Tester",
      currentRank: "agent",
      highestRank: "agent",
      emailPreferences: prefs,
    })
    .returning();
  return agent;
}

async function createSubscription(
  agentId: number,
  status: "active" | "paused" | "cancelled" | "expired" = "active",
  endDate?: Date,
) {
  const [sub] = await db
    .insert(schema.subscriptions)
    .values({
      agentId,
      merchantName: "Renew Merchant",
      tier: "tier_1",
      monthlyAmount: "199.00",
      status,
      endDate,
    })
    .returning();
  return sub;
}

async function loginAs(email: string): Promise<string[]> {
  const res = await request(testApp)
    .post("/api/login")
    .send({ username: email, password: PASSWORD });
  return res.headers["set-cookie"] as unknown as string[];
}

async function loginAsAdmin(): Promise<string[]> {
  return loginAs(`${ADMIN_EMAIL_PREFIX}@example.com`);
}

async function cleanupAgent(agentId: number) {
  await db
    .delete(schema.activityLog)
    .where(
      and(
        eq(schema.activityLog.entityType, "subscription"),
        eq(schema.activityLog.actorId, agentId),
      ),
    );
  await db.delete(schema.notifications).where(eq(schema.notifications.agentId, agentId));
  await db.delete(schema.subscriptions).where(eq(schema.subscriptions.agentId, agentId));
  await db.delete(schema.agents).where(eq(schema.agents.id, agentId));
}

function shortDelay(ms = 30) {
  return new Promise((r) => setTimeout(r, ms));
}

function isoDate(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
}

beforeAll(async () => {
  const [admin] = await db
    .insert(schema.agents)
    .values({
      email: `${ADMIN_EMAIL_PREFIX}@example.com`,
      password: await hashPassword(PASSWORD),
      firstName: "Admin",
      lastName: "Renewal",
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
}, 30000);

afterAll(async () => {
  await db.delete(schema.agents).where(eq(schema.agents.id, adminId));
  await testPool.end();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("end-date endpoint – renewal confirmation email", () => {
  it("sends a renewal email when the end date is extended into the future", async () => {
    const agent = await createAgent("future");
    const sub = await createSubscription(agent.id, "active");
    const cookie = await loginAsAdmin();

    await request(testApp)
      .patch(`/api/admin/subscriptions/${sub.id}/end-date`)
      .set("Cookie", cookie)
      .send({ endDate: isoDate(30) })
      .expect(200);

    await shortDelay();
    expect(emailService.sendSubscriptionRenewedEmail).toHaveBeenCalledOnce();
    expect(emailService.sendSubscriptionRenewedEmail).toHaveBeenCalledWith(
      agent.email,
      expect.objectContaining({
        merchantName: "Renew Merchant",
        newEndDate: expect.any(String),
      }),
    );

    await cleanupAgent(agent.id);
  });

  it("does NOT send a renewal email when the end date is cleared", async () => {
    const agent = await createAgent("cleared");
    const sub = await createSubscription(agent.id, "active", new Date(Date.now() + 30 * 86400000));
    const cookie = await loginAsAdmin();

    await request(testApp)
      .patch(`/api/admin/subscriptions/${sub.id}/end-date`)
      .set("Cookie", cookie)
      .send({ endDate: null })
      .expect(200);

    await shortDelay();
    expect(emailService.sendSubscriptionRenewedEmail).not.toHaveBeenCalled();

    await cleanupAgent(agent.id);
  });

  it("does NOT send a renewal email when the end date is set to the past", async () => {
    const agent = await createAgent("past");
    const sub = await createSubscription(agent.id, "active");
    const cookie = await loginAsAdmin();

    await request(testApp)
      .patch(`/api/admin/subscriptions/${sub.id}/end-date`)
      .set("Cookie", cookie)
      .send({ endDate: isoDate(-5) })
      .expect(200);

    await shortDelay();
    expect(emailService.sendSubscriptionRenewedEmail).not.toHaveBeenCalled();

    await cleanupAgent(agent.id);
  });

  it("does NOT send a renewal email when a still-future end date is shortened", async () => {
    const agent = await createAgent("shortened");
    const sub = await createSubscription(agent.id, "active", new Date(Date.now() + 90 * 86400000));
    const cookie = await loginAsAdmin();

    await request(testApp)
      .patch(`/api/admin/subscriptions/${sub.id}/end-date`)
      .set("Cookie", cookie)
      .send({ endDate: isoDate(30) })
      .expect(200);

    await shortDelay();
    expect(emailService.sendSubscriptionRenewedEmail).not.toHaveBeenCalled();

    await cleanupAgent(agent.id);
  });

  it("sends a renewal email when an existing future end date is pushed out further", async () => {
    const agent = await createAgent("extended");
    const sub = await createSubscription(agent.id, "active", new Date(Date.now() + 30 * 86400000));
    const cookie = await loginAsAdmin();

    await request(testApp)
      .patch(`/api/admin/subscriptions/${sub.id}/end-date`)
      .set("Cookie", cookie)
      .send({ endDate: isoDate(90) })
      .expect(200);

    await shortDelay();
    expect(emailService.sendSubscriptionRenewedEmail).toHaveBeenCalledOnce();

    await cleanupAgent(agent.id);
  });

  it("respects the emailOnReactivated opt-out for renewal emails", async () => {
    const agent = await createAgent("optout", { emailOnReactivated: false });
    const sub = await createSubscription(agent.id, "active");
    const cookie = await loginAsAdmin();

    await request(testApp)
      .patch(`/api/admin/subscriptions/${sub.id}/end-date`)
      .set("Cookie", cookie)
      .send({ endDate: isoDate(30) })
      .expect(200);

    await shortDelay();
    expect(emailService.sendSubscriptionRenewedEmail).not.toHaveBeenCalled();

    await cleanupAgent(agent.id);
  });
});

describe("reactivation email – reflects the new end date", () => {
  it("includes newEndDate when the reactivated subscription has a future end date", async () => {
    const agent = await createAgent("react-end", { emailOnReactivated: true });
    const sub = await createSubscription(
      agent.id,
      "paused",
      new Date(Date.now() + 45 * 86400000),
    );
    const cookie = await loginAsAdmin();

    await request(testApp)
      .patch(`/api/admin/subscriptions/${sub.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "active" })
      .expect(200);

    await shortDelay();
    expect(emailService.sendSubscriptionReactivatedEmail).toHaveBeenCalledOnce();
    expect(emailService.sendSubscriptionReactivatedEmail).toHaveBeenCalledWith(
      agent.email,
      expect.objectContaining({ newEndDate: expect.any(String) }),
    );

    await cleanupAgent(agent.id);
  });

  it("sends a reactivation email with newEndDate when reactivating from cancelled", async () => {
    const agent = await createAgent("react-cancelled", { emailOnReactivated: true });
    const sub = await createSubscription(
      agent.id,
      "cancelled",
      new Date(Date.now() + 60 * 86400000),
    );
    const cookie = await loginAsAdmin();

    await request(testApp)
      .patch(`/api/admin/subscriptions/${sub.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "active" })
      .expect(200);

    await shortDelay();
    expect(emailService.sendSubscriptionReactivatedEmail).toHaveBeenCalledOnce();
    expect(emailService.sendSubscriptionReactivatedEmail).toHaveBeenCalledWith(
      agent.email,
      expect.objectContaining({
        merchantName: "Renew Merchant",
        newEndDate: expect.any(String),
      }),
    );

    await cleanupAgent(agent.id);
  });

  it("omits newEndDate when the reactivated subscription has no future end date", async () => {
    const agent = await createAgent("react-noend", { emailOnReactivated: true });
    const sub = await createSubscription(agent.id, "paused");
    const cookie = await loginAsAdmin();

    await request(testApp)
      .patch(`/api/admin/subscriptions/${sub.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "active" })
      .expect(200);

    await shortDelay();
    expect(emailService.sendSubscriptionReactivatedEmail).toHaveBeenCalledOnce();
    const callArg = (emailService.sendSubscriptionReactivatedEmail as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(callArg.newEndDate).toBeUndefined();

    await cleanupAgent(agent.id);
  });
});
