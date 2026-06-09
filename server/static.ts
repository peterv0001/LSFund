import express, { type Express } from "express";
import fs from "fs";
import path from "path";

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

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  app.use("/{*path}", (req, res) => {
    const pathname = req.path;
    const status = isKnownRoute(pathname) ? 200 : 404;
    res.status(status).sendFile(path.resolve(distPath, "index.html"));
  });
}
