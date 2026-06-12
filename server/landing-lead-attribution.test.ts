import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@shared/schema";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import { registerRoutes } from "./routes.js";
import { api } from "@shared/routes";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run landing-lead attribution tests");
}

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const SUFFIX = `${Date.now()}`;
const ACTIVE_CODE = `LPACTIVE${SUFFIX}`;
const SUSPENDED_CODE = `LPSUSPENDED${SUFFIX}`;

let activeAgentId: number;
let suspendedAgentId: number;
let testApp: ReturnType<typeof express>;
const createdLeadEmails: string[] = [];

beforeAll(async () => {
  const [active] = await db
    .insert(schema.agents)
    .values({
      email: `lp-active-${SUFFIX}@example.com`,
      password: "x",
      firstName: "Ava",
      lastName: "Active",
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
      email: `lp-suspended-${SUFFIX}@example.com`,
      password: "x",
      firstName: "Sam",
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
  await db.delete(schema.agents).where(eq(schema.agents.id, activeAgentId));
  await db.delete(schema.agents).where(eq(schema.agents.id, suspendedAgentId));
  await testPool.end();
});

async function submitLandingLead(body: Record<string, unknown>) {
  return request(testApp).post(api.public.landingLead.path).send(body);
}

async function getLeadByEmail(email: string) {
  const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.contactEmail, email));
  return lead;
}

describe("landing-lead agent attribution", () => {
  it("assigns the lead to an active agent when agent_ref matches their referral code", async () => {
    const email = `lead-match-${SUFFIX}@example.com`;
    createdLeadEmails.push(email);

    const res = await submitLandingLead({
      campaign: "platform",
      name: "Match Merchant",
      email,
      agent_ref: ACTIVE_CODE,
      tier_interest: "Growth",
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    const lead = await getLeadByEmail(email);
    expect(lead).toBeDefined();
    expect(lead.assignedAgentId).toBe(activeAgentId);
    expect(lead.assignedAt).not.toBeNull();
    expect((lead.enrichmentData as Record<string, unknown>).agent_ref).toBe(ACTIVE_CODE);
    expect((lead.enrichmentData as Record<string, unknown>).tier_interest).toBe("Growth");
  });

  it("requires an exact referral-code match (different case does not attribute)", async () => {
    const email = `lead-case-${SUFFIX}@example.com`;
    createdLeadEmails.push(email);

    const res = await submitLandingLead({
      campaign: "leaks",
      name: "Case Merchant",
      email,
      agent_ref: ACTIVE_CODE.toLowerCase(),
    });
    expect(res.status).toBe(200);

    const lead = await getLeadByEmail(email);
    expect(lead.assignedAgentId).toBeNull();
  });

  it("leaves the lead unassigned when agent_ref does not match any code", async () => {
    const email = `lead-nomatch-${SUFFIX}@example.com`;
    createdLeadEmails.push(email);

    const res = await submitLandingLead({
      campaign: "scale",
      name: "Orphan Merchant",
      email,
      agent_ref: `DOESNOTEXIST${SUFFIX}`,
    });
    expect(res.status).toBe(200);

    const lead = await getLeadByEmail(email);
    expect(lead.assignedAgentId).toBeNull();
    expect(lead.assignedAt).toBeNull();
  });

  it("leaves the lead unassigned when the matched agent is not active", async () => {
    const email = `lead-suspended-${SUFFIX}@example.com`;
    createdLeadEmails.push(email);

    const res = await submitLandingLead({
      campaign: "platform",
      name: "Suspended Ref Merchant",
      email,
      agent_ref: SUSPENDED_CODE,
    });
    expect(res.status).toBe(200);

    const lead = await getLeadByEmail(email);
    expect(lead.assignedAgentId).toBeNull();
    expect(lead.assignedAt).toBeNull();
  });

  it("never attributes when agent_ref is a numeric agent id (no id enumeration)", async () => {
    const email = `lead-numericid-${SUFFIX}@example.com`;
    createdLeadEmails.push(email);

    const res = await submitLandingLead({
      campaign: "platform",
      name: "Numeric Ref Merchant",
      email,
      agent_ref: String(activeAgentId),
    });
    expect(res.status).toBe(200);

    const lead = await getLeadByEmail(email);
    expect(lead.assignedAgentId).toBeNull();
    expect(lead.assignedAt).toBeNull();
  });

  it("saves the lead unassigned when no agent_ref is provided", async () => {
    const email = `lead-noref-${SUFFIX}@example.com`;
    createdLeadEmails.push(email);

    const res = await submitLandingLead({
      campaign: "platform",
      name: "Direct Merchant",
      email,
    });
    expect(res.status).toBe(200);

    const lead = await getLeadByEmail(email);
    expect(lead.assignedAgentId).toBeNull();
  });
});

describe("public advisor lookup", () => {
  it("resolves an active referral code to the advisor first name", async () => {
    const res = await request(testApp).get(
      api.public.advisor.path.replace(":code", ACTIVE_CODE),
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ found: true, name: "Ava" });
  });

  it("does not resolve a suspended agent's code", async () => {
    const res = await request(testApp).get(
      api.public.advisor.path.replace(":code", SUSPENDED_CODE),
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ found: false });
  });

  it("does not resolve a numeric agent id (no id enumeration)", async () => {
    const res = await request(testApp).get(
      api.public.advisor.path.replace(":code", String(activeAgentId)),
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ found: false });
  });

  it("returns found: false for an unknown code", async () => {
    const res = await request(testApp).get(
      api.public.advisor.path.replace(":code", `NOPE${SUFFIX}`),
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ found: false });
  });
});
