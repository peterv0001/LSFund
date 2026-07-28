import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@shared/schema";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import { scrypt as scryptCallback, randomBytes } from "crypto";
import { promisify } from "util";

import { registerRoutes } from "../routes.js";
import { EXPIRY_CHECK_INTERVAL_MS } from "../scheduler.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run system-info endpoint tests");
}

const scryptAsync = promisify(scryptCallback);

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const TS = Date.now();
const ADMIN_EMAIL = `sysinfo-admin-${TS}@example.com`;
const ADMIN_PASSWORD = "SysInfo1!";
const AGENT_EMAIL = `sysinfo-agent-${TS}@example.com`;
const AGENT_PASSWORD = "SysInfo2!";

let adminId: number;
let agentId: number;
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

async function loginAsAgent(): Promise<string[]> {
  const res = await request(testApp)
    .post("/api/login")
    .send({ username: AGENT_EMAIL, password: AGENT_PASSWORD });
  return res.headers["set-cookie"] as unknown as string[];
}

beforeAll(async () => {
  const [admin] = await db
    .insert(schema.agents)
    .values({
      email: ADMIN_EMAIL,
      password: await hashPassword(ADMIN_PASSWORD),
      firstName: "SysInfo",
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
      password: await hashPassword(AGENT_PASSWORD),
      firstName: "SysInfo",
      lastName: "Agent",
      currentRank: "agent",
      highestRank: "agent",
      isAdmin: false,
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

describe("GET /api/admin/system-info – HTTP endpoint", () => {
  it("returns the scheduler expiry-check interval for an authenticated admin", async () => {
    const cookie = await loginAsAdmin();

    const res = await request(testApp)
      .get("/api/admin/system-info")
      .set("Cookie", cookie)
      .expect(200);

    expect(typeof res.body.expiryCheckIntervalMs).toBe("number");
    expect(res.body.expiryCheckIntervalMs).toBe(EXPIRY_CHECK_INTERVAL_MS);
    expect(res.body.expiryCheckIntervalMs).toBeGreaterThan(0);
  });

  it("returns expiryWarningDays as a positive number", async () => {
    const cookie = await loginAsAdmin();

    const res = await request(testApp)
      .get("/api/admin/system-info")
      .set("Cookie", cookie)
      .expect(200);

    expect(typeof res.body.expiryWarningDays).toBe("number");
    expect(res.body.expiryWarningDays).toBeGreaterThan(0);
  });

  it("returns nodeEnv as a non-empty string", async () => {
    const cookie = await loginAsAdmin();

    const res = await request(testApp)
      .get("/api/admin/system-info")
      .set("Cookie", cookie)
      .expect(200);

    expect(typeof res.body.nodeEnv).toBe("string");
    expect(res.body.nodeEnv.length).toBeGreaterThan(0);
  });

  it("returns schedulerLastRunAt as a string or null", async () => {
    const cookie = await loginAsAdmin();

    const res = await request(testApp)
      .get("/api/admin/system-info")
      .set("Cookie", cookie)
      .expect(200);

    const val = res.body.schedulerLastRunAt;
    expect(val === null || typeof val === "string").toBe(true);
  });

  it("returns schedulerNextRunAt as a string or null", async () => {
    const cookie = await loginAsAdmin();

    const res = await request(testApp)
      .get("/api/admin/system-info")
      .set("Cookie", cookie)
      .expect(200);

    const val = res.body.schedulerNextRunAt;
    expect(val === null || typeof val === "string").toBe(true);
  });

  it("returns all required operational fields in a single response", async () => {
    const cookie = await loginAsAdmin();

    const res = await request(testApp)
      .get("/api/admin/system-info")
      .set("Cookie", cookie)
      .expect(200);

    // Presence and type check for every field the UI card consumes.
    expect(typeof res.body.expiryCheckIntervalMs).toBe("number");
    expect(typeof res.body.expiryWarningDays).toBe("number");
    expect(typeof res.body.nodeEnv).toBe("string");
    expect(res.body).toHaveProperty("schedulerLastRunAt");
    expect(res.body).toHaveProperty("schedulerNextRunAt");
  });

  it("returns 401 when not authenticated", async () => {
    await request(testApp).get("/api/admin/system-info").expect(401);
  });

  it("returns 403 for an authenticated non-admin agent", async () => {
    const cookie = await loginAsAgent();

    const res = await request(testApp)
      .get("/api/admin/system-info")
      .set("Cookie", cookie);

    expect(res.status).toBe(403);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(200);
  });
});
