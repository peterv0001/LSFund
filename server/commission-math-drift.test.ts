import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@shared/schema";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import { registerRoutes } from "./routes.js";
import { WebhookHandlers } from "./webhookHandlers.js";
import { scrypt as scryptCallback, randomBytes } from "crypto";
import { promisify } from "util";

// ============================================================================
// Commission-math drift guard
// ----------------------------------------------------------------------------
// The legacy subscription commission math (pool rate × decay, the +0.05 MCA
// pairing bonus that applies ONLY to the producer, and the L1/L2 upline override
// that intentionally EXCLUDES the bonus) is duplicated:
//   1. WebhookHandlers.fireCommissions   (server/webhookHandlers.ts)
//   2. POST /api/admin/subscriptions/calculate-commissions (server/routes.ts)
//
// Both fire on legacy records and both read sub.monthlyAmount, so they are the
// two reachable copies of the same formula. If someone edits the bonus (or the
// pool/decay math) in one copy but not the other, an agent could be quoted one
// amount and paid another — a money-movement bug. These tests run identical
// inputs through both code paths and assert the producer amounts agree, so the
// suite fails if the pairing bonus is added to (or removed from) only one path.
//
// The webhook path is the only reachable copy that also emits the L1/L2 upline
// override, so the override (bonus-excluded) amounts are locked here too.
// ============================================================================

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run commission drift tests");
}

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const PREFIX = `comm-drift-${Date.now()}`;
const ADMIN_PASSWORD = "AdminDriftPass1!";

const scryptAsync = promisify(scryptCallback);
async function hashPasswordForTest(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

let producerId: number; // earns the producer commission (with bonus when paired)
let l1SponsorId: number; // L1 upline override (no bonus)
let l2SponsorId: number; // L2 upline override (no bonus)
let adminId: number;
let testApp: ReturnType<typeof express>;
let adminCookie: string[];

const allAgentIds: number[] = [];

async function insertAgent(values: Partial<typeof schema.agents.$inferInsert>) {
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: `${PREFIX}-${Math.random().toString(36).slice(2, 8)}@example.com`,
      password: "not-a-real-hash",
      firstName: "Drift",
      lastName: "Tester",
      currentRank: "agent",
      highestRank: "agent",
      ...values,
    })
    .returning();
  allAgentIds.push(agent.id);
  return agent;
}

// Inserts a LEGACY subscription starting "now" so the decay window is months1to3
// (decayRate = 1.00). mcaPairedDealId only needs to be truthy — the legacy bonus
// branch checks truthiness, not a real deal, and the column carries no FK.
async function insertLegacySub(
  overrides: Partial<typeof schema.subscriptions.$inferInsert> = {},
) {
  const [sub] = await db
    .insert(schema.subscriptions)
    .values({
      agentId: producerId,
      merchantName: "Drift Merchant",
      tier: "tier_1",
      monthlyAmount: "100",
      startDate: new Date(),
      status: "active",
      commissionModel: "legacy",
      ...overrides,
    })
    .returning();
  return sub;
}

async function commissionsForSub(subId: number) {
  return db
    .select()
    .from(schema.commissions)
    .where(eq(schema.commissions.subscriptionId, subId));
}

async function cleanupSubs(subIds: number[]) {
  const ids = Array.from(new Set(subIds));
  if (ids.length === 0) return;
  await db.delete(schema.commissions).where(inArray(schema.commissions.subscriptionId, ids));
  await db.delete(schema.subscriptions).where(inArray(schema.subscriptions.id, ids));
}

// Returns the IDs of every subscription the calculate-commissions route would
// process right now (status=active). Used to scope cleanup of commissions the
// global route may create for subscriptions owned by other test files.
async function activeSubIds(): Promise<number[]> {
  const rows = await db
    .select({ id: schema.subscriptions.id })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.status, "active"));
  return rows.map((r) => r.id);
}

beforeAll(async () => {
  // Build the upline chain: L2 -> L1 -> producer (getUpline walks sponsorId).
  const l2 = await insertAgent({ firstName: "L2", lastName: "Upline" });
  l2SponsorId = l2.id;
  const l1 = await insertAgent({ firstName: "L1", lastName: "Upline", sponsorId: l2SponsorId });
  l1SponsorId = l1.id;
  const producer = await insertAgent({ firstName: "Producer", lastName: "Agent", sponsorId: l1SponsorId });
  producerId = producer.id;

  const admin = await insertAgent({
    firstName: "Admin",
    lastName: "Drift",
    isAdmin: true,
    email: `${PREFIX}-admin@example.com`,
    password: await hashPasswordForTest(ADMIN_PASSWORD),
  });
  adminId = admin.id;

  testApp = express();
  testApp.use(express.json());
  const httpServer = createServer(testApp);
  await registerRoutes(httpServer, testApp);

  const loginRes = await request(testApp)
    .post("/api/login")
    .send({ username: `${PREFIX}-admin@example.com`, password: ADMIN_PASSWORD });
  adminCookie = loginRes.headers["set-cookie"] as unknown as string[];
}, 30000);

afterAll(async () => {
  for (const id of allAgentIds) {
    const subRows = await db
      .select({ id: schema.subscriptions.id })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.agentId, id));
    await cleanupSubs(subRows.map((r) => r.id));
    await db.delete(schema.commissions).where(eq(schema.commissions.agentId, id));
    await db.delete(schema.activityLog).where(eq(schema.activityLog.actorId, id));
  }
  await db.delete(schema.agents).where(inArray(schema.agents.id, allAgentIds));
  await testPool.end();
});

// Fires the webhook path for a legacy sub and returns the producer's commission
// amount. The sub must carry a stripeSubscriptionId so handleInvoicePaid can
// locate it; pairing is controlled by mcaPairedDealId.
async function runWebhookPath(paired: boolean): Promise<{
  subId: number;
  producer: number;
  l1?: number;
  l2?: number;
  producerType: string;
}> {
  const stripeId = `sub_drift_webhook_${Math.random().toString(36).slice(2, 10)}`;
  const sub = await insertLegacySub({
    stripeSubscriptionId: stripeId,
    stripeCustomerId: "cus_drift",
    billingStatus: "active",
    mcaPairedDealId: paired ? 999999 : null,
  });

  await WebhookHandlers.handleInvoicePaid(stripeId, { lines: { data: [] } });

  const rows = await commissionsForSub(sub.id);
  const producerRow = rows.find((r) => r.agentId === producerId);
  const l1Row = rows.find((r) => r.agentId === l1SponsorId);
  const l2Row = rows.find((r) => r.agentId === l2SponsorId);
  if (!producerRow) throw new Error("webhook path produced no producer commission");
  return {
    subId: sub.id,
    producer: Number(producerRow.amount),
    l1: l1Row ? Number(l1Row.amount) : undefined,
    l2: l2Row ? Number(l2Row.amount) : undefined,
    producerType: producerRow.type,
  };
}

// Fires the routes.ts calculate-commissions path (the preview/estimate copy of
// the math) for a freshly inserted legacy sub and returns the producer's amount.
async function runRoutesPath(paired: boolean): Promise<{ subId: number; producer: number; producerType: string }> {
  const sub = await insertLegacySub({ mcaPairedDealId: paired ? 999999 : null });
  const touched = await activeSubIds();

  await request(testApp)
    .post("/api/admin/subscriptions/calculate-commissions")
    .set("Cookie", adminCookie)
    .expect(200);

  const rows = await commissionsForSub(sub.id);
  const producerRow = rows.find((r) => r.agentId === producerId);
  if (!producerRow) throw new Error("routes path produced no producer commission");

  // The global route may have created commissions for other test files' active
  // subs; drop commissions for everything it touched except our own sub so no
  // orphan rows survive pointing at subscriptions about to be deleted elsewhere.
  await db
    .delete(schema.commissions)
    .where(inArray(schema.commissions.subscriptionId, touched.filter((id) => id !== sub.id)));

  return { subId: sub.id, producer: Number(producerRow.amount), producerType: producerRow.type };
}

describe("commission-math drift: webhook vs routes calculate-commissions", () => {
  it("paired tier_1 $100 — both paths pay the producer $30.00 (pool×decay + bonus) and agree", async () => {
    const webhook = await runWebhookPath(true);
    const routes = await runRoutesPath(true);
    try {
      // pool 0.25 × decay 1.00 = 0.25, + 0.05 pairing bonus = 0.30 × $100 = $30.00
      expect(webhook.producer).toBeCloseTo(30.0, 2);
      expect(routes.producer).toBeCloseTo(30.0, 2);
      // Cross-path equality is the real drift guard: removing/adding the bonus in
      // only one copy makes one side $25.00 and breaks this assertion.
      expect(webhook.producer).toBeCloseTo(routes.producer, 2);
      expect(webhook.producerType).toBe("subscription_commission");
      expect(routes.producerType).toBe("subscription_commission");

      // The upline override intentionally excludes the bonus:
      // L1 = $100 × 0.25 × 0.10 × 1.00 = $2.50, L2 = $100 × 0.25 × 0.05 × 1.00 = $1.25
      expect(webhook.l1).toBeCloseTo(2.5, 2);
      expect(webhook.l2).toBeCloseTo(1.25, 2);
    } finally {
      await cleanupSubs([webhook.subId, routes.subId]);
    }
  });

  it("unpaired tier_1 $100 — both paths pay the producer $25.00 (no bonus) and agree", async () => {
    const webhook = await runWebhookPath(false);
    const routes = await runRoutesPath(false);
    try {
      // Without pairing the bonus is absent: 0.25 × $100 = $25.00 on both paths.
      expect(webhook.producer).toBeCloseTo(25.0, 2);
      expect(routes.producer).toBeCloseTo(25.0, 2);
      expect(webhook.producer).toBeCloseTo(routes.producer, 2);

      // Upline override is unaffected by pairing (never carried the bonus).
      expect(webhook.l1).toBeCloseTo(2.5, 2);
      expect(webhook.l2).toBeCloseTo(1.25, 2);
    } finally {
      await cleanupSubs([webhook.subId, routes.subId]);
    }
  });

  it("the +0.05 pairing bonus is exactly the paid/unpaid delta on BOTH paths", async () => {
    const webhookPaired = await runWebhookPath(true);
    const webhookUnpaired = await runWebhookPath(false);
    const routesPaired = await runRoutesPath(true);
    const routesUnpaired = await runRoutesPath(false);
    try {
      // $100 × 0.05 = $5.00 bonus delta. If the bonus is dropped from one path
      // only, that path's delta collapses to $0 and this assertion fails.
      expect(webhookPaired.producer - webhookUnpaired.producer).toBeCloseTo(5.0, 2);
      expect(routesPaired.producer - routesUnpaired.producer).toBeCloseTo(5.0, 2);
    } finally {
      await cleanupSubs([
        webhookPaired.subId,
        webhookUnpaired.subId,
        routesPaired.subId,
        routesUnpaired.subId,
      ]);
    }
  });
});
