---
name: SPA catch-all request path
description: Why the SPA fallback handler must read originalUrl, not req.path, to know the real route
---

The SPA fallback handler in `server/static.ts` is mounted with `app.use("/{*path}", ...)`. In Express 5 a wildcard mount consumes the matched segment into `req.baseUrl`, so inside the handler `req.path` is only the *remainder* — for a top-level route like `/login` it is just `/`, and for `/dashboard/foo` it is `/foo`.

**Why:** Using `req.path` made route detection and `PUBLIC_ROUTE_META` meta-injection see `/` for every single-segment route, so every page silently got the homepage's `<title>`/meta tags. It also defeats any logic that branches on the real path (e.g. deciding whether a route needs per-request meta vs. a precompressed static shell).

**How to apply:** Derive the real path from `req.originalUrl.split("?")[0]` (then `decodeURIComponent`), not `req.path`, in any handler mounted under a wildcard like `/{*path}`. Verify with a test that hits a non-root single-segment route (e.g. `/login`) and asserts route-specific behavior, since the bug is invisible at `/`.
