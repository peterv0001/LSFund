import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, desc } from "drizzle-orm";
import * as schema from "@shared/schema";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import { scrypt as scryptCallback, randomBytes } from "crypto";
import { promisify } from "util";
import { registerRoutes } from "../routes.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run calculate-commissions dedup tests");
}

const scryptAsync = promisify(scryptCallback);

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const TS = Date.now();
const ADMIN_EMAIL = `calc-comm-dedup-admin-${TS}@example.com`;
const ADMIN_PASSWORD = "CalcCommDedup1!";

let adminId: number;
let agentId: number;
let subscriptionId: number;
let testApp: ReturnType<typeof express>;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function loginAsAdmin(): Promise<string[]> {
  const res = await request(testApp)
    .post("/api/login")
    .send({ username: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  return res.headers["set-cookie"] as unknown as string[];
}

/** Count commissions rows for our specific fixture subscription only. */
async function countCommissionsForSub(subId: number): Promise<number> {
  const rows = await db
    .select()
    .from(schema.commissions)
    .where(eq(schema.commissions.subscriptionId, subId));
  return rows.length;
}

beforeAll(async () => {
  // Admin who will call the route
  const [admin] = await db
    .insert(schema.agents)
    .values({
      email: ADMIN_EMAIL,
      password: await hashPassword(ADMIN_PASSWORD),
      firstName: "CalcCommDedup",
      lastName: "Admin",
      currentRank: "agent",
      highestRank: "agent",
      isAdmin: true,
      emailVerifiedAt: new Date(),
    })
    .returning();
  adminId = admin.id;

  // Agent whose subscription will receive the commission
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: `calc-comm-dedup-agent-${TS}@example.com`,
      password: "not-a-real-hash",
      firstName: "CalcCommDedup",
      lastName: "Agent",
      currentRank: "agent",
      highestRank: "agent",
      isAdmin: false,
      emailVerifiedAt: new Date(),
    })
    .returning();
  agentId = agent.id;

  // Active subscription using the legacy commission model so the route takes
  // the findSubscriptionCommission / createCommission dedup path.
  // startDate 45 days ago → monthsSinceStart = 1 (months 1–3 decay bucket),
  // ensuring commissionAmount > 0.
  const startDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
  const [sub] = await db
    .insert(schema.subscriptions)
    .values({
      agentId,
      merchantName: "Dedup Test Merchant",
      tier: "tier_1",
      monthlyAmount: "200.00",
      status: "active",
      billingStatus: null, // null is treated as active by the route filter
      commissionModel: "legacy",
      startDate,
    })
    .returning();
  subscriptionId = sub.id;

  testApp = express();
  testApp.use(express.json());
  const httpServer = createServer(testApp);
  await registerRoutes(httpServer, testApp);
}, 30000);

afterAll(async () => {
  // Clean up in dependency order
  await db
    .delete(schema.commissions)
    .where(eq(schema.commissions.agentId, agentId));
  await db
    .delete(schema.activityLog)
    .where(eq(schema.activityLog.actorId, adminId));
  await db
    .delete(schema.subscriptions)
    .where(eq(schema.subscriptions.id, subscriptionId));
  await db.delete(schema.agents).where(eq(schema.agents.id, agentId));
  await db.delete(schema.agents).where(eq(schema.agents.id, adminId));
  await testPool.end();
}, 15000);

describe("POST /api/admin/subscriptions/calculate-commissions – deduplication", () => {
  let run1Body: { message: string; processed: number; skipped: number; totalActive: number };
  let run2Body: { message: string; processed: number; skipped: number; totalActive: number };

  // ── Run 1 ──────────────────────────────────────────────────────────────────

  it("run 1: returns 200 with processed, skipped, and totalActive fields", async () => {
    const cookie = await loginAsAdmin();

    const res = await request(testApp)
      .post("/api/admin/subscriptions/calculate-commissions")
      .set("Cookie", cookie)
      .expect(200);

    run1Body = res.body;

    expect(run1Body.message).toBe("Subscription commissions calculated");
    expect(typeof run1Body.processed).toBe("number");
    expect(typeof run1Body.skipped).toBe("number");
    expect(typeof run1Body.totalActive).toBe("number");
    // Our fixture subscription must be included
    expect(run1Body.totalActive).toBeGreaterThanOrEqual(1);
    // At least our fixture was processed
    expect(run1Body.processed).toBeGreaterThanOrEqual(1);
  });

  it("run 1: creates exactly one commission record for the fixture subscription", async () => {
    const count = await countCommissionsForSub(subscriptionId);
    expect(count).toBe(1);
  });

  // ── Run 2 ──────────────────────────────────────────────────────────────────

  it("run 2: returns 200 with the fixture subscription counted as skipped (not processed again)", async () => {
    const cookie = await loginAsAdmin();

    const res = await request(testApp)
      .post("/api/admin/subscriptions/calculate-commissions")
      .set("Cookie", cookie)
      .expect(200);

    run2Body = res.body;

    expect(run2Body.message).toBe("Subscription commissions calculated");
    // At least our fixture was skipped (it was already created in run 1)
    expect(run2Body.skipped).toBeGreaterThanOrEqual(1);
  });

  it("run 2: does NOT create a duplicate commission record for the fixture subscription", async () => {
    // This is the definitive dedup proof: exactly one row exists, not two
    const count = await countCommissionsForSub(subscriptionId);
    expect(count).toBe(1);
  });

  it("run 2: totalActive is the same as run 1 (both runs see the same active subscriptions)", async () => {
    expect(run2Body.totalActive).toBe(run1Body.totalActive);
  });

  // ── Activity log ──────────────────────────────────────────────────────────

  it("each run writes an activity log entry with action='calculate' and entityType='commission'", async () => {
    const logs = await db
      .select()
      .from(schema.activityLog)
      .where(
        and(
          eq(schema.activityLog.actorId, adminId),
          eq(schema.activityLog.action, "calculate"),
          eq(schema.activityLog.entityType, "commission")
        )
      )
      .orderBy(desc(schema.activityLog.createdAt))
      .limit(2);

    // Both runs should have written a log entry
    expect(logs.length).toBeGreaterThanOrEqual(2);
  });

  it("run 1 activity log details match the run 1 API response values", async () => {
    const logs = await db
      .select()
      .from(schema.activityLog)
      .where(
        and(
          eq(schema.activityLog.actorId, adminId),
          eq(schema.activityLog.action, "calculate"),
          eq(schema.activityLog.entityType, "commission")
        )
      )
      .orderBy(desc(schema.activityLog.createdAt))
      .limit(2);

    // logs[1] is the earlier entry (run 1); logs[0] is run 2
    const run1Log = logs[1];
    expect(run1Log).toBeDefined();

    const details = run1Log.details as { processed: number; skipped: number; totalActive: number };
    expect(details.processed).toBe(run1Body.processed);
    expect(details.skipped).toBe(run1Body.skipped);
    expect(details.totalActive).toBe(run1Body.totalActive);
  });

  it("run 2 activity log details match the run 2 API response values", async () => {
    const logs = await db
      .select()
      .from(schema.activityLog)
      .where(
        and(
          eq(schema.activityLog.actorId, adminId),
          eq(schema.activityLog.action, "calculate"),
          eq(schema.activityLog.entityType, "commission")
        )
      )
      .orderBy(desc(schema.activityLog.createdAt))
      .limit(1);

    const run2Log = logs[0];
    expect(run2Log).toBeDefined();

    const details = run2Log.details as { processed: number; skipped: number; totalActive: number };
    expect(details.processed).toBe(run2Body.processed);
    expect(details.skipped).toBe(run2Body.skipped);
    expect(details.totalActive).toBe(run2Body.totalActive);
  });

  // ── Access control ────────────────────────────────────────────────────────

  it("returns 401 when called without authentication", async () => {
    await request(testApp)
      .post("/api/admin/subscriptions/calculate-commissions")
      .expect(401);
  });
});
