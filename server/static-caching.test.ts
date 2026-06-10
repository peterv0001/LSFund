import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import compression from "compression";
import request from "supertest";
import fs from "fs";
import os from "os";
import path from "path";
import http from "http";
import zlib from "zlib";

import { serveStatic, PUBLIC_ROUTE_META } from "./static.js";

let distDir: string;
let testApp: ReturnType<typeof express>;
let server: http.Server;

// Mirror escapeHtml() in static.ts so the fixture and assertions compare against
// the exact bytes the server writes into the <title> and <meta> tags.
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// The homepage's meta. In production the built index.html already carries these
// SEO defaults, and express.static serves "/" verbatim from that file (the
// meta-injecting catch-all only handles non-root routes). The fixture mirrors
// that so "/" returns the homepage meta exactly like production.
const HOME_META = PUBLIC_ROUTE_META.find(({ pattern }) => pattern.test("/"))!
  .meta;

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

const PRECOMPRESSED_GZIP_MARKER =
  "this exact text only exists inside the precompressed .gz sibling " +
  "and never in the source asset".repeat(20);

const INDEX_BR_MARKER =
  "this exact text only exists inside the precompressed index.html.br " +
  "and never in the source shell".repeat(20);

const INDEX_GZIP_MARKER =
  "this exact text only exists inside the precompressed index.html.gz " +
  "and never in the source shell".repeat(20);

beforeAll(async () => {
  distDir = fs.mkdtempSync(path.join(os.tmpdir(), "static-caching-"));
  fs.mkdirSync(path.join(distDir, "assets"));

  // Padded past compression's default 1KB threshold so the HTML shell is a
  // meaningful compression test, while keeping the tags injectMeta rewrites.
  fs.writeFileSync(
    path.join(distDir, "index.html"),
    `<!doctype html><html><head><title>${escapeHtml(HOME_META.title)}</title>` +
      `<meta name="description" content="${escapeHtml(HOME_META.description)}" /></head>` +
      `<body><div id="root"></div>` +
      `<!-- ${"filler ".repeat(300)} -->` +
      `</body></html>`,
  );

  // Precompressed siblings for the SPA shell, as emitted at build time. Their
  // content is intentionally distinct from a fresh (de)compression of the
  // source shell so we can prove the precompressed file is served verbatim on
  // the SPA fallback route.
  fs.writeFileSync(
    path.join(distDir, "index.html.br"),
    zlib.brotliCompressSync(Buffer.from(INDEX_BR_MARKER)),
  );
  fs.writeFileSync(
    path.join(distDir, "index.html.gz"),
    zlib.gzipSync(Buffer.from(INDEX_GZIP_MARKER)),
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
  // Its `.gz` sibling is likewise distinct from a fresh gzip of the source so
  // we can prove the gzip-only path serves the precompressed file verbatim.
  fs.writeFileSync(
    path.join(distDir, "assets", "prebuilt-aaa11111.js.gz"),
    zlib.gzipSync(Buffer.from(PRECOMPRESSED_GZIP_MARKER)),
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

  it("serves a precompressed .gz sibling to gzip-only clients", async () => {
    const res = await request(testApp)
      .get("/assets/prebuilt-aaa11111.js")
      .set("Accept-Encoding", "gzip");
    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("gzip");
    expect(res.headers["cache-control"]).toBe(
      "public, max-age=31536000, immutable",
    );

    // superagent transparently decodes the gzip body; it must match the
    // prebuilt sibling, proving the source was never gzipped on the fly.
    expect(res.text).toBe(PRECOMPRESSED_GZIP_MARKER);
  });

  it("prefers the precompressed .br sibling over .gz when the client accepts both", async () => {
    const res = await request(testApp)
      .get("/assets/prebuilt-aaa11111.js")
      .set("Accept-Encoding", "gzip, br");
    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("br");
    expect(res.text).toBe(PRECOMPRESSED_MARKER);
  });

  it("falls back to on-the-fly gzip when no .gz sibling exists", async () => {
    // index-abc12345.js has no precompressed sibling, so a gzip-only client
    // must still get gzip — served live by the compression middleware.
    const res = await request(testApp)
      .get("/assets/index-abc12345.js")
      .set("Accept-Encoding", "gzip");
    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("gzip");

    const original = fs.readFileSync(
      path.join(distDir, "assets", "index-abc12345.js"),
    );
    expect(res.text).toBe(original.toString());
  });

  it("serves a precompressed .gz body whose Content-Length matches the bytes sent", async () => {
    const expected = zlib.gzipSync(Buffer.from(PRECOMPRESSED_GZIP_MARKER));

    const res = await rawGet("/assets/prebuilt-aaa11111.js", {
      "Accept-Encoding": "gzip",
    });
    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("gzip");
    expect(Number(res.headers["content-length"])).toBe(res.body.length);
    // The bytes on the wire are the prebuilt sibling verbatim, not a fresh
    // runtime gzip of the source.
    expect(res.body.equals(expected)).toBe(true);

    const decoded = zlib.gunzipSync(res.body);
    expect(decoded.toString()).toBe(PRECOMPRESSED_GZIP_MARKER);
  });

  it("serves an on-the-fly gzip body that decompresses back to the original JS asset", async () => {
    const original = fs.readFileSync(
      path.join(distDir, "assets", "index-abc12345.js"),
    );

    const res = await rawGet("/assets/index-abc12345.js", {
      "Accept-Encoding": "gzip",
    });
    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("gzip");

    const decoded = zlib.gunzipSync(res.body);
    expect(decoded.equals(original)).toBe(true);
  });

  it("serves an on-the-fly gzip body that decompresses back to the original CSS asset", async () => {
    const original = fs.readFileSync(
      path.join(distDir, "assets", "index-def67890.css"),
    );

    const res = await rawGet("/assets/index-def67890.css", {
      "Accept-Encoding": "gzip",
    });
    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("gzip");

    const decoded = zlib.gunzipSync(res.body);
    expect(decoded.equals(original)).toBe(true);
  });

  it("sends an on-the-fly gzip payload smaller than the uncompressed asset", async () => {
    const original = fs.readFileSync(
      path.join(distDir, "assets", "index-abc12345.js"),
    );

    const res = await rawGet("/assets/index-abc12345.js", {
      "Accept-Encoding": "gzip",
    });
    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("gzip");
    expect(res.body.length).toBeLessThan(original.length);
  });
});

describe("SPA fallback precompression", () => {
  it("serves the precompressed index.html.br sibling on SPA routes that need no meta injection", async () => {
    const res = await request(testApp)
      .get("/dashboard")
      .set("Accept-Encoding", "br");
    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("br");
    // The SPA shell must still load immediately on a redeploy.
    expect(res.headers["cache-control"]).toBe("no-cache");
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    // superagent decodes the br body; it must equal the prebuilt sibling,
    // proving the source shell was never compressed on the fly.
    expect(res.text).toBe(INDEX_BR_MARKER);
  });

  it("serves the precompressed index.html.gz sibling to gzip-only clients on SPA routes", async () => {
    const res = await request(testApp)
      .get("/dashboard")
      .set("Accept-Encoding", "gzip");
    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("gzip");
    expect(res.headers["cache-control"]).toBe("no-cache");
    expect(res.text).toBe(INDEX_GZIP_MARKER);
  });

  it("prefers the precompressed .br sibling over .gz on SPA routes when both are accepted", async () => {
    const res = await request(testApp)
      .get("/dashboard")
      .set("Accept-Encoding", "gzip, br");
    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("br");
    expect(res.text).toBe(INDEX_BR_MARKER);
  });

  it("serves the precompressed shell on unknown client routes with a 404 status", async () => {
    const res = await request(testApp)
      .get("/this-route-does-not-exist")
      .set("Accept-Encoding", "br");
    expect(res.status).toBe(404);
    expect(res.headers["content-encoding"]).toBe("br");
    expect(res.headers["cache-control"]).toBe("no-cache");
    expect(res.text).toBe(INDEX_BR_MARKER);
  });

  it("sets a Content-Length matching the precompressed bytes actually sent", async () => {
    const expected = zlib.brotliCompressSync(Buffer.from(INDEX_BR_MARKER));

    const res = await rawGet("/dashboard", { "Accept-Encoding": "br" });
    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("br");
    expect(Number(res.headers["content-length"])).toBe(res.body.length);
    expect(res.body.equals(expected)).toBe(true);
  });

  it("still injects per-request meta on meta routes instead of the precompressed sibling", async () => {
    const res = await request(testApp)
      .get("/login")
      .set("Accept-Encoding", "br");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-cache");
    // The rewritten meta title must be present, proving the precompressed
    // sibling (which lacks it) was NOT served for this route.
    expect(res.text).toContain("Agent Sign In");
    expect(res.text).not.toContain(INDEX_BR_MARKER);
  });
});

describe("public route SEO meta isolation", () => {
  // A representative concrete path for every entry in PUBLIC_ROUTE_META. The
  // assertions below require every meta entry to be matched by exactly one of
  // these, so adding a new public route without a sample here fails the suite.
  const ROUTE_SAMPLES: string[] = [
    "/",
    "/login",
    "/signup",
    "/join/ABC123",
    "/forgot-password",
    "/reset-password",
    "/privacy",
    "/terms",
    "/refund-policy",
    "/income-disclosure",
    "/lp/declined",
    "/lp/consolidation",
    "/lp/growth",
    "/lp/seasonal",
    "/lp/partners",
    "/lp/referral",
  ];

  const homeTitleTag = `<title>${escapeHtml(HOME_META.title)}</title>`;
  const homeDescriptionTag = `content="${escapeHtml(HOME_META.description)}"`;

  it("has a representative sample path for every PUBLIC_ROUTE_META entry", () => {
    // Every meta entry must be exercised by at least one sample so this guard
    // can never silently skip a route that was added later.
    for (const { pattern } of PUBLIC_ROUTE_META) {
      const matched = ROUTE_SAMPLES.some((p) => pattern.test(p));
      expect(
        matched,
        `no ROUTE_SAMPLES path matches ${pattern} — add one so the SEO guard covers it`,
      ).toBe(true);
    }
  });

  for (const samplePath of ROUTE_SAMPLES) {
    it(`serves ${samplePath} with its own title/description, not the homepage's`, async () => {
      const match = PUBLIC_ROUTE_META.find(({ pattern }) =>
        pattern.test(samplePath),
      );
      expect(
        match,
        `${samplePath} should match a PUBLIC_ROUTE_META entry`,
      ).toBeTruthy();
      const { meta } = match!;

      const res = await request(testApp).get(samplePath);
      expect(res.status).toBe(200);

      // The route's own title and description must be injected verbatim.
      expect(res.text).toContain(`<title>${escapeHtml(meta.title)}</title>`);
      expect(res.text).toContain(`content="${escapeHtml(meta.description)}"`);

      if (samplePath !== "/") {
        // The core bug: when the catch-all read req.path (always "/" under the
        // wildcard mount) every page got the homepage's meta. Any non-home page
        // must NOT carry the homepage's title or description.
        expect(res.text).not.toContain(homeTitleTag);
        expect(res.text).not.toContain(homeDescriptionTag);
      }
    });
  }
});
