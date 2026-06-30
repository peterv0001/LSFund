# SEO Strategy

## In scope
- Public marketing landing page (`/`)
- Public ad and campaign landing pages (`/lp/*`)
- Public legal and compliance pages (`/privacy`, `/terms`, `/refund-policy`, `/income-disclosure`)
- Public auth and referral entry routes (`/login`, `/signup`, `/join/:code`, `/forgot-password`, `/reset-password`) where they affect crawlability or shared metadata

## Out of scope
- Authenticated agent portal routes (`/dashboard`, `/team`, `/deals`, `/earnings`, `/settings`, `/rank`, `/leaderboards`, `/resources`, `/reports`, `/training`, `/leads`, `/subscriptions`)
- Admin routes (`/admin/**`)
- API endpoints except where they influence public crawlability or public-route responses

## Target audience
- Business owners looking for merchant cash advance and working-capital options
- Prospective agents and recruiting traffic for the LeaderShield network

## Primary keywords
- Merchant cash advance funding
- Business funding
- Working capital for small businesses
- Referral partner funding program
- MCA agent opportunity

## Architecture notes
- The current public experience is a Vite React SPA served through a shared `index.html` shell.
- Public route metadata is mostly shared, and the `/lp/*` pages only change title/description client-side after hydration.
- Future scans should assume public-route SEO improvements require SSR, SSG, or prerendering unless the architecture changes.

## Dismissed categories
- None yet
