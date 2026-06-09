import { describe, it, expect, beforeAll, afterAll } from "vitest";
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

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run subscription system actor tests");
}

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const scryptAsync = promisify(scryptCallback);

async function hashPasswordForTest(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

const TS = Date.now();
const TEST_PREFIX = `sys-actor-test-${TS}`;
const PASSWORD = "SysActorPass1!";

let agentId: number;
let adminId: number;
let subscriptionId: number;
let testApp: ReturnType<typeof express>;

async function createAgent(suffix: string, opts: { isAdmin?: boolean } = {}) {
  const { isAdmin = false } = opts;
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: `${TEST_PREFIX}-${suffix}@example.com`,
      password: await hashPasswordForTest(PASSWORD),
      firstName: "Sys",
      lastName: isAdmin ? "Admin" : "Agent",
      currentRank: "agent",
      highestRank: "agent",
      isAdmin,
    })
    .returning();
  return agent;
}

async function login(email: string): Promise<string[]> {
  const res = await request(testApp)
    .post("/api/login")
    .send({ username: email, password: PASSWORD });
  return res.headers["set-cookie"] as unknown as string[];
}

beforeAll(async () => {
  const agent = await createAgent("agent");
  agentId = agent.id;

  const admin = await createAgent("admin", { isAdmin: true });
  adminId = admin.id;

  const [sub] = await db
    .insert(schema.subscriptions)
    .values({
      agentId,
      merchantName: "System Actor Merchant",
      tier: "tier_1",
      monthlyAmount: "199.00",
      status: "active",
    })
    .returning();
  subscriptionId = sub.id;

  // Automated/system-driven change: actorType 'system' with a non-null actorId (0).
  // This simulates the scheduler/webhook-driven activity that should display as "System".
  await db.insert(schema.activityLog).values({
    actorId: 0,
    actorType: "system",
    action: "update",
    entityType: "subscription",
    entityId: subscriptionId,
    description: `Subscription #${subscriptionId} automatically expired`,
  });

  testApp = express();
  testApp.use(express.json());
  const httpServer = createServer(testApp);
  await registerRoutes(httpServer, testApp);
}, 30000);

afterAll(async () => {
  await db.delete(schema.activityLog).where(eq(schema.activityLog.entityId, subscriptionId));
  await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, subscriptionId));
  await db.delete(schema.agents).where(inArray(schema.agents.id, [agentId, adminId]));
  await testPool.end();
});

describe("System actor display for automated subscription changes", () => {
  it("GET /api/admin/subscriptions/:id/activity returns actorName 'System' for system actorType", async () => {
    const cookie = await login(`${TEST_PREFIX}-admin@example.com`);
    const res = await request(testApp)
      .get(`/api/admin/subscriptions/${subscriptionId}/activity`)
      .set("Cookie", cookie)
      .expect(200);

    const systemEntry = res.body.find(
      (e: { actorType: string; action: string }) =>
        e.actorType === "system" && e.action === "update",
    );
    expect(systemEntry).toBeDefined();
    expect(systemEntry.actorName).toBe("System");
    // actorId is non-null (0) but must NOT surface as a cryptic "#0".
    expect(systemEntry.actorName).not.toContain("#");
  });

  it("GET /api/subscriptions/:id/history returns actorName 'System' for system actorType", async () => {
    const cookie = await login(`${TEST_PREFIX}-agent@example.com`);
    const res = await request(testApp)
      .get(`/api/subscriptions/${subscriptionId}/history`)
      .set("Cookie", cookie)
      .expect(200);

    const systemEntry = res.body.find(
      (e: { actorType: string; action: string }) =>
        e.actorType === "system" && e.action === "update",
    );
    expect(systemEntry).toBeDefined();
    expect(systemEntry.actorName).toBe("System");
    expect(systemEntry.actorName).not.toContain("#");
  });

  it("treats actorId = 0 with actorType 'system' as System (not '#0') in both endpoints", async () => {
    const adminCookie = await login(`${TEST_PREFIX}-admin@example.com`);
    const adminRes = await request(testApp)
      .get(`/api/admin/subscriptions/${subscriptionId}/activity`)
      .set("Cookie", adminCookie)
      .expect(200);
    const adminSystemEntries = adminRes.body.filter(
      (e: { actorType: string }) => e.actorType === "system",
    );
    expect(adminSystemEntries.length).toBeGreaterThan(0);
    for (const entry of adminSystemEntries) {
      expect(entry.actorName).toBe("System");
    }

    const agentCookie = await login(`${TEST_PREFIX}-agent@example.com`);
    const agentRes = await request(testApp)
      .get(`/api/subscriptions/${subscriptionId}/history`)
      .set("Cookie", agentCookie)
      .expect(200);
    const agentSystemEntries = agentRes.body.filter(
      (e: { actorType: string }) => e.actorType === "system",
    );
    expect(agentSystemEntries.length).toBeGreaterThan(0);
    for (const entry of agentSystemEntries) {
      expect(entry.actorName).toBe("System");
    }
  });
});
