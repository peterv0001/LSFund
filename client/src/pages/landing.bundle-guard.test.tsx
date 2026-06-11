import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "fs";
import path from "path";

// Fast guard for the mobile performance win on the public home page ("/"):
// `client/src/pages/landing.tsx` must paint the hero without pulling the heavy
// animation library (framer-motion) or the below-the-fold sections into the
// first-paint bundle. Those live behind a lazy() boundary in
// `landing-sections.tsx` and must STAY there.
//
// This test statically walks the import graph starting at landing.tsx,
// following ONLY static imports. Dynamic `import(...)` calls (what lazy() uses)
// are code-split into separate chunks by Vite/Rollup, so we stop at them — they
// are exactly the boundary that keeps the hero fast.
//
// This is a quick, build-free pre-check. The authoritative byte-size budget is
// enforced against the real built artifact in `landing.bundle-artifact.test.tsx`
// (and in script/build.ts via script/bundle-budget.ts).

const projectRoot = path.resolve(__dirname, "..", "..", "..");
const clientSrc = path.resolve(projectRoot, "client", "src");
const sharedDir = path.resolve(projectRoot, "shared");

const ENTRY = path.resolve(clientSrc, "pages", "landing.tsx");

const RESOLVE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".mjs", ".cjs"];

function resolveLocalModule(spec: string, importerDir: string): string | null {
  let base: string | null = null;
  if (spec.startsWith("@/")) {
    base = path.resolve(clientSrc, spec.slice(2));
  } else if (spec.startsWith("@shared/")) {
    base = path.resolve(sharedDir, spec.slice("@shared/".length));
  } else if (spec.startsWith("./") || spec.startsWith("../")) {
    base = path.resolve(importerDir, spec);
  } else {
    // Bare specifier -> external package (not a local source file).
    return null;
  }

  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const ext of RESOLVE_EXTENSIONS) {
    const withExt = base + ext;
    if (existsSync(withExt)) return withExt;
  }
  for (const ext of RESOLVE_EXTENSIONS) {
    const indexFile = path.resolve(base, "index" + ext);
    if (existsSync(indexFile)) return indexFile;
  }
  return null;
}

// Extract STATIC import/export specifiers from a source file. Deliberately
// ignores dynamic `import(...)` because those are async chunk boundaries.
function extractStaticSpecifiers(source: string): string[] {
  const specs: string[] = [];
  // `import ... from "x"` and `export ... from "x"`
  const fromRe = /\b(?:import|export)\b[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/g;
  // bare side-effect import: `import "x"` (NOT `import("x")`)
  const bareRe = /\bimport\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = fromRe.exec(source)) !== null) specs.push(m[1]);
  while ((m = bareRe.exec(source)) !== null) specs.push(m[1]);
  return specs;
}

interface GraphResult {
  localFiles: Set<string>;
  externalPackages: Set<string>;
}

function buildStaticGraph(entry: string): GraphResult {
  const localFiles = new Set<string>();
  const externalPackages = new Set<string>();
  const queue: string[] = [entry];

  while (queue.length > 0) {
    const file = queue.pop()!;
    if (localFiles.has(file)) continue;
    localFiles.add(file);

    const source = readFileSync(file, "utf-8");
    const importerDir = path.dirname(file);

    for (const spec of extractStaticSpecifiers(source)) {
      const resolved = resolveLocalModule(spec, importerDir);
      if (resolved) {
        if (!localFiles.has(resolved)) queue.push(resolved);
      } else if (!spec.startsWith("@/") && !spec.startsWith("@shared/")) {
        // Normalize scoped/sub-path package names to their package root.
        const pkg = spec.startsWith("@")
          ? spec.split("/").slice(0, 2).join("/")
          : spec.split("/")[0];
        externalPackages.add(pkg);
      }
    }
  }

  return { localFiles, externalPackages };
}

describe("landing page initial bundle guard", () => {
  const graph = buildStaticGraph(ENTRY);

  it("does not pull framer-motion into the first-paint bundle", () => {
    const offenders = Array.from(graph.externalPackages).filter(
      (pkg) => pkg === "framer-motion" || pkg.startsWith("framer-motion/"),
    );
    expect(
      offenders,
      `framer-motion (or a transitive dependency) was statically imported into the "/" first-paint bundle via the graph rooted at landing.tsx. ` +
        `Move animation-heavy code into landing-sections.tsx (loaded lazily) so the mobile hero stays fast. Offending packages: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("loads the below-the-fold sections behind a lazy boundary", () => {
    // Sanity check that the split is actually in place: landing.tsx must
    // reference landing-sections via a dynamic import, and must NOT statically
    // import it (which would defeat the split).
    const source = readFileSync(ENTRY, "utf-8");
    expect(source).toMatch(/import\(\s*['"]@\/pages\/landing-sections['"]\s*\)/);

    const sectionsFile = path.resolve(clientSrc, "pages", "landing-sections.tsx");
    expect(
      graph.localFiles.has(sectionsFile),
      "landing-sections.tsx must NOT be reachable via static imports from landing.tsx — it should only be loaded lazily.",
    ).toBe(false);
  });
});
