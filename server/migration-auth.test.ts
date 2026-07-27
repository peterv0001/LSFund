import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@shared/schema";
import { scrypt as scryptCallback, randomBytes } from "crypto";
import { promisify } from "util";

// Unique migration name so the fake migration list never collides with the
// real schema or with other tests running against the same database.
const { MIG_AUTH, applyMigrationMock, revertMigrationMock } = vi.hoisted(() => {
  const ts = Date.now();
  return {
    MIG_AUTH: `test_migration_auth_${ts}`,
    applyMigrationMock: vi.fn(async () => {}),
    revertMigrationMock: vi.fn(async () => {}),
  };
});

// Replace the real migration list/runners so the admin routes operate on a
// harmless fake migration that never touches the real schema.
vi.mock("./migrations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./migrations")>();
  const noop = async () => {};
  return {
    ...actual,
    migrations: [{ name: MIG_AUTH, run: noop, down: noop }],
    applyMigration: applyMigrationMock,
    revertMigration: revertMigrationMock,
  };
});

import { registerRoutes } from "./routes.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run migration auth tests");
}

const scryptAsync = promisify(scryptCallback);

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const TS = Date.now();
const AGENT_EMAIL = `migration-auth-agent-${TS}@example.com`;
const AGENT_PASSWORD = "MigrationAuth1!";

let agentId: number;
let testApp: ReturnType<typeof express>;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function loginAsAgent(): Promise<string[]> {
  const res = await request(testApp)
    .post("/api/login")
    .send({ username: AGENT_EMAIL, password: AGENT_PASSWORD });
  expect(res.status).toBe(200);
  return res.headers["set-cookie"] as unknown as string[];
}

beforeAll(async () => {
  const [agent] = await db
    .insert(schema.agents)
    .values({
      email: AGENT_EMAIL,
      password: await hashPassword(AGENT_PASSWORD),
      firstName: "MigrationAuth",
      lastName: "Agent",
      currentRank: "agent",
      highestRank: "agent",
      isAdmin: false,
    })
    .returning();
  agentId = agent.id;

  testApp = express();
  testApp.use(express.json());
  const httpServer = createServer(testApp);
  await registerRoutes(httpServer, testApp);
}, 30000);

afterAll(async () => {
  await db.delete(schema.agents).where(eq(schema.agents.id, agentId));
  await testPool.end();
});

describe("migration apply/revert authorization", () => {
  it("rejects unauthenticated apply with 401 and never runs the migration", async () => {
    const res = await request(testApp)
      .post(`/api/admin/migrations/${MIG_AUTH}/apply`)
      .expect(401);

    expect(res.body.message).toMatch(/unauthorized/i);
    expect(applyMigrationMock).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated revert with 401 and never runs the revert", async () => {
    const res = await request(testApp)
      .post(`/api/admin/migrations/${MIG_AUTH}/revert`)
      .expect(401);

    expect(res.body.message).toMatch(/unauthorized/i);
    expect(revertMigrationMock).not.toHaveBeenCalled();
  });

  it("rejects a logged-in non-admin agent's apply with 403 and never runs the migration", async () => {
    const cookie = await loginAsAgent();

    const res = await request(testApp)
      .post(`/api/admin/migrations/${MIG_AUTH}/apply`)
      .set("Cookie", cookie)
      .expect(403);

    expect(res.body.message).toMatch(/admin access required/i);
    expect(applyMigrationMock).not.toHaveBeenCalled();
  });

  it("rejects a logged-in non-admin agent's revert with 403 and never runs the revert", async () => {
    const cookie = await loginAsAgent();

    const res = await request(testApp)
      .post(`/api/admin/migrations/${MIG_AUTH}/revert`)
      .set("Cookie", cookie)
      .expect(403);

    expect(res.body.message).toMatch(/admin access required/i);
    expect(revertMigrationMock).not.toHaveBeenCalled();
  });
});
