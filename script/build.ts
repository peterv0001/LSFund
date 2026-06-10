import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, readdir, writeFile, stat } from "fs/promises";
import path from "path";
import zlib from "zlib";

// Only precompress payloads worth the bytes; tiny files don't benefit. Keep in
// sync with BROTLI_MIN_BYTES in server/static.ts.
const COMPRESS_MIN_BYTES = 1024;
const COMPRESSIBLE = /\.(js|css|html|json|svg|map|txt|wasm|webmanifest)$/i;

async function precompressAssets(dir: string) {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }

  let count = 0;
  for (const entry of entries) {
    const filePath = path.join(dir, entry);
    const info = await stat(filePath);
    if (info.isDirectory()) {
      await precompressAssets(filePath);
      continue;
    }
    if (!info.isFile() || info.size < COMPRESS_MIN_BYTES) continue;
    if (!COMPRESSIBLE.test(entry) || /\.(br|gz)$/i.test(entry)) continue;

    const raw = await readFile(filePath);

    const br = zlib.brotliCompressSync(raw, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
      },
    });
    await writeFile(`${filePath}.br`, br);

    count++;
  }
  return count;
}

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
  await viteBuild();

  console.log("precompressing static assets...");
  const compressed = await precompressAssets(path.resolve("dist/public"));
  console.log(`precompressed ${compressed ?? 0} static assets (.br)`);

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
