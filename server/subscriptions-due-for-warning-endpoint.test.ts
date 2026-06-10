import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@shared/schema";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import { scrypt as scryptCallback, randomBytes } from "crypto";
import { promisify } from "util";

import { registerRoutes } from "./routes.js";
import { storage } from "./storage.js";
import { resolveExpiryWarningDays } from "./scheduler.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run due-for-warning endpoint tests");
}

const scryptAsync = promisify(scryptCallback);

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const TS = Date.now();
const ADMIN_EMAIL = `due-warning-admin-${TS}@example.com`;
const AGENT_EMAIL = `due-warning-agent-${TS}@example.com`;
const PASSWORD = "DueWarning1!";
const SETTING_KEY = "expiryWarningDays";

const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS);

let adminId: number;
let nonAdminId: number;
let testApp: ReturnType<typeof express>;
let originalSetting: any;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function login(email: string): Promise<string[]> {
  const res = await request(testApp)
    .post("/api/login")
    .send({ username: email, password: PASSWORD });
  return res.headers["set-cookie"] as unknown as string[];
}

async function createSub(values: {
  status?: "active" | "paused" | "cancelled" | "expired";
  endDate?: Date | null;
  expiryWarningSentAt?: Date | null;
  merchantName?: string;
}) {
  const [sub] = await db
    .insert(schema.subscriptions)
    .values({
      agentId: nonAdminId,
      merchantName: values.merchantName ?? "Acme Corp",
      tier: "tier_1",
      monthlyAmount: "199.00",
      status: values.status ?? "active",
      endDate: values.endDate ?? null,
      expiryWarningSentAt: values.expiryWarningSentAt ?? null,
    })
    .returning();
  return sub;
}

async function clearSubs() {
  await db.delete(schema.subscriptions).where(eq(schema.subscriptions.agentId, nonAdminId));
}

beforeAll(async () => {
  const [admin] = await db
    .insert(schema.agents)
    .values({
      email: ADMIN_EMAIL,
      password: await hashPassword(PASSWORD),
      firstName: "DueWarning",
      lastName: "Admin",
      currentRank: "agent",
      highestRank: "agent",
      isAdmin: true,
    })
    .returning();
  adminId = admin.id;

  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: AGENT_EMAIL,
      password: await hashPassword(PASSWORD),
      firstName: "DueWarning",
      lastName: "Agent",
      currentRank: "agent",
      highestRank: "agent",
      isAdmin: false,
    })
    .returning();
  nonAdminId = agent.id;

  originalSetting = await storage.getPlatformSetting(SETTING_KEY);

  testApp = express();
  testApp.use(express.json());
  const httpServer = createServer(testApp);
  await registerRoutes(httpServer, testApp);
}, 30000);

afterAll(async () => {
  await clearSubs();
  await db.delete(schema.agents).where(inArray(schema.agents.id, [adminId, nonAdminId]));

  if (originalSetting === null || originalSetting === undefined) {
    await db.delete(schema.platformSettings).where(eq(schema.platformSettings.key, SETTING_KEY));
  } else {
    await storage.savePlatformSetting(SETTING_KEY, originalSetting);
  }

  await testPool.end();
});

beforeEach(async () => {
  await clearSubs();
});

// =========================================================
// GET /api/admin/subscriptions/due-for-warning
//
// This endpoint powers the admin preview ("how many subscriptions would
// receive an expiry-warning email right now") and the deep-link that filters
// the subscriptions list to exactly those IDs. These tests confirm:
//   1. The response shape { days, count, subscriptionIds } matches what
//      storage.getSubscriptionsDueForWarning returns for the saved setting,
//      including the 1–90 clamp applied by resolveExpiryWarningDays.
//   2. Only active/paused subscriptions whose endDate is inside the window
//      and that have not already been warned are included.
//   3. The route is admin-only.
// =========================================================

describe("GET /api/admin/subscriptions/due-for-warning", () => {
  it("returns { days, count, subscriptionIds } matching storage for the saved setting", async () => {
    await storage.savePlatformSetting(SETTING_KEY, 14);

    await createSub({ status: "active", endDate: daysFromNow(14), merchantName: "InWindow Corp" });
    await createSub({ status: "active", endDate: daysFromNow(3), merchantName: "OutOfWindow Corp" });

    const cookie = await login(ADMIN_EMAIL);
    const res = await request(testApp)
      .get("/api/admin/subscriptions/due-for-warning")
      .set("Cookie", cookie)
      .expect(200);

    const expectedDays = await resolveExpiryWarningDays();
    const expected = await storage.getSubscriptionsDueForWarning(expectedDays);
    const expectedIds = expected.map((s) => s.id);

    expect(res.body.days).toBe(14);
    expect(res.body.days).toBe(expectedDays);
    expect(res.body.count).toBe(expected.length);
    expect(res.body.subscriptionIds.slice().sort()).toEqual(expectedIds.slice().sort());
  });

  it("clamps a too-large saved setting to 90 days (via resolveExpiryWarningDays)", async () => {
    await storage.savePlatformSetting(SETTING_KEY, 200);

    const cookie = await login(ADMIN_EMAIL);
    const res = await request(testApp)
      .get("/api/admin/subscriptions/due-for-warning")
      .set("Cookie", cookie)
      .expect(200);

    expect(res.body.days).toBe(90);
    expect(res.body.days).toBe(await resolveExpiryWarningDays());
  });

  it("clamps a too-small saved setting to 1 day (via resolveExpiryWarningDays)", async () => {
    await storage.savePlatformSetting(SETTING_KEY, 0);

    const cookie = await login(ADMIN_EMAIL);
    const res = await request(testApp)
      .get("/api/admin/subscriptions/due-for-warning")
      .set("Cookie", cookie)
      .expect(200);

    expect(res.body.days).toBe(1);
    expect(res.body.days).toBe(await resolveExpiryWarningDays());
  });

  it("includes only active/paused, in-window, not-yet-warned subscriptions", async () => {
    await storage.savePlatformSetting(SETTING_KEY, 7);

    const activeInWindow = await createSub({ status: "active", endDate: daysFromNow(7) });
    const pausedInWindow = await createSub({ status: "paused", endDate: daysFromNow(7) });
    const cancelledInWindow = await createSub({ status: "cancelled", endDate: daysFromNow(7) });
    const expiredInWindow = await createSub({ status: "expired", endDate: daysFromNow(7) });
    const alreadyWarned = await createSub({
      status: "active",
      endDate: daysFromNow(7),
      expiryWarningSentAt: new Date(),
    });
    const outOfWindow = await createSub({ status: "active", endDate: daysFromNow(30) });
    const noEndDate = await createSub({ status: "active", endDate: null });

    const cookie = await login(ADMIN_EMAIL);
    const res = await request(testApp)
      .get("/api/admin/subscriptions/due-for-warning")
      .set("Cookie", cookie)
      .expect(200);

    const ids: number[] = res.body.subscriptionIds;

    expect(ids).toContain(activeInWindow.id);
    expect(ids).toContain(pausedInWindow.id);

    expect(ids).not.toContain(cancelledInWindow.id);
    expect(ids).not.toContain(expiredInWindow.id);
    expect(ids).not.toContain(alreadyWarned.id);
    expect(ids).not.toContain(outOfWindow.id);
    expect(ids).not.toContain(noEndDate.id);

    // count always equals the number of returned IDs.
    expect(res.body.count).toBe(ids.length);
  });

  it("returns 401 when called without authentication", async () => {
    await request(testApp).get("/api/admin/subscriptions/due-for-warning").expect(401);
  });

  it("returns 403 when called by a non-admin agent", async () => {
    const cookie = await login(AGENT_EMAIL);
    await request(testApp)
      .get("/api/admin/subscriptions/due-for-warning")
      .set("Cookie", cookie)
      .expect(403);
  });
});
