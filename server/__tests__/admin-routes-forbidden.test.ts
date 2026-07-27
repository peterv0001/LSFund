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

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run admin-routes-forbidden tests");
}

const scryptAsync = promisify(scryptCallback);

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const TS = Date.now();
const AGENT_EMAIL = `admin-403-agent-${TS}@example.com`;
const AGENT_PASSWORD = "Admin403Agent1!";

let agentId: number;
let testApp: ReturnType<typeof express>;
let agentCookie: string[];

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

beforeAll(async () => {
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: AGENT_EMAIL,
      password: await hashPassword(AGENT_PASSWORD),
      firstName: "Admin403",
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

  const res = await request(testApp)
    .post("/api/login")
    .send({ username: AGENT_EMAIL, password: AGENT_PASSWORD });
  agentCookie = res.headers["set-cookie"] as unknown as string[];
  expect(agentCookie).toBeTruthy();
}, 30000);

afterAll(async () => {
  await db.delete(schema.agents).where(eq(schema.agents.id, agentId));
  await testPool.end();
});

type Method = "get" | "post" | "patch" | "delete";

const adminRoutes: Array<{ method: Method; path: string }> = [
  // Stats
  { method: "get", path: "/api/admin/stats" },
  // Agents
  { method: "get", path: "/api/admin/agents" },
  { method: "get", path: "/api/admin/agents/onboarding" },
  { method: "get", path: "/api/admin/agents/unverified-count" },
  { method: "get", path: "/api/admin/agents/1" },
  { method: "patch", path: "/api/admin/agents/1" },
  { method: "post", path: "/api/admin/agents/1/verify-email" },
  { method: "post", path: "/api/admin/agents/1/suspend" },
  { method: "post", path: "/api/admin/agents/1/activate" },
  { method: "post", path: "/api/admin/agents/1/impersonate" },
  { method: "get", path: "/api/admin/agents/1/governance" },
  { method: "post", path: "/api/admin/agents/1/residual-status" },
  // Deals
  { method: "get", path: "/api/admin/deals" },
  { method: "patch", path: "/api/admin/deals/1" },
  { method: "post", path: "/api/admin/deals/1/approve" },
  { method: "post", path: "/api/admin/deals/1/reject" },
  // Commissions
  { method: "get", path: "/api/admin/commissions" },
  { method: "get", path: "/api/admin/commissions/pending" },
  { method: "post", path: "/api/admin/commissions/1/approve" },
  { method: "post", path: "/api/admin/commissions/approve-all" },
  { method: "post", path: "/api/admin/commissions/1/void" },
  { method: "post", path: "/api/admin/commissions/calculate" },
  // Payouts
  { method: "get", path: "/api/admin/payouts" },
  { method: "get", path: "/api/admin/payouts/preview" },
  { method: "post", path: "/api/admin/payouts/create" },
  { method: "post", path: "/api/admin/payouts/1/process" },
  { method: "post", path: "/api/admin/payouts/1/mark-paid" },
  // Subscriptions
  { method: "get", path: "/api/admin/subscriptions" },
  { method: "post", path: "/api/admin/subscriptions" },
  { method: "patch", path: "/api/admin/subscriptions/1/status" },
  { method: "patch", path: "/api/admin/subscriptions/1/end-date" },
  { method: "post", path: "/api/admin/subscriptions/1/retry-payment" },
  { method: "get", path: "/api/admin/subscriptions/1/activity" },
  { method: "post", path: "/api/admin/subscriptions/calculate-commissions" },
  // Holdbacks
  { method: "get", path: "/api/admin/holdbacks" },
  { method: "post", path: "/api/admin/holdbacks/1/release" },
  { method: "post", path: "/api/admin/holdbacks/1/clawback" },
  { method: "patch", path: "/api/admin/holdbacks/1" },
  { method: "post", path: "/api/admin/holdbacks/release-eligible" },
  // Announcements & resources
  { method: "get", path: "/api/admin/announcements" },
  { method: "post", path: "/api/admin/announcements" },
  { method: "delete", path: "/api/admin/announcements/1" },
  { method: "get", path: "/api/admin/resources" },
  { method: "delete", path: "/api/admin/resources/1" },
  // Settings & system
  { method: "get", path: "/api/admin/settings" },
  { method: "patch", path: "/api/admin/settings" },
  { method: "get", path: "/api/admin/system-info" },
  { method: "get", path: "/api/admin/webhook-status" },
  { method: "post", path: "/api/admin/test-webhook" },
  { method: "post", path: "/api/admin/webhook-secret" },
  // Activity log
  { method: "get", path: "/api/admin/activity-log" },
  { method: "get", path: "/api/admin/activity" },
  // Leads
  { method: "get", path: "/api/admin/leads" },
  { method: "get", path: "/api/admin/leads/stats" },
  { method: "post", path: "/api/admin/leads/upload" },
  { method: "post", path: "/api/admin/leads/assign" },
  { method: "get", path: "/api/admin/lead-requests" },
  { method: "post", path: "/api/admin/lead-requests/1/respond" },
  // Export templates
  { method: "get", path: "/api/admin/export-templates" },
  { method: "post", path: "/api/admin/export-templates" },
  { method: "patch", path: "/api/admin/export-templates/1" },
  { method: "delete", path: "/api/admin/export-templates/1" },
  // Migrations
  { method: "get", path: "/api/admin/migrations" },
  { method: "post", path: "/api/admin/migrations/some_migration/apply" },
  { method: "post", path: "/api/admin/migrations/some_migration/revert" },
  // Health
  { method: "get", path: "/api/admin/health/schema" },
];

describe("admin-only routes reject authenticated non-admin agents", () => {
  it.each(adminRoutes)(
    "$method $path returns 403 for a non-admin agent",
    async ({ method, path }) => {
      const res = await request(testApp)[method](path).set("Cookie", agentCookie);
      expect(res.status).toBe(403);
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(200);
    }
  );

  it.each(adminRoutes)(
    "$method $path returns 401 when unauthenticated",
    async ({ method, path }) => {
      const res = await request(testApp)[method](path);
      expect(res.status).toBe(401);
    }
  );
});
