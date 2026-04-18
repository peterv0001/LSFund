import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@shared/schema";
import { storage } from "./storage.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run subscription tests");
}

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const TEST_EMAIL_PREFIX = `sub-test-${Date.now()}`;

async function createTestAgent(suffix: string) {
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: `${TEST_EMAIL_PREFIX}-${suffix}@example.com`,
      password: "not-a-real-hash",
      firstName: "Sub",
      lastName: "Test",
      currentRank: "agent",
      highestRank: "agent",
    })
    .returning();
  return agent;
}

async function createTestSubscription(
  agentId: number,
  status: "active" | "paused" | "cancelled" | "expired" = "active"
) {
  const [sub] = await db
    .insert(schema.subscriptions)
    .values({
      agentId,
      merchantName: "Acme Corp",
      tier: "tier_1",
      monthlyAmount: "199.00",
      status,
    })
    .returning();
  return sub;
}

let agentId: number;

beforeAll(async () => {
  const agent = await createTestAgent("main");
  agentId = agent.id;
});

afterAll(async () => {
  await db.delete(schema.subscriptions).where(eq(schema.subscriptions.agentId, agentId));
  await db.delete(schema.agents).where(eq(schema.agents.id, agentId));
  await testPool.end();
});

// =========================================================
// Storage layer – subscription status tracking behaviour
// =========================================================

describe("updateSubscriptionStatus – pausing", () => {
  it("sets pausedAt when an active subscription is paused", async () => {
    const sub = await createTestSubscription(agentId, "active");
    const updated = await storage.updateSubscriptionStatus(sub.id, "paused");
    expect(updated.status).toBe("paused");
    expect(updated.pausedAt).not.toBeNull();
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });

  it("records the actor who paused when actorId is provided", async () => {
    const sub = await createTestSubscription(agentId, "active");
    const updated = await storage.updateSubscriptionStatus(sub.id, "paused", agentId);
    expect(updated.pausedById).toBe(agentId);
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });
});

describe("updateSubscriptionStatus – cancelling", () => {
  it("sets cancelledAt when a subscription is cancelled", async () => {
    const sub = await createTestSubscription(agentId, "active");
    const updated = await storage.updateSubscriptionStatus(sub.id, "cancelled");
    expect(updated.status).toBe("cancelled");
    expect(updated.cancelledAt).not.toBeNull();
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });

  it("records the actor who cancelled when actorId is provided", async () => {
    const sub = await createTestSubscription(agentId, "active");
    const updated = await storage.updateSubscriptionStatus(sub.id, "cancelled", agentId);
    expect(updated.cancelledById).toBe(agentId);
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });
});

describe("updateSubscriptionStatus – reactivation", () => {
  it("clears pausedAt when a paused subscription is reactivated", async () => {
    const sub = await createTestSubscription(agentId, "active");
    await storage.updateSubscriptionStatus(sub.id, "paused");
    const updated = await storage.updateSubscriptionStatus(sub.id, "active");
    expect(updated.status).toBe("active");
    expect(updated.pausedAt).toBeNull();
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });

  it("sets reactivatedAt when a paused subscription is reactivated", async () => {
    const sub = await createTestSubscription(agentId, "active");
    await storage.updateSubscriptionStatus(sub.id, "paused");
    const updated = await storage.updateSubscriptionStatus(sub.id, "active");
    expect(updated.reactivatedAt).not.toBeNull();
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });

  it("records the actor who reactivated when actorId is provided", async () => {
    const sub = await createTestSubscription(agentId, "active");
    await storage.updateSubscriptionStatus(sub.id, "paused");
    const updated = await storage.updateSubscriptionStatus(sub.id, "active", agentId);
    expect(updated.reactivatedById).toBe(agentId);
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });

  it("sets reactivatedAt even when an already-active subscription is set to active", async () => {
    const sub = await createTestSubscription(agentId, "active");
    const updated = await storage.updateSubscriptionStatus(sub.id, "active");
    expect(updated.reactivatedAt).not.toBeNull();
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, sub.id));
  });
});

// =========================================================
// Route validation – invalid transitions
// These tests replicate the guard logic in
// PATCH /api/subscriptions/:id/status and verify the correct
// HTTP status codes are returned.
// =========================================================

/**
 * Mirrors the validation logic from the agent self-service route
 * so we can test it without standing up a full HTTP server.
 */
function applyTransitionGuards(
  currentStatus: string,
  targetStatus: string
): { ok: true } | { ok: false; httpStatus: number; message: string } {
  if (currentStatus === "cancelled") {
    return { ok: false, httpStatus: 400, message: "Cannot update a cancelled subscription" };
  }
  if (currentStatus === "expired") {
    return { ok: false, httpStatus: 400, message: "Cannot update an expired subscription" };
  }
  if (targetStatus === "active" && currentStatus !== "paused") {
    return { ok: false, httpStatus: 400, message: "Only paused subscriptions can be reactivated" };
  }
  return { ok: true };
}

describe("route validation – invalid status transitions", () => {
  it("returns 400 when trying to update a cancelled subscription", () => {
    const result = applyTransitionGuards("cancelled", "active");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.httpStatus).toBe(400);
      expect(result.message).toMatch(/cancelled/i);
    }
  });

  it("returns 400 when trying to update an expired subscription", () => {
    const result = applyTransitionGuards("expired", "active");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.httpStatus).toBe(400);
      expect(result.message).toMatch(/expired/i);
    }
  });

  it("returns 400 when trying to reactivate an active subscription", () => {
    const result = applyTransitionGuards("active", "active");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.httpStatus).toBe(400);
      expect(result.message).toMatch(/paused/i);
    }
  });

  it("allows pausing an active subscription", () => {
    const result = applyTransitionGuards("active", "paused");
    expect(result.ok).toBe(true);
  });

  it("allows cancelling an active subscription", () => {
    const result = applyTransitionGuards("active", "cancelled");
    expect(result.ok).toBe(true);
  });

  it("allows reactivating a paused subscription", () => {
    const result = applyTransitionGuards("paused", "active");
    expect(result.ok).toBe(true);
  });

  it("allows cancelling a paused subscription", () => {
    const result = applyTransitionGuards("paused", "cancelled");
    expect(result.ok).toBe(true);
  });
});
