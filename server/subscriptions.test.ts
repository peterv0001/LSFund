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
// getSubscriptionsByAgent – reactivation actor attribution
//
// The subscriptions card renders "Reactivated on [date] by [name]" for
// active subscriptions that were previously paused. The name comes from
// getSubscriptionsByAgent resolving reactivatedById -> reactivatedByName.
// The UI shows the resolved name when present and falls back to "by Admin"
// when reactivatedByName is null. These tests lock in that data path so it
// cannot silently break.
// =========================================================

describe("getSubscriptionsByAgent – reactivatedByName attribution", () => {
  let adminActorId: number;
  let agentActorId: number;

  beforeAll(async () => {
    const [admin] = await db
      .insert(schema.agents)
      .values({
        email: `${TEST_EMAIL_PREFIX}-react-admin@example.com`,
        password: "not-a-real-hash",
        firstName: "Ada",
        lastName: "Adminson",
        currentRank: "agent",
        highestRank: "agent",
        isAdmin: true,
      })
      .returning();
    adminActorId = admin.id;

    const [agent] = await db
      .insert(schema.agents)
      .values({
        email: `${TEST_EMAIL_PREFIX}-react-agent@example.com`,
        password: "not-a-real-hash",
        firstName: "Gary",
        lastName: "Agentsmith",
        currentRank: "agent",
        highestRank: "agent",
      })
      .returning();
    agentActorId = agent.id;
  });

  afterAll(async () => {
    await db.delete(schema.agents).where(eq(schema.agents.id, adminActorId));
    await db.delete(schema.agents).where(eq(schema.agents.id, agentActorId));
  });

  async function getSubFromAgent(subId: number) {
    const subs = await storage.getSubscriptionsByAgent(agentId);
    return subs.find((s) => s.id === subId);
  }

  it("resolves reactivatedByName to the admin's full name when an admin reactivates", async () => {
    const sub = await createTestSubscription(agentId, "active");
    await storage.updateSubscriptionStatus(sub.id, "paused");
    await storage.updateSubscriptionStatus(sub.id, "active", adminActorId);

    const result = await getSubFromAgent(sub.id);
    expect(result).toBeDefined();
    expect(result?.status).toBe("active");
    expect(result?.reactivatedAt).not.toBeNull();
    expect(result?.reactivatedByName).toBe("Ada Adminson");

    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });

  it("resolves reactivatedByName to the agent's full name when an agent reactivates", async () => {
    const sub = await createTestSubscription(agentId, "active");
    await storage.updateSubscriptionStatus(sub.id, "paused");
    await storage.updateSubscriptionStatus(sub.id, "active", agentActorId);

    const result = await getSubFromAgent(sub.id);
    expect(result).toBeDefined();
    expect(result?.reactivatedAt).not.toBeNull();
    expect(result?.reactivatedByName).toBe("Gary Agentsmith");

    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });

  it("leaves reactivatedByName null when no actor is recorded (UI falls back to 'by Admin')", async () => {
    const sub = await createTestSubscription(agentId, "active");
    await storage.updateSubscriptionStatus(sub.id, "paused");
    await storage.updateSubscriptionStatus(sub.id, "active");

    const result = await getSubFromAgent(sub.id);
    expect(result).toBeDefined();
    expect(result?.reactivatedAt).not.toBeNull();
    expect(result?.reactivatedById).toBeNull();
    expect(result?.reactivatedByName).toBeNull();

    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });

  it("clears reactivatedByName after the subscription is paused again (nothing shown)", async () => {
    const sub = await createTestSubscription(agentId, "active");
    await storage.updateSubscriptionStatus(sub.id, "paused");
    await storage.updateSubscriptionStatus(sub.id, "active", adminActorId);

    let result = await getSubFromAgent(sub.id);
    expect(result?.reactivatedByName).toBe("Ada Adminson");

    await storage.updateSubscriptionStatus(sub.id, "paused", agentActorId);
    result = await getSubFromAgent(sub.id);
    expect(result?.status).toBe("paused");
    expect(result?.reactivatedAt).toBeNull();
    expect(result?.reactivatedByName).toBeNull();

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
    expect(entry?.actorId).toBe(adminId);
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
    expect(entry?.actorId).toBe(adminId);
    expect(entry?.entityId).toBe(sub.id);

    await cleanupActivityLog(sub.id);
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });
});

describe("admin subscription status route – activity logging on reactivate", () => {
  it("creates an activity log entry with action 'reactivate' when an admin reactivates a subscription", async () => {
    const sub = await createTestSubscription(agentId, "paused");
    const cookie = await loginAsAdmin();

    await request(testApp)
      .patch(`/api/admin/subscriptions/${sub.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "active" })
      .expect(200);

    // logActivity in the route is fire-and-forget; poll until the entry appears
    const entry = await pollForActivityLogEntry(sub.id, "reactivate");
    expect(entry).toBeDefined();
    expect(entry?.action).toBe("reactivate");
    expect(entry?.actorType).toBe("admin");
    expect(entry?.entityId).toBe(sub.id);

    await cleanupActivityLog(sub.id);
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });
});

// =========================================================
// POST /api/admin/subscriptions/calculate-commissions – HTTP route
// Verifies that the route only processes active subscriptions
// and excludes paused ones end-to-end.
// =========================================================

const COMM_ROUTE_EMAIL_PREFIX = `comm-route-test-${Date.now()}`;
let commRouteAgentId: number;

beforeAll(async () => {
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: `${COMM_ROUTE_EMAIL_PREFIX}@example.com`,
      password: "not-a-real-hash",
      firstName: "CommRoute",
      lastName: "Agent",
      currentRank: "agent",
      highestRank: "agent",
    })
    .returning();
  commRouteAgentId = agent.id;
}, 30000);

afterAll(async () => {
  await db.delete(schema.commissions).where(eq(schema.commissions.agentId, commRouteAgentId));
  await db.delete(schema.subscriptions).where(eq(schema.subscriptions.agentId, commRouteAgentId));
  await db.delete(schema.agents).where(eq(schema.agents.id, commRouteAgentId));
});

describe("POST /api/admin/subscriptions/calculate-commissions – status filtering", () => {
  it("creates a commission only for the active subscription and not for the paused one", async () => {
    const activeSub = await createTestSubscription(commRouteAgentId, "active");
    const pausedSub = await createTestSubscription(commRouteAgentId, "paused");
    try {
      const cookie = await loginAsAdmin();

      const res = await request(testApp)
        .post("/api/admin/subscriptions/calculate-commissions")
        .set("Cookie", cookie)
        .expect(200);

      expect(res.body).toHaveProperty("processed");
      expect(res.body).toHaveProperty("totalActive");

      // totalActive must be >= 1 (at least our active sub)
      expect(res.body.totalActive).toBeGreaterThanOrEqual(1);

      // The paused subscription must NOT be counted as active
      // Fetch commissions created for this agent during this run
      const agentCommissions = await db
        .select()
        .from(schema.commissions)
        .where(eq(schema.commissions.agentId, commRouteAgentId));

      // Exactly one commission: for the active sub (not the paused one)
      expect(agentCommissions).toHaveLength(1);
      expect(Number(agentCommissions[0].amount)).toBeGreaterThan(0);

      // Verify the commission amount matches the active sub's monthly amount
      // multiplied by the pool+decay rate (tier_1 = 0.50, months1to3 decay = 1.0)
      const expectedRate = 0.50 * 1.00;
      const expectedAmount = Number(activeSub.monthlyAmount) * expectedRate;
      expect(Number(agentCommissions[0].amount)).toBeCloseTo(expectedAmount, 2);
    } finally {
      await db.delete(schema.commissions).where(eq(schema.commissions.agentId, commRouteAgentId));
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, activeSub.id));
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, pausedSub.id));
    }
  });

  it("creates no commissions for the agent when all their subscriptions are paused", async () => {
    const pausedSub = await createTestSubscription(commRouteAgentId, "paused");
    try {
      const cookie = await loginAsAdmin();

      await request(testApp)
        .post("/api/admin/subscriptions/calculate-commissions")
        .set("Cookie", cookie)
        .expect(200);

      const agentCommissions = await db
        .select()
        .from(schema.commissions)
        .where(eq(schema.commissions.agentId, commRouteAgentId));

      expect(agentCommissions).toHaveLength(0);
    } finally {
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, pausedSub.id));
    }
  });

  it("does not create duplicate commissions when the route is called twice for the same period", async () => {
    const activeSub = await createTestSubscription(commRouteAgentId, "active");
    try {
      const cookie = await loginAsAdmin();

      const firstRes = await request(testApp)
        .post("/api/admin/subscriptions/calculate-commissions")
        .set("Cookie", cookie)
        .expect(200);

      // First call: commission created, skipped should be 0 for this agent's sub
      expect(firstRes.body).toHaveProperty("skipped");

      const secondRes = await request(testApp)
        .post("/api/admin/subscriptions/calculate-commissions")
        .set("Cookie", cookie)
        .expect(200);

      // Second call: commission already exists, skipped should be >= 1
      expect(secondRes.body).toHaveProperty("skipped");
      expect(secondRes.body.skipped).toBeGreaterThanOrEqual(1);
      expect(secondRes.body.processed).toBe(0);

      const agentCommissions = await db
        .select()
        .from(schema.commissions)
        .where(
          and(
            eq(schema.commissions.agentId, commRouteAgentId),
            eq(schema.commissions.subscriptionId, activeSub.id),
          )
        );

      expect(agentCommissions).toHaveLength(1);
    } finally {
      await db.delete(schema.commissions).where(eq(schema.commissions.agentId, commRouteAgentId));
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, activeSub.id));
    }
  });

  it("skips cancelled and expired subscriptions, creating a commission only for the active one", async () => {
    const activeSub = await createTestSubscription(commRouteAgentId, "active");
    const cancelledSub = await createTestSubscription(commRouteAgentId, "cancelled");
    const expiredSub = await createTestSubscription(commRouteAgentId, "expired");
    try {
      const cookie = await loginAsAdmin();

      const res = await request(testApp)
        .post("/api/admin/subscriptions/calculate-commissions")
        .set("Cookie", cookie)
        .expect(200);

      expect(res.body).toHaveProperty("processed");
      expect(res.body).toHaveProperty("totalActive");

      const agentCommissions = await db
        .select()
        .from(schema.commissions)
        .where(eq(schema.commissions.agentId, commRouteAgentId));

      // Exactly one commission: for the active sub only
      expect(agentCommissions).toHaveLength(1);
      expect(Number(agentCommissions[0].amount)).toBeGreaterThan(0);

      // Verify the commission amount matches the active sub, not the cancelled/expired ones
      const expectedRate = 0.50 * 1.00;
      const expectedAmount = Number(activeSub.monthlyAmount) * expectedRate;
      expect(Number(agentCommissions[0].amount)).toBeCloseTo(expectedAmount, 2);
    } finally {
      await db.delete(schema.commissions).where(eq(schema.commissions.agentId, commRouteAgentId));
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, activeSub.id));
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, cancelledSub.id));
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, expiredSub.id));
    }
  });
});

// =========================================================
// GET /api/subscriptions/history – All Activity timeline
// These tests spin up the real Express app and verify the
// combined history endpoint used by the AllActivityTimeline
// component: authentication, entry content, merchant labels,
// and pagination.
// =========================================================

const HISTORY_AGENT_EMAIL_PREFIX = `history-test-${Date.now()}`;
const HISTORY_AGENT_PASSWORD = "HistoryTestPass1!";
let historyAgentId: number;
let historyAgentCookie: string[];

beforeAll(async () => {
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: `${HISTORY_AGENT_EMAIL_PREFIX}@example.com`,
      password: await hashPasswordForTest(HISTORY_AGENT_PASSWORD),
      firstName: "History",
      lastName: "Agent",
      currentRank: "agent",
      highestRank: "agent",
      isAdmin: false,
    })
    .returning();
  historyAgentId = agent.id;

  const loginRes = await request(testApp)
    .post("/api/login")
    .send({
      username: `${HISTORY_AGENT_EMAIL_PREFIX}@example.com`,
      password: HISTORY_AGENT_PASSWORD,
    });
  historyAgentCookie = loginRes.headers["set-cookie"] as unknown as string[];
}, 30000);

afterAll(async () => {
  // Per-test cleanups handle individual activity log entries.
  // Clean up any leftover subscriptions and the test agent.
  await db.delete(schema.subscriptions).where(eq(schema.subscriptions.agentId, historyAgentId));
  await db.delete(schema.agents).where(eq(schema.agents.id, historyAgentId));
});

describe("GET /api/subscriptions/history – authentication", () => {
  it("returns 401 when the request is not authenticated", async () => {
    await request(testApp).get("/api/subscriptions/history").expect(401);
  });

  it("returns 200 with an authenticated agent session", async () => {
    const res = await request(testApp)
      .get("/api/subscriptions/history")
      .set("Cookie", historyAgentCookie)
      .expect(200);

    expect(res.body).toHaveProperty("logs");
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("page");
    expect(res.body).toHaveProperty("pageSize");
    expect(Array.isArray(res.body.logs)).toBe(true);
  });
});

describe("GET /api/subscriptions/history – empty history", () => {
  it("returns empty logs when the agent has no subscriptions", async () => {
    const res = await request(testApp)
      .get("/api/subscriptions/history")
      .set("Cookie", historyAgentCookie)
      .expect(200);

    // This agent has no subscriptions yet at this point in the suite
    expect(res.body.total).toBe(0);
    expect(res.body.logs).toHaveLength(0);
  });
});

describe("GET /api/subscriptions/history – activity entries after subscription actions", () => {
  it("shows a create entry in the history after the agent logs a new subscription", async () => {
    const merchantName = "New Merchant Create Test";

    const createRes = await request(testApp)
      .post("/api/subscriptions")
      .set("Cookie", historyAgentCookie)
      .send({ merchantName, tier: "tier_1" })
      .expect(201);

    const subId: number = createRes.body.id;

    try {
      // Fire-and-forget logActivity; poll until it lands
      const entry = await pollForActivityLogEntry(subId, "create");
      expect(entry).toBeDefined();
      expect(entry?.action).toBe("create");
      expect(entry?.entityType).toBe("subscription");
      expect(entry?.entityId).toBe(subId);

      // Verify the history endpoint surfaces it with the merchant name
      const res = await request(testApp)
        .get("/api/subscriptions/history")
        .set("Cookie", historyAgentCookie)
        .expect(200);

      const match = res.body.logs.find(
        (l: { action: string; entityId: number; merchantName: string }) =>
          l.action === "create" && l.entityId === subId
      );
      expect(match).toBeDefined();
      expect(match.merchantName).toBe(merchantName);
    } finally {
      await cleanupActivityLog(subId);
      // Also remove the commission created by the route
      await db.delete(schema.commissions).where(eq(schema.commissions.agentId, historyAgentId));
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, subId));
    }
  });

  it("shows a pause entry in the history after an admin pauses the agent's subscription", async () => {
    const sub = await db
      .insert(schema.subscriptions)
      .values({
        agentId: historyAgentId,
        merchantName: "History Merchant",
        tier: "tier_1",
        monthlyAmount: "199.00",
        status: "active",
      })
      .returning()
      .then(([r]) => r);

    try {
      const adminCookie = await loginAsAdmin();
      await request(testApp)
        .patch(`/api/admin/subscriptions/${sub.id}/status`)
        .set("Cookie", adminCookie)
        .send({ status: "paused" })
        .expect(200);

      // Poll until the fire-and-forget logActivity write completes
      const entry = await pollForActivityLogEntry(sub.id, "pause");
      expect(entry).toBeDefined();

      // Now verify the history endpoint returns it for the agent
      const res = await request(testApp)
        .get("/api/subscriptions/history")
        .set("Cookie", historyAgentCookie)
        .expect(200);

      const match = res.body.logs.find(
        (l: { action: string; entityId: number }) =>
          l.action === "pause" && l.entityId === sub.id
      );
      expect(match).toBeDefined();
    } finally {
      await cleanupActivityLog(sub.id);
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
    }
  });

  it("shows a cancel entry in the history after an admin cancels the agent's subscription", async () => {
    const sub = await db
      .insert(schema.subscriptions)
      .values({
        agentId: historyAgentId,
        merchantName: "History Merchant",
        tier: "tier_1",
        monthlyAmount: "199.00",
        status: "active",
      })
      .returning()
      .then(([r]) => r);

    try {
      const adminCookie = await loginAsAdmin();
      await request(testApp)
        .patch(`/api/admin/subscriptions/${sub.id}/status`)
        .set("Cookie", adminCookie)
        .send({ status: "cancelled" })
        .expect(200);

      const entry = await pollForActivityLogEntry(sub.id, "cancel");
      expect(entry).toBeDefined();

      const res = await request(testApp)
        .get("/api/subscriptions/history")
        .set("Cookie", historyAgentCookie)
        .expect(200);

      const match = res.body.logs.find(
        (l: { action: string; entityId: number }) =>
          l.action === "cancel" && l.entityId === sub.id
      );
      expect(match).toBeDefined();
    } finally {
      await cleanupActivityLog(sub.id);
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
    }
  });

  it("shows a reactivate entry in the history after an admin reactivates a paused subscription", async () => {
    const sub = await db
      .insert(schema.subscriptions)
      .values({
        agentId: historyAgentId,
        merchantName: "History Merchant",
        tier: "tier_1",
        monthlyAmount: "199.00",
        status: "paused",
      })
      .returning()
      .then(([r]) => r);

    try {
      const adminCookie = await loginAsAdmin();
      await request(testApp)
        .patch(`/api/admin/subscriptions/${sub.id}/status`)
        .set("Cookie", adminCookie)
        .send({ status: "active" })
        .expect(200);

      const entry = await pollForActivityLogEntry(sub.id, "reactivate");
      expect(entry).toBeDefined();

      const res = await request(testApp)
        .get("/api/subscriptions/history")
        .set("Cookie", historyAgentCookie)
        .expect(200);

      const match = res.body.logs.find(
        (l: { action: string; entityId: number }) =>
          l.action === "reactivate" && l.entityId === sub.id
      );
      expect(match).toBeDefined();
    } finally {
      await cleanupActivityLog(sub.id);
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
    }
  });

  it("shows a pause entry with actorType 'agent' in the history after the agent self-service pauses their subscription", async () => {
    const sub = await db
      .insert(schema.subscriptions)
      .values({
        agentId: historyAgentId,
        merchantName: "Agent Self-Service Pause Merchant",
        tier: "tier_1",
        monthlyAmount: "199.00",
        status: "active",
      })
      .returning()
      .then(([r]) => r);

    try {
      await request(testApp)
        .patch(`/api/subscriptions/${sub.id}/status`)
        .set("Cookie", historyAgentCookie)
        .send({ status: "paused" })
        .expect(200);

      const entry = await pollForActivityLogEntry(sub.id, "pause");
      expect(entry).toBeDefined();

      const res = await request(testApp)
        .get("/api/subscriptions/history")
        .set("Cookie", historyAgentCookie)
        .expect(200);

      const match = res.body.logs.find(
        (l: { action: string; entityId: number; actorType: string }) =>
          l.action === "pause" && l.entityId === sub.id
      );
      expect(match).toBeDefined();
      expect(match.actorType).toBe("agent");
    } finally {
      await cleanupActivityLog(sub.id);
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
    }
  });

  it("shows a cancel entry with actorType 'agent' in the history after the agent self-service cancels their subscription", async () => {
    const sub = await db
      .insert(schema.subscriptions)
      .values({
        agentId: historyAgentId,
        merchantName: "Agent Self-Service Cancel Merchant",
        tier: "tier_1",
        monthlyAmount: "199.00",
        status: "active",
      })
      .returning()
      .then(([r]) => r);

    try {
      await request(testApp)
        .patch(`/api/subscriptions/${sub.id}/status`)
        .set("Cookie", historyAgentCookie)
        .send({ status: "cancelled" })
        .expect(200);

      const entry = await pollForActivityLogEntry(sub.id, "cancel");
      expect(entry).toBeDefined();

      const res = await request(testApp)
        .get("/api/subscriptions/history")
        .set("Cookie", historyAgentCookie)
        .expect(200);

      const match = res.body.logs.find(
        (l: { action: string; entityId: number; actorType: string }) =>
          l.action === "cancel" && l.entityId === sub.id
      );
      expect(match).toBeDefined();
      expect(match.actorType).toBe("agent");
    } finally {
      await cleanupActivityLog(sub.id);
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
    }
  });

  it("shows a reactivate entry with actorType 'agent' in the history after the agent self-service reactivates their subscription", async () => {
    const sub = await db
      .insert(schema.subscriptions)
      .values({
        agentId: historyAgentId,
        merchantName: "Agent Self-Service Reactivate Merchant",
        tier: "tier_1",
        monthlyAmount: "199.00",
        status: "paused",
      })
      .returning()
      .then(([r]) => r);

    try {
      await request(testApp)
        .patch(`/api/subscriptions/${sub.id}/status`)
        .set("Cookie", historyAgentCookie)
        .send({ status: "active" })
        .expect(200);

      const entry = await pollForActivityLogEntry(sub.id, "reactivate");
      expect(entry).toBeDefined();

      const res = await request(testApp)
        .get("/api/subscriptions/history")
        .set("Cookie", historyAgentCookie)
        .expect(200);

      const match = res.body.logs.find(
        (l: { action: string; entityId: number; actorType: string }) =>
          l.action === "reactivate" && l.entityId === sub.id
      );
      expect(match).toBeDefined();
      expect(match.actorType).toBe("agent");
    } finally {
      await cleanupActivityLog(sub.id);
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
    }
  });
});

describe("GET /api/subscriptions/history – merchant name label", () => {
  it("includes the correct merchantName on each activity entry", async () => {
    const merchantName = "Merchant Label Test Co";
    const sub = await db
      .insert(schema.subscriptions)
      .values({
        agentId: historyAgentId,
        merchantName,
        tier: "tier_1",
        monthlyAmount: "149.00",
        status: "active",
      })
      .returning()
      .then(([r]) => r);

    try {
      // Insert an activity log entry directly for speed and control
      await storage.logActivity({
        actorId: historyAgentId,
        actorType: "agent",
        action: "pause",
        entityType: "subscription",
        entityId: sub.id,
        description: "Test pause for merchant name assertion",
      });

      const res = await request(testApp)
        .get("/api/subscriptions/history")
        .set("Cookie", historyAgentCookie)
        .expect(200);

      const match = res.body.logs.find(
        (l: { action: string; entityId: number; merchantName: string }) =>
          l.entityId === sub.id && l.action === "pause"
      );
      expect(match).toBeDefined();
      expect(match.merchantName).toBe(merchantName);
    } finally {
      await cleanupActivityLog(sub.id);
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
    }
  });

  it("does not expose other agents' subscriptions in the history", async () => {
    // Create a second agent with its own subscription and activity
    const [otherAgent] = await db
      .insert(schema.agents)
      .values({
        email: `other-history-${Date.now()}@example.com`,
        password: "not-a-real-hash",
        firstName: "Other",
        lastName: "Agent",
        currentRank: "agent",
        highestRank: "agent",
      })
      .returning();

    const [otherSub] = await db
      .insert(schema.subscriptions)
      .values({
        agentId: otherAgent.id,
        merchantName: "Other Agent Merchant",
        tier: "tier_1",
        monthlyAmount: "99.00",
        status: "active",
      })
      .returning();

    await storage.logActivity({
      actorId: otherAgent.id,
      actorType: "agent",
      action: "pause",
      entityType: "subscription",
      entityId: otherSub.id,
      description: "Should not appear in historyAgent history",
    });

    try {
      const res = await request(testApp)
        .get("/api/subscriptions/history")
        .set("Cookie", historyAgentCookie)
        .expect(200);

      const leaked = res.body.logs.find(
        (l: { entityId: number }) => l.entityId === otherSub.id
      );
      expect(leaked).toBeUndefined();
    } finally {
      await cleanupActivityLog(otherSub.id);
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, otherSub.id));
      await db.delete(schema.agents).where(eq(schema.agents.id, otherAgent.id));
    }
  });
});

describe("GET /api/subscriptions/history – pagination", () => {
  it("returns the first page of entries and correct total when there are more than 20 entries", async () => {
    const sub = await db
      .insert(schema.subscriptions)
      .values({
        agentId: historyAgentId,
        merchantName: "Pagination Merchant",
        tier: "tier_1",
        monthlyAmount: "99.00",
        status: "active",
      })
      .returning()
      .then(([r]) => r);

    const TOTAL_ENTRIES = 25;
    try {
      // Insert 25 activity log entries directly for speed
      for (let i = 0; i < TOTAL_ENTRIES; i++) {
        await storage.logActivity({
          actorId: historyAgentId,
          actorType: "agent",
          action: "pause",
          entityType: "subscription",
          entityId: sub.id,
          description: `Pagination test entry ${i + 1}`,
        });
      }

      const page1 = await request(testApp)
        .get("/api/subscriptions/history?page=1&pageSize=20")
        .set("Cookie", historyAgentCookie)
        .expect(200);

      expect(page1.body.total).toBeGreaterThanOrEqual(TOTAL_ENTRIES);
      expect(page1.body.logs).toHaveLength(20);
      expect(page1.body.page).toBe(1);
      expect(page1.body.pageSize).toBe(20);
    } finally {
      await cleanupActivityLog(sub.id);
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
    }
  });

  it("returns the second page with the remaining entries", async () => {
    const sub = await db
      .insert(schema.subscriptions)
      .values({
        agentId: historyAgentId,
        merchantName: "Pagination Merchant",
        tier: "tier_1",
        monthlyAmount: "99.00",
        status: "active",
      })
      .returning()
      .then(([r]) => r);

    const TOTAL_ENTRIES = 25;
    try {
      for (let i = 0; i < TOTAL_ENTRIES; i++) {
        await storage.logActivity({
          actorId: historyAgentId,
          actorType: "agent",
          action: "pause",
          entityType: "subscription",
          entityId: sub.id,
          description: `Pagination test entry ${i + 1}`,
        });
      }

      const page2 = await request(testApp)
        .get("/api/subscriptions/history?page=2&pageSize=20")
        .set("Cookie", historyAgentCookie)
        .expect(200);

      expect(page2.body.page).toBe(2);
      expect(page2.body.logs.length).toBeGreaterThanOrEqual(TOTAL_ENTRIES - 20);
      expect(page2.body.logs.length).toBeLessThanOrEqual(20);
    } finally {
      await cleanupActivityLog(sub.id);
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
    }
  });

  it("respects the pageSize cap of 50", async () => {
    const res = await request(testApp)
      .get("/api/subscriptions/history?pageSize=100")
      .set("Cookie", historyAgentCookie)
      .expect(200);

    expect(res.body.pageSize).toBe(50);
  });
});

// =========================================================
// PATCH /api/subscriptions/:id/status – agent-initiated status changes
// Verifies that the activity log entry's actorId matches the
// authenticated agent and actorType is 'agent'.
// =========================================================

const AGENT_ROUTE_EMAIL_PREFIX = `agent-route-test-${Date.now()}`;
const AGENT_ROUTE_PASSWORD = "AgentTestPass1!";
let agentRouteAgentId: number;

beforeAll(async () => {
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: `${AGENT_ROUTE_EMAIL_PREFIX}@example.com`,
      password: await hashPasswordForTest(AGENT_ROUTE_PASSWORD),
      firstName: "AgentRoute",
      lastName: "Tester",
      currentRank: "agent",
      highestRank: "agent",
    })
    .returning();
  agentRouteAgentId = agent.id;
}, 30000);

afterAll(async () => {
  await db.delete(schema.subscriptions).where(eq(schema.subscriptions.agentId, agentRouteAgentId));
  await db.delete(schema.agents).where(eq(schema.agents.id, agentRouteAgentId));
});

async function loginAsAgent(): Promise<string[]> {
  const res = await request(testApp)
    .post("/api/login")
    .send({ username: `${AGENT_ROUTE_EMAIL_PREFIX}@example.com`, password: AGENT_ROUTE_PASSWORD });
  return res.headers["set-cookie"] as unknown as string[];
}

describe("agent subscription status route – activity logging on pause", () => {
  it("logs actorId equal to the agent's ID and actorType 'agent' when an agent pauses their subscription", async () => {
    const sub = await createTestSubscription(agentRouteAgentId, "active");
    const cookie = await loginAsAgent();

    await request(testApp)
      .patch(`/api/subscriptions/${sub.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "paused" })
      .expect(200);

    const entry = await pollForActivityLogEntry(sub.id, "pause");
    expect(entry).toBeDefined();
    expect(entry?.action).toBe("pause");
    expect(entry?.actorType).toBe("agent");
    expect(entry?.actorId).toBe(agentRouteAgentId);
    expect(entry?.entityId).toBe(sub.id);

    await cleanupActivityLog(sub.id);
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });
});

describe("agent subscription status route – activity logging on cancel", () => {
  it("logs actorId equal to the agent's ID and actorType 'agent' when an agent cancels their subscription", async () => {
    const sub = await createTestSubscription(agentRouteAgentId, "active");
    const cookie = await loginAsAgent();

    await request(testApp)
      .patch(`/api/subscriptions/${sub.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "cancelled" })
      .expect(200);

    const entry = await pollForActivityLogEntry(sub.id, "cancel");
    expect(entry).toBeDefined();
    expect(entry?.action).toBe("cancel");
    expect(entry?.actorType).toBe("agent");
    expect(entry?.actorId).toBe(agentRouteAgentId);
    expect(entry?.entityId).toBe(sub.id);

    await cleanupActivityLog(sub.id);
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });
});

describe("agent subscription status route – activity logging on reactivate", () => {
  it("logs actorId equal to the agent's ID and actorType 'agent' when an agent reactivates their paused subscription", async () => {
    const sub = await createTestSubscription(agentRouteAgentId, "paused");
    const cookie = await loginAsAgent();

    await request(testApp)
      .patch(`/api/subscriptions/${sub.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "active" })
      .expect(200);

    const entry = await pollForActivityLogEntry(sub.id, "reactivate");
    expect(entry).toBeDefined();
    expect(entry?.action).toBe("reactivate");
    expect(entry?.actorType).toBe("agent");
    expect(entry?.actorId).toBe(agentRouteAgentId);
    expect(entry?.entityId).toBe(sub.id);

    await cleanupActivityLog(sub.id);
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });
});

// =========================================================
// PATCH /api/subscriptions/:id/status – cross-agent access guard
// Verifies that an agent cannot change another agent's subscription.
// =========================================================

const AGENT_B_EMAIL_PREFIX = `agent-b-test-${Date.now()}`;
const AGENT_B_PASSWORD = "AgentBTestPass1!";
let agentBId: number;

beforeAll(async () => {
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: `${AGENT_B_EMAIL_PREFIX}@example.com`,
      password: await hashPasswordForTest(AGENT_B_PASSWORD),
      firstName: "AgentB",
      lastName: "CrossTest",
      currentRank: "agent",
      highestRank: "agent",
    })
    .returning();
  agentBId = agent.id;
}, 30000);

afterAll(async () => {
  await db.delete(schema.agents).where(eq(schema.agents.id, agentBId));
});

describe("agent subscription status route – cross-agent access guard", () => {
  it("returns 404 when agent B tries to update a subscription owned by agent A", async () => {
    const subOwnedByAgentA = await createTestSubscription(agentRouteAgentId, "active");

    try {
      const loginRes = await request(testApp)
        .post("/api/login")
        .send({ username: `${AGENT_B_EMAIL_PREFIX}@example.com`, password: AGENT_B_PASSWORD });
      expect(loginRes.status).toBe(200);
      const agentBCookie = loginRes.headers["set-cookie"] as unknown as string[];

      await request(testApp)
        .patch(`/api/subscriptions/${subOwnedByAgentA.id}/status`)
        .set("Cookie", agentBCookie)
        .send({ status: "paused" })
        .expect(404);
    } finally {
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, subOwnedByAgentA.id));
    }
  });
});

// =========================================================
// GET /api/subscriptions – cross-agent read isolation
// Verifies that agent B cannot enumerate agent A's subscriptions
// via the GET /api/subscriptions endpoint.
// =========================================================

describe("GET /api/subscriptions – cross-agent read isolation", () => {
  it("does not return agent A's subscription IDs when logged in as agent B", async () => {
    const subOwnedByAgentA = await createTestSubscription(agentRouteAgentId, "active");

    try {
      const loginRes = await request(testApp)
        .post("/api/login")
        .send({ username: `${AGENT_B_EMAIL_PREFIX}@example.com`, password: AGENT_B_PASSWORD });
      expect(loginRes.status).toBe(200);
      const agentBCookie = loginRes.headers["set-cookie"] as unknown as string[];

      const res = await request(testApp)
        .get("/api/subscriptions")
        .set("Cookie", agentBCookie)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const returnedIds = (res.body as Array<{ id: number }>).map((s) => s.id);
      expect(returnedIds).not.toContain(subOwnedByAgentA.id);
    } finally {
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, subOwnedByAgentA.id));
    }
  });

  it("returns only agent B's own subscriptions and none belonging to agent A", async () => {
    const subOwnedByAgentA = await createTestSubscription(agentRouteAgentId, "active");
    const subOwnedByAgentB = await createTestSubscription(agentBId, "active");

    try {
      const loginRes = await request(testApp)
        .post("/api/login")
        .send({ username: `${AGENT_B_EMAIL_PREFIX}@example.com`, password: AGENT_B_PASSWORD });
      expect(loginRes.status).toBe(200);
      const agentBCookie = loginRes.headers["set-cookie"] as unknown as string[];

      const res = await request(testApp)
        .get("/api/subscriptions")
        .set("Cookie", agentBCookie)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const returnedIds = (res.body as Array<{ id: number }>).map((s) => s.id);
      expect(returnedIds).toContain(subOwnedByAgentB.id);
      expect(returnedIds).not.toContain(subOwnedByAgentA.id);
    } finally {
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, subOwnedByAgentA.id));
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, subOwnedByAgentB.id));
    }
  });
});

// =========================================================
// GET /api/subscriptions/history – cross-agent read isolation
// Verifies that agent B cannot see agent A's activity log
// entries via the GET /api/subscriptions/history endpoint.
// =========================================================

describe("GET /api/subscriptions/history – cross-agent read isolation", () => {
  it("does not return activity log entries for agent A's subscriptions when logged in as agent B", async () => {
    const subOwnedByAgentA = await createTestSubscription(agentRouteAgentId, "active");

    try {
      await storage.logActivity({
        actorId: agentRouteAgentId,
        actorType: "agent",
        action: "pause",
        entityType: "subscription",
        entityId: subOwnedByAgentA.id,
        description: "Cross-agent history isolation test entry",
      });

      const loginRes = await request(testApp)
        .post("/api/login")
        .send({ username: `${AGENT_B_EMAIL_PREFIX}@example.com`, password: AGENT_B_PASSWORD });
      expect(loginRes.status).toBe(200);
      const agentBCookie = loginRes.headers["set-cookie"] as unknown as string[];

      const res = await request(testApp)
        .get("/api/subscriptions/history")
        .set("Cookie", agentBCookie)
        .expect(200);

      expect(res.body).toHaveProperty("logs");
      expect(Array.isArray(res.body.logs)).toBe(true);
      const returnedEntityIds = (res.body.logs as Array<{ entityId: number }>).map(
        (l) => l.entityId
      );
      expect(returnedEntityIds).not.toContain(subOwnedByAgentA.id);
    } finally {
      await cleanupActivityLog(subOwnedByAgentA.id);
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, subOwnedByAgentA.id));
    }
  });
});

// =========================================================
// GET /api/subscriptions/:id/history – cross-agent read isolation
// Verifies that agent B cannot read the per-subscription activity
// timeline of agent A's subscription by passing its ID.
// =========================================================

describe("GET /api/subscriptions/:id/history – cross-agent read isolation", () => {
  it("blocks agent B from fetching agent A's per-subscription history by ID", async () => {
    const subOwnedByAgentA = await createTestSubscription(agentRouteAgentId, "active");

    try {
      await storage.logActivity({
        actorId: agentRouteAgentId,
        actorType: "agent",
        action: "pause",
        entityType: "subscription",
        entityId: subOwnedByAgentA.id,
        description: "Cross-agent per-subscription history isolation test entry",
      });

      const loginRes = await request(testApp)
        .post("/api/login")
        .send({ username: `${AGENT_B_EMAIL_PREFIX}@example.com`, password: AGENT_B_PASSWORD });
      expect(loginRes.status).toBe(200);
      const agentBCookie = loginRes.headers["set-cookie"] as unknown as string[];

      const res = await request(testApp)
        .get(`/api/subscriptions/${subOwnedByAgentA.id}/history`)
        .set("Cookie", agentBCookie);

      expect([403, 404]).toContain(res.status);
      expect(res.status).not.toBe(200);
    } finally {
      await cleanupActivityLog(subOwnedByAgentA.id);
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, subOwnedByAgentA.id));
    }
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

  it("returns 0 when all subscriptions are expired", async () => {
    const expiredSub = await createTestSubscription(agentId, "expired");

    try {
      const revenue = await storage.getActiveSubscriptionRevenue(agentId);
      expect(revenue).toBe(0);
    } finally {
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, expiredSub.id));
    }
  });
});

// =========================================================
// Storage layer – getSubscriptionsDueForExpiry
// =========================================================

async function createTestSubscriptionWithEndDate(
  agentId: number,
  status: "active" | "paused" | "cancelled" | "expired",
  endDate: Date | null
) {
  const [sub] = await db
    .insert(schema.subscriptions)
    .values({
      agentId,
      merchantName: "Expiry Test Corp",
      tier: "tier_1",
      monthlyAmount: "99.00",
      status,
      endDate,
    })
    .returning();
  return sub;
}

describe("getSubscriptionsDueForExpiry – returns subscriptions past their endDate", () => {
  it("returns an active subscription whose endDate is in the past", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sub = await createTestSubscriptionWithEndDate(agentId, "active", pastDate);

    try {
      const due = await storage.getSubscriptionsDueForExpiry();
      const ids = due.map((s) => s.id);
      expect(ids).toContain(sub.id);
    } finally {
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
    }
  });

  it("returns a paused subscription whose endDate is in the past", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sub = await createTestSubscriptionWithEndDate(agentId, "paused", pastDate);

    try {
      const due = await storage.getSubscriptionsDueForExpiry();
      const ids = due.map((s) => s.id);
      expect(ids).toContain(sub.id);
    } finally {
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
    }
  });
});

describe("getSubscriptionsDueForExpiry – excludes subscriptions that should not be expired", () => {
  it("does not include a subscription with no endDate", async () => {
    const sub = await createTestSubscriptionWithEndDate(agentId, "active", null);

    try {
      const due = await storage.getSubscriptionsDueForExpiry();
      const ids = due.map((s) => s.id);
      expect(ids).not.toContain(sub.id);
    } finally {
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
    }
  });

  it("does not include an active subscription with a future endDate", async () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const sub = await createTestSubscriptionWithEndDate(agentId, "active", futureDate);

    try {
      const due = await storage.getSubscriptionsDueForExpiry();
      const ids = due.map((s) => s.id);
      expect(ids).not.toContain(sub.id);
    } finally {
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
    }
  });

  it("does not include an already-expired subscription even with a past endDate", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sub = await createTestSubscriptionWithEndDate(agentId, "expired", pastDate);

    try {
      const due = await storage.getSubscriptionsDueForExpiry();
      const ids = due.map((s) => s.id);
      expect(ids).not.toContain(sub.id);
    } finally {
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
    }
  });

  it("does not include a cancelled subscription even with a past endDate", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sub = await createTestSubscriptionWithEndDate(agentId, "cancelled", pastDate);

    try {
      const due = await storage.getSubscriptionsDueForExpiry();
      const ids = due.map((s) => s.id);
      expect(ids).not.toContain(sub.id);
    } finally {
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
    }
  });
});
