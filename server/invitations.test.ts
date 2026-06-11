import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@shared/schema";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import { registerRoutes } from "./routes.js";
import { scrypt as scryptCallback, randomBytes, createHash } from "crypto";
import { promisify } from "util";
import { api } from "@shared/routes";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run invitation route tests");
}

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const scryptAsync = promisify(scryptCallback);

async function hashPasswordForTest(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

const INVITER_PASSWORD = "InviterPass1!";
const PREFIX = `invite-test-${Date.now()}`;
const inviterEmail = `${PREFIX}-inviter@example.com`;
const existingEmail = `${PREFIX}-existing@example.com`;

let inviterId: number;
let existingAgentId: number;
let testApp: ReturnType<typeof express>;

// Emails of agents created during acceptance tests, cleaned up at the end.
const createdAgentEmails: string[] = [];

beforeAll(async () => {
  const [inviter] = await db
    .insert(schema.agents)
    .values({
      email: inviterEmail,
      password: await hashPasswordForTest(INVITER_PASSWORD),
      firstName: "Ivy",
      lastName: "Inviter",
      currentRank: "agent",
      highestRank: "agent",
      status: "active",
    })
    .returning();
  inviterId = inviter.id;

  const [existing] = await db
    .insert(schema.agents)
    .values({
      email: existingEmail,
      password: await hashPasswordForTest("ExistingPass1!"),
      firstName: "Al",
      lastName: "Ready",
      currentRank: "agent",
      highestRank: "agent",
      status: "active",
    })
    .returning();
  existingAgentId = existing.id;

  testApp = express();
  testApp.use(express.json());
  const httpServer = createServer(testApp);
  await registerRoutes(httpServer, testApp);
}, 30000);

afterAll(async () => {
  await db.delete(schema.agentInvitations).where(eq(schema.agentInvitations.inviterId, inviterId));
  const emails = [inviterEmail, existingEmail, ...createdAgentEmails];
  if (emails.length) {
    await db.delete(schema.agents).where(inArray(schema.agents.email, emails));
  }
  await testPool.end();
});

async function loginAsInviter(): Promise<string[]> {
  const res = await request(testApp)
    .post("/api/login")
    .send({ username: inviterEmail, password: INVITER_PASSWORD });
  return res.headers["set-cookie"] as unknown as string[];
}

// Inserts an invitation directly with a known raw token so acceptance/lookup
// flows can be exercised (the API never returns the raw token).
async function seedInvitation(opts: {
  email: string;
  rawToken: string;
  placementLeg?: "left" | "right" | "auto";
  status?: "pending" | "accepted" | "cancelled" | "expired";
  expiresAt?: Date;
  firstName?: string;
  lastName?: string;
}) {
  const [inv] = await db
    .insert(schema.agentInvitations)
    .values({
      inviterId,
      firstName: opts.firstName ?? "Pat",
      lastName: opts.lastName ?? "Prospect",
      email: opts.email,
      placementLeg: opts.placementLeg ?? "auto",
      token: hashToken(opts.rawToken),
      status: opts.status ?? "pending",
      expiresAt: opts.expiresAt ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    })
    .returning();
  return inv;
}

describe("POST /api/invitations (create)", () => {
  it("rejects unauthenticated requests with 401", async () => {
    await request(testApp)
      .post(api.invitations.create.path)
      .send({ firstName: "New", lastName: "Lead", email: `${PREFIX}-a@example.com`, placementLeg: "auto" })
      .expect(401);
  });

  it("creates a pending invitation and never exposes the token", async () => {
    const cookie = await loginAsInviter();
    const email = `${PREFIX}-create@example.com`;
    const res = await request(testApp)
      .post(api.invitations.create.path)
      .set("Cookie", cookie)
      .send({ firstName: "New", lastName: "Lead", email, placementLeg: "left" })
      .expect(201);

    expect(res.body).toHaveProperty("id");
    expect(res.body.status).toBe("pending");
    expect(res.body.email).toBe(email);
    expect(res.body.placementLeg).toBe("left");
    expect(res.body.token).toBeUndefined();
  });

  it("rejects inviting an email that already has an account", async () => {
    const cookie = await loginAsInviter();
    const res = await request(testApp)
      .post(api.invitations.create.path)
      .set("Cookie", cookie)
      .send({ firstName: "Al", lastName: "Ready", email: existingEmail, placementLeg: "auto" })
      .expect(400);
    expect(res.body.message).toMatch(/already/i);
  });

  it("rejects a duplicate pending invitation to the same email", async () => {
    const cookie = await loginAsInviter();
    const email = `${PREFIX}-dup@example.com`;
    await request(testApp)
      .post(api.invitations.create.path)
      .set("Cookie", cookie)
      .send({ firstName: "Dup", lastName: "Licate", email, placementLeg: "auto" })
      .expect(201);
    const res = await request(testApp)
      .post(api.invitations.create.path)
      .set("Cookie", cookie)
      .send({ firstName: "Dup", lastName: "Licate", email, placementLeg: "auto" })
      .expect(400);
    expect(res.body.message).toMatch(/pending invitation/i);
  });
});

describe("GET /api/invitations (list)", () => {
  it("requires authentication", async () => {
    await request(testApp).get(api.invitations.list.path).expect(401);
  });

  it("returns the inviter's invitations without tokens", async () => {
    const cookie = await loginAsInviter();
    const res = await request(testApp)
      .get(api.invitations.list.path)
      .set("Cookie", cookie)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    for (const inv of res.body) {
      expect(inv.token).toBeUndefined();
      expect(inv.inviterId).toBe(inviterId);
    }
  });
});

describe("GET /api/invitations/lookup/:token", () => {
  it("returns a prefill preview for a valid token", async () => {
    const rawToken = randomBytes(32).toString("hex");
    await seedInvitation({ email: `${PREFIX}-lookup@example.com`, rawToken, firstName: "Look", lastName: "Up" });
    const res = await request(testApp)
      .get(api.invitations.lookup.path.replace(":token", rawToken))
      .expect(200);
    expect(res.body.email).toBe(`${PREFIX}-lookup@example.com`);
    expect(res.body.firstName).toBe("Look");
    expect(res.body.inviterName).toBe("Ivy Inviter");
  });

  it("rejects an invalid token", async () => {
    await request(testApp)
      .get(api.invitations.lookup.path.replace(":token", "not-a-real-token"))
      .expect(400);
  });
});

describe("POST /api/invitations/accept", () => {
  it("creates the agent placed under the inviter on the stored leg, logs them in, and marks the invite used", async () => {
    const rawToken = randomBytes(32).toString("hex");
    const email = `${PREFIX}-accept@example.com`;
    createdAgentEmails.push(email);
    const inv = await seedInvitation({ email, rawToken, placementLeg: "left", firstName: "Ace", lastName: "Eptor" });

    const res = await request(testApp)
      .post(api.invitations.accept.path)
      .send({ token: rawToken, password: "ProspectPass1!", legalConsent: true })
      .expect(200);

    expect(res.body.email).toBe(email);
    expect(res.body.password).toBeUndefined();

    const [agent] = await db.select().from(schema.agents).where(eq(schema.agents.email, email));
    expect(agent).toBeTruthy();
    expect(agent.sponsorId).toBe(inviterId);
    expect(agent.placementId).toBe(inviterId);
    expect(agent.leg).toBe("left");

    const [updated] = await db
      .select()
      .from(schema.agentInvitations)
      .where(eq(schema.agentInvitations.id, inv.id));
    expect(updated.status).toBe("accepted");
    expect(updated.acceptedAgentId).toBe(agent.id);
  });

  it("rejects reusing an already-accepted token", async () => {
    const rawToken = randomBytes(32).toString("hex");
    await seedInvitation({ email: `${PREFIX}-used@example.com`, rawToken, status: "accepted" });
    const res = await request(testApp)
      .post(api.invitations.accept.path)
      .send({ token: rawToken, password: "ProspectPass1!", legalConsent: true })
      .expect(400);
    expect(res.body.message).toMatch(/already been used/i);
  });

  it("rejects an expired token", async () => {
    const rawToken = randomBytes(32).toString("hex");
    await seedInvitation({
      email: `${PREFIX}-expired@example.com`,
      rawToken,
      expiresAt: new Date(Date.now() - 1000),
    });
    const res = await request(testApp)
      .post(api.invitations.accept.path)
      .send({ token: rawToken, password: "ProspectPass1!", legalConsent: true })
      .expect(400);
    expect(res.body.message).toMatch(/expired/i);
  });

  it("rejects an invalid token", async () => {
    await request(testApp)
      .post(api.invitations.accept.path)
      .send({ token: "totally-invalid", password: "ProspectPass1!", legalConsent: true })
      .expect(400);
  });

  it("rejects acceptance without legal consent", async () => {
    const rawToken = randomBytes(32).toString("hex");
    await seedInvitation({ email: `${PREFIX}-noconsent@example.com`, rawToken });
    await request(testApp)
      .post(api.invitations.accept.path)
      .send({ token: rawToken, password: "ProspectPass1!", legalConsent: false })
      .expect(400);
  });
});
