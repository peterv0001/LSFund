import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
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
  throw new Error("DATABASE_URL must be set to run agent subscription count tests");
}

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const scryptAsync = promisify(scryptCallback);

async function hashPasswordForTest(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

const TEST_PREFIX = `sub-count-test-${Date.now()}`;
const ADMIN_PASSWORD = "AdminSubCountPass1!";

let testAgentId: number;
let adminId: number;
let testApp: ReturnType<typeof express>;

async function createAgent(suffix: string, isAdmin = false) {
  const password = isAdmin ? await hashPasswordForTest(ADMIN_PASSWORD) : "not-a-real-hash";
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: `${TEST_PREFIX}-${suffix}@example.com`,
      password,
      firstName: "Count",
      lastName: "Test",
      currentRank: "agent",
      highestRank: "agent",
      isAdmin,
    })
    .returning();
  return agent;
}

async function createSubscription(
  agentId: number,
  status: "active" | "paused" | "cancelled" | "expired"
) {
  const [sub] = await db
    .insert(schema.subscriptions)
    .values({
      agentId,
      merchantName: "Count Test Merchant",
      tier: "tier_1",
      monthlyAmount: "99.00",
      status,
    })
    .returning();
  return sub;
}

beforeAll(async () => {
  const agent = await createAgent("main");
  testAgentId = agent.id;

  const admin = await createAgent("admin", true);
  adminId = admin.id;

  testApp = express();
  testApp.use(express.json());
  const httpServer = createServer(testApp);
  await registerRoutes(httpServer, testApp);
}, 30000);

afterAll(async () => {
  await db.delete(schema.subscriptions).where(eq(schema.subscriptions.agentId, testAgentId));
  await db.delete(schema.agents).where(eq(schema.agents.id, testAgentId));
  await db.delete(schema.agents).where(eq(schema.agents.id, adminId));
  await testPool.end();
});

async function loginAsAdmin(): Promise<string[]> {
  const res = await request(testApp)
    .post("/api/login")
    .send({ username: `${TEST_PREFIX}-admin@example.com`, password: ADMIN_PASSWORD });
  return res.headers["set-cookie"] as unknown as string[];
}

// =========================================================
// Storage layer – getAgentsPaginated subscription counts
// =========================================================

describe("getAgentsPaginated – activeSubscriptionCount vs totalSubscriptionCount", () => {
  it("returns 0 for both counts when the agent has no subscriptions", async () => {
    const result = await storage.getAgentsPaginated(1, 100, {
      search: `${TEST_PREFIX}-main@example.com`,
    });
    const agent = result.agents.find((a) => a.id === testAgentId);
    expect(agent).toBeDefined();
    expect(agent!.totalSubscriptionCount).toBe(0);
    expect(agent!.activeSubscriptionCount).toBe(0);
  });

  it("counts only active subscriptions in activeSubscriptionCount", async () => {
    const activeSub = await createSubscription(testAgentId, "active");
    const cancelledSub = await createSubscription(testAgentId, "cancelled");
    const pausedSub = await createSubscription(testAgentId, "paused");

    try {
      const result = await storage.getAgentsPaginated(1, 100, {
        search: `${TEST_PREFIX}-main@example.com`,
      });
      const agent = result.agents.find((a) => a.id === testAgentId);
      expect(agent).toBeDefined();
      expect(agent!.activeSubscriptionCount).toBe(1);
      expect(agent!.totalSubscriptionCount).toBe(3);
    } finally {
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, activeSub.id));
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, cancelledSub.id));
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, pausedSub.id));
    }
  });

  it("reflects multiple active subscriptions correctly", async () => {
    const active1 = await createSubscription(testAgentId, "active");
    const active2 = await createSubscription(testAgentId, "active");
    const paused = await createSubscription(testAgentId, "paused");

    try {
      const result = await storage.getAgentsPaginated(1, 100, {
        search: `${TEST_PREFIX}-main@example.com`,
      });
      const agent = result.agents.find((a) => a.id === testAgentId);
      expect(agent).toBeDefined();
      expect(agent!.activeSubscriptionCount).toBe(2);
      expect(agent!.totalSubscriptionCount).toBe(3);
    } finally {
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, active1.id));
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, active2.id));
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, paused.id));
    }
  });

  it("returns 0 for activeSubscriptionCount when all subscriptions are cancelled or paused", async () => {
    const cancelled = await createSubscription(testAgentId, "cancelled");
    const paused = await createSubscription(testAgentId, "paused");

    try {
      const result = await storage.getAgentsPaginated(1, 100, {
        search: `${TEST_PREFIX}-main@example.com`,
      });
      const agent = result.agents.find((a) => a.id === testAgentId);
      expect(agent).toBeDefined();
      expect(agent!.activeSubscriptionCount).toBe(0);
      expect(agent!.totalSubscriptionCount).toBe(2);
    } finally {
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, cancelled.id));
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, paused.id));
    }
  });
});

// =========================================================
// HTTP route – GET /api/admin/agents subscription counts
// =========================================================

describe("GET /api/admin/agents – activeSubscriptionCount and totalSubscriptionCount in response", () => {
  it("returns agents with both count fields including the seeded test agent", async () => {
    const cookie = await loginAsAdmin();
    const res = await request(testApp)
      .get(`/api/admin/agents?search=${encodeURIComponent(`${TEST_PREFIX}-main@example.com`)}`)
      .set("Cookie", cookie)
      .expect(200);

    expect(res.body).toHaveProperty("agents");
    expect(Array.isArray(res.body.agents)).toBe(true);
    expect(res.body.agents).toHaveLength(1);

    const agent = res.body.agents[0];
    expect(agent.id).toBe(testAgentId);
    expect(agent).toHaveProperty("activeSubscriptionCount");
    expect(agent).toHaveProperty("totalSubscriptionCount");
    expect(typeof agent.activeSubscriptionCount).toBe("number");
    expect(typeof agent.totalSubscriptionCount).toBe("number");
  });

  it("reports correct counts for an agent with mixed-status subscriptions", async () => {
    const activeSub = await createSubscription(testAgentId, "active");
    const cancelledSub = await createSubscription(testAgentId, "cancelled");
    const pausedSub = await createSubscription(testAgentId, "paused");

    try {
      const cookie = await loginAsAdmin();
      const res = await request(testApp)
        .get(`/api/admin/agents?search=${encodeURIComponent(`${TEST_PREFIX}-main@example.com`)}`)
        .set("Cookie", cookie)
        .expect(200);

      expect(res.body.agents).toHaveLength(1);
      const agent = res.body.agents[0];
      expect(agent.id).toBe(testAgentId);
      expect(agent.activeSubscriptionCount).toBe(1);
      expect(agent.totalSubscriptionCount).toBe(3);
    } finally {
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, activeSub.id));
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, cancelledSub.id));
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, pausedSub.id));
    }
  });

  it("returns totalSubscriptionCount equal to activeSubscriptionCount when all subscriptions are active", async () => {
    const active1 = await createSubscription(testAgentId, "active");
    const active2 = await createSubscription(testAgentId, "active");

    try {
      const cookie = await loginAsAdmin();
      const res = await request(testApp)
        .get(`/api/admin/agents?search=${encodeURIComponent(`${TEST_PREFIX}-main@example.com`)}`)
        .set("Cookie", cookie)
        .expect(200);

      const agent = res.body.agents[0];
      expect(agent.activeSubscriptionCount).toBe(2);
      expect(agent.totalSubscriptionCount).toBe(2);
      expect(agent.activeSubscriptionCount).toBe(agent.totalSubscriptionCount);
    } finally {
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, active1.id));
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, active2.id));
    }
  });

  it("returns activeSubscriptionCount of 0 when the agent has no active subscriptions", async () => {
    const expired = await createSubscription(testAgentId, "expired");
    const cancelled = await createSubscription(testAgentId, "cancelled");

    try {
      const cookie = await loginAsAdmin();
      const res = await request(testApp)
        .get(`/api/admin/agents?search=${encodeURIComponent(`${TEST_PREFIX}-main@example.com`)}`)
        .set("Cookie", cookie)
        .expect(200);

      const agent = res.body.agents[0];
      expect(agent.activeSubscriptionCount).toBe(0);
      expect(agent.totalSubscriptionCount).toBe(2);
    } finally {
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, expired.id));
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, cancelled.id));
    }
  });

  it("requires admin authentication and returns 401 for unauthenticated requests", async () => {
    await request(testApp).get("/api/admin/agents").expect(401);
  });
});
