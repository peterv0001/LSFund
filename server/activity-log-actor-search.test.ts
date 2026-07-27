import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@shared/schema";
import { storage } from "./storage.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run activity log actor search tests");
}

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const TEST_ACTOR_ID = 999_002;
const TEST_ACTOR_EMAIL = "zephyrina.quintallow@activity-search-test.example";
const TEST_FIRST_NAME = "Zephyrina";
const TEST_LAST_NAME = "Quintallow";

async function insertLog(action: string) {
  await db.insert(schema.activityLog).values({
    actorId: TEST_ACTOR_ID,
    actorType: "agent",
    action,
    entityType: "subscription",
    entityId: 999_002,
  });
}

async function cleanup() {
  await db
    .delete(schema.activityLog)
    .where(eq(schema.activityLog.actorId, TEST_ACTOR_ID));
  await db.delete(schema.agents).where(eq(schema.agents.id, TEST_ACTOR_ID));
}

beforeAll(async () => {
  await cleanup();
  await db.insert(schema.agents).values({
    id: TEST_ACTOR_ID,
    email: TEST_ACTOR_EMAIL,
    password: "x",
    firstName: TEST_FIRST_NAME,
    lastName: TEST_LAST_NAME,
  });
  await insertLog("create");
  await insertLog("pause");
  await insertLog("reactivate");
});

afterAll(async () => {
  await cleanup();
  await testPool.end();
});

describe("getActivityLogs actor name search", () => {
  it("returns matching entries when searching by the actor's first name", async () => {
    const { logs, total } = await storage.getActivityLogs(1, 100, {
      actorId: TEST_ACTOR_ID,
      search: TEST_FIRST_NAME,
    });
    expect(logs.length).toBe(3);
    expect(total).toBe(3);
    expect(logs.every((l) => l.actorId === TEST_ACTOR_ID)).toBe(true);
    expect(logs.every((l) => l.actorName === `${TEST_FIRST_NAME} ${TEST_LAST_NAME}`)).toBe(true);
  });

  it("returns matching entries when searching by the actor's last name", async () => {
    const { logs, total } = await storage.getActivityLogs(1, 100, {
      actorId: TEST_ACTOR_ID,
      search: TEST_LAST_NAME,
    });
    expect(logs.length).toBe(3);
    expect(total).toBe(3);
  });

  it("matches a partial fragment of the actor's name", async () => {
    const { logs } = await storage.getActivityLogs(1, 100, {
      actorId: TEST_ACTOR_ID,
      search: TEST_FIRST_NAME.slice(0, 4),
    });
    expect(logs.length).toBe(3);
  });

  it("matches the actor's name regardless of capitalization", async () => {
    for (const search of [
      TEST_FIRST_NAME.toLowerCase(),
      TEST_FIRST_NAME.toUpperCase(),
      TEST_LAST_NAME.toLowerCase(),
      TEST_LAST_NAME.toUpperCase(),
    ]) {
      const { logs, total } = await storage.getActivityLogs(1, 100, {
        actorId: TEST_ACTOR_ID,
        search,
      });
      expect(logs.length).toBe(3);
      expect(total).toBe(3);
    }
  });

  it("returns no entries when searching for an unrelated name", async () => {
    const { logs, total } = await storage.getActivityLogs(1, 100, {
      actorId: TEST_ACTOR_ID,
      search: "NobodyNamedThis",
    });
    expect(logs.length).toBe(0);
    expect(total).toBe(0);
  });
});
