import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@shared/schema";
import { storage } from "./storage.js";
import { warnUpcomingExpirations } from "./scheduler.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run scheduler expiry warning tests");
}

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const TEST_EMAIL_PREFIX = `scheduler-warn-days-test-${Date.now()}`;
const SETTING_KEY = "expiryWarningDays";

const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS);

let agentId: number;
let originalSetting: any;

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

async function getSub(id: number) {
  const [row] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.id, id));
  return row;
}

beforeAll(async () => {
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: `${TEST_EMAIL_PREFIX}@example.com`,
      password: "not-a-real-hash",
      firstName: "Scheduler",
      lastName: "WarnDays",
      currentRank: "agent",
      highestRank: "agent",
    })
    .returning();
  agentId = agent.id;

  // Remember the existing setting so we can restore it for other test files.
  originalSetting = await storage.getPlatformSetting(SETTING_KEY);
});

afterAll(async () => {
  await clearSubs();
  await db.delete(schema.agents).where(eq(schema.agents.id, agentId));

  // Restore the platform setting to whatever it was before this file ran.
  if (originalSetting === null || originalSetting === undefined) {
    await db.delete(schema.platformSettings).where(eq(schema.platformSettings.key, SETTING_KEY));
  } else {
    await storage.savePlatformSetting(SETTING_KEY, originalSetting);
  }

  await testPool.end();
});

beforeEach(async () => {
  await clearSubs();
});

// =========================================================
// Scheduler honours the configurable expiryWarningDays setting
//
// These tests cover the full path the production scheduler takes:
//   1. Admin saves expiryWarningDays in platform settings.
//   2. warnUpcomingExpirations() reads that setting via getPlatformSetting.
//   3. It queries getSubscriptionsDueForWarning(<setting>).
//   4. Only subscriptions inside the resulting window are warned
//      (expiryWarningSentAt is stamped).
//
// We assert on the real DB side effect (expiryWarningSentAt) rather than a
// mock so the test fails if the setting is ever ignored or the window math
// drifts. The expiry warning email is skipped automatically when
// RESEND_API_KEY is unset, so no external calls are made.
// =========================================================

describe("scheduler respects the configured expiryWarningDays setting", () => {
  it("queries the custom 14-day window: returns subscriptions expiring in 13–15 days", async () => {
    await storage.savePlatformSetting(SETTING_KEY, 14);

    const lowEdge = await createSub({ status: "active", endDate: daysFromNow(13.1) });
    const center = await createSub({ status: "active", endDate: daysFromNow(14) });
    const highEdge = await createSub({ status: "active", endDate: daysFromNow(14.9) });

    const due = await storage.getSubscriptionsDueForWarning(14);
    const ids = due.map((s) => s.id);

    expect(ids).toContain(lowEdge.id);
    expect(ids).toContain(center.id);
    expect(ids).toContain(highEdge.id);
  });

  it("excludes subscriptions expiring in 6–8 days when the setting is 14", async () => {
    await storage.savePlatformSetting(SETTING_KEY, 14);

    const sixDays = await createSub({ status: "active", endDate: daysFromNow(6) });
    const sevenDays = await createSub({ status: "active", endDate: daysFromNow(7) });
    const eightDays = await createSub({ status: "active", endDate: daysFromNow(8) });

    const due = await storage.getSubscriptionsDueForWarning(14);
    const ids = due.map((s) => s.id);

    expect(ids).not.toContain(sixDays.id);
    expect(ids).not.toContain(sevenDays.id);
    expect(ids).not.toContain(eightDays.id);
  });

  it("warns only the 14-day-window subscription when the scheduler runs with the setting at 14", async () => {
    await storage.savePlatformSetting(SETTING_KEY, 14);

    // Inside the 14-day window the scheduler should warn this one.
    const inWindow = await createSub({
      status: "active",
      endDate: daysFromNow(14),
      merchantName: "InWindow Corp",
    });
    // Inside the default 7-day window but OUTSIDE the configured 14-day window.
    const sevenDaySub = await createSub({
      status: "active",
      endDate: daysFromNow(7),
      merchantName: "SevenDay Corp",
    });

    await warnUpcomingExpirations();

    const warned = await getSub(inWindow.id);
    const notWarned = await getSub(sevenDaySub.id);

    expect(warned.expiryWarningSentAt).not.toBeNull();
    expect(notWarned.expiryWarningSentAt).toBeNull();
  });

  it("warns the 7-day-window subscription but not the 14-day one when the setting is 7", async () => {
    await storage.savePlatformSetting(SETTING_KEY, 7);

    const sevenDaySub = await createSub({
      status: "active",
      endDate: daysFromNow(7),
      merchantName: "SevenDay Corp",
    });
    const fourteenDaySub = await createSub({
      status: "active",
      endDate: daysFromNow(14),
      merchantName: "FourteenDay Corp",
    });

    await warnUpcomingExpirations();

    const warned = await getSub(sevenDaySub.id);
    const notWarned = await getSub(fourteenDaySub.id);

    expect(warned.expiryWarningSentAt).not.toBeNull();
    expect(notWarned.expiryWarningSentAt).toBeNull();
  });
});
