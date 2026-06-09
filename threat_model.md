# Threat Model

## Project Overview

Leadershield Network is a publicly deployed React + Express + PostgreSQL application for agent recruitment, MCA deal intake, subscription billing, commission tracking, and admin operations. The production application serves a public marketing site plus session-authenticated agent and admin APIs. Authentication uses Passport local auth with PostgreSQL-backed sessions. Stripe is used for subscription billing, Resend is used for transactional email, and an external PMF endpoint may receive funded-deal intake data.

Production assumption for this scan: only code paths reachable when `NODE_ENV=production` are in scope. Development-only Vite tooling, tests, mockup sandbox behavior, and other non-production helpers are out of scope unless production reachability is shown.

## Assets

- **User accounts and sessions** — agent/admin identities, password hashes, session cookies, reset tokens, admin flags, referral relationships. Compromise enables impersonation or privilege abuse.
- **Financial and payout data** — commissions, payouts, payout email, bank-account last four, subscription billing state, holdbacks, clawbacks, and agent earnings. Exposure or tampering directly affects money movement.
- **Merchant and lead PII** — merchant names, emails, phone numbers, addresses, business details, owner names, owner DOB, owner address, and lead contact data. This is regulated personal and business information.
- **MCA application data** — deal intake, funding amounts, GBR, uploaded document metadata, compliance flags, PMF submission identifiers, and underwriting-related records.
- **Platform secrets and integration credentials** — database connection string, session secret, Stripe credentials, webhook secret, PMF API key, and email provider credentials.
- **Administrative control plane** — admin settings, migration controls, webhook-status tooling, exports, activity logs, and bulk lead operations.

## Trust Boundaries

- **Browser to Express API** — every request from public, agent, and admin users crosses into untrusted server input. The client cannot enforce security boundaries.
- **Authenticated agent to other agents** — agent users must never be able to read or modify other agents’ records unless the response is intentionally sanitized and authorized.
- **Agent to admin boundary** — admin-only operations such as approvals, payouts, lead management, exports, migrations, and settings must be enforced server-side.
- **Express API to PostgreSQL** — the server holds broad database access. Injection or overbroad queries at the route layer can expose the full tenant dataset.
- **Express API to Stripe / Resend / PMF** — sensitive customer and merchant data leaves the app here. Requests must be authenticated, scoped, and logged safely.
- **Production vs dev-only boundary** — `server/index.ts`, `server/routes.ts`, `server/storage.ts`, `server/webhookHandlers.ts`, `server/email.ts`, and built client assets are production scope; tests, e2e, and Vite-only development helpers are normally out of scope.

## Scan Anchors

- **Production entry points:** `server/index.ts`, `server/routes.ts`, `client/src/App.tsx`
- **Highest-risk code areas:** auth/session setup in `server/routes.ts`; raw model fetches in `server/storage.ts`; Stripe/PMF webhook and billing flows in `server/index.ts`, `server/routes.ts`, `server/webhookHandlers.ts`; agent/admin data exports and activity/logging paths in `server/routes.ts`
- **Public surface:** `/`, legal pages, `/login`, `/signup`, `/join/:code`, `/api/register`, `/api/login`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/sponsors/search`, `/api/webhooks/stripe`
- **Authenticated agent surface:** `/api/user`, `/api/agents/*`, `/api/deals*`, `/api/subscriptions*`, `/api/leads*`, `/api/notifications*`, `/api/training*`
- **Admin surface:** `/api/admin/*`
- **Usually dev-only / ignore unless proven reachable:** `server/vite.ts`, `e2e/`, `server/*.test.ts`, `server/__tests__/`, local scan artifacts

## Threat Categories

### Spoofing

The application relies on password authentication and long-lived session cookies for both agents and admins. The system must reject weak or fallback production session secrets, protect password-reset flows from abuse, and ensure only valid session holders can reach authenticated APIs. Stripe webhook calls must continue to require signature verification before billing state changes are accepted.

### Tampering

Agents and admins can create and update deals, subscriptions, leads, notifications, payout settings, and business rules. The server must enforce ownership and role checks on every state-changing route, and must never trust client-supplied identifiers to select another user’s records. Admin settings changes must remain schema-validated and constrained to intended fields.

### Information Disclosure

This project stores especially sensitive financial and merchant data. API responses must never expose password hashes, reset tokens, payout details, secret integration identifiers, or other internal-only fields. Logs must not contain merchant or owner PII, and public or agent-visible routes must not leak other users’ records through direct object references or overbroad model serialization.

### Denial of Service

Public auth and recovery endpoints are internet-facing on a public deployment. Login, sponsor search, and password-reset endpoints must resist automated abuse with rate limiting or equivalent throttling so attackers cannot brute-force credentials, enumerate accounts at scale, or flood downstream email/integration systems.

### Elevation of Privilege

The biggest privilege boundary is between normal agents and admins, plus between one agent and another. All `/api/admin/*` routes must enforce admin authorization server-side, and agent routes that accept path IDs must verify ownership or return only sanitized public data. Any path that exposes internal auth material, reset tokens, or mutable cross-user records can become a stepping stone to full account takeover or broader privilege escalation.