import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import compression from "compression";
import request from "supertest";
import fs from "fs";
import os from "os";
import path from "path";

import { serveStatic } from "./static.js";

let distDir: string;
let testApp: ReturnType<typeof express>;

beforeAll(() => {
  distDir = fs.mkdtempSync(path.join(os.tmpdir(), "static-caching-"));
  fs.mkdirSync(path.join(distDir, "assets"));

  // Padded past compression's default 1KB threshold so the HTML shell is a
  // meaningful compression test, while keeping the tags injectMeta rewrites.
  fs.writeFileSync(
    path.join(distDir, "index.html"),
    `<!doctype html><html><head><title>Leader Shield Funding</title>` +
      `<meta name="description" content="placeholder" /></head>` +
      `<body><div id="root"></div>` +
      `<!-- ${"filler ".repeat(300)} -->` +
      `</body></html>`,
  );

  // A content-hashed asset large enough to clear compression's default
  // 1KB threshold so we can assert it gets gzipped.
  fs.writeFileSync(
    path.join(distDir, "assets", "index-abc12345.js"),
    `console.log("leader shield funding bundle");`.repeat(200),
  );
  fs.writeFileSync(
    path.join(distDir, "assets", "index-def67890.css"),
    `.lsf{color:#0A1628;background:#F6F8FB;}`.repeat(200),
  );

  // Mirror the production wiring: compression before the static handler.
  testApp = express();
  testApp.use(compression());
  serveStatic(testApp, distDir);
});

afterAll(() => {
  fs.rmSync(distDir, { recursive: true, force: true });
});

describe("production static serving cache headers", () => {
  it("serves hashed JS assets as immutable, year-long cacheable", async () => {
    const res = await request(testApp).get("/assets/index-abc12345.js");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe(
      "public, max-age=31536000, immutable",
    );
  });

  it("serves hashed CSS assets as immutable, year-long cacheable", async () => {
    const res = await request(testApp).get("/assets/index-def67890.css");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe(
      "public, max-age=31536000, immutable",
    );
  });

  it("serves index.html with no-cache so new deploys load immediately", async () => {
    const res = await request(testApp).get("/");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-cache");
  });

  it("serves SPA fallback routes with no-cache", async () => {
    const res = await request(testApp).get("/dashboard");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-cache");

    // Deep/unknown client routes also fall through to the SPA shell and must
    // never be cached so a redeploy is picked up immediately.
    const deep = await request(testApp).get("/this-route-does-not-exist");
    expect(deep.headers["cache-control"]).toBe("no-cache");
  });
});

describe("production response compression", () => {
  it("gzip-compresses assets when the client accepts gzip", async () => {
    const res = await request(testApp)
      .get("/assets/index-abc12345.js")
      .set("Accept-Encoding", "gzip");
    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("gzip");
  });

  it("gzip-compresses the HTML shell when the client accepts gzip", async () => {
    const res = await request(testApp)
      .get("/")
      .set("Accept-Encoding", "gzip");
    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("gzip");
  });

  it("Brotli-compresses JS assets when the client accepts br", async () => {
    const res = await request(testApp)
      .get("/assets/index-abc12345.js")
      .set("Accept-Encoding", "br");
    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("br");
    // Brotli responses must keep the year-long immutable caching.
    expect(res.headers["cache-control"]).toBe(
      "public, max-age=31536000, immutable",
    );
  });

  it("Brotli-compresses CSS assets when the client accepts br", async () => {
    const res = await request(testApp)
      .get("/assets/index-def67890.css")
      .set("Accept-Encoding", "br");
    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("br");
  });

  it("prefers Brotli over gzip when the client accepts both", async () => {
    const res = await request(testApp)
      .get("/assets/index-abc12345.js")
      .set("Accept-Encoding", "br, gzip");
    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("br");
  });

  it("falls back to gzip when the client does not accept Brotli", async () => {
    const res = await request(testApp)
      .get("/assets/index-abc12345.js")
      .set("Accept-Encoding", "gzip");
    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("gzip");
  });
});
