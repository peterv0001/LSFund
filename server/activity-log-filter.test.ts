import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@shared/schema";
import { storage } from "./storage.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run activity log filter tests");
}

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const TEST_ACTOR_ID = 999_001;

async function insertLog(action: string) {
  await db.insert(schema.activityLog).values({
    actorId: TEST_ACTOR_ID,
    actorType: "system",
    action,
    entityType: "migration",
    entityId: 999_001,
  });
}

async function cleanup() {
  await db
    .delete(schema.activityLog)
    .where(eq(schema.activityLog.actorId, TEST_ACTOR_ID));
}

beforeAll(async () => {
  await cleanup();
  await insertLog("run_migration");
  await insertLog("revert_migration");
  await insertLog("create");
});

afterAll(async () => {
  await cleanup();
  await testPool.end();
});

describe("getActivityLogs migration group filter", () => {
  it("returns both run_migration and revert_migration when actions=['run_migration','revert_migration']", async () => {
    const { logs } = await storage.getActivityLogs(1, 100, {
      actorId: TEST_ACTOR_ID,
      actions: ["run_migration", "revert_migration"],
    });
    const actions = logs.map((l) => l.action);
    expect(actions).toContain("run_migration");
    expect(actions).toContain("revert_migration");
    expect(actions).not.toContain("create");
  });

  it("returns only run_migration entries when action='run_migration'", async () => {
    const { logs } = await storage.getActivityLogs(1, 100, {
      actorId: TEST_ACTOR_ID,
      action: "run_migration",
    });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs.every((l) => l.action === "run_migration")).toBe(true);
  });

  it("returns only revert_migration entries when action='revert_migration'", async () => {
    const { logs } = await storage.getActivityLogs(1, 100, {
      actorId: TEST_ACTOR_ID,
      action: "revert_migration",
    });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs.every((l) => l.action === "revert_migration")).toBe(true);
  });

  it("actions filter takes priority over action when both are provided", async () => {
    const { logs } = await storage.getActivityLogs(1, 100, {
      actorId: TEST_ACTOR_ID,
      action: "create",
      actions: ["run_migration", "revert_migration"],
    });
    const actions = logs.map((l) => l.action);
    expect(actions).not.toContain("create");
    expect(actions).toContain("run_migration");
    expect(actions).toContain("revert_migration");
  });
});
