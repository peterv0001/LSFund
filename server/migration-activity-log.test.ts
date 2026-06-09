import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { like } from "drizzle-orm";
import * as schema from "@shared/schema";

// Unique marker so we can target only the rows this test creates.
const { FAKE_NAME } = vi.hoisted(() => ({
  FAKE_NAME: "test_route_migration_" + Date.now(),
}));

// Replace the real migration list/runners so the admin apply/revert routes
// operate on a harmless fake migration that never touches the real schema.
vi.mock("./migrations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./migrations")>();
  return {
    ...actual,
    migrations: [
      {
        name: FAKE_NAME,
        run: async () => {},
        down: async () => {},
      },
    ],
    applyMigration: vi.fn(async () => {}),
    revertMigration: vi.fn(async () => {}),
  };
});

import { registerRoutes } from "./routes.js";
import { storage } from "./storage.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run migration activity log tests");
}

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

let agent: ReturnType<typeof request.agent>;
let adminId: number;

async function markApplied(name: string) {
  await testPool.query(
    `INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING`,
    [name]
  );
}

async function unmarkApplied(name: string) {
  await testPool.query(`DELETE FROM schema_migrations WHERE name = $1`, [name]);
}

async function cleanupLogs() {
  await db
    .delete(schema.activityLog)
    .where(like(schema.activityLog.description, `%${FAKE_NAME}%`));
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  const httpServer = createServer(app);
  await registerRoutes(httpServer, app);

  agent = request.agent(app);
  const res = await agent
    .post("/api/login")
    .send({ username: "admin@psl.capital", password: "password123" });
  expect(res.status).toBe(200);
  expect(res.body.isAdmin).toBe(true);
  adminId = res.body.id;

  await unmarkApplied(FAKE_NAME);
  await cleanupLogs();
});

afterAll(async () => {
  await cleanupLogs();
  await unmarkApplied(FAKE_NAME);
  await testPool.end();
});

describe("migration activity log – apply route", () => {
  it("records a run_migration entry when a migration is applied via the admin route", async () => {
    const res = await agent.post(`/api/admin/migrations/${FAKE_NAME}/apply`);
    expect(res.status).toBe(200);

    const { logs } = await storage.getActivityLogs(1, 50, {
      action: "run_migration",
      search: FAKE_NAME,
    });

    const entry = logs.find(
      (l) => (l.details as { migration?: string } | null)?.migration === FAKE_NAME
    );
    expect(entry).toBeDefined();
    expect(entry!.action).toBe("run_migration");
    expect(entry!.entityType).toBe("migration");
    expect(entry!.actorType).toBe("admin");
    expect(entry!.actorId).toBe(adminId);
  });
});

describe("migration activity log – revert route", () => {
  it("records a revert_migration entry when a migration is reverted via the admin route", async () => {
    // The revert route requires the migration to currently be applied.
    await markApplied(FAKE_NAME);

    const res = await agent.post(`/api/admin/migrations/${FAKE_NAME}/revert`);
    expect(res.status).toBe(200);

    const { logs } = await storage.getActivityLogs(1, 50, {
      action: "revert_migration",
      search: FAKE_NAME,
    });

    const entry = logs.find(
      (l) => (l.details as { migration?: string } | null)?.migration === FAKE_NAME
    );
    expect(entry).toBeDefined();
    expect(entry!.action).toBe("revert_migration");
    expect(entry!.entityType).toBe("migration");
    expect(entry!.actorType).toBe("admin");
    expect(entry!.actorId).toBe(adminId);
  });
});

describe("migration activity log – action dropdown filter (HTTP)", () => {
  const FILTER_MARKER = FAKE_NAME + "_filter";

  beforeAll(async () => {
    // Seed one of each action so the filter assertions are self-contained.
    await db.insert(schema.activityLog).values([
      {
        actorId: adminId,
        actorType: "admin",
        action: "run_migration",
        entityType: "migration",
        entityId: 0,
        description: `Applied migration: ${FILTER_MARKER}`,
        details: { migration: FILTER_MARKER },
      },
      {
        actorId: adminId,
        actorType: "admin",
        action: "revert_migration",
        entityType: "migration",
        entityId: 0,
        description: `Reverted migration: ${FILTER_MARKER}`,
        details: { migration: FILTER_MARKER },
      },
      {
        actorId: adminId,
        actorType: "admin",
        action: "create",
        entityType: "migration",
        entityId: 0,
        description: `Unrelated event for ${FILTER_MARKER}`,
        details: { migration: FILTER_MARKER },
      },
    ]);
  });

  it("action=migration returns only run_migration and revert_migration events", async () => {
    const res = await agent.get(
      `/api/admin/activity-log?action=migration&search=${FILTER_MARKER}&pageSize=100`
    );
    expect(res.status).toBe(200);

    const actions: string[] = res.body.logs.map((l: { action: string }) => l.action);
    expect(actions).toContain("run_migration");
    expect(actions).toContain("revert_migration");
    expect(actions).not.toContain("create");
    expect(
      actions.every((a) => a === "run_migration" || a === "revert_migration")
    ).toBe(true);
  });

  it("action=run_migration returns only run_migration events", async () => {
    const res = await agent.get(
      `/api/admin/activity-log?action=run_migration&search=${FILTER_MARKER}&pageSize=100`
    );
    expect(res.status).toBe(200);
    expect(res.body.logs.length).toBeGreaterThanOrEqual(1);
    expect(
      res.body.logs.every((l: { action: string }) => l.action === "run_migration")
    ).toBe(true);
  });

  it("action=revert_migration returns only revert_migration events", async () => {
    const res = await agent.get(
      `/api/admin/activity-log?action=revert_migration&search=${FILTER_MARKER}&pageSize=100`
    );
    expect(res.status).toBe(200);
    expect(res.body.logs.length).toBeGreaterThanOrEqual(1);
    expect(
      res.body.logs.every((l: { action: string }) => l.action === "revert_migration")
    ).toBe(true);
  });
});
