/**
 * Tests for the "agent lost last active subscription" admin alert.
 * Covers:
 *  - Alert fires when the agent's active count drops to 0 (still has history)
 *  - Alert is skipped when the agent still has other active subscriptions
 *  - Alert is skipped when the agent never had any subscriptions
 *  - No duplicate alert when one unread alert already exists for that agent
 *  - Admin PATCH route triggers the alert on cancel / pause
 *  - Agent self-service PATCH triggers the alert on cancel / pause
 *  - Webhook handleSubscriptionDeleted triggers the alert
 *  - Scheduler expiry triggers the alert when the expired sub was the last active one
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, like } from "drizzle-orm";
import * as schema from "@shared/schema";
import { storage } from "./storage.js";
import { maybeNotifyAdminsAgentLostLastSubscription } from "./adminAlerts.js";
import { WebhookHandlers } from "./webhookHandlers.js";
import { expireOverdueSubscriptions } from "./scheduler.js";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import { registerRoutes } from "./routes.js";
import { scrypt as scryptCallback, randomBytes } from "crypto";
import { promisify } from "util";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run admin-last-sub-alert tests");
}

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });
const scryptAsync = promisify(scryptCallback);

const PREFIX = `last-sub-alert-${Date.now()}`;
const ADMIN_PASS = "AdminLastSubAlert1!";
const AGENT_PASS = "AgentLastSubAlert1!";

async function hashPw(pw: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(pw, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function makeAgent(suffix: string, isAdmin = false, withLoginPassword = false) {
  const pw = isAdmin ? await hashPw(ADMIN_PASS) : withLoginPassword ? await hashPw(AGENT_PASS) : "irrelevant-hash";
  const [a] = await db.insert(schema.agents).values({
    email: `${PREFIX}-${suffix}@example.com`,
    password: pw,
    firstName: "Alert",
    lastName: "Test",
    currentRank: "agent",
    highestRank: "agent",
    isAdmin,
    emailVerifiedAt: new Date(),
  }).returning();
  return a;
}

async function makeSub(
  agentId: number,
  status: "active" | "paused" | "cancelled" | "expired",
  stripeSubId?: string,
) {
  const [s] = await db.insert(schema.subscriptions).values({
    agentId,
    merchantName: `Merchant-${Math.random().toString(36).slice(2)}`,
    tier: "tier_1",
    monthlyAmount: "99.00",
    status,
    ...(stripeSubId ? { stripeSubscriptionId: stripeSubId } : {}),
  }).returning();
  return s;
}

/** Fetch notifications created for an admin that reference the given agent. */
async function getAdminAlertsForAgent(adminId: number, agentId: number) {
  return await db.select().from(schema.notifications).where(
    and(
      eq(schema.notifications.agentId, adminId),
      eq(schema.notifications.title, "Agent Lost Last Active Subscription"),
      like(schema.notifications.message, `%agent-id:${agentId}%`),
    )
  );
}

/**
 * Purge last-sub-alert notifications for ALL admins that reference this agent.
 * Must be called after every test that creates an alert so stale unread
 * notifications don't trip the duplicate-suppression check in later tests.
 */
async function purgeAllAdminAlertsForAgent(agentId: number) {
  const admins = await storage.getAdminAgents();
  await Promise.all(
    admins.map((admin) =>
      db.delete(schema.notifications).where(
        and(
          eq(schema.notifications.agentId, admin.id),
          like(schema.notifications.message, `%agent-id:${agentId}%`),
        )
      ).catch(() => {})
    )
  );
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

let adminId: number;
let agentId: number;
let testApp: ReturnType<typeof express>;

const createdSubIds: number[] = [];
const createdAgentIds: number[] = [];

beforeAll(async () => {
  const admin = await makeAgent("admin", true);
  adminId = admin.id;
  createdAgentIds.push(adminId);

  const agent = await makeAgent("agent");
  agentId = agent.id;
  createdAgentIds.push(agentId);

  testApp = express();
  testApp.use(express.json());
  const httpServer = createServer(testApp);
  await registerRoutes(httpServer, testApp);
}, 30000);

afterAll(async () => {
  for (const id of createdSubIds) {
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, id)).catch(() => {});
  }
  await purgeAllAdminAlertsForAgent(agentId).catch(() => {});
  for (const id of createdAgentIds) {
    await db.delete(schema.agents).where(eq(schema.agents.id, id)).catch(() => {});
  }
  await testPool.end();
});

async function loginAsAdmin() {
  const res = await request(testApp)
    .post("/api/login")
    .send({ username: `${PREFIX}-admin@example.com`, password: ADMIN_PASS });
  return res.headers["set-cookie"] as unknown as string[];
}

async function loginAsAgent(email: string) {
  const res = await request(testApp)
    .post("/api/login")
    .send({ username: email, password: AGENT_PASS });
  return res.headers["set-cookie"] as unknown as string[];
}

// ── Unit-style tests against the helper directly ───────────────────────────

describe("maybeNotifyAdminsAgentLostLastSubscription", () => {
  it("creates an admin notification when the agent has no active subs and has history", async () => {
    const sub = await makeSub(agentId, "cancelled");
    createdSubIds.push(sub.id);

    try {
      await maybeNotifyAdminsAgentLostLastSubscription(agentId, "Alert Test");

      const alerts = await getAdminAlertsForAgent(adminId, agentId);
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    } finally {
      await purgeAllAdminAlertsForAgent(agentId);
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
      createdSubIds.splice(createdSubIds.indexOf(sub.id), 1);
    }
  });

  it("does NOT fire when the agent still has an active subscription", async () => {
    const sub = await makeSub(agentId, "active");
    createdSubIds.push(sub.id);

    try {
      await maybeNotifyAdminsAgentLostLastSubscription(agentId, "Alert Test");

      const alerts = await getAdminAlertsForAgent(adminId, agentId);
      expect(alerts).toHaveLength(0);
    } finally {
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
      createdSubIds.splice(createdSubIds.indexOf(sub.id), 1);
    }
  });

  it("does NOT fire when the agent has never had any subscription", async () => {
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.agentId, agentId));

    await maybeNotifyAdminsAgentLostLastSubscription(agentId, "Alert Test");

    const alerts = await getAdminAlertsForAgent(adminId, agentId);
    expect(alerts).toHaveLength(0);
  });

  it("does NOT create a duplicate when an unread alert already exists for that agent", async () => {
    const sub = await makeSub(agentId, "cancelled");
    createdSubIds.push(sub.id);

    try {
      // First alert — should create notifications for all admins
      await maybeNotifyAdminsAgentLostLastSubscription(agentId, "Alert Test");
      const firstAlerts = await getAdminAlertsForAgent(adminId, agentId);
      expect(firstAlerts.length).toBe(1);

      // Second call — should be suppressed because an unread alert already exists
      await maybeNotifyAdminsAgentLostLastSubscription(agentId, "Alert Test");
      const afterSecond = await getAdminAlertsForAgent(adminId, agentId);
      expect(afterSecond.length).toBe(1); // still just one
    } finally {
      await purgeAllAdminAlertsForAgent(agentId);
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
      createdSubIds.splice(createdSubIds.indexOf(sub.id), 1);
    }
  });
});

// ── Integration: admin PATCH /api/admin/subscriptions/:id/status ──────────

describe("PATCH /api/admin/subscriptions/:id/status – last-sub admin alert", () => {
  it("fires an admin alert when cancelling an agent's only active subscription", async () => {
    const sub = await makeSub(agentId, "active");
    createdSubIds.push(sub.id);

    try {
      const cookie = await loginAsAdmin();
      await request(testApp)
        .patch(`/api/admin/subscriptions/${sub.id}/status`)
        .set("Cookie", cookie)
        .send({ status: "cancelled" })
        .expect(200);

      // Fire-and-forget: give the alert time to land
      await new Promise((r) => setTimeout(r, 800));

      const alerts = await getAdminAlertsForAgent(adminId, agentId);
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    } finally {
      await purgeAllAdminAlertsForAgent(agentId);
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
      createdSubIds.splice(createdSubIds.indexOf(sub.id), 1);
    }
  });

  it("fires an admin alert when pausing an agent's only active subscription", async () => {
    const sub = await makeSub(agentId, "active");
    createdSubIds.push(sub.id);

    try {
      const cookie = await loginAsAdmin();
      await request(testApp)
        .patch(`/api/admin/subscriptions/${sub.id}/status`)
        .set("Cookie", cookie)
        .send({ status: "paused" })
        .expect(200);

      await new Promise((r) => setTimeout(r, 800));

      const alerts = await getAdminAlertsForAgent(adminId, agentId);
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    } finally {
      await purgeAllAdminAlertsForAgent(agentId);
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
      createdSubIds.splice(createdSubIds.indexOf(sub.id), 1);
    }
  });

  it("does NOT fire when the agent still has another active subscription", async () => {
    const sub1 = await makeSub(agentId, "active");
    const sub2 = await makeSub(agentId, "active");
    createdSubIds.push(sub1.id, sub2.id);

    try {
      const cookie = await loginAsAdmin();
      await request(testApp)
        .patch(`/api/admin/subscriptions/${sub1.id}/status`)
        .set("Cookie", cookie)
        .send({ status: "cancelled" })
        .expect(200);

      await new Promise((r) => setTimeout(r, 800));

      const alerts = await getAdminAlertsForAgent(adminId, agentId);
      expect(alerts).toHaveLength(0);
    } finally {
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub1.id));
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub2.id));
      createdSubIds.splice(createdSubIds.indexOf(sub1.id), 1);
      createdSubIds.splice(createdSubIds.indexOf(sub2.id), 1);
    }
  });
});

// ── Integration: WebhookHandlers.handleSubscriptionDeleted ────────────────

describe("WebhookHandlers.handleSubscriptionDeleted – last-sub admin alert", () => {
  it("fires an admin alert when the deleted Stripe sub was the agent's last active one", async () => {
    const stripeId = `sub_test_last_${Date.now()}`;
    const sub = await makeSub(agentId, "active", stripeId);
    createdSubIds.push(sub.id);

    try {
      await WebhookHandlers.handleSubscriptionDeleted(stripeId);

      const alerts = await getAdminAlertsForAgent(adminId, agentId);
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    } finally {
      await purgeAllAdminAlertsForAgent(agentId);
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
      createdSubIds.splice(createdSubIds.indexOf(sub.id), 1);
    }
  });

  it("does NOT fire when the deleted sub was not the agent's last active one", async () => {
    const stripeId = `sub_test_notlast_${Date.now()}`;
    const sub1 = await makeSub(agentId, "active", stripeId);
    const sub2 = await makeSub(agentId, "active");
    createdSubIds.push(sub1.id, sub2.id);

    try {
      await WebhookHandlers.handleSubscriptionDeleted(stripeId);

      const alerts = await getAdminAlertsForAgent(adminId, agentId);
      expect(alerts).toHaveLength(0);
    } finally {
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub1.id));
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub2.id));
      createdSubIds.splice(createdSubIds.indexOf(sub1.id), 1);
      createdSubIds.splice(createdSubIds.indexOf(sub2.id), 1);
    }
  });
});

// ── Integration: agent self-service PATCH /api/subscriptions/:id/status ──────

describe("PATCH /api/subscriptions/:id/status (self-service) – last-sub admin alert", () => {
  let selfAgentId: number;

  beforeAll(async () => {
    const a = await makeAgent("self-agent", false, true);
    selfAgentId = a.id;
    createdAgentIds.push(selfAgentId);
  });

  it("fires an admin alert when the agent self-cancels their only active subscription", async () => {
    const sub = await makeSub(selfAgentId, "active");
    createdSubIds.push(sub.id);

    try {
      const cookie = await loginAsAgent(`${PREFIX}-self-agent@example.com`);
      await request(testApp)
        .patch(`/api/subscriptions/${sub.id}/status`)
        .set("Cookie", cookie)
        .send({ status: "cancelled" })
        .expect(200);

      // Fire-and-forget: give the alert time to land
      await new Promise((r) => setTimeout(r, 800));

      const alerts = await getAdminAlertsForAgent(adminId, selfAgentId);
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    } finally {
      await purgeAllAdminAlertsForAgent(selfAgentId);
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
      createdSubIds.splice(createdSubIds.indexOf(sub.id), 1);
    }
  });

  it("fires an admin alert when the agent self-pauses their only active subscription", async () => {
    const sub = await makeSub(selfAgentId, "active");
    createdSubIds.push(sub.id);

    try {
      const cookie = await loginAsAgent(`${PREFIX}-self-agent@example.com`);
      await request(testApp)
        .patch(`/api/subscriptions/${sub.id}/status`)
        .set("Cookie", cookie)
        .send({ status: "paused" })
        .expect(200);

      await new Promise((r) => setTimeout(r, 800));

      const alerts = await getAdminAlertsForAgent(adminId, selfAgentId);
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    } finally {
      await purgeAllAdminAlertsForAgent(selfAgentId);
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
      createdSubIds.splice(createdSubIds.indexOf(sub.id), 1);
    }
  });

  it("does NOT fire when the agent still has another active subscription after self-cancel", async () => {
    const sub1 = await makeSub(selfAgentId, "active");
    const sub2 = await makeSub(selfAgentId, "active");
    createdSubIds.push(sub1.id, sub2.id);

    try {
      const cookie = await loginAsAgent(`${PREFIX}-self-agent@example.com`);
      await request(testApp)
        .patch(`/api/subscriptions/${sub1.id}/status`)
        .set("Cookie", cookie)
        .send({ status: "cancelled" })
        .expect(200);

      await new Promise((r) => setTimeout(r, 800));

      const alerts = await getAdminAlertsForAgent(adminId, selfAgentId);
      expect(alerts).toHaveLength(0);
    } finally {
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub1.id));
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub2.id));
      createdSubIds.splice(createdSubIds.indexOf(sub1.id), 1);
      createdSubIds.splice(createdSubIds.indexOf(sub2.id), 1);
    }
  });
});

// ── Integration: expireOverdueSubscriptions scheduler ─────────────────────────

describe("expireOverdueSubscriptions – last-sub admin alert", () => {
  let expiryAgentId: number;

  beforeAll(async () => {
    const a = await makeAgent("expiry-agent");
    expiryAgentId = a.id;
    createdAgentIds.push(expiryAgentId);
  });

  it("fires an admin alert when expiry removes the agent's last active subscription", async () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    const sub = await makeSub(expiryAgentId, "active");
    // Backdate the end date so the scheduler picks it up
    await db.update(schema.subscriptions)
      .set({ endDate: pastDate })
      .where(eq(schema.subscriptions.id, sub.id));
    createdSubIds.push(sub.id);

    try {
      await expireOverdueSubscriptions();

      // expireOverdueSubscriptions awaits the alert internally via fire-and-forget
      await new Promise((r) => setTimeout(r, 400));

      const alerts = await getAdminAlertsForAgent(adminId, expiryAgentId);
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    } finally {
      await purgeAllAdminAlertsForAgent(expiryAgentId);
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
      createdSubIds.splice(createdSubIds.indexOf(sub.id), 1);
    }
  });

  it("does NOT fire when expiry removes one of multiple active subscriptions", async () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const sub1 = await makeSub(expiryAgentId, "active");
    await db.update(schema.subscriptions)
      .set({ endDate: pastDate })
      .where(eq(schema.subscriptions.id, sub1.id));
    // sub2 remains active with no end date
    const sub2 = await makeSub(expiryAgentId, "active");
    createdSubIds.push(sub1.id, sub2.id);

    try {
      await expireOverdueSubscriptions();

      await new Promise((r) => setTimeout(r, 400));

      const alerts = await getAdminAlertsForAgent(adminId, expiryAgentId);
      expect(alerts).toHaveLength(0);
    } finally {
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub1.id));
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub2.id));
      createdSubIds.splice(createdSubIds.indexOf(sub1.id), 1);
      createdSubIds.splice(createdSubIds.indexOf(sub2.id), 1);
    }
  });
});
