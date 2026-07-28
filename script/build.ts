import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";
import path from "path";

import { precompressAssets } from "./precompress.js";
import { assertLandingBundleWithinBudget } from "./bundle-budget.js";
import { prerender } from "./prerender.js";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  const clientBuild = await viteBuild();
  const rollupOutput = Array.isArray(clientBuild) ? clientBuild[0] : clientBuild;
  if (rollupOutput && "output" in rollupOutput) {
    // Guard the mobile home page ("/"): fail the build if the landing route's
    // first-paint JS grows past budget or eagerly pulls in the animation /
    // below-the-fold chunks (see script/bundle-budget.ts).
    const report = assertLandingBundleWithinBudget(rollupOutput);
    console.log(
      `landing "/" first-paint JS (route-specific): ${report.landingDeltaBytes} bytes — within budget`,
    );
  } else {
    throw new Error(
      "build: vite build did not return a Rollup output; cannot enforce the landing bundle budget",
    );
  }

  // SSR bundle — used only by the prerender step below; not shipped to users.
  // Uses a separate vite.ssr.config.ts so the client manualChunks settings
  // (which reference React packages that Rollup externalises in SSR mode)
  // never apply to this build.
  console.log("building SSR bundle for prerendering...");
  await viteBuild({ configFile: path.resolve("vite.ssr.config.ts") });

  console.log("prerendering public routes...");
  await prerender();

  console.log("precompressing static assets...");
  const compressed = await precompressAssets(path.resolve("dist/public"));
  console.log(`precompressed ${compressed ?? 0} static assets (.br + .gz)`);

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
