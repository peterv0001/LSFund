import type { RollupOutput, OutputChunk } from "rollup";

// Budget for the public home page ("/") first-paint JavaScript.
//
// We measure the *incremental* JS the browser must download to render the "/"
// route on a cold load — i.e. the landing route chunk plus everything it
// statically pulls in — MINUS the shared app shell (the entry chunk + framework
// vendor chunk) that every route loads regardless. That isolates the landing
// page's own footprint, so the budget is sensitive to landing-specific bloat
// (e.g. re-importing framer-motion or another heavy library into the hero) and
// is not perturbed by unrelated growth in the shared shell.
//
// Measured ~15KB today. The cap leaves headroom for small hero tweaks but trips
// well before the ~115KB animation (framer-motion) chunk could leak back into
// the first paint.
export const INITIAL_ROUTE_JS_BUDGET_BYTES = 50 * 1024;

const LANDING_MODULE = "client/src/pages/landing.tsx";
const ANIMATION_PACKAGE = "framer-motion";

const norm = (p: string) => p.replace(/\\/g, "/");

export interface LandingBundleReport {
  entryFile: string;
  landingFile: string;
  shellBytes: number;
  landingClosureBytes: number;
  landingDeltaBytes: number;
  landingDeltaChunks: { fileName: string; bytes: number }[];
  animationChunkInClosure: string | null;
}

function chunksOf(output: RollupOutput): OutputChunk[] {
  return output.output.filter((o): o is OutputChunk => o.type === "chunk");
}

/**
 * Analyze a Vite/Rollup build output and report the landing route's first-paint
 * JS footprint, plus whether the heavy animation (framer-motion) chunk has
 * leaked into the route's static (eagerly-loaded) closure.
 */
export function analyzeLandingBundle(output: RollupOutput): LandingBundleReport {
  const chunks = chunksOf(output);
  const byName = new Map(chunks.map((c) => [c.fileName, c]));

  const entry = chunks.find((c) => c.isEntry);
  const landing = chunks.find((c) =>
    Object.keys(c.modules).some((m) => norm(m).endsWith(LANDING_MODULE)),
  );
  if (!entry) {
    throw new Error(
      "bundle-budget: could not find the entry chunk in the build output",
    );
  }
  if (!landing) {
    throw new Error(
      `bundle-budget: could not find the landing chunk (the chunk containing ${LANDING_MODULE}) in the build output`,
    );
  }

  // Walk only STATIC imports (chunk.imports). Dynamic imports (chunk.dynamicImports)
  // are separate async chunks that load after first paint, so they are excluded.
  const staticClosure = (startFileName: string): Set<string> => {
    const seen = new Set<string>();
    const queue = [startFileName];
    while (queue.length > 0) {
      const fileName = queue.pop()!;
      if (seen.has(fileName)) continue;
      seen.add(fileName);
      const chunk = byName.get(fileName);
      if (!chunk) continue;
      for (const imp of chunk.imports) {
        if (!seen.has(imp)) queue.push(imp);
      }
    }
    return seen;
  };

  const bytesOf = (fileName: string) =>
    Buffer.byteLength(byName.get(fileName)!.code);
  const sumBytes = (fileNames: string[]) =>
    fileNames.reduce((total, fileName) => total + bytesOf(fileName), 0);

  const shell = staticClosure(entry.fileName);
  const landingClosure = staticClosure(landing.fileName);
  const landingClosureFiles = Array.from(landingClosure);
  const deltaFiles = landingClosureFiles.filter(
    (fileName) => !shell.has(fileName),
  );

  const chunkContainingModule = (predicate: (modulePath: string) => boolean) => {
    const chunk = chunks.find((c) =>
      Object.keys(c.modules).some((m) => predicate(norm(m))),
    );
    return chunk?.fileName ?? null;
  };

  const animationFile = chunkContainingModule((m) => m.includes(ANIMATION_PACKAGE));

  return {
    entryFile: entry.fileName,
    landingFile: landing.fileName,
    shellBytes: sumBytes(Array.from(shell)),
    landingClosureBytes: sumBytes(landingClosureFiles),
    landingDeltaBytes: sumBytes(deltaFiles),
    landingDeltaChunks: deltaFiles.map((fileName) => ({
      fileName,
      bytes: bytesOf(fileName),
    })),
    animationChunkInClosure:
      animationFile && landingClosure.has(animationFile) ? animationFile : null,
  };
}

/**
 * Throws if the landing route violates the first-paint budget or eagerly loads
 * the animation (framer-motion) chunk. Returns the report on success.
 */
export function assertLandingBundleWithinBudget(
  output: RollupOutput,
  budgetBytes: number = INITIAL_ROUTE_JS_BUDGET_BYTES,
): LandingBundleReport {
  const report = analyzeLandingBundle(output);
  const problems: string[] = [];

  if (report.animationChunkInClosure) {
    problems.push(
      `framer-motion (chunk "${report.animationChunkInClosure}") is statically loaded by the "/" route. ` +
        `Keep animation-heavy code out of landing.tsx (load it lazily) so the mobile hero stays fast.`,
    );
  }
  if (report.landingDeltaBytes > budgetBytes) {
    const heaviest = [...report.landingDeltaChunks]
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 5)
      .map((c) => `${c.fileName} (${c.bytes}b)`)
      .join(", ");
    problems.push(
      `the "/" route's first-paint JS (beyond the shared app shell) is ${report.landingDeltaBytes} bytes, ` +
        `over the ${budgetBytes}-byte budget. Something heavy was likely imported directly into landing.tsx ` +
        `instead of being lazy-loaded. Heaviest route-specific chunks: ${heaviest}.`,
    );
  }

  if (problems.length > 0) {
    throw new Error(
      "Landing page bundle budget check FAILED:\n - " + problems.join("\n - "),
    );
  }
  return report;
}
