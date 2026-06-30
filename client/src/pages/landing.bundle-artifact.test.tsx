import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { build } from "vite";
import type { RollupOutput } from "rollup";
import {
  analyzeLandingBundle,
  INITIAL_ROUTE_JS_BUDGET_BYTES,
  type LandingBundleReport,
} from "../../../script/bundle-budget";

// Authoritative bundle-budget guard for the public home page ("/"). Unlike the
// fast source-graph pre-check in landing.bundle-guard.test.tsx, this runs a real
// production Vite/Rollup build and measures the ACTUAL emitted chunks. That
// catches any heavy third-party import sneaking into the first paint (not just
// framer-motion), since real package bytes are counted.

let report: LandingBundleReport;

beforeAll(async () => {
  // Force a clean production build: the vite config gates dev-only plugins on
  // NODE_ENV, and minification differs by mode.
  const prevNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const out = await build({ logLevel: "silent", mode: "production" });
    const rollupOutput = (Array.isArray(out) ? out[0] : out) as RollupOutput;
    report = analyzeLandingBundle(rollupOutput);
  } finally {
    process.env.NODE_ENV = prevNodeEnv;
  }
}, 180_000);

describe("landing page built-artifact bundle budget", () => {
  it("does not statically load the framer-motion (animation) chunk on '/'", () => {
    expect(
      report.animationChunkInClosure,
      `framer-motion was eagerly loaded by the "/" route via chunk "${report.animationChunkInClosure}". ` +
        `Keep animation-heavy code off the home route (it belongs on the lazily-routed content pages).`,
    ).toBeNull();
  });

  it("keeps the '/' route first-paint JS within the byte budget", () => {
    const heaviest = [...report.landingDeltaChunks]
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 5)
      .map((c) => `${c.fileName} (${c.bytes}b)`)
      .join(", ");
    expect(
      report.landingDeltaBytes,
      `The "/" route's route-specific first-paint JS is ${report.landingDeltaBytes} bytes ` +
        `(budget ${INITIAL_ROUTE_JS_BUDGET_BYTES}). Something heavy was likely imported directly into landing.tsx ` +
        `instead of being lazy-loaded. Heaviest route chunks: ${heaviest}.`,
    ).toBeLessThanOrEqual(INITIAL_ROUTE_JS_BUDGET_BYTES);
  });
});
