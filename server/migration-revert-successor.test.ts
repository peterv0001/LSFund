import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, like, or } from "drizzle-orm";
import * as schema from "@shared/schema";
import { scrypt as scryptCallback, randomBytes } from "crypto";
import { promisify } from "util";

// Unique migration names so the fake migration list never collides with the
// real schema or with other tests running against the same database.
const { MIG_A, MIG_B, MIG_C, revertMigrationMock } = vi.hoisted(() => {
  const ts = Date.now();
  return {
    MIG_A: `test_revert_successor_a_${ts}`,
    MIG_B: `test_revert_successor_b_${ts}`,
    MIG_C: `test_revert_successor_c_${ts}`,
    revertMigrationMock: vi.fn(async () => {}),
  };
});

// Replace the real migration list/runners so the admin revert route operates on
// harmless fake migrations (ordered A → B → C) that never touch the real schema.
vi.mock("./migrations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./migrations")>();
  const noop = async () => {};
  return {
    ...actual,
    migrations: [
      { name: MIG_A, run: noop, down: noop },
      { name: MIG_B, run: noop, down: noop },
      { name: MIG_C, run: noop, down: noop },
    ],
    applyMigration: vi.fn(async () => {}),
    revertMigration: revertMigrationMock,
  };
});

import { registerRoutes } from "./routes.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run migration revert successor tests");
}

const scryptAsync = promisify(scryptCallback);

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const TS = Date.now();
const ADMIN_EMAIL = `revert-successor-admin-${TS}@example.com`;
const ADMIN_PASSWORD = "RevertSuccessor1!";

let adminId: number;
let testApp: ReturnType<typeof express>;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function loginAsAdmin(): Promise<string[]> {
  const res = await request(testApp)
    .post("/api/login")
    .send({ username: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  return res.headers["set-cookie"] as unknown as string[];
}

async function markApplied(name: string) {
  await testPool.query(
    `INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING`,
    [name]
  );
}

async function unmarkApplied(name: string) {
  await testPool.query(`DELETE FROM schema_migrations WHERE name = $1`, [name]);
}

beforeAll(async () => {
  const [admin] = await db
    .insert(schema.agents)
    .values({
      email: ADMIN_EMAIL,
      password: await hashPassword(ADMIN_PASSWORD),
      firstName: "RevertSuccessor",
      lastName: "Admin",
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

beforeEach(async () => {
  revertMigrationMock.mockClear();
  await unmarkApplied(MIG_A);
  await unmarkApplied(MIG_B);
  await unmarkApplied(MIG_C);
});

afterAll(async () => {
  await unmarkApplied(MIG_A);
  await unmarkApplied(MIG_B);
  await unmarkApplied(MIG_C);
  await db
    .delete(schema.activityLog)
    .where(
      or(
        like(schema.activityLog.description, `%${MIG_A}%`),
        like(schema.activityLog.description, `%${MIG_B}%`),
        like(schema.activityLog.description, `%${MIG_C}%`)
      )
    );
  await db.delete(schema.agents).where(eq(schema.agents.id, adminId));
  await testPool.end();
});

describe("POST /api/admin/migrations/:name/revert – successor protection", () => {
  it("returns 400 and names the blocking migration when a later migration is still applied", async () => {
    // A and B both applied; reverting A must be blocked because B depends on it.
    await markApplied(MIG_A);
    await markApplied(MIG_B);

    const cookie = await loginAsAdmin();

    const res = await request(testApp)
      .post(`/api/admin/migrations/${MIG_A}/revert`)
      .set("Cookie", cookie)
      .expect(400);

    expect(res.body.message).toContain(MIG_B);
    expect(res.body.message).toMatch(/must be reverted first/i);
    // The protection must short-circuit before the down function runs.
    expect(revertMigrationMock).not.toHaveBeenCalled();
  });

  it("names every blocking migration when multiple later migrations are still applied", async () => {
    // A, B, and C all applied; reverting A must name both B and C.
    await markApplied(MIG_A);
    await markApplied(MIG_B);
    await markApplied(MIG_C);

    const cookie = await loginAsAdmin();

    const res = await request(testApp)
      .post(`/api/admin/migrations/${MIG_A}/revert`)
      .set("Cookie", cookie)
      .expect(400);

    expect(res.body.message).toContain(MIG_B);
    expect(res.body.message).toContain(MIG_C);
    expect(res.body.message).toMatch(/migrations must be reverted first/i);
    expect(revertMigrationMock).not.toHaveBeenCalled();
  });

  it("returns 200 and reverts when the migration has no applied successors", async () => {
    // Only A applied; B and C are not applied, so A has no blocking successors.
    await markApplied(MIG_A);

    const cookie = await loginAsAdmin();

    const res = await request(testApp)
      .post(`/api/admin/migrations/${MIG_A}/revert`)
      .set("Cookie", cookie)
      .expect(200);

    expect(res.body.message).toMatch(/reverted successfully/i);
    expect(revertMigrationMock).toHaveBeenCalledWith(MIG_A);
  });

  it("returns 200 and reverts the latest applied migration even when earlier ones are applied", async () => {
    // A, B, and C applied; reverting C (the last) has no successors to block it.
    await markApplied(MIG_A);
    await markApplied(MIG_B);
    await markApplied(MIG_C);

    const cookie = await loginAsAdmin();

    const res = await request(testApp)
      .post(`/api/admin/migrations/${MIG_C}/revert`)
      .set("Cookie", cookie)
      .expect(200);

    expect(res.body.message).toMatch(/reverted successfully/i);
    expect(revertMigrationMock).toHaveBeenCalledWith(MIG_C);
  });
});
