import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@shared/schema";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import { registerRoutes } from "./routes.js";
import { storage } from "./storage.js";
import { api } from "@shared/routes";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run landing-view tracking tests");
}

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const SUFFIX = `${Date.now()}`;
const ACTIVE_CODE = `LVACTIVE${SUFFIX}`;
const SUSPENDED_CODE = `LVSUSPENDED${SUFFIX}`;

let activeAgentId: number;
let suspendedAgentId: number;
let testApp: ReturnType<typeof express>;
const createdLeadEmails: string[] = [];

beforeAll(async () => {
  const [active] = await db
    .insert(schema.agents)
    .values({
      email: `lv-active-${SUFFIX}@example.com`,
      password: "x",
      firstName: "Vera",
      lastName: "Views",
      currentRank: "agent",
      highestRank: "agent",
      status: "active",
      referralCode: ACTIVE_CODE,
    })
    .returning();
  activeAgentId = active.id;

  const [suspended] = await db
    .insert(schema.agents)
    .values({
      email: `lv-suspended-${SUFFIX}@example.com`,
      password: "x",
      firstName: "Stan",
      lastName: "Suspended",
      currentRank: "agent",
      highestRank: "agent",
      status: "suspended",
      referralCode: SUSPENDED_CODE,
    })
    .returning();
  suspendedAgentId = suspended.id;

  testApp = express();
  testApp.use(express.json());
  const httpServer = createServer(testApp);
  await registerRoutes(httpServer, testApp);
}, 30000);

afterAll(async () => {
  for (const email of createdLeadEmails) {
    await db.delete(schema.leads).where(eq(schema.leads.contactEmail, email));
  }
  await db.delete(schema.landingPageViews).where(eq(schema.landingPageViews.agentId, activeAgentId));
  await db.delete(schema.landingPageViews).where(eq(schema.landingPageViews.agentId, suspendedAgentId));
  await db.delete(schema.agents).where(eq(schema.agents.id, activeAgentId));
  await db.delete(schema.agents).where(eq(schema.agents.id, suspendedAgentId));
  await testPool.end();
});

async function postView(body: Record<string, unknown>) {
  return request(testApp).post(api.public.landingView.path).send(body);
}

describe("public landing-view tracking", () => {
  it("records a view crediting the active agent on an exact referral-code match", async () => {
    const res = await postView({ ref: ACTIVE_CODE, page: "platform" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ recorded: true });

    const rows = await db
      .select()
      .from(schema.landingPageViews)
      .where(eq(schema.landingPageViews.agentId, activeAgentId));
    expect(rows.some((r) => r.page === "platform")).toBe(true);
  });

  it("requires an exact referral-code match (different case does not record)", async () => {
    const res = await postView({ ref: ACTIVE_CODE.toLowerCase(), page: "leaks" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ recorded: false });
  });

  it("does not record for an unknown referral code", async () => {
    const res = await postView({ ref: `NOPE${SUFFIX}`, page: "scale" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ recorded: false });
  });

  it("does not record for a suspended agent's code", async () => {
    const res = await postView({ ref: SUSPENDED_CODE, page: "platform" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ recorded: false });
  });

  it("never records when ref is a numeric agent id (no id enumeration)", async () => {
    const res = await postView({ ref: String(activeAgentId), page: "platform" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ recorded: false });
  });

  it("rejects an unknown page value", async () => {
    const res = await postView({ ref: ACTIVE_CODE, page: "bogus" });
    expect(res.status).toBe(400);
  });
});

describe("agent share stats", () => {
  it("counts views per page and leads per page for the agent", async () => {
    // Two more platform views (total 3 with the one recorded above) + one scale view.
    await postView({ ref: ACTIVE_CODE, page: "platform" });
    await postView({ ref: ACTIVE_CODE, page: "platform" });
    await postView({ ref: ACTIVE_CODE, page: "scale" });

    // A lead attributed to this agent from the scale landing page.
    const leadEmail = `lv-lead-${SUFFIX}@example.com`;
    createdLeadEmails.push(leadEmail);
    await storage.createLead({
      contactName: "Scale Lead",
      contactEmail: leadEmail,
      source: "landing:lp-platform-scale",
      status: "new",
      assignedAgentId: activeAgentId,
    });

    const stats = await storage.getShareStats(activeAgentId);
    expect(stats.platform.views).toBe(3);
    expect(stats.scale.views).toBe(1);
    expect(stats.leaks.views).toBe(0);
    expect(stats.scale.leads).toBe(1);
    expect(stats.platform.leads).toBe(0);
    expect(stats.leaks.leads).toBe(0);
  });
});
