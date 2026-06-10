import express, { type Express, type Request } from "express";
import fs from "fs";
import path from "path";
import zlib from "zlib";

const KNOWN_ROUTES = [
  /^\/$/,
  /^\/login$/,
  /^\/signup$/,
  /^\/join\/[^/]+$/,
  /^\/forgot-password$/,
  /^\/reset-password$/,
  /^\/income-disclosure$/,
  /^\/privacy$/,
  /^\/refund-policy$/,
  /^\/terms$/,
  /^\/lp\/(declined|consolidation|growth|seasonal|partners|referral)$/,
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

const SITE = "Leader Shield Funding";
const DOMAIN = "https://leadershieldfunding.com";

const PUBLIC_ROUTE_META: Array<{ pattern: RegExp; meta: RouteMeta }> = [
  {
    pattern: /^\/$/,
    meta: {
      title: `Business Funding & Merchant Cash Advance | ${SITE}`,
      description:
        "Leader Shield Funding helps businesses access fast merchant cash advances and grow recurring revenue. Join our agent network or apply for capital today.",
    },
  },
  {
    pattern: /^\/login$/,
    meta: {
      title: `Agent Sign In | ${SITE}`,
      description:
        "Sign in to your Leader Shield Funding agent portal to manage deals, track commissions, and grow your team.",
    },
  },
  {
    pattern: /^\/signup$/,
    meta: {
      title: `Create Agent Account | ${SITE}`,
      description:
        "Join Leader Shield Funding as an agent. Earn multi-tiered commissions on MCA deals and Merchant Growth Platform subscriptions.",
    },
  },
  {
    pattern: /^\/join\//,
    meta: {
      title: `Join Leader Shield Funding`,
      description:
        "You've been invited to join Leader Shield Funding. Create your agent account and start earning commissions on MCA deals and subscriptions.",
    },
  },
  {
    pattern: /^\/forgot-password$/,
    meta: {
      title: `Forgot Password | ${SITE}`,
      description: "Reset your Leader Shield Funding agent portal password.",
    },
  },
  {
    pattern: /^\/reset-password$/,
    meta: {
      title: `Reset Password | ${SITE}`,
      description:
        "Create a new password for your Leader Shield Funding agent portal account.",
    },
  },
  {
    pattern: /^\/privacy$/,
    meta: {
      title: `Privacy Policy | ${SITE}`,
      description:
        "Leader Shield Funding privacy policy: how we collect, use, and protect your personal information.",
    },
  },
  {
    pattern: /^\/terms$/,
    meta: {
      title: `Terms of Service | ${SITE}`,
      description:
        "Leader Shield Funding terms of service governing use of the platform, agent agreements, and commission structures.",
    },
  },
  {
    pattern: /^\/refund-policy$/,
    meta: {
      title: `Refund Policy | ${SITE}`,
      description:
        "Leader Shield Funding refund and cancellation policy for Merchant Growth Platform subscriptions.",
    },
  },
  {
    pattern: /^\/income-disclosure$/,
    meta: {
      title: `Income Disclosure Statement | ${SITE}`,
      description:
        "FTC-compliant income disclosure for Leader Shield Funding agents. Actual earnings vary based on effort, experience, and market conditions.",
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
      title: `You Know a Business That Needs Capital. | ${SITE}`,
      description:
        "Join the Leader Shield referral partner program: make the introduction and earn 1% of factoring origination on every funded referral. No quotas, no sales role.",
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

function injectMeta(html: string, meta: RouteMeta, requestPath: string): string {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const url = escapeHtml(`${DOMAIN}${requestPath}`);

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

function acceptsBrotli(req: Request): boolean {
  const header = req.headers["accept-encoding"];
  if (!header) return false;
  const value = Array.isArray(header) ? header.join(",") : header;
  return /(^|,)\s*br\s*(;|,|$)/i.test(value);
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

function brotliStatic(distPath: string): express.RequestHandler {
  return (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (!acceptsBrotli(req)) return next();

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

    // Prefer a precompressed `.br` sibling emitted at build time so we never
    // pay runtime compression cost (and it survives restarts). Fall back to
    // compressing on the fly and caching in-memory.
    const precompressedPath = `${filePath}.br`;
    let data: Buffer;
    try {
      const brStat = fs.statSync(precompressedPath);
      if (brStat.isFile()) {
        data = fs.readFileSync(precompressedPath);
      } else {
        data = compressInMemory(filePath, stat.mtimeMs);
      }
    } catch {
      data = compressInMemory(filePath, stat.mtimeMs);
    }

    res.setHeader("Content-Encoding", "br");
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

  // Serve Brotli when the client advertises `Accept-Encoding: br`; falls
  // through to express.static + gzip (`compression`) otherwise.
  app.use(brotliStatic(distPath));

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
    const pathname = req.path;
    const status = isKnownRoute(pathname) ? 200 : 404;
    const html = getIndexHtml();

    // The SPA shell must never be cached so new deploys load immediately.
    res.setHeader("Cache-Control", "no-cache");

    const match = PUBLIC_ROUTE_META.find(({ pattern }) => pattern.test(pathname));
    if (match) {
      const injected = injectMeta(html, match.meta, pathname);
      res.status(status).setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(injected);
    } else {
      res.status(status).sendFile(indexPath);
    }
  });
}
