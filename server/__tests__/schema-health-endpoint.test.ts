import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@shared/schema";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import { scrypt as scryptCallback, randomBytes } from "crypto";
import { promisify } from "util";

vi.mock("../schema-health.js", () => ({
  checkSchemaHealth: vi.fn(),
  logSchemaHealth: vi.fn().mockResolvedValue(undefined),
}));

import { checkSchemaHealth } from "../schema-health.js";
import { registerRoutes } from "../routes.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run schema-health endpoint tests");
}

const scryptAsync = promisify(scryptCallback);

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const TS = Date.now();
const ADMIN_EMAIL = `sh-endpoint-admin-${TS}@example.com`;
const ADMIN_PASSWORD = "ShEndpoint1!";
const AGENT_EMAIL = `sh-endpoint-agent-${TS}@example.com`;
const AGENT_PASSWORD = "ShEndpoint2!";

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
      firstName: "SchHealthEndpoint",
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
      firstName: "SchHealthEndpoint",
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

describe("GET /api/admin/health/schema – HTTP endpoint", () => {
  it("returns 200 with healthy: true when the schema health check reports healthy", async () => {
    vi.mocked(checkSchemaHealth).mockResolvedValueOnce({
      healthy: true,
      drift: [],
      checkedAt: new Date().toISOString(),
    });

    const cookie = await loginAsAdmin();

    const res = await request(testApp)
      .get("/api/admin/health/schema")
      .set("Cookie", cookie)
      .expect(200);

    expect(res.body.healthy).toBe(true);
    expect(res.body.drift).toHaveLength(0);
    expect(res.body.checkedAt).toBeTruthy();
  });

  it("returns 503 with healthy: false and drift details when schema drift is detected", async () => {
    vi.mocked(checkSchemaHealth).mockResolvedValueOnce({
      healthy: false,
      drift: [{ table: "agents", missingColumns: ["email"] }],
      checkedAt: new Date().toISOString(),
    });

    const cookie = await loginAsAdmin();

    const res = await request(testApp)
      .get("/api/admin/health/schema")
      .set("Cookie", cookie)
      .expect(503);

    expect(res.body.healthy).toBe(false);
    expect(res.body.drift).toHaveLength(1);
    expect(res.body.drift[0].table).toBe("agents");
    expect(res.body.drift[0].missingColumns).toContain("email");
  });

  it("returns 401 when not authenticated", async () => {
    await request(testApp).get("/api/admin/health/schema").expect(401);
  });

  it("returns 403 for an authenticated non-admin agent", async () => {
    const cookie = await loginAsAgent();

    const res = await request(testApp)
      .get("/api/admin/health/schema")
      .set("Cookie", cookie);

    expect(res.status).toBe(403);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(200);
  });
});
