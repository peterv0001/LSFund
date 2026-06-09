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
  throw new Error("DATABASE_URL must be set to run activity log admin name tests");
}

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const scryptAsync = promisify(scryptCallback);

async function hashPasswordForTest(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

const TEST_PREFIX = `actlog-name-test-${Date.now()}`;
const ADMIN_PASSWORD = "AdminActLogPass1!";
const ADMIN_FIRST = "Wilhelmina";
const ADMIN_LAST = "Throckmorton";
const ADMIN_FULL_NAME = `${ADMIN_FIRST} ${ADMIN_LAST}`;

let adminId: number;
let targetAgentId: number;
let testApp: ReturnType<typeof express>;

async function createAgent(suffix: string, opts: { isAdmin?: boolean; firstName?: string; lastName?: string } = {}) {
  const { isAdmin = false, firstName = "Target", lastName = "Agent" } = opts;
  const password = isAdmin ? await hashPasswordForTest(ADMIN_PASSWORD) : "not-a-real-hash";
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: `${TEST_PREFIX}-${suffix}@example.com`,
      password,
      firstName,
      lastName,
      currentRank: "agent",
      highestRank: "agent",
      isAdmin,
    })
    .returning();
  return agent;
}

beforeAll(async () => {
  const admin = await createAgent("admin", {
    isAdmin: true,
    firstName: ADMIN_FIRST,
    lastName: ADMIN_LAST,
  });
  adminId = admin.id;

  const target = await createAgent("target");
  targetAgentId = target.id;

  testApp = express();
  testApp.use(express.json());
  const httpServer = createServer(testApp);
  await registerRoutes(httpServer, testApp);
}, 30000);

afterAll(async () => {
  await db.delete(schema.activityLog).where(eq(schema.activityLog.actorId, adminId));
  await db.delete(schema.holdbacks).where(eq(schema.holdbacks.agentId, targetAgentId));
  await db.delete(schema.announcements).where(eq(schema.announcements.createdById, adminId));
  await db.delete(schema.agents).where(eq(schema.agents.id, targetAgentId));
  await db.delete(schema.agents).where(eq(schema.agents.id, adminId));
  await testPool.end();
});

async function loginAsAdmin(): Promise<string[]> {
  const res = await request(testApp)
    .post("/api/login")
    .send({ username: `${TEST_PREFIX}-admin@example.com`, password: ADMIN_PASSWORD });
  return res.headers["set-cookie"] as unknown as string[];
}

async function getLatestLogForEntity(entityType: string, entityId: number, action: string) {
  const { logs } = await storage.getActivityLogs(1, 100, {
    actorId: adminId,
    entityType,
    entityId,
    action,
  });
  return logs[0];
}

describe("activity log descriptions include the acting admin's name", () => {
  it("includes the admin's full name when suspending an agent", async () => {
    const cookie = await loginAsAdmin();
    await request(testApp)
      .post(`/api/admin/agents/${targetAgentId}/suspend`)
      .set("Cookie", cookie)
      .send({ reason: "Test suspension" })
      .expect(200);

    const log = await getLatestLogForEntity("agent", targetAgentId, "suspend");
    expect(log).toBeDefined();
    expect(log.description).toContain(ADMIN_FIRST);
    expect(log.description).toContain(ADMIN_LAST);
    expect(log.description).toContain(ADMIN_FULL_NAME);
  });

  it("includes the admin's full name when activating an agent", async () => {
    const cookie = await loginAsAdmin();
    await request(testApp)
      .post(`/api/admin/agents/${targetAgentId}/activate`)
      .set("Cookie", cookie)
      .send({})
      .expect(200);

    const log = await getLatestLogForEntity("agent", targetAgentId, "activate");
    expect(log).toBeDefined();
    expect(log.description).toContain(ADMIN_FULL_NAME);
  });

  it("includes the admin's full name when releasing a holdback", async () => {
    const [holdback] = await db
      .insert(schema.holdbacks)
      .values({
        dealId: 999_999,
        agentId: targetAgentId,
        totalAmount: "1234.56",
        status: "held",
      })
      .returning();

    const cookie = await loginAsAdmin();
    await request(testApp)
      .post(`/api/admin/holdbacks/${holdback.id}/release`)
      .set("Cookie", cookie)
      .send({})
      .expect(200);

    const log = await getLatestLogForEntity("holdback", holdback.id, "release");
    expect(log).toBeDefined();
    expect(log.description).toContain(ADMIN_FULL_NAME);
  });

  it("includes the admin's full name when creating an announcement", async () => {
    const cookie = await loginAsAdmin();
    const res = await request(testApp)
      .post(`/api/admin/announcements`)
      .set("Cookie", cookie)
      .send({ title: "Test Announcement", content: "Hello team" })
      .expect(201);

    const announcementId = res.body.id as number;
    const log = await getLatestLogForEntity("announcement", announcementId, "create");
    expect(log).toBeDefined();
    expect(log.description).toContain(ADMIN_FULL_NAME);
    expect(log.description).toContain("Test Announcement");
  });
});
