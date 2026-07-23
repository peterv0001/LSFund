---
name: Public content is mirrored in four places
description: A public-facing copy/price/brand change must be applied in four parallel surfaces, not just the React page.
---

The same public marketing facts (prices, compensation framing, brand wording,
program offerings) are duplicated across FOUR surfaces. Changing only the React
page leaves stale copy live elsewhere and a code reviewer / stale-term grep will
catch it:

1. Client page copy — `client/src/pages/**` (incl. `lp/*.tsx`, `landing-sections.tsx`).
2. Server-rendered route meta — `server/static.ts` (title/description per route regex, injected into served HTML).
3. Structured data — JSON-LD in `client/index.html` (FAQ answers must mirror the on-page FAQ in `landing-sections.tsx` word-for-word).
4. LLM/agent index — `client/public/llms.txt` (NOTE: the real file is under `client/public/`, NOT a root `llms.txt`).

**Why:** A 2026 content correction was rejected in review because llms.txt
(wrong path grepped), the index.html JSON-LD FAQ, and an email footer brand
still carried old prices/wording even though the page copy was fixed.

**Gotcha:** the SSR meta injection uses `String.replace`, whose replacement
string treats `$` sequences (`$1`, `$&`) specially — meta text containing
literal dollars ("$2K to $2M") must be escaped (`$` → `$$`); `server/static.ts`
has an `escapeReplacement` helper for this.

**How to apply:** When changing any public price, compensation %, brand string,
or program description, grep ALL of: `client/src`, `server/static.ts`,
`client/index.html`, `client/public/llms.txt`, and `server/email.ts` (email
footers). Run the stale-term sweep across the repo (excluding only
`attached_assets/**`, which are original uploaded source references — do not edit
them), not just `client/src`.
