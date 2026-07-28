// Build-time prerender step: imports the SSR bundle produced by
// `vite build --ssr`, renders each public route to HTML, and saves the result
// under dist/public/prerendered/.  server/static.ts detects those files and
// serves them instead of the bare SPA shell, so crawlers receive real page
// content in the first HTTP response.

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const DIST_PUBLIC = path.resolve("dist/public");
const DIST_SSR = path.resolve("dist/ssr");
const PRERENDER_DIR = path.join(DIST_PUBLIC, "prerendered");

export async function prerender(): Promise<void> {
  const indexPath = path.join(DIST_PUBLIC, "index.html");
  if (!fs.existsSync(indexPath)) {
    throw new Error(`prerender: dist/public/index.html not found — run the client build first`);
  }

  const ssrEntry = path.join(DIST_SSR, "entry-server.js");
  if (!fs.existsSync(ssrEntry)) {
    throw new Error(`prerender: dist/ssr/entry-server.js not found — run the SSR build first`);
  }

  const indexHtml = fs.readFileSync(indexPath, "utf-8");

  // Dynamic import resolves ESM correctly; pathToFileURL handles Windows paths.
  const { render, PUBLIC_ROUTES } = (await import(
    pathToFileURL(ssrEntry).href
  )) as typeof import("../client/src/entry-server");

  fs.mkdirSync(PRERENDER_DIR, { recursive: true });

  let succeeded = 0;
  let failed = 0;

  for (const { path: routePath } of PUBLIC_ROUTES) {
    try {
      const appHtml = render(routePath);

      // Inject the server-rendered markup into the root placeholder.
      // data-ssr="1" signals client/src/main.tsx to use hydrateRoot instead
      // of createRoot so React keeps the server DOM rather than discarding it.
      const html = indexHtml.replace(
        '<div id="root"></div>',
        `<div id="root" data-ssr="1">${appHtml}</div>`,
      );

      // Convert the URL path to a file path inside prerendered/:
      //   /           → prerendered/index.html
      //   /funding    → prerendered/funding.html
      //   /lp/scale   → prerendered/lp/scale.html
      const fileName =
        routePath === "/" ? "index.html" : routePath.slice(1) + ".html";
      const filePath = path.join(PRERENDER_DIR, fileName);

      // Ensure nested directories exist (e.g. prerendered/lp/).
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, html, "utf-8");
      console.log(`  ✓ ${routePath}`);
      succeeded++;
    } catch (err) {
      console.error(`  ✗ ${routePath}:`, err);
      failed++;
    }
  }

  console.log(
    `prerendering complete — ${succeeded} succeeded, ${failed} failed`,
  );

  if (failed > 0) {
    // Warn but don't abort the build: prerendering is an enhancement layer.
    // The server falls back to the plain SPA shell for any route whose file is
    // missing, so a partial failure doesn't break the deployed app.
    console.warn(
      `prerender: ${failed} route(s) failed — those routes will fall back to the SPA shell`,
    );
  }
}
