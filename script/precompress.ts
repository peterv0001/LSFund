import { readFile, readdir, writeFile, stat } from "fs/promises";
import path from "path";
import zlib from "zlib";

// Only precompress payloads worth the bytes; tiny files don't benefit. Keep in
// sync with BROTLI_MIN_BYTES in server/static.ts.
export const COMPRESS_MIN_BYTES = 1024;
export const COMPRESSIBLE = /\.(js|css|html|json|svg|map|txt|wasm|webmanifest)$/i;

export async function precompressAssets(dir: string): Promise<number> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return 0;
  }

  let count = 0;
  for (const entry of entries) {
    const filePath = path.join(dir, entry);
    const info = await stat(filePath);
    if (info.isDirectory()) {
      count += await precompressAssets(filePath);
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

    // Also emit a gzip sibling for browsers that don't support Brotli, so the
    // server never pays runtime gzip cost for these assets.
    const gz = zlib.gzipSync(raw, { level: zlib.constants.Z_BEST_COMPRESSION });
    await writeFile(`${filePath}.gz`, gz);

    count++;
  }
  return count;
}
