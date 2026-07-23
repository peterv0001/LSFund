# SEO Strategy

## In scope
- Public marketing landing page (`/`)
- Public focused marketing pages (`/funding`, `/platform`, `/opportunity`, `/commissions`)
- Public ad and campaign landing pages (`/lp/*`)
- Public legal and compliance pages (`/privacy`, `/terms`, `/refund-policy`, `/income-disclosure`)
- Public auth and referral entry routes (`/login`, `/signup`, `/join/:code`, `/forgot-password`, `/reset-password`) where they affect crawlability or shared metadata

## Out of scope
- Authenticated agent portal routes (`/dashboard`, `/team`, `/deals`, `/earnings`, `/settings`, `/rank`, `/leaderboards`, `/resources`, `/reports`, `/training`, `/leads`, `/subscriptions`)
- Admin routes (`/admin/**`)
- API endpoints except where they influence public crawlability or public-route responses
- One-time token flows (`/invite/accept`, `/verify-email`) unless they accidentally affect broader crawlability rules

## Target audience
- Business owners looking for merchant cash advance and working-capital options
- Prospective agents and recruiting traffic for the LeaderShield network
- Referral partners, brokerages, call centers, and ISOs evaluating the partner program

## Primary keywords
- Merchant cash advance funding
- Business funding
- Working capital for small businesses
- Referral partner funding program
- MCA agent opportunity
- Merchant growth platform

## Architecture notes
- The public experience is a Vite React SPA served through a shared `index.html` shell.
- `server/static.ts` injects route-specific title and description tags into the shell for only part of the public route set.
- Public body content is still client-rendered for all public routes, so AI crawlers and social bots only see the initial shell HTML.
- Future scans should assume public-route SEO improvements require SSR, SSG, or prerendering unless the architecture changes.

## Dismissed categories
- None yet
