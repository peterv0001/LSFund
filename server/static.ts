import express, { type Express, type Request } from "express";
import fs from "fs";
import path from "path";
import zlib from "zlib";

const KNOWN_ROUTES = [
  /^\/$/,
  /^\/funding$/,
  /^\/platform$/,
  /^\/opportunity$/,
  /^\/commissions$/,
  /^\/login$/,
  /^\/signup$/,
  /^\/join\/[^/]+$/,
  /^\/forgot-password$/,
  /^\/reset-password$/,
  /^\/income-disclosure$/,
  /^\/privacy$/,
  /^\/refund-policy$/,
  /^\/terms$/,
  /^\/lp\/(declined|consolidation|growth|seasonal|partners|referral|platform|leaks|scale)$/,
  /^\/dashboard$/,
  /^\/team$/,
  /^\/deals$/,
  /^\/earnings$/,
  /^\/settings$/,
  /^\/rank$/,
  /^\/leaderboards$/,
  /^\/resources$/,
  /^\/reports$/,
  /^\/training$/,
  /^\/leads$/,
  /^\/subscriptions$/,
  /^\/admin(\/[a-z-]*)?$/,
];

function isKnownRoute(pathname: string): boolean {
  return KNOWN_ROUTES.some((pattern) => pattern.test(pathname));
}

interface RouteMeta {
  title: string;
  description: string;
}

const SITE = "LeaderShield Funding";
const DOMAIN = "https://leadershieldfunding.com";

export const PUBLIC_ROUTE_META: Array<{ pattern: RegExp; meta: RouteMeta }> = [
  {
    pattern: /^\/$/,
    meta: {
      title: `Business Funding & Merchant Cash Advance | ${SITE}`,
      description:
        "LeaderShield Funding helps businesses access fast merchant cash advances and grow recurring revenue. Join our agent network or apply for capital today.",
    },
  },
  {
    pattern: /^\/funding$/,
    meta: {
      title: `Merchant Cash Advance Funding | ${SITE}`,
      description:
        "Fast, flexible merchant cash advance funding from $2K to $2M. See eligibility, factor rates, repayment terms, and how our streamlined intake gets businesses funded in as little as one day.",
    },
  },
  {
    pattern: /^\/platform$/,
    meta: {
      title: `Merchant Growth Platform Subscription Tiers | ${SITE}`,
      description:
        "Four AI-powered Merchant Growth Platform subscription tiers — Starter, Growth Foundation, Revenue Growth System, and Revenue Scale AI — powered by Marketing Titan + Lead Titan AI.",
    },
  },
  {
    pattern: /^\/opportunity$/,
    meta: {
      title: `The Agent Opportunity | ${SITE}`,
      description:
        "Build a full agent business with two revenue streams — immediate MCA commissions plus compounding subscription residuals. See how it works, income scenarios, your toolkit, and a 30-day roadmap.",
    },
  },
  {
    pattern: /^\/commissions$/,
    meta: {
      title: `The Compensation Plan | ${SITE}`,
      description:
        "Transparent LeaderShield compensation: MCA Opening Agent Pool, subscription pools by distributor tier, performance accelerators, lifetime residuals, agency overrides, and downline income up to three levels.",
    },
  },
  {
    pattern: /^\/login$/,
    meta: {
      title: `Agent Sign In | ${SITE}`,
      description:
        "Sign in to your LeaderShield Funding agent portal to manage deals, track commissions, and grow your team.",
    },
  },
  {
    pattern: /^\/signup$/,
    meta: {
      title: `Create Agent Account | ${SITE}`,
      description:
        "Join LeaderShield Funding as an agent. Earn multi-tiered commissions on MCA deals and Merchant Growth Platform subscriptions.",
    },
  },
  {
    pattern: /^\/join\//,
    meta: {
      title: `Join LeaderShield Funding`,
      description:
        "You've been invited to join LeaderShield Funding. Create your agent account and start earning commissions on MCA deals and subscriptions.",
    },
  },
  {
    pattern: /^\/forgot-password$/,
    meta: {
      title: `Forgot Password | ${SITE}`,
      description: "Reset your LeaderShield Funding agent portal password.",
    },
  },
  {
    pattern: /^\/reset-password$/,
    meta: {
      title: `Reset Password | ${SITE}`,
      description:
        "Create a new password for your LeaderShield Funding agent portal account.",
    },
  },
  {
    pattern: /^\/privacy$/,
    meta: {
      title: `Privacy Policy | ${SITE}`,
      description:
        "LeaderShield Funding privacy policy: how we collect, use, and protect your personal information.",
    },
  },
  {
    pattern: /^\/terms$/,
    meta: {
      title: `Terms of Service | ${SITE}`,
      description:
        "LeaderShield Funding terms of service governing use of the platform, agent agreements, and commission structures.",
    },
  },
  {
    pattern: /^\/refund-policy$/,
    meta: {
      title: `Refund Policy | ${SITE}`,
      description:
        "LeaderShield Funding refund and cancellation policy for Merchant Growth Platform subscriptions.",
    },
  },
  {
    pattern: /^\/income-disclosure$/,
    meta: {
      title: `Income Disclosure Statement | ${SITE}`,
      description:
        "FTC-compliant income disclosure for LeaderShield Funding agents. Actual earnings vary based on effort, experience, and market conditions.",
    },
  },
  {
    pattern: /^\/lp\/declined$/,
    meta: {
      title: `The Bank Said No. Your Revenue Says Yes. | ${SITE}`,
      description:
        "Get the 24-Hour Funding Checklist: exactly what to prepare so your business can move from application to funded capital in as little as one business day.",
    },
  },
  {
    pattern: /^\/lp\/consolidation$/,
    meta: {
      title: `Too Many Daily Debits? See the Math on One Payment. | ${SITE}`,
      description:
        "Get a free consolidation analysis: map every advance you're carrying and see what one structured payment could do for your daily cash flow.",
    },
  },
  {
    pattern: /^\/lp\/growth$/,
    meta: {
      title: `Growth Doesn't Wait for the Bank. | ${SITE}`,
      description:
        "Get the Capital ROI Playbook: how operators decide when fast capital beats waiting — with worked examples on inventory turns, marketing payback, and expansion math.",
    },
  },
  {
    pattern: /^\/lp\/seasonal$/,
    meta: {
      title: `Stock the Season Before the Season. | ${SITE}`,
      description:
        "Get the Seasonal Capital Calendar: when to secure inventory and staffing capital ahead of your peak — retail, e-commerce, restaurants, and trades.",
    },
  },
  {
    pattern: /^\/lp\/partners$/,
    meta: {
      title: `Your Dialers. Our Paper. | ${SITE} Partner Network`,
      description:
        "An institutional MCA partner program for call centers, ISOs, and brokerages: transparent per-deal economics, fast funding payouts, and full compliance coverage.",
    },
  },
  {
    pattern: /^\/lp\/referral$/,
    meta: {
      title: `Two Income Streams. One Agent Role. | ${SITE}`,
      description:
        "Become a LeaderShield Funding agent: earn the 32.5% Opening Agent Pool on funded MCA deals plus recurring Merchant Growth Platform subscription commissions (up to 55%) and lifetime residuals.",
    },
  },
];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// `String.replace` treats `$` sequences in the replacement string specially
// (`$1`, `$&`, etc.), so literal dollar signs in meta text (e.g. "$2K to $2M")
// would corrupt the output. Double them so they survive as literals.
function escapeReplacement(str: string): string {
  return str.replace(/\$/g, "$$$$");
}

function injectMeta(html: string, meta: RouteMeta, requestPath: string): string {
  const title = escapeReplacement(escapeHtml(meta.title));
  const description = escapeReplacement(escapeHtml(meta.description));
  const url = escapeReplacement(escapeHtml(`${DOMAIN}${requestPath}`));

  let result = html;

  result = result.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);

  result = result.replace(
    /(<meta\s+name="description"\s+content=")[^"]*(")/,
    `$1${description}$2`,
  );
  result = result.replace(
    /(<meta\s+property="og:title"\s+content=")[^"]*(")/,
    `$1${title}$2`,
  );
  result = result.replace(
    /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
    `$1${description}$2`,
  );
  result = result.replace(
    /(<meta\s+property="og:url"\s+content=")[^"]*(")/,
    `$1${url}$2`,
  );
  result = result.replace(
    /(<meta\s+name="twitter:title"\s+content=")[^"]*(")/,
    `$1${title}$2`,
  );
  result = result.replace(
    /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,
    `$1${description}$2`,
  );

  return result;
}

// Only Brotli-compress payloads worth the CPU; tiny files don't benefit and
// matches the spirit of compression's default ~1KB threshold.
const BROTLI_MIN_BYTES = 1024;

// Brotli yields noticeably smaller files than gzip for modern browsers. The
// `compression` middleware only emits gzip/deflate, so we serve precompressed
// Brotli ourselves for on-disk static files. Results are cached in-memory keyed
// by mtime so each asset is only compressed once.
const brotliCache = new Map<string, { mtimeMs: number; data: Buffer }>();

function compressInMemory(filePath: string, mtimeMs: number): Buffer {
  let cached = brotliCache.get(filePath);
  if (!cached || cached.mtimeMs !== mtimeMs) {
    const raw = fs.readFileSync(filePath);
    cached = { mtimeMs, data: zlib.brotliCompressSync(raw) };
    brotliCache.set(filePath, cached);
  }
  return cached.data;
}

function acceptsEncoding(req: Request, encoding: string): boolean {
  const header = req.headers["accept-encoding"];
  if (!header) return false;
  const value = Array.isArray(header) ? header.join(",") : header;
  return new RegExp(`(^|,)\\s*${encoding}\\s*(;|,|$)`, "i").test(value);
}

function acceptsBrotli(req: Request): boolean {
  return acceptsEncoding(req, "br");
}

function acceptsGzip(req: Request): boolean {
  return acceptsEncoding(req, "gzip");
}

function setAssetCacheControl(res: express.Response, filePath: string) {
  // Mirror express.static's setHeaders so Brotli responses get the same
  // caching as their uncompressed counterparts.
  if (filePath.endsWith("index.html")) {
    res.setHeader("Cache-Control", "no-cache");
  } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  }
}

function readSibling(filePath: string, ext: string): Buffer | null {
  const siblingPath = `${filePath}.${ext}`;
  try {
    const siblingStat = fs.statSync(siblingPath);
    if (siblingStat.isFile()) {
      return fs.readFileSync(siblingPath);
    }
  } catch {
    /* no sibling on disk */
  }
  return null;
}

function precompressedStatic(distPath: string): express.RequestHandler {
  return (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();

    const wantsBrotli = acceptsBrotli(req);
    const wantsGzip = acceptsGzip(req);
    if (!wantsBrotli && !wantsGzip) return next();

    let pathname: string;
    try {
      pathname = decodeURIComponent(req.path);
    } catch {
      return next();
    }

    const filePath = path.join(distPath, pathname);
    // Guard against path traversal escaping the build directory.
    if (filePath !== distPath && !filePath.startsWith(distPath + path.sep)) {
      return next();
    }

    let stat: fs.Stats;
    try {
      stat = fs.statSync(filePath);
    } catch {
      return next();
    }
    if (!stat.isFile() || stat.size < BROTLI_MIN_BYTES) return next();

    let encoding: "br" | "gzip";
    let data: Buffer;

    if (wantsBrotli) {
      // Prefer a precompressed `.br` sibling emitted at build time so we never
      // pay runtime compression cost (and it survives restarts). Fall back to
      // compressing on the fly and caching in-memory.
      encoding = "br";
      data = readSibling(filePath, "br") ?? compressInMemory(filePath, stat.mtimeMs);
    } else {
      // Gzip-only clients: serve a precompressed `.gz` sibling if one exists so
      // we avoid runtime gzip cost. If there's no sibling, fall through to
      // express.static + the `compression` middleware, which gzips on the fly.
      const gz = readSibling(filePath, "gz");
      if (!gz) return next();
      encoding = "gzip";
      data = gz;
    }

    res.setHeader("Content-Encoding", encoding);
    res.setHeader("Vary", "Accept-Encoding");
    res.type(path.extname(filePath) || "application/octet-stream");
    setAssetCacheControl(res, filePath);
    res.setHeader("Content-Length", data.length);

    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.end(data);
  };
}

export function serveStatic(app: Express, distPathOverride?: string) {
  const distPath = distPathOverride ?? path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve precompressed assets: Brotli when the client accepts `br`, otherwise
  // a precompressed `.gz` sibling for gzip-only clients. Requests with no
  // matching precompressed file fall through to express.static + on-the-fly
  // gzip (`compression`).
  app.use(precompressedStatic(distPath));

  app.use(
    express.static(distPath, {
      setHeaders: (res, filePath) => {
        // Vite emits content-hashed filenames under /assets, so they can be
        // cached forever. index.html must never be cached so new deploys are
        // picked up immediately.
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache");
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );

  const indexPath = path.resolve(distPath, "index.html");
  let indexHtml: string | null = null;

  function getIndexHtml(): string {
    if (!indexHtml) {
      indexHtml = fs.readFileSync(indexPath, "utf-8");
    }
    return indexHtml;
  }

  app.use("/{*path}", (req, res) => {
    // This handler is mounted at the `/{*path}` wildcard, so Express strips the
    // matched segment into `req.baseUrl` and leaves `req.path` as the remainder
    // (e.g. "/" for "/login"). Derive the real request path from `originalUrl`
    // so route detection and meta injection see the full path.
    let pathname = req.originalUrl.split("?")[0];
    try {
      pathname = decodeURIComponent(pathname);
    } catch {
      /* keep the raw path if it isn't valid percent-encoding */
    }
    const status = isKnownRoute(pathname) ? 200 : 404;

    // The SPA shell must never be cached so new deploys load immediately.
    res.setHeader("Cache-Control", "no-cache");

    const match = PUBLIC_ROUTE_META.find(({ pattern }) => pattern.test(pathname));
    if (match) {
      // Meta routes rewrite the HTML per-request, so the precompressed sibling
      // can't be reused; let the `compression` middleware gzip the result.
      const injected = injectMeta(getIndexHtml(), match.meta, pathname);
      res.status(status).setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(injected);
      return;
    }

    // The SPA shell is unchanged for these routes, so reuse the precompressed
    // `index.html.br`/`.gz` siblings emitted at build time instead of paying
    // runtime compression on the most-hit fallback route.
    res.status(status).setHeader("Content-Type", "text/html; charset=utf-8");

    let encoding: "br" | "gzip" | null = null;
    let data: Buffer | null = null;

    if (acceptsBrotli(req)) {
      const br = readSibling(indexPath, "br");
      if (br) {
        encoding = "br";
        data = br;
      }
    }
    if (!data && acceptsGzip(req)) {
      const gz = readSibling(indexPath, "gz");
      if (gz) {
        encoding = "gzip";
        data = gz;
      }
    }

    if (data && encoding) {
      res.setHeader("Content-Encoding", encoding);
      res.setHeader("Vary", "Accept-Encoding");
      res.setHeader("Content-Length", data.length);
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      res.end(data);
      return;
    }

    // No precompressed sibling (or client accepts neither br nor gzip): fall
    // back to the raw file and let `compression` handle gzip if applicable.
    res.sendFile(indexPath);
  });
}
