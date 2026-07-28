import { describe, it, expect, beforeAll, afterAll } from "vitest";
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
import { api } from "@shared/routes";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run admin agent route tests");
}

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const scryptAsync = promisify(scryptCallback);

async function hashPasswordForTest(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

const ADMIN_PASSWORD = "AdminRoutePass1!";
const AGENT_PASSWORD = "AgentRoutePass2!";
const PREFIX = `admin-route-test-${Date.now()}`;

let adminId: number;
let agentId: number;
let testApp: ReturnType<typeof express>;

beforeAll(async () => {
  // Seed a verified admin user
  const [admin] = await db
    .insert(schema.agents)
    .values({
      email: `${PREFIX}-admin@example.com`,
      password: await hashPasswordForTest(ADMIN_PASSWORD),
      firstName: "Admin",
      lastName: "RouteTest",
      currentRank: "agent",
      highestRank: "agent",
      isAdmin: true,
      emailVerifiedAt: new Date(),
    })
    .returning();
  adminId = admin.id;

  // Seed a regular (non-admin) verified agent for contrast
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: `${PREFIX}-agent@example.com`,
      password: await hashPasswordForTest(AGENT_PASSWORD),
      firstName: "Regular",
      lastName: "Agent",
      currentRank: "agent",
      highestRank: "agent",
      emailVerifiedAt: new Date(),
    })
    .returning();
  agentId = agent.id;

  testApp = express();
  testApp.use(express.json());
  const httpServer = createServer(testApp);
  await registerRoutes(httpServer, testApp);
}, 30000);

afterAll(async () => {
  await db.delete(schema.agents).where(eq(schema.agents.id, adminId));
  await db.delete(schema.agents).where(eq(schema.agents.id, agentId));
  await testPool.end();
});

async function loginAsAdmin(): Promise<string[]> {
  const res = await request(testApp)
    .post("/api/login")
    .send({ username: `${PREFIX}-admin@example.com`, password: ADMIN_PASSWORD });
  return res.headers["set-cookie"] as unknown as string[];
}

async function loginAsAgent(): Promise<string[]> {
  const res = await request(testApp)
    .post("/api/login")
    .send({ username: `${PREFIX}-agent@example.com`, password: AGENT_PASSWORD });
  return res.headers["set-cookie"] as unknown as string[];
}

// =========================================================
// Static GET /api/admin/agents/* route ordering regression tests
//
// The static routes (onboarding, unverified-count, pending-placement)
// must be registered BEFORE the dynamic GET /api/admin/agents/:id route.
// If they are shadowed by /:id, Express would match e.g.
// /api/admin/agents/onboarding with id="onboarding". The handler then
// calls storage.getAgent(NaN) (since Number("onboarding") is NaN) and
// either 404s or crashes — not a 200 with the admin payload the client
// expects. These tests hit each static endpoint as an authenticated admin
// and assert 200 with a well-formed payload, proving the static route —
// not /:id — handled the request.
// =========================================================

describe("static GET /api/admin/agents/* routes are not shadowed by /:id", () => {
  it("GET /api/admin/agents/onboarding returns 200 with a well-formed cohort array", async () => {
    const cookie = await loginAsAdmin();
    const res = await request(testApp)
      .get(api.admin.agents.onboarding.path)
      .set("Cookie", cookie)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    // Each entry in the cohort must carry the required onboarding fields.
    for (const row of res.body) {
      expect(typeof row.id).toBe("number");
      expect(typeof row.firstName).toBe("string");
      expect(typeof row.lastName).toBe("string");
      expect(typeof row.email).toBe("string");
      expect(typeof row.emailVerified).toBe("boolean");
      expect(typeof row.module1Complete).toBe("boolean");
      expect(typeof row.checklistPercent).toBe("number");
      expect(typeof row.daysSinceSignup).toBe("number");
    }
  });

  it("GET /api/admin/agents/unverified-count returns 200 with a numeric count", async () => {
    const cookie = await loginAsAdmin();
    const res = await request(testApp)
      .get(api.admin.agents.unverifiedCount.path)
      .set("Cookie", cookie)
      .expect(200);

    expect(typeof res.body.count).toBe("number");
    expect(Number.isNaN(res.body.count)).toBe(false);
    expect(res.body.count).toBeGreaterThanOrEqual(0);
  });

  it("GET /api/admin/agents/pending-placement returns 200 with an array", async () => {
    const cookie = await loginAsAdmin();
    const res = await request(testApp)
      .get(api.admin.agents.pendingPlacement.path)
      .set("Cookie", cookie)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  // If the static routes were shadowed by GET /api/admin/agents/:id, the
  // handler would resolve id=NaN and return 404 (agent not found) instead
  // of the 200 + admin payload asserted above. This complementary test
  // confirms the dynamic /:id route is still reachable for a real numeric
  // id, proving both handlers coexist and are independently reachable.
  it("GET /api/admin/agents/:id still returns the agent for a valid numeric id (dynamic route reachable)", async () => {
    const cookie = await loginAsAdmin();
    const res = await request(testApp)
      .get(`/api/admin/agents/${agentId}`)
      .set("Cookie", cookie)
      .expect(200);

    expect(res.body.id).toBe(agentId);
    expect(typeof res.body.email).toBe("string");
  });

  // Confirm admin-only enforcement: a regular agent must be rejected with 403.
  // This distinguishes the 403 an /:id handler would emit (ownership check)
  // from the 200 the static paths return to admins.
  it("GET /api/admin/agents/onboarding returns 403 for a non-admin agent", async () => {
    const cookie = await loginAsAgent();
    await request(testApp)
      .get(api.admin.agents.onboarding.path)
      .set("Cookie", cookie)
      .expect(403);
  });

  it("GET /api/admin/agents/unverified-count returns 403 for a non-admin agent", async () => {
    const cookie = await loginAsAgent();
    await request(testApp)
      .get(api.admin.agents.unverifiedCount.path)
      .set("Cookie", cookie)
      .expect(403);
  });

  it("GET /api/admin/agents/pending-placement returns 403 for a non-admin agent", async () => {
    const cookie = await loginAsAgent();
    await request(testApp)
      .get(api.admin.agents.pendingPlacement.path)
      .set("Cookie", cookie)
      .expect(403);
  });
});
