/**
 * Integration tests proving that POST /api/deals is idempotent when the client
 * supplies an X-Idempotency-Key header.
 *
 * Two scenarios are covered:
 *  1. Two truly-concurrent requests with the same key — both must return 201
 *     with the same deal ID, and exactly one row must exist in the deals table.
 *  2. A replay request that arrives after the first request has already
 *     completed — it must also return the original deal without inserting a new
 *     row.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@shared/schema";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import { scrypt as scryptCallback, randomBytes, randomUUID } from "crypto";
import { promisify } from "util";
import { registerRoutes } from "../routes.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run deal-submit-dedup tests");
}

const scryptAsync = promisify(scryptCallback);
const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const TS = Date.now();
const AGENT_EMAIL = `deal-dedup-agent-${TS}@example.com`;
const AGENT_PASSWORD = "DealDedup1!";

let agentId: number;
let testApp: ReturnType<typeof express>;
let agentCookie: string[];

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

/** Minimal valid deal payload for this agent. */
function dealPayload(merchantName: string) {
  return {
    merchantName,
    merchantPhone: "5551234567",
    businessAddress: "123 Main St",
    businessCity: "Austin",
    businessState: "TX",
    businessZip: "78701",
    ownerFirstName: "John",
    ownerLastName: "Smith",
    ownerPhone: "5559876543",
    ownerOwnershipPct: 100,
    loanAmount: 50000,
    avgMonthlyRevenue: 25000,
    requestedAmount: 50000,
  };
}

beforeAll(async () => {
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: AGENT_EMAIL,
      password: await hashPassword(AGENT_PASSWORD),
      firstName: "DealDedup",
      lastName: "Agent",
      currentRank: "agent",
      highestRank: "agent",
      isAdmin: false,
      // Email must be verified or POST /api/deals returns 403.
      emailVerifiedAt: new Date(),
    })
    .returning();
  agentId = agent.id;

  testApp = express();
  testApp.use(express.json());
  const httpServer = createServer(testApp);
  await registerRoutes(httpServer, testApp);

  // Log in and capture session cookie.
  const loginRes = await request(testApp)
    .post("/api/login")
    .send({ username: AGENT_EMAIL, password: AGENT_PASSWORD });
  expect(loginRes.status).toBe(200);
  agentCookie = loginRes.headers["set-cookie"] as unknown as string[];
}, 30_000);

afterAll(async () => {
  // Clean up in dependency order (notifications → deals → agents).
  await db
    .delete(schema.notifications)
    .where(eq(schema.notifications.agentId, agentId));
  await db.delete(schema.deals).where(eq(schema.deals.agentId, agentId));
  await db.delete(schema.agents).where(eq(schema.agents.id, agentId));
  await testPool.end();
}, 15_000);

describe("POST /api/deals – idempotency deduplication", () => {
  it("concurrent requests with the same X-Idempotency-Key create exactly one deal", async () => {
    const key = randomUUID();
    const merchant = `Concurrent Dedup Merchant ${TS}`;

    // Fire both requests simultaneously — neither should have resolved before
    // the other starts because Promise.all dispatches both without awaiting.
    const [resA, resB] = await Promise.all([
      request(testApp)
        .post("/api/deals")
        .set("Cookie", agentCookie)
        .set("X-Idempotency-Key", key)
        .send(dealPayload(merchant)),
      request(testApp)
        .post("/api/deals")
        .set("Cookie", agentCookie)
        .set("X-Idempotency-Key", key)
        .send(dealPayload(merchant)),
    ]);

    // Both requests must succeed.
    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);

    // Both must return the same deal.
    expect(resA.body.id).toBe(resB.body.id);

    // Exactly one row must exist in the database for this merchant.
    const rows = await db
      .select()
      .from(schema.deals)
      .where(eq(schema.deals.agentId, agentId));
    const matchingRows = rows.filter((r) => r.merchantName === merchant);
    expect(matchingRows).toHaveLength(1);
  });

  it("a replay request after the first completes returns the original deal without inserting a new row", async () => {
    const key = randomUUID();
    const merchant = `Replay Dedup Merchant ${TS}`;

    // First request — creates the deal.
    const first = await request(testApp)
      .post("/api/deals")
      .set("Cookie", agentCookie)
      .set("X-Idempotency-Key", key)
      .send(dealPayload(merchant));
    expect(first.status).toBe(201);

    // Replay with the same key — must return the same deal id.
    const replay = await request(testApp)
      .post("/api/deals")
      .set("Cookie", agentCookie)
      .set("X-Idempotency-Key", key)
      .send(dealPayload(merchant));
    expect(replay.status).toBe(201);
    expect(replay.body.id).toBe(first.body.id);

    // Still only one row for this merchant.
    const rows = await db
      .select()
      .from(schema.deals)
      .where(eq(schema.deals.agentId, agentId));
    const matchingRows = rows.filter((r) => r.merchantName === merchant);
    expect(matchingRows).toHaveLength(1);
  });

  it("requests without an idempotency key always create separate deals", async () => {
    const merchant = `No-Key Merchant ${TS}`;

    const [resA, resB] = await Promise.all([
      request(testApp)
        .post("/api/deals")
        .set("Cookie", agentCookie)
        .send(dealPayload(merchant)),
      request(testApp)
        .post("/api/deals")
        .set("Cookie", agentCookie)
        .send(dealPayload(merchant)),
    ]);

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);
    // Without a key, each request is independent — different deal IDs.
    expect(resA.body.id).not.toBe(resB.body.id);
  });
});
