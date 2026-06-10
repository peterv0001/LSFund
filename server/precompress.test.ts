import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import zlib from "zlib";

import {
  precompressAssets,
  COMPRESS_MIN_BYTES,
  COMPRESSIBLE,
} from "../script/precompress.js";

let dir: string;

// A compressible payload comfortably over the size threshold.
const bigJs = `console.log("leader shield funding bundle");`.repeat(200);

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "precompress-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function write(rel: string, contents: string | Buffer) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents);
}

function exists(rel: string) {
  return fs.existsSync(path.join(dir, rel));
}

describe("precompressAssets", () => {
  it("emits a .br sibling for compressible files over the size threshold", async () => {
    write("assets/index-abc12345.js", bigJs);
    write("assets/index-def67890.css", `.lsf{color:#0A1628;}`.repeat(200));

    const count = await precompressAssets(dir);

    expect(count).toBe(2);
    expect(exists("assets/index-abc12345.js.br")).toBe(true);
    expect(exists("assets/index-def67890.css.br")).toBe(true);

    // The emitted .br must decompress back to the original bytes.
    const original = fs.readFileSync(path.join(dir, "assets/index-abc12345.js"));
    const br = fs.readFileSync(path.join(dir, "assets/index-abc12345.js.br"));
    expect(zlib.brotliDecompressSync(br).equals(original)).toBe(true);
    // And it should actually be smaller than the source.
    expect(br.length).toBeLessThan(original.length);
  });

  it("skips files smaller than the size threshold", async () => {
    const tiny = "x".repeat(COMPRESS_MIN_BYTES - 1);
    write("assets/tiny.js", tiny);

    const count = await precompressAssets(dir);

    expect(count).toBe(0);
    expect(exists("assets/tiny.js.br")).toBe(false);
  });

  it("compresses a file exactly at the size threshold", async () => {
    write("assets/exact.js", "x".repeat(COMPRESS_MIN_BYTES));

    const count = await precompressAssets(dir);

    expect(count).toBe(1);
    expect(exists("assets/exact.js.br")).toBe(true);
  });

  it("skips non-compressible file types even when large", async () => {
    // Large enough to clear the threshold, but not a compressible extension.
    write("assets/photo.png", Buffer.alloc(COMPRESS_MIN_BYTES * 4, 7));
    write("assets/font.woff2", Buffer.alloc(COMPRESS_MIN_BYTES * 4, 9));

    const count = await precompressAssets(dir);

    expect(count).toBe(0);
    expect(exists("assets/photo.png.br")).toBe(false);
    expect(exists("assets/font.woff2.br")).toBe(false);
  });

  it("does not double-compress existing .br or .gz files", async () => {
    write("assets/already.js.br", Buffer.alloc(COMPRESS_MIN_BYTES * 4, 1));
    write("assets/already.js.gz", Buffer.alloc(COMPRESS_MIN_BYTES * 4, 2));

    const count = await precompressAssets(dir);

    expect(count).toBe(0);
    expect(exists("assets/already.js.br.br")).toBe(false);
    expect(exists("assets/already.js.gz.br")).toBe(false);
  });

  it("recurses into nested directories and counts every compressed asset", async () => {
    write("index.html", `<!doctype html><body>${"filler ".repeat(300)}</body>`);
    write("assets/app.js", bigJs);
    write("assets/nested/deep.css", `.x{}`.repeat(400));

    const count = await precompressAssets(dir);

    expect(count).toBe(3);
    expect(exists("index.html.br")).toBe(true);
    expect(exists("assets/app.js.br")).toBe(true);
    expect(exists("assets/nested/deep.css.br")).toBe(true);
  });

  it("returns 0 for a directory that does not exist", async () => {
    const count = await precompressAssets(path.join(dir, "missing"));
    expect(count).toBe(0);
  });

  it("covers every extension declared compressible", () => {
    for (const ext of [
      "js",
      "css",
      "html",
      "json",
      "svg",
      "map",
      "txt",
      "wasm",
      "webmanifest",
    ]) {
      expect(COMPRESSIBLE.test(`file.${ext}`)).toBe(true);
    }
    expect(COMPRESSIBLE.test("file.png")).toBe(false);
  });
});
