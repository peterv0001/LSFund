import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@shared/schema";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import { registerRoutes } from "./routes.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run join-flow tests");
}

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const RUN_ID = `join-${Date.now()}`;
const PASSWORD = "JoinFlowPass1!";

let testApp: ReturnType<typeof express>;
const createdEmails: string[] = [];

function email(label: string): string {
  const addr = `${RUN_ID}-${label}@example.com`.toLowerCase();
  createdEmails.push(addr);
  return addr;
}

function registerAgent(body: Record<string, unknown>) {
  return request(testApp).post("/api/register").send(body);
}

async function insertSponsor(opts: {
  label: string;
  status?: "active" | "inactive" | "suspended";
  referralCode: string;
}) {
  const addr = email(opts.label);
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: addr,
      password: "x".repeat(64) + ".salt",
      firstName: "Spon",
      lastName: opts.label.replace(/[^a-zA-Z]/g, "") || "Sor",
      referralCode: opts.referralCode,
      status: opts.status ?? "active",
      currentRank: "agent",
      highestRank: "agent",
    })
    .returning();
  return agent;
}

beforeAll(async () => {
  testApp = express();
  testApp.use(express.json());
  const httpServer = createServer(testApp);
  await registerRoutes(httpServer, testApp);
}, 30000);

afterAll(async () => {
  if (createdEmails.length) {
    const rows = await db
      .select({ id: schema.agents.id })
      .from(schema.agents)
      .where(inArray(schema.agents.email, createdEmails));
    const ids = rows.map((r) => r.id);
    if (ids.length) {
      await db.delete(schema.notifications).where(inArray(schema.notifications.agentId, ids));
      // Delete deepest-first is unnecessary because placement_id has no FK,
      // but clear children's placement pointers is not needed for cleanup.
      await db.delete(schema.agents).where(inArray(schema.agents.id, ids));
    }
  }
  await testPool.end();
});

describe("referral join/signup flow", () => {
  it("resolves a sponsor by referral code and places the new agent under them", async () => {
    const sponsor = await insertSponsor({ label: "bycode", referralCode: `RC${RUN_ID.slice(-6)}A` });
    const res = await registerAgent({
      email: email("bycode-new"),
      password: PASSWORD,
      firstName: "Cody",
      lastName: "Code",
      referralCode: sponsor.referralCode,
    }).expect(201);

    expect(res.body.sponsorId).toBe(sponsor.id);
    expect(res.body.placementId).toBe(sponsor.id);
    expect(res.body.leg).toBe("left");
  });

  it("resolves a sponsor by a numeric id supplied as the referral code", async () => {
    const sponsor = await insertSponsor({ label: "bynum", referralCode: `RC${RUN_ID.slice(-6)}B` });
    const res = await registerAgent({
      email: email("bynum-new"),
      password: PASSWORD,
      firstName: "Numb",
      lastName: "Eric",
      referralCode: String(sponsor.id),
    }).expect(201);

    expect(res.body.sponsorId).toBe(sponsor.id);
  });

  it("resolves a sponsor by an explicit sponsorId", async () => {
    const sponsor = await insertSponsor({ label: "byid", referralCode: `RC${RUN_ID.slice(-6)}C` });
    const res = await registerAgent({
      email: email("byid-new"),
      password: PASSWORD,
      firstName: "Iden",
      lastName: "Tity",
      sponsorId: sponsor.id,
    }).expect(201);

    expect(res.body.sponsorId).toBe(sponsor.id);
  });

  it("rejects a signup whose referral code resolves to an inactive sponsor", async () => {
    const sponsor = await insertSponsor({
      label: "inactive",
      status: "inactive",
      referralCode: `RC${RUN_ID.slice(-6)}D`,
    });
    const res = await registerAgent({
      email: email("inactive-new"),
      password: PASSWORD,
      firstName: "No",
      lastName: "Show",
      referralCode: sponsor.referralCode,
    }).expect(400);

    expect(res.body.message).toMatch(/referral link is no longer valid/i);
    // The orphaned agent must not have been created.
    const found = await db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.email, createdEmails[createdEmails.length - 1]));
    expect(found).toHaveLength(0);
  });

  it("rejects a signup whose sponsorId does not exist", async () => {
    const res = await registerAgent({
      email: email("missing-new"),
      password: PASSWORD,
      firstName: "Ghost",
      lastName: "Sponsor",
      sponsorId: 2_000_000_000,
    }).expect(400);

    expect(res.body.message).toMatch(/referral link is no longer valid/i);
  });

  it("allows a genuinely sponsorless direct signup", async () => {
    const res = await registerAgent({
      email: email("direct-new"),
      password: PASSWORD,
      firstName: "Solo",
      lastName: "Direct",
    }).expect(201);

    expect(res.body.sponsorId ?? null).toBeNull();
    expect(res.body.placementId ?? null).toBeNull();
    expect(res.body.leg ?? null).toBeNull();
    expect(typeof res.body.referralCode).toBe("string");
    expect(res.body.referralCode.length).toBeGreaterThan(0);
  });

  it("places into the left and right legs, traversing down a filled leg", async () => {
    const sponsor = await insertSponsor({ label: "tree", referralCode: `RC${RUN_ID.slice(-6)}E` });

    const a = await registerAgent({
      email: email("tree-a"),
      password: PASSWORD,
      firstName: "Left",
      lastName: "One",
      sponsorId: sponsor.id,
      placementLeg: "left",
    }).expect(201);
    expect(a.body.placementId).toBe(sponsor.id);
    expect(a.body.leg).toBe("left");

    const c = await registerAgent({
      email: email("tree-c"),
      password: PASSWORD,
      firstName: "Right",
      lastName: "One",
      sponsorId: sponsor.id,
      placementLeg: "right",
    }).expect(201);
    expect(c.body.placementId).toBe(sponsor.id);
    expect(c.body.leg).toBe("right");

    // Sponsor's left slot is filled by A, so a second left placement must
    // traverse down to A and land on A's open left slot.
    const b = await registerAgent({
      email: email("tree-b"),
      password: PASSWORD,
      firstName: "Left",
      lastName: "Deep",
      sponsorId: sponsor.id,
      placementLeg: "left",
    }).expect(201);
    expect(b.body.placementId).toBe(a.body.id);
    expect(b.body.leg).toBe("left");
  });

  it("auto-balances onto the open leg", async () => {
    const sponsor = await insertSponsor({ label: "auto", referralCode: `RC${RUN_ID.slice(-6)}F` });
    const res = await registerAgent({
      email: email("auto-new"),
      password: PASSWORD,
      firstName: "Auto",
      lastName: "Bal",
      sponsorId: sponsor.id,
      placementLeg: "auto",
    }).expect(201);
    expect(res.body.placementId).toBe(sponsor.id);
    expect(["left", "right"]).toContain(res.body.leg);
  });

  it("rejects a duplicate email", async () => {
    const addr = email("dupe");
    await registerAgent({
      email: addr,
      password: PASSWORD,
      firstName: "First",
      lastName: "Time",
    }).expect(201);

    const res = await registerAgent({
      email: addr,
      password: PASSWORD,
      firstName: "Second",
      lastName: "Time",
    }).expect(400);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it("always assigns a server-generated referral code and ignores a body-supplied one", async () => {
    const sponsor = await insertSponsor({ label: "nohack", referralCode: `RC${RUN_ID.slice(-6)}G` });
    const injected = "HACKERINJECTED";
    const res = await registerAgent({
      email: email("nohack-new"),
      password: PASSWORD,
      firstName: "Safe",
      lastName: "Code",
      sponsorId: sponsor.id,
      referralCode: injected,
    }).expect(201);

    expect(res.body.referralCode).not.toBe(injected);
    expect(res.body.referralCode).not.toBe(sponsor.referralCode);
    expect(res.body.referralCode.length).toBeGreaterThan(0);
  });

  it("creates a welcome notification and notifies the sponsor of a new team member", async () => {
    const sponsor = await insertSponsor({ label: "notif", referralCode: `RC${RUN_ID.slice(-6)}H` });
    const res = await registerAgent({
      email: email("notif-new"),
      password: PASSWORD,
      firstName: "Note",
      lastName: "Ify",
      sponsorId: sponsor.id,
    }).expect(201);

    const newAgentNotes = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.agentId, res.body.id));
    expect(newAgentNotes.some((n) => n.type === "system")).toBe(true);

    const sponsorNotes = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.agentId, sponsor.id));
    expect(sponsorNotes.some((n) => n.type === "team_signup")).toBe(true);
  });

  it("never places two concurrent same-leg signups in the same slot", async () => {
    const sponsor = await insertSponsor({ label: "race", referralCode: `RC${RUN_ID.slice(-6)}I` });

    const [r1, r2] = await Promise.all([
      registerAgent({
        email: email("race-1"),
        password: PASSWORD,
        firstName: "Race",
        lastName: "One",
        sponsorId: sponsor.id,
        placementLeg: "left",
      }),
      registerAgent({
        email: email("race-2"),
        password: PASSWORD,
        firstName: "Race",
        lastName: "Two",
        sponsorId: sponsor.id,
        placementLeg: "left",
      }),
    ]);

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);

    const slot = (b: any) => `${b.placementId}:${b.leg}`;
    expect(slot(r1.body)).not.toBe(slot(r2.body));
  });

  it("enforces the placement uniqueness guarantee at the database level", async () => {
    const rows = await testPool.query(
      `SELECT 1 FROM pg_indexes WHERE indexname = 'agents_placement_leg_unique_idx'`
    );
    expect(rows.rowCount).toBe(1);
  });
});
