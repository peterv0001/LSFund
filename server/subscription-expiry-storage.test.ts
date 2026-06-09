import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@shared/schema";
import { storage } from "./storage.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run subscription expiry storage tests");
}

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const TEST_EMAIL_PREFIX = `expiry-store-test-${Date.now()}`;

const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS);

let agentId: number;

async function createSub(values: {
  status?: "active" | "paused" | "cancelled" | "expired";
  endDate?: Date | null;
  expiryWarningSentAt?: Date | null;
  merchantName?: string;
}) {
  const [sub] = await db
    .insert(schema.subscriptions)
    .values({
      agentId,
      merchantName: values.merchantName ?? "Acme Corp",
      tier: "tier_1",
      monthlyAmount: "199.00",
      status: values.status ?? "active",
      endDate: values.endDate ?? null,
      expiryWarningSentAt: values.expiryWarningSentAt ?? null,
    })
    .returning();
  return sub;
}

async function clearSubs() {
  await db.delete(schema.subscriptions).where(eq(schema.subscriptions.agentId, agentId));
}

beforeAll(async () => {
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: `${TEST_EMAIL_PREFIX}@example.com`,
      password: "not-a-real-hash",
      firstName: "Expiry",
      lastName: "Store",
      currentRank: "agent",
      highestRank: "agent",
    })
    .returning();
  agentId = agent.id;
});

afterAll(async () => {
  await clearSubs();
  await db.delete(schema.agents).where(eq(schema.agents.id, agentId));
  await testPool.end();
});

beforeEach(async () => {
  await clearSubs();
});

// =========================================================
// getSubscriptionsDueForExpiry
// =========================================================

describe("getSubscriptionsDueForExpiry", () => {
  it("returns an active subscription whose endDate is in the past", async () => {
    const sub = await createSub({ status: "active", endDate: daysFromNow(-1) });

    const due = await storage.getSubscriptionsDueForExpiry();
    const ids = due.map((s) => s.id);

    expect(ids).toContain(sub.id);
  });

  it("returns a paused subscription whose endDate is in the past", async () => {
    const sub = await createSub({ status: "paused", endDate: daysFromNow(-1) });

    const due = await storage.getSubscriptionsDueForExpiry();
    const ids = due.map((s) => s.id);

    expect(ids).toContain(sub.id);
  });

  it("does not return a subscription whose endDate is still in the future", async () => {
    const sub = await createSub({ status: "active", endDate: daysFromNow(5) });

    const due = await storage.getSubscriptionsDueForExpiry();
    const ids = due.map((s) => s.id);

    expect(ids).not.toContain(sub.id);
  });

  it("does not return a subscription with a null endDate", async () => {
    const sub = await createSub({ status: "active", endDate: null });

    const due = await storage.getSubscriptionsDueForExpiry();
    const ids = due.map((s) => s.id);

    expect(ids).not.toContain(sub.id);
  });

  it("ignores already-cancelled and already-expired subscriptions", async () => {
    const cancelled = await createSub({ status: "cancelled", endDate: daysFromNow(-1) });
    const expired = await createSub({ status: "expired", endDate: daysFromNow(-1) });

    const due = await storage.getSubscriptionsDueForExpiry();
    const ids = due.map((s) => s.id);

    expect(ids).not.toContain(cancelled.id);
    expect(ids).not.toContain(expired.id);
  });
});

// =========================================================
// getSubscriptionsDueForWarning
// =========================================================

describe("getSubscriptionsDueForWarning", () => {
  it("returns a subscription whose endDate falls exactly on the target day (7)", async () => {
    const sub = await createSub({ status: "active", endDate: daysFromNow(7) });

    const due = await storage.getSubscriptionsDueForWarning(7);
    const ids = due.map((s) => s.id);

    expect(ids).toContain(sub.id);
  });

  it("includes subscriptions at the near edge of the window (6 days out)", async () => {
    // window for days=7 is [now+6d, now+8d]; 6 days + a small buffer keeps it inside.
    const sub = await createSub({ status: "active", endDate: daysFromNow(6.1) });

    const due = await storage.getSubscriptionsDueForWarning(7);
    const ids = due.map((s) => s.id);

    expect(ids).toContain(sub.id);
  });

  it("includes subscriptions at the far edge of the window (8 days out)", async () => {
    const sub = await createSub({ status: "active", endDate: daysFromNow(7.9) });

    const due = await storage.getSubscriptionsDueForWarning(7);
    const ids = due.map((s) => s.id);

    expect(ids).toContain(sub.id);
  });

  it("excludes subscriptions before the window (5 days out)", async () => {
    const sub = await createSub({ status: "active", endDate: daysFromNow(5) });

    const due = await storage.getSubscriptionsDueForWarning(7);
    const ids = due.map((s) => s.id);

    expect(ids).not.toContain(sub.id);
  });

  it("excludes subscriptions after the window (10 days out)", async () => {
    const sub = await createSub({ status: "active", endDate: daysFromNow(10) });

    const due = await storage.getSubscriptionsDueForWarning(7);
    const ids = due.map((s) => s.id);

    expect(ids).not.toContain(sub.id);
  });

  it("excludes subscriptions that already have expiryWarningSentAt set", async () => {
    const sub = await createSub({
      status: "active",
      endDate: daysFromNow(7),
      expiryWarningSentAt: new Date(),
    });

    const due = await storage.getSubscriptionsDueForWarning(7);
    const ids = due.map((s) => s.id);

    expect(ids).not.toContain(sub.id);
  });

  it("excludes cancelled and expired subscriptions even inside the window", async () => {
    const cancelled = await createSub({ status: "cancelled", endDate: daysFromNow(7) });
    const expired = await createSub({ status: "expired", endDate: daysFromNow(7) });

    const due = await storage.getSubscriptionsDueForWarning(7);
    const ids = due.map((s) => s.id);

    expect(ids).not.toContain(cancelled.id);
    expect(ids).not.toContain(expired.id);
  });

  it("includes paused subscriptions inside the window", async () => {
    const sub = await createSub({ status: "paused", endDate: daysFromNow(7) });

    const due = await storage.getSubscriptionsDueForWarning(7);
    const ids = due.map((s) => s.id);

    expect(ids).toContain(sub.id);
  });

  it("honours a custom warning window (days=14)", async () => {
    const inWindow = await createSub({ status: "active", endDate: daysFromNow(14) });
    const outOfWindow = await createSub({ status: "active", endDate: daysFromNow(7) });

    const due = await storage.getSubscriptionsDueForWarning(14);
    const ids = due.map((s) => s.id);

    expect(ids).toContain(inWindow.id);
    expect(ids).not.toContain(outOfWindow.id);
  });
});

// =========================================================
// markSubscriptionWarningSent
// =========================================================

describe("markSubscriptionWarningSent", () => {
  it("stamps expiryWarningSentAt so the subscription stops appearing in the warning query", async () => {
    const sub = await createSub({ status: "active", endDate: daysFromNow(7) });

    // Initially due.
    const before = await storage.getSubscriptionsDueForWarning(7);
    expect(before.map((s) => s.id)).toContain(sub.id);

    await storage.markSubscriptionWarningSent(sub.id);

    const [row] = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.id, sub.id));
    expect(row.expiryWarningSentAt).not.toBeNull();

    // No longer due — prevents duplicate warnings.
    const after = await storage.getSubscriptionsDueForWarning(7);
    expect(after.map((s) => s.id)).not.toContain(sub.id);
  });

  it("is idempotent against duplicate warnings across repeated scheduler runs", async () => {
    const sub = await createSub({ status: "active", endDate: daysFromNow(7) });

    await storage.markSubscriptionWarningSent(sub.id);
    const firstDue = await storage.getSubscriptionsDueForWarning(7);
    expect(firstDue.map((s) => s.id)).not.toContain(sub.id);

    // A second scheduler pass would query again and find nothing to re-warn.
    const secondDue = await storage.getSubscriptionsDueForWarning(7);
    expect(secondDue.map((s) => s.id)).not.toContain(sub.id);
  });
});
