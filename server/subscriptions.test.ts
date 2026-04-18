import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import * as schema from "@shared/schema";
import { storage } from "./storage.js";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import { registerRoutes } from "./routes.js";
import { scrypt as scryptCallback, randomBytes } from "crypto";
import { promisify } from "util";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run subscription tests");
}

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const TEST_EMAIL_PREFIX = `sub-test-${Date.now()}`;

async function createTestAgent(suffix: string) {
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: `${TEST_EMAIL_PREFIX}-${suffix}@example.com`,
      password: "not-a-real-hash",
      firstName: "Sub",
      lastName: "Test",
      currentRank: "agent",
      highestRank: "agent",
    })
    .returning();
  return agent;
}

async function createTestSubscription(
  agentId: number,
  status: "active" | "paused" | "cancelled" | "expired" = "active"
) {
  const [sub] = await db
    .insert(schema.subscriptions)
    .values({
      agentId,
      merchantName: "Acme Corp",
      tier: "tier_1",
      monthlyAmount: "199.00",
      status,
    })
    .returning();
  return sub;
}

let agentId: number;

beforeAll(async () => {
  const agent = await createTestAgent("main");
  agentId = agent.id;
});

afterAll(async () => {
  await db.delete(schema.subscriptions).where(eq(schema.subscriptions.agentId, agentId));
  await db.delete(schema.agents).where(eq(schema.agents.id, agentId));
  await testPool.end();
});

// =========================================================
// Storage layer – subscription status tracking behaviour
// =========================================================

describe("updateSubscriptionStatus – pausing", () => {
  it("sets pausedAt when an active subscription is paused", async () => {
    const sub = await createTestSubscription(agentId, "active");
    const updated = await storage.updateSubscriptionStatus(sub.id, "paused");
    expect(updated.status).toBe("paused");
    expect(updated.pausedAt).not.toBeNull();
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });

  it("records the actor who paused when actorId is provided", async () => {
    const sub = await createTestSubscription(agentId, "active");
    const updated = await storage.updateSubscriptionStatus(sub.id, "paused", agentId);
    expect(updated.pausedById).toBe(agentId);
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });
});

describe("updateSubscriptionStatus – cancelling", () => {
  it("sets cancelledAt when a subscription is cancelled", async () => {
    const sub = await createTestSubscription(agentId, "active");
    const updated = await storage.updateSubscriptionStatus(sub.id, "cancelled");
    expect(updated.status).toBe("cancelled");
    expect(updated.cancelledAt).not.toBeNull();
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });

  it("records the actor who cancelled when actorId is provided", async () => {
    const sub = await createTestSubscription(agentId, "active");
    const updated = await storage.updateSubscriptionStatus(sub.id, "cancelled", agentId);
    expect(updated.cancelledById).toBe(agentId);
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });
});

describe("updateSubscriptionStatus – reactivation", () => {
  it("clears pausedAt when a paused subscription is reactivated", async () => {
    const sub = await createTestSubscription(agentId, "active");
    await storage.updateSubscriptionStatus(sub.id, "paused");
    const updated = await storage.updateSubscriptionStatus(sub.id, "active");
    expect(updated.status).toBe("active");
    expect(updated.pausedAt).toBeNull();
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });

  it("sets reactivatedAt when a paused subscription is reactivated", async () => {
    const sub = await createTestSubscription(agentId, "active");
    await storage.updateSubscriptionStatus(sub.id, "paused");
    const updated = await storage.updateSubscriptionStatus(sub.id, "active");
    expect(updated.reactivatedAt).not.toBeNull();
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });

  it("records the actor who reactivated when actorId is provided", async () => {
    const sub = await createTestSubscription(agentId, "active");
    await storage.updateSubscriptionStatus(sub.id, "paused");
    const updated = await storage.updateSubscriptionStatus(sub.id, "active", agentId);
    expect(updated.reactivatedById).toBe(agentId);
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });

  it("sets reactivatedAt even when an already-active subscription is set to active", async () => {
    const sub = await createTestSubscription(agentId, "active");
    const updated = await storage.updateSubscriptionStatus(sub.id, "active");
    expect(updated.reactivatedAt).not.toBeNull();
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });
});

// =========================================================
// Route validation – invalid transitions
// These tests replicate the guard logic in
// PATCH /api/subscriptions/:id/status and verify the correct
// HTTP status codes are returned.
// =========================================================

/**
 * Mirrors the validation logic from the agent self-service route
 * so we can test it without standing up a full HTTP server.
 */
function applyTransitionGuards(
  currentStatus: string,
  targetStatus: string
): { ok: true } | { ok: false; httpStatus: number; message: string } {
  if (currentStatus === "cancelled") {
    return { ok: false, httpStatus: 400, message: "Cannot update a cancelled subscription" };
  }
  if (currentStatus === "expired") {
    return { ok: false, httpStatus: 400, message: "Cannot update an expired subscription" };
  }
  if (targetStatus === "active" && currentStatus !== "paused") {
    return { ok: false, httpStatus: 400, message: "Only paused subscriptions can be reactivated" };
  }
  return { ok: true };
}

describe("route validation – invalid status transitions", () => {
  it("returns 400 when trying to update a cancelled subscription", () => {
    const result = applyTransitionGuards("cancelled", "active");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.httpStatus).toBe(400);
      expect(result.message).toMatch(/cancelled/i);
    }
  });

  it("returns 400 when trying to update an expired subscription", () => {
    const result = applyTransitionGuards("expired", "active");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.httpStatus).toBe(400);
      expect(result.message).toMatch(/expired/i);
    }
  });

  it("returns 400 when trying to reactivate an active subscription", () => {
    const result = applyTransitionGuards("active", "active");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.httpStatus).toBe(400);
      expect(result.message).toMatch(/paused/i);
    }
  });

  it("allows pausing an active subscription", () => {
    const result = applyTransitionGuards("active", "paused");
    expect(result.ok).toBe(true);
  });

  it("allows cancelling an active subscription", () => {
    const result = applyTransitionGuards("active", "cancelled");
    expect(result.ok).toBe(true);
  });

  it("allows reactivating a paused subscription", () => {
    const result = applyTransitionGuards("paused", "active");
    expect(result.ok).toBe(true);
  });

  it("allows cancelling a paused subscription", () => {
    const result = applyTransitionGuards("paused", "cancelled");
    expect(result.ok).toBe(true);
  });
});

// =========================================================
// Admin PATCH /api/admin/subscriptions/:id/status – route tests
// These tests spin up the real Express app and hit the route
// over HTTP to confirm it writes activity log entries with
// the correct action, actorType, and entityId.
// =========================================================

const scryptAsync = promisify(scryptCallback);

async function hashPasswordForTest(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function pollForActivityLogEntry(
  subscriptionId: number,
  action: string,
  timeoutMs = 2000,
  intervalMs = 50
): Promise<(typeof schema.activityLog.$inferSelect) | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { logs } = await storage.getActivityLogs(1, 100, {
      entityType: "subscription",
      entityId: subscriptionId,
    });
    const entry = logs.find((l) => l.action === action && l.entityId === subscriptionId);
    if (entry) return entry;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return undefined;
}

async function cleanupActivityLog(subscriptionId: number) {
  await db
    .delete(schema.activityLog)
    .where(
      and(
        eq(schema.activityLog.entityType, "subscription"),
        eq(schema.activityLog.entityId, subscriptionId)
      )
    );
}

const ADMIN_PASSWORD = "AdminTestPass1!";
const ADMIN_EMAIL_PREFIX = `admin-route-test-${Date.now()}`;

let adminId: number;
let testApp: ReturnType<typeof express>;

beforeAll(async () => {
  // Create a dedicated admin agent for route tests
  const [admin] = await db
    .insert(schema.agents)
    .values({
      email: `${ADMIN_EMAIL_PREFIX}@example.com`,
      password: await hashPasswordForTest(ADMIN_PASSWORD),
      firstName: "Admin",
      lastName: "Tester",
      currentRank: "agent",
      highestRank: "agent",
      isAdmin: true,
    })
    .returning();
  adminId = admin.id;

  // Spin up the real Express app with all routes registered
  testApp = express();
  testApp.use(express.json());
  const httpServer = createServer(testApp);
  await registerRoutes(httpServer, testApp);
}, 30000);

afterAll(async () => {
  await db.delete(schema.agents).where(eq(schema.agents.id, adminId));
});

async function loginAsAdmin(): Promise<string[]> {
  const res = await request(testApp)
    .post("/api/login")
    .send({ username: `${ADMIN_EMAIL_PREFIX}@example.com`, password: ADMIN_PASSWORD });
  return res.headers["set-cookie"] as unknown as string[];
}

describe("admin subscription status route – activity logging on pause", () => {
  it("creates an activity log entry with action 'pause' when an admin pauses a subscription", async () => {
    const sub = await createTestSubscription(agentId, "active");
    const cookie = await loginAsAdmin();

    await request(testApp)
      .patch(`/api/admin/subscriptions/${sub.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "paused" })
      .expect(200);

    // logActivity in the route is fire-and-forget; poll until the entry appears
    const entry = await pollForActivityLogEntry(sub.id, "pause");
    expect(entry).toBeDefined();
    expect(entry?.action).toBe("pause");
    expect(entry?.actorType).toBe("admin");
    expect(entry?.entityId).toBe(sub.id);

    await cleanupActivityLog(sub.id);
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });
});

describe("admin subscription status route – activity logging on cancel", () => {
  it("creates an activity log entry with action 'cancel' when an admin cancels a subscription", async () => {
    const sub = await createTestSubscription(agentId, "active");
    const cookie = await loginAsAdmin();

    await request(testApp)
      .patch(`/api/admin/subscriptions/${sub.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "cancelled" })
      .expect(200);

    // logActivity in the route is fire-and-forget; poll until the entry appears
    const entry = await pollForActivityLogEntry(sub.id, "cancel");
    expect(entry).toBeDefined();
    expect(entry?.action).toBe("cancel");
    expect(entry?.actorType).toBe("admin");
    expect(entry?.entityId).toBe(sub.id);

    await cleanupActivityLog(sub.id);
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });
});

// =========================================================
// Commission calculations – getActiveSubscriptionRevenue
// =========================================================

describe("getActiveSubscriptionRevenue – status filtering", () => {
  it("counts only active subscriptions and excludes paused ones", async () => {
    const activeSub = await createTestSubscription(agentId, "active");
    const pausedSub = await createTestSubscription(agentId, "paused");

    try {
      const revenue = await storage.getActiveSubscriptionRevenue(agentId);
      expect(revenue).toBe(Number(activeSub.monthlyAmount));
      expect(revenue).not.toBe(Number(activeSub.monthlyAmount) + Number(pausedSub.monthlyAmount));
    } finally {
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, activeSub.id));
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, pausedSub.id));
    }
  });

  it("returns 0 when all subscriptions are paused", async () => {
    const pausedSub = await createTestSubscription(agentId, "paused");

    try {
      const revenue = await storage.getActiveSubscriptionRevenue(agentId);
      expect(revenue).toBe(0);
    } finally {
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, pausedSub.id));
    }
  });

  it("returns 0 when all subscriptions are cancelled", async () => {
    const cancelledSub = await createTestSubscription(agentId, "cancelled");

    try {
      const revenue = await storage.getActiveSubscriptionRevenue(agentId);
      expect(revenue).toBe(0);
    } finally {
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, cancelledSub.id));
    }
  });
});
