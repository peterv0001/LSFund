import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import * as schema from "@shared/schema";
import { storage } from "../storage.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run commission constraint tests");
}

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const TEST_PREFIX = `comm-constraint-${Date.now()}`;

let agentId: number;
let subscriptionId: number;

async function createTestAgent(suffix: string) {
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: `${TEST_PREFIX}-${suffix}@example.com`,
      password: "not-a-real-hash",
      firstName: "Constraint",
      lastName: "Test",
      currentRank: "agent",
      highestRank: "agent",
    })
    .returning();
  return agent;
}

async function createTestSubscription(agentId: number) {
  const [sub] = await db
    .insert(schema.subscriptions)
    .values({
      agentId,
      merchantName: "Test Merchant",
      tier: "tier_1",
      monthlyAmount: "199.00",
      status: "active",
    })
    .returning();
  return sub;
}

beforeAll(async () => {
  const agent = await createTestAgent("main");
  agentId = agent.id;
  const sub = await createTestSubscription(agentId);
  subscriptionId = sub.id;
});

afterAll(async () => {
  await db
    .delete(schema.commissions)
    .where(eq(schema.commissions.agentId, agentId));
  await db
    .delete(schema.subscriptions)
    .where(eq(schema.subscriptions.agentId, agentId));
  await db.delete(schema.agents).where(eq(schema.agents.id, agentId));
  await testPool.end();
});

describe("commissions unique constraint – DB level", () => {
  const periodDate = "2025-01-01";
  const commissionType = "subscription_commission" as const;

  it("allows inserting a subscription commission for an agent+subscription+period+type", async () => {
    const [comm] = await db
      .insert(schema.commissions)
      .values({
        agentId,
        subscriptionId,
        type: commissionType,
        amount: "50.00",
        periodDate,
        status: "pending",
      })
      .returning();

    expect(comm).toBeDefined();
    expect(comm.agentId).toBe(agentId);
    expect(comm.subscriptionId).toBe(subscriptionId);
    expect(comm.periodDate).toBe(periodDate);
    expect(comm.type).toBe(commissionType);
  });

  it("rejects a duplicate insert for the same agent+subscription+period+type via DB constraint", async () => {
    await expect(
      db
        .insert(schema.commissions)
        .values({
          agentId,
          subscriptionId,
          type: commissionType,
          amount: "99.00",
          periodDate,
          status: "pending",
        })
        .returning()
    ).rejects.toThrow();
  });

  it("allows a different period date for the same agent+subscription+type", async () => {
    const [comm] = await db
      .insert(schema.commissions)
      .values({
        agentId,
        subscriptionId,
        type: commissionType,
        amount: "50.00",
        periodDate: "2025-02-01",
        status: "pending",
      })
      .returning();

    expect(comm).toBeDefined();
    expect(comm.periodDate).toBe("2025-02-01");
  });

  it("allows a different commission type for the same agent+subscription+period", async () => {
    const [comm] = await db
      .insert(schema.commissions)
      .values({
        agentId,
        subscriptionId,
        type: "subscription_residual",
        amount: "20.00",
        periodDate,
        status: "pending",
      })
      .returning();

    expect(comm).toBeDefined();
    expect(comm.type).toBe("subscription_residual");
  });
});

describe("createCommission storage method – idempotency", () => {
  const periodDate = "2025-03-01";
  const commissionType = "subscription_commission" as const;

  it("inserts and returns a new commission when none exists", async () => {
    const comm = await storage.createCommission({
      agentId,
      subscriptionId,
      type: commissionType,
      amount: "75.00",
      periodDate,
      status: "pending",
    });

    expect(comm).toBeDefined();
    expect(comm.agentId).toBe(agentId);
    expect(comm.amount).toBe("75.00");
  });

  it("returns the existing commission instead of throwing when a duplicate is attempted", async () => {
    const first = await storage.createCommission({
      agentId,
      subscriptionId,
      type: commissionType,
      amount: "75.00",
      periodDate,
      status: "pending",
    });

    const duplicate = await storage.createCommission({
      agentId,
      subscriptionId,
      type: commissionType,
      amount: "999.00",
      periodDate,
      status: "pending",
    });

    expect(duplicate).toBeDefined();
    expect(duplicate.id).toBe(first.id);
    expect(duplicate.amount).toBe("75.00");
  });

  it("does not create a second record when createCommission is called twice for the same key", async () => {
    await storage.createCommission({
      agentId,
      subscriptionId,
      type: commissionType,
      amount: "75.00",
      periodDate,
      status: "pending",
    });

    const all = await db
      .select()
      .from(schema.commissions)
      .where(
        and(
          eq(schema.commissions.agentId, agentId),
          eq(schema.commissions.subscriptionId, subscriptionId),
          eq(schema.commissions.periodDate, periodDate),
          eq(schema.commissions.type, commissionType)
        )
      );

    expect(all).toHaveLength(1);
  });
});

describe("commissions unique constraint – partial index scope", () => {
  it("does NOT enforce uniqueness for non-subscription commissions (no subscriptionId)", async () => {
    const periodDate = "2025-04-01";

    const [first] = await db
      .insert(schema.commissions)
      .values({
        agentId,
        subscriptionId: null,
        type: "personal_deal",
        amount: "100.00",
        periodDate,
        status: "pending",
      })
      .returning();

    const [second] = await db
      .insert(schema.commissions)
      .values({
        agentId,
        subscriptionId: null,
        type: "personal_deal",
        amount: "200.00",
        periodDate,
        status: "pending",
      })
      .returning();

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first.id).not.toBe(second.id);
  });
});
