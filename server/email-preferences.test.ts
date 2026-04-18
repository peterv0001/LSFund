/**
 * Tests verifying that emailPreferences flags are respected when
 * the agent self-service route and the admin subscription-status route decide
 * whether to dispatch notification emails.
 *
 * emailService is fully mocked so no real emails are ever sent and no
 * RESEND_API_KEY is required.
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import * as schema from "@shared/schema";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import { registerRoutes } from "./routes.js";
import { scrypt as scryptCallback, randomBytes } from "crypto";
import { promisify } from "util";

// ── Mock emailService BEFORE routes are imported ──────────────────────────────
// vi.mock is hoisted by Vitest's transformer so this runs before any imports.
vi.mock("./email.js", () => ({
  emailService: {
    sendSubscriptionPausedEmail: vi.fn().mockResolvedValue(undefined),
    sendSubscriptionCancelledEmail: vi.fn().mockResolvedValue(undefined),
    sendSubscriptionReactivatedEmail: vi.fn().mockResolvedValue(undefined),
    sendSubscriptionExpiredEmail: vi.fn().mockResolvedValue(undefined),
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendDealFundedEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendTeamSignupEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

// Import mocked emailService AFTER vi.mock declaration (hoisting ensures the
// mock is in place by the time the real module would be loaded).
import { emailService } from "./email.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run email-prefs tests");
}

const scryptAsync = promisify(scryptCallback);

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const TS = Date.now();
const AGENT_EMAIL_PREFIX = `email-pref-agent-${TS}`;
const ADMIN_EMAIL_PREFIX = `email-pref-admin-${TS}`;
const PASSWORD = "EmailPref1!";

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// ── Shared test infrastructure ────────────────────────────────────────────────

let testApp: ReturnType<typeof express>;
let adminId: number;

type EmailPrefs = {
  emailOnPaused?: boolean;
  emailOnCancelled?: boolean;
  emailOnReactivated?: boolean;
};

/**
 * Create a test agent.
 *
 * Pass a full EmailPrefs object to set specific flags, or pass an empty object
 * `{}` to simulate the "missing keys" edge case (the route falls back to
 * treating every preference as enabled).  The DB column is NOT NULL so we
 * always provide at least `{}`.
 */
async function createAgent(suffix: string, prefs: EmailPrefs = {}) {
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: `${AGENT_EMAIL_PREFIX}-${suffix}@example.com`,
      password: await hashPassword(PASSWORD),
      firstName: "Pref",
      lastName: "Tester",
      currentRank: "agent",
      highestRank: "agent",
      emailPreferences: prefs,
    })
    .returning();
  return agent;
}

async function createSubscription(
  agentId: number,
  status: "active" | "paused" | "cancelled" | "expired" = "active"
) {
  const [sub] = await db
    .insert(schema.subscriptions)
    .values({
      agentId,
      merchantName: "Test Merchant",
      tier: "tier_1",
      monthlyAmount: "199.00",
      status,
    })
    .returning();
  return sub;
}

async function loginAs(email: string): Promise<string[]> {
  const res = await request(testApp)
    .post("/api/login")
    .send({ username: email, password: PASSWORD });
  return res.headers["set-cookie"] as unknown as string[];
}

async function cleanupAgent(agentId: number) {
  await db
    .delete(schema.activityLog)
    .where(
      and(
        eq(schema.activityLog.entityType, "subscription"),
        eq(schema.activityLog.actorId, agentId)
      )
    );
  await db
    .delete(schema.subscriptions)
    .where(eq(schema.subscriptions.agentId, agentId));
  await db.delete(schema.agents).where(eq(schema.agents.id, agentId));
}

// Small helper to give fire-and-forget calls a chance to execute.
// Since emailService is mocked synchronously, the spy is called before the
// route sends its response, so in most cases no extra delay is needed.  We
// keep a minimal wait here as a safety net.
function shortDelay(ms = 20) {
  return new Promise((r) => setTimeout(r, ms));
}

beforeAll(async () => {
  const [admin] = await db
    .insert(schema.agents)
    .values({
      email: `${ADMIN_EMAIL_PREFIX}@example.com`,
      password: await hashPassword(PASSWORD),
      firstName: "Admin",
      lastName: "EmailPref",
      currentRank: "agent",
      highestRank: "agent",
      isAdmin: true,
    })
    .returning();
  adminId = admin.id;

  testApp = express();
  testApp.use(express.json());
  const httpServer = createServer(testApp);
  await registerRoutes(httpServer, testApp);
}, 30000);

afterAll(async () => {
  await db.delete(schema.agents).where(eq(schema.agents.id, adminId));
  await testPool.end();
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Agent self-service route ──────────────────────────────────────────────────

describe("agent self-service route – email preference: emailOnPaused", () => {
  it("does NOT send a paused email when emailOnPaused is false", async () => {
    const agent = await createAgent("pause-off", {
      emailOnPaused: false,
      emailOnCancelled: true,
      emailOnReactivated: true,
    });
    const sub = await createSubscription(agent.id, "active");
    const cookie = await loginAs(agent.email);

    await request(testApp)
      .patch(`/api/subscriptions/${sub.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "paused" })
      .expect(200);

    await shortDelay();
    expect(emailService.sendSubscriptionPausedEmail).not.toHaveBeenCalled();

    await cleanupAgent(agent.id);
  });

  it("DOES send a paused email when emailOnPaused is true", async () => {
    const agent = await createAgent("pause-on", {
      emailOnPaused: true,
      emailOnCancelled: true,
      emailOnReactivated: true,
    });
    const sub = await createSubscription(agent.id, "active");
    const cookie = await loginAs(agent.email);

    await request(testApp)
      .patch(`/api/subscriptions/${sub.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "paused" })
      .expect(200);

    await shortDelay();
    expect(emailService.sendSubscriptionPausedEmail).toHaveBeenCalledOnce();
    expect(emailService.sendSubscriptionPausedEmail).toHaveBeenCalledWith(
      agent.email,
      expect.objectContaining({ merchantName: "Test Merchant" })
    );

    await cleanupAgent(agent.id);
  });
});

describe("agent self-service route – email preference: emailOnCancelled", () => {
  it("does NOT send a cancelled email when emailOnCancelled is false", async () => {
    const agent = await createAgent("cancel-off", {
      emailOnPaused: true,
      emailOnCancelled: false,
      emailOnReactivated: true,
    });
    const sub = await createSubscription(agent.id, "active");
    const cookie = await loginAs(agent.email);

    await request(testApp)
      .patch(`/api/subscriptions/${sub.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "cancelled" })
      .expect(200);

    await shortDelay();
    expect(emailService.sendSubscriptionCancelledEmail).not.toHaveBeenCalled();

    await cleanupAgent(agent.id);
  });

  it("DOES send a cancelled email when emailOnCancelled is true", async () => {
    const agent = await createAgent("cancel-on", {
      emailOnPaused: true,
      emailOnCancelled: true,
      emailOnReactivated: true,
    });
    const sub = await createSubscription(agent.id, "active");
    const cookie = await loginAs(agent.email);

    await request(testApp)
      .patch(`/api/subscriptions/${sub.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "cancelled" })
      .expect(200);

    await shortDelay();
    expect(emailService.sendSubscriptionCancelledEmail).toHaveBeenCalledOnce();

    await cleanupAgent(agent.id);
  });
});

describe("agent self-service route – null/missing emailPreferences", () => {
  it("sends a paused email by default when preferences are an empty object (all prefs enabled)", async () => {
    // Pass an empty object {} to simulate preferences with no explicit flags.
    // The route uses `(prefs.emailOnPaused !== false)` which is true when the
    // key is absent, so the email should be sent.
    const agent = await createAgent("null-prefs", {});
    const sub = await createSubscription(agent.id, "active");
    const cookie = await loginAs(agent.email);

    await request(testApp)
      .patch(`/api/subscriptions/${sub.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "paused" })
      .expect(200);

    await shortDelay();
    expect(emailService.sendSubscriptionPausedEmail).toHaveBeenCalledOnce();

    await cleanupAgent(agent.id);
  });
});

// ── Admin route ───────────────────────────────────────────────────────────────

async function loginAsAdmin(): Promise<string[]> {
  return loginAs(`${ADMIN_EMAIL_PREFIX}@example.com`);
}

describe("admin route – email preference: emailOnPaused", () => {
  it("does NOT send a paused email when the agent's emailOnPaused is false", async () => {
    const agent = await createAgent("admin-pause-off", {
      emailOnPaused: false,
      emailOnCancelled: true,
      emailOnReactivated: true,
    });
    const sub = await createSubscription(agent.id, "active");
    const cookie = await loginAsAdmin();

    await request(testApp)
      .patch(`/api/admin/subscriptions/${sub.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "paused" })
      .expect(200);

    await shortDelay();
    expect(emailService.sendSubscriptionPausedEmail).not.toHaveBeenCalled();

    await cleanupAgent(agent.id);
  });

  it("DOES send a paused email when the agent's emailOnPaused is true", async () => {
    const agent = await createAgent("admin-pause-on", {
      emailOnPaused: true,
      emailOnCancelled: true,
      emailOnReactivated: true,
    });
    const sub = await createSubscription(agent.id, "active");
    const cookie = await loginAsAdmin();

    await request(testApp)
      .patch(`/api/admin/subscriptions/${sub.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "paused" })
      .expect(200);

    await shortDelay();
    expect(emailService.sendSubscriptionPausedEmail).toHaveBeenCalledOnce();

    await cleanupAgent(agent.id);
  });
});

describe("admin route – email preference: emailOnCancelled", () => {
  it("does NOT send a cancelled email when the agent's emailOnCancelled is false", async () => {
    const agent = await createAgent("admin-cancel-off", {
      emailOnPaused: true,
      emailOnCancelled: false,
      emailOnReactivated: true,
    });
    const sub = await createSubscription(agent.id, "active");
    const cookie = await loginAsAdmin();

    await request(testApp)
      .patch(`/api/admin/subscriptions/${sub.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "cancelled" })
      .expect(200);

    await shortDelay();
    expect(emailService.sendSubscriptionCancelledEmail).not.toHaveBeenCalled();

    await cleanupAgent(agent.id);
  });

  it("DOES send a cancelled email when the agent's emailOnCancelled is true", async () => {
    const agent = await createAgent("admin-cancel-on", {
      emailOnPaused: true,
      emailOnCancelled: true,
      emailOnReactivated: true,
    });
    const sub = await createSubscription(agent.id, "active");
    const cookie = await loginAsAdmin();

    await request(testApp)
      .patch(`/api/admin/subscriptions/${sub.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "cancelled" })
      .expect(200);

    await shortDelay();
    expect(emailService.sendSubscriptionCancelledEmail).toHaveBeenCalledOnce();

    await cleanupAgent(agent.id);
  });
});

describe("admin route – email preference: emailOnReactivated", () => {
  it("does NOT send a reactivated email when the agent's emailOnReactivated is false", async () => {
    const agent = await createAgent("admin-react-off", {
      emailOnPaused: true,
      emailOnCancelled: true,
      emailOnReactivated: false,
    });
    const sub = await createSubscription(agent.id, "paused");
    const cookie = await loginAsAdmin();

    await request(testApp)
      .patch(`/api/admin/subscriptions/${sub.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "active" })
      .expect(200);

    await shortDelay();
    expect(emailService.sendSubscriptionReactivatedEmail).not.toHaveBeenCalled();

    await cleanupAgent(agent.id);
  });

  it("DOES send a reactivated email when the agent's emailOnReactivated is true", async () => {
    const agent = await createAgent("admin-react-on", {
      emailOnPaused: true,
      emailOnCancelled: true,
      emailOnReactivated: true,
    });
    const sub = await createSubscription(agent.id, "paused");
    const cookie = await loginAsAdmin();

    await request(testApp)
      .patch(`/api/admin/subscriptions/${sub.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "active" })
      .expect(200);

    await shortDelay();
    expect(emailService.sendSubscriptionReactivatedEmail).toHaveBeenCalledOnce();

    await cleanupAgent(agent.id);
  });
});

describe("admin route – null/missing emailPreferences", () => {
  it("sends paused email by default when no preference keys are set", async () => {
    const agent = await createAgent("admin-null-prefs-pause", {});
    const sub = await createSubscription(agent.id, "active");
    const cookie = await loginAsAdmin();

    await request(testApp)
      .patch(`/api/admin/subscriptions/${sub.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "paused" })
      .expect(200);

    await shortDelay();
    expect(emailService.sendSubscriptionPausedEmail).toHaveBeenCalledOnce();

    await cleanupAgent(agent.id);
  });

  it("sends cancelled email by default when no preference keys are set", async () => {
    const agent = await createAgent("admin-null-prefs-cancel", {});
    const sub = await createSubscription(agent.id, "active");
    const cookie = await loginAsAdmin();

    await request(testApp)
      .patch(`/api/admin/subscriptions/${sub.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "cancelled" })
      .expect(200);

    await shortDelay();
    expect(emailService.sendSubscriptionCancelledEmail).toHaveBeenCalledOnce();

    await cleanupAgent(agent.id);
  });

  it("sends reactivated email by default when no preference keys are set", async () => {
    const agent = await createAgent("admin-null-prefs-react", {});
    const sub = await createSubscription(agent.id, "paused");
    const cookie = await loginAsAdmin();

    await request(testApp)
      .patch(`/api/admin/subscriptions/${sub.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "active" })
      .expect(200);

    await shortDelay();
    expect(emailService.sendSubscriptionReactivatedEmail).toHaveBeenCalledOnce();

    await cleanupAgent(agent.id);
  });
});

// ── Unit tests: explicit null for emailPreferences ────────────────────────────
// The DB column is NOT NULL, so we cannot insert a null value directly.
// These unit tests mirror the preference-gate logic from the routes verbatim
// and confirm that an explicit null is handled identically to {} (all emails
// default to enabled).  This is the same pattern used for applyTransitionGuards
// in subscriptions.test.ts.

/**
 * Mirrors the preference gate in PATCH /api/subscriptions/:id/status and
 * PATCH /api/admin/subscriptions/:id/status.
 *
 *   const prefs = (agent.emailPreferences as … | null) ?? {};
 *   if (status === 'paused' && prefs.emailOnPaused !== false)   → send
 *   else if (status === 'cancelled' && prefs.emailOnCancelled !== false) → send
 *   else if (isReactivation && prefs.emailOnReactivated !== false) → send
 */
function emailGate(
  status: "paused" | "cancelled" | "active",
  isReactivation: boolean,
  rawPrefs: Record<string, boolean> | null
): { paused: boolean; cancelled: boolean; reactivated: boolean } {
  const prefs = rawPrefs ?? {};
  return {
    paused: status === "paused" && prefs["emailOnPaused"] !== false,
    cancelled: status === "cancelled" && prefs["emailOnCancelled"] !== false,
    reactivated: status === "active" && isReactivation && prefs["emailOnReactivated"] !== false,
  };
}

describe("preference gate unit tests – explicit null emailPreferences", () => {
  it("treats null prefs as all-enabled for paused status", () => {
    const result = emailGate("paused", false, null);
    expect(result.paused).toBe(true);
  });

  it("treats null prefs as all-enabled for cancelled status", () => {
    const result = emailGate("cancelled", false, null);
    expect(result.cancelled).toBe(true);
  });

  it("treats null prefs as all-enabled for reactivated status", () => {
    const result = emailGate("active", true, null);
    expect(result.reactivated).toBe(true);
  });

  it("null prefs still respects explicit false when the field would be absent (edge: demonstrates {} behaviour matches null)", () => {
    // Both null and {} should behave identically through the ?? {} fallback.
    const withNull = emailGate("paused", false, null);
    const withEmpty = emailGate("paused", false, {});
    expect(withNull.paused).toBe(withEmpty.paused);
  });
});
