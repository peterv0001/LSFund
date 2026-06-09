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
  throw new Error("DATABASE_URL must be set to run agent route tests");
}

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const scryptAsync = promisify(scryptCallback);

async function hashPasswordForTest(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

const AGENT_PASSWORD = "AgentRoutePass1!";
const AGENT_EMAIL_PREFIX = `agent-route-test-${Date.now()}`;

let agentId: number;
let testApp: ReturnType<typeof express>;

beforeAll(async () => {
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: `${AGENT_EMAIL_PREFIX}@example.com`,
      password: await hashPasswordForTest(AGENT_PASSWORD),
      firstName: "Route",
      lastName: "Tester",
      currentRank: "agent",
      highestRank: "agent",
    })
    .returning();
  agentId = agent.id;

  testApp = express();
  testApp.use(express.json());
  const httpServer = createServer(testApp);
  await registerRoutes(httpServer, testApp);
}, 30000);

afterAll(async () => {
  await db.delete(schema.agents).where(eq(schema.agents.id, agentId));
  await testPool.end();
});

async function loginAsAgent(): Promise<string[]> {
  const res = await request(testApp)
    .post("/api/login")
    .send({ username: `${AGENT_EMAIL_PREFIX}@example.com`, password: AGENT_PASSWORD });
  return res.headers["set-cookie"] as unknown as string[];
}

// =========================================================
// Static GET /api/agents/* route ordering regression tests
//
// The static routes (dashboard, rank-progress, referral-link,
// referral-stats) must be registered BEFORE the dynamic
// GET /api/agents/:id route. If they are shadowed by /:id,
// Express matches e.g. /api/agents/dashboard with id="dashboard",
// Number("dashboard") === NaN, and the DB query crashes (or, for a
// non-admin, the ownership check returns 403). These tests hit each
// static endpoint as an authenticated agent and assert a 200 with a
// well-formed payload, proving the static route — not /:id — handled
// the request.
// =========================================================

describe("static /api/agents/* routes are not shadowed by /:id", () => {
  it("GET /api/agents/dashboard returns 200 with a well-formed dashboard payload", async () => {
    const cookie = await loginAsAgent();
    const res = await request(testApp)
      .get(api.agents.dashboard.path)
      .set("Cookie", cookie)
      .expect(200);

    expect(res.body).toHaveProperty("totalEarned");
    expect(res.body).toHaveProperty("teamSize");
    expect(res.body).toHaveProperty("currentRank", "agent");
    expect(typeof res.body.rankProgress).toBe("number");
    expect(Number.isNaN(res.body.rankProgress)).toBe(false);
    expect(Array.isArray(res.body.recentDeals)).toBe(true);
    expect(Array.isArray(res.body.recentCommissions)).toBe(true);
  });

  it("GET /api/agents/rank-progress returns 200 with a well-formed rank-progress payload", async () => {
    const cookie = await loginAsAgent();
    const res = await request(testApp)
      .get(api.agents.rankProgress.path)
      .set("Cookie", cookie)
      .expect(200);

    expect(res.body).toHaveProperty("currentRank", "agent");
    expect(res.body).toHaveProperty("highestRank", "agent");
    expect(res.body).toHaveProperty("nextRank");
    expect(res.body).toHaveProperty("qualified");
    expect(typeof res.body.qualified).toBe("boolean");
  });

  it("GET /api/agents/referral-link returns 200 with a referral code and URL", async () => {
    const cookie = await loginAsAgent();
    const res = await request(testApp)
      .get(api.agents.referralLink.path)
      .set("Cookie", cookie)
      .expect(200);

    expect(typeof res.body.referralCode).toBe("string");
    expect(res.body.referralCode.length).toBeGreaterThan(0);
    expect(typeof res.body.referralUrl).toBe("string");
    expect(res.body.referralUrl).toContain(res.body.referralCode);
  });

  it("GET /api/agents/referral-stats returns 200 with well-formed referral stats", async () => {
    const cookie = await loginAsAgent();
    const res = await request(testApp)
      .get(api.agents.referralStats.path)
      .set("Cookie", cookie)
      .expect(200);

    expect(typeof res.body.totalReferrals).toBe("number");
    expect(typeof res.body.thisMonthReferrals).toBe("number");
    expect(typeof res.body.activeReferrals).toBe("number");
    expect(Array.isArray(res.body.recentReferrals)).toBe(true);
  });

  // If the static routes were shadowed by GET /api/agents/:id, a
  // non-admin agent requesting these string "ids" would hit the
  // ownership check (req.user.id !== Number("dashboard")) and receive
  // 403 — never 200 with the static payload. Asserting 200 above is
  // therefore sufficient to prove the ordering is correct. This test
  // documents the contrast: the dynamic /:id route DOES 403 for a
  // foreign numeric id, confirming the handler is reachable but
  // distinct from the static paths.
  it("GET /api/agents/:id still 403s for another agent's numeric id (dynamic route reachable)", async () => {
    const cookie = await loginAsAgent();
    const foreignId = agentId + 999999;
    await request(testApp)
      .get(`/api/agents/${foreignId}`)
      .set("Cookie", cookie)
      .expect(403);
  });
});
