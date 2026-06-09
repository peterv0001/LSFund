import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@shared/schema";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import { scrypt as scryptCallback, randomBytes } from "crypto";
import { promisify } from "util";

import { registerRoutes } from "../routes.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run export-templates endpoint tests");
}

const scryptAsync = promisify(scryptCallback);

const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(testPool, { schema });

const TS = Date.now();
const ADMIN_A_EMAIL = `export-tpl-admin-a-${TS}@example.com`;
const ADMIN_B_EMAIL = `export-tpl-admin-b-${TS}@example.com`;
const PASSWORD = "ExportTpl1!";

let adminAId: number;
let adminBId: number;
let testApp: ReturnType<typeof express>;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function login(email: string): Promise<string[]> {
  const res = await request(testApp)
    .post("/api/login")
    .send({ username: email, password: PASSWORD });
  return res.headers["set-cookie"] as unknown as string[];
}

beforeAll(async () => {
  const [adminA] = await db
    .insert(schema.agents)
    .values({
      email: ADMIN_A_EMAIL,
      password: await hashPassword(PASSWORD),
      firstName: "ExportTpl",
      lastName: "AdminA",
      currentRank: "agent",
      highestRank: "agent",
      isAdmin: true,
    })
    .returning();
  adminAId = adminA.id;

  const [adminB] = await db
    .insert(schema.agents)
    .values({
      email: ADMIN_B_EMAIL,
      password: await hashPassword(PASSWORD),
      firstName: "ExportTpl",
      lastName: "AdminB",
      currentRank: "agent",
      highestRank: "agent",
      isAdmin: true,
    })
    .returning();
  adminBId = adminB.id;

  testApp = express();
  testApp.use(express.json());
  const httpServer = createServer(testApp);
  await registerRoutes(httpServer, testApp);
}, 30000);

afterAll(async () => {
  await db
    .delete(schema.adminExportTemplates)
    .where(inArray(schema.adminExportTemplates.adminId, [adminAId, adminBId]));
  await db
    .delete(schema.agents)
    .where(inArray(schema.agents.id, [adminAId, adminBId]));
  await testPool.end();
});

describe("Admin export templates – sharing & ownership", () => {
  it("makes a shared template created by admin A visible to admin B", async () => {
    const cookieA = await login(ADMIN_A_EMAIL);

    const created = await request(testApp)
      .post("/api/admin/export-templates")
      .set("Cookie", cookieA)
      .send({ name: `shared-${TS}`, columns: ["name", "email"], isShared: true })
      .expect(201);

    expect(created.body.isShared).toBe(true);
    expect(created.body.adminId).toBe(adminAId);
    const sharedId = created.body.id;

    const cookieB = await login(ADMIN_B_EMAIL);
    const listB = await request(testApp)
      .get("/api/admin/export-templates")
      .set("Cookie", cookieB)
      .expect(200);

    const ids = listB.body.map((t: { id: number }) => t.id);
    expect(ids).toContain(sharedId);
  });

  it("hides a non-shared template from other admins but shows it to the owner", async () => {
    const cookieA = await login(ADMIN_A_EMAIL);

    const created = await request(testApp)
      .post("/api/admin/export-templates")
      .set("Cookie", cookieA)
      .send({ name: `private-${TS}`, columns: ["name"], isShared: false })
      .expect(201);

    expect(created.body.isShared).toBe(false);
    const privateId = created.body.id;

    const listA = await request(testApp)
      .get("/api/admin/export-templates")
      .set("Cookie", cookieA)
      .expect(200);
    expect(listA.body.map((t: { id: number }) => t.id)).toContain(privateId);

    const cookieB = await login(ADMIN_B_EMAIL);
    const listB = await request(testApp)
      .get("/api/admin/export-templates")
      .set("Cookie", cookieB)
      .expect(200);
    expect(listB.body.map((t: { id: number }) => t.id)).not.toContain(privateId);
  });

  it("returns 403 when a non-owner tries to DELETE a template", async () => {
    const cookieA = await login(ADMIN_A_EMAIL);
    const created = await request(testApp)
      .post("/api/admin/export-templates")
      .set("Cookie", cookieA)
      .send({ name: `del-owned-${TS}`, columns: ["name"], isShared: true })
      .expect(201);
    const templateId = created.body.id;

    const cookieB = await login(ADMIN_B_EMAIL);
    await request(testApp)
      .delete(`/api/admin/export-templates/${templateId}`)
      .set("Cookie", cookieB)
      .expect(403);

    const stillExists = await db
      .select()
      .from(schema.adminExportTemplates)
      .where(eq(schema.adminExportTemplates.id, templateId));
    expect(stillExists).toHaveLength(1);
  });

  it("returns 403 when a non-owner tries to PATCH a template", async () => {
    const cookieA = await login(ADMIN_A_EMAIL);
    const created = await request(testApp)
      .post("/api/admin/export-templates")
      .set("Cookie", cookieA)
      .send({ name: `patch-owned-${TS}`, columns: ["name"], isShared: true })
      .expect(201);
    const templateId = created.body.id;

    const cookieB = await login(ADMIN_B_EMAIL);
    await request(testApp)
      .patch(`/api/admin/export-templates/${templateId}`)
      .set("Cookie", cookieB)
      .send({ name: "hijacked" })
      .expect(403);

    const [row] = await db
      .select()
      .from(schema.adminExportTemplates)
      .where(eq(schema.adminExportTemplates.id, templateId));
    expect(row.name).toBe(`patch-owned-${TS}`);
  });

  it("allows the owner to PATCH and DELETE their own template", async () => {
    const cookieA = await login(ADMIN_A_EMAIL);
    const created = await request(testApp)
      .post("/api/admin/export-templates")
      .set("Cookie", cookieA)
      .send({ name: `owner-crud-${TS}`, columns: ["name"], isShared: false })
      .expect(201);
    const templateId = created.body.id;

    const updated = await request(testApp)
      .patch(`/api/admin/export-templates/${templateId}`)
      .set("Cookie", cookieA)
      .send({ name: `owner-renamed-${TS}` })
      .expect(200);
    expect(updated.body.name).toBe(`owner-renamed-${TS}`);

    await request(testApp)
      .delete(`/api/admin/export-templates/${templateId}`)
      .set("Cookie", cookieA)
      .expect(200);

    const rows = await db
      .select()
      .from(schema.adminExportTemplates)
      .where(eq(schema.adminExportTemplates.id, templateId));
    expect(rows).toHaveLength(0);
  });

  it("returns 401 when listing templates without authentication", async () => {
    await request(testApp).get("/api/admin/export-templates").expect(401);
  });
});
