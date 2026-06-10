import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import compression from "compression";
import request from "supertest";
import fs from "fs";
import os from "os";
import path from "path";
import http from "http";
import zlib from "zlib";

import { serveStatic } from "./static.js";

let distDir: string;
let testApp: ReturnType<typeof express>;
let server: http.Server;

// supertest's superagent transparently decodes `Content-Encoding: br`, which
// would hide whether the bytes on the wire are valid Brotli or smaller than the
// source. Fetch over a raw socket so we see the actual compressed payload.
function rawGet(
  urlPath: string,
  headers: Record<string, string>,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const address = server.address();
    if (!address || typeof address === "string") {
      reject(new Error("test server is not listening on a TCP port"));
      return;
    }
    const req = http.request(
      {
        host: "127.0.0.1",
        port: address.port,
        path: urlPath,
        method: "GET",
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
          }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

const PRECOMPRESSED_MARKER =
  "this exact text only exists inside the precompressed .br sibling " +
  "and never in the source asset".repeat(20);

beforeAll(async () => {
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

  // A hashed asset that has a precompressed `.br` sibling (as emitted at build
  // time). The `.br` content is intentionally distinct from a fresh brotli of
  // the source so we can prove the precompressed file is served verbatim.
  fs.writeFileSync(
    path.join(distDir, "assets", "prebuilt-aaa11111.js"),
    `console.log("source that should never be compressed at runtime");`.repeat(200),
  );
  fs.writeFileSync(
    path.join(distDir, "assets", "prebuilt-aaa11111.js.br"),
    zlib.brotliCompressSync(Buffer.from(PRECOMPRESSED_MARKER)),
  );

  // Mirror the production wiring: compression before the static handler.
  testApp = express();
  testApp.use(compression());
  serveStatic(testApp, distDir);

  await new Promise<void>((resolve) => {
    server = testApp.listen(0, "127.0.0.1", resolve);
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
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

  it("serves a Brotli body that decompresses back to the original JS asset", async () => {
    const original = fs.readFileSync(
      path.join(distDir, "assets", "index-abc12345.js"),
    );

    const res = await rawGet("/assets/index-abc12345.js", {
      "Accept-Encoding": "br",
    });
    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("br");

    // Content-Length must describe the compressed bytes actually sent.
    expect(Number(res.headers["content-length"])).toBe(res.body.length);

    const decoded = zlib.brotliDecompressSync(res.body);
    expect(decoded.equals(original)).toBe(true);
  });

  it("serves a Brotli body that decompresses back to the original CSS asset", async () => {
    const original = fs.readFileSync(
      path.join(distDir, "assets", "index-def67890.css"),
    );

    const res = await rawGet("/assets/index-def67890.css", {
      "Accept-Encoding": "br",
    });
    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("br");

    const decoded = zlib.brotliDecompressSync(res.body);
    expect(decoded.equals(original)).toBe(true);
  });

  it("sends a Brotli payload smaller than the uncompressed asset", async () => {
    const original = fs.readFileSync(
      path.join(distDir, "assets", "index-abc12345.js"),
    );

    const res = await rawGet("/assets/index-abc12345.js", {
      "Accept-Encoding": "br",
    });
    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("br");
    expect(res.body.length).toBeLessThan(original.length);
  });

  it("serves a precompressed .br sibling verbatim instead of compressing on the fly", async () => {
    const res = await request(testApp)
      .get("/assets/prebuilt-aaa11111.js")
      .set("Accept-Encoding", "br");
    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("br");
    expect(res.headers["cache-control"]).toBe(
      "public, max-age=31536000, immutable",
    );

    // superagent transparently decodes the br body; it must match the prebuilt
    // sibling, proving the source was never compressed on the fly.
    expect(res.text).toBe(PRECOMPRESSED_MARKER);
  });
});
