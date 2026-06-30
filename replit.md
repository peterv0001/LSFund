# LeaderShield Funding - Agent Portal

## Overview
LeaderShield Funding is a full-stack network marketing (MLM) platform for Merchant Cash Advance (MCA) lending and recurring subscription products (Merchant Growth Platform). It enables agents to sign up via referrals, log deals, manage subscriptions, and earn multi-tiered commissions based on GBR waterfall and subscription decay. The platform includes an agent portal, an admin portal, and a public marketing website for recruitment.

**Brand:** LeaderShield Funding
**Domain:** leadershieldfunding.com
**Color Palette:** Vault Ink (#0A1628) and Brass (#C9A24B) on Clean Paper (#F6F8FB); supporting Steel (#5C6B82) and Verified Green (#1C8A5B)
**Fonts:** Archivo (headings/display), IBM Plex Sans (body), IBM Plex Mono (financial figures/eyebrows)
**Logo:** Heraldic crest (shield + upward chevron) in ink with brass stroke; wordmark "Leader" (heavy/ink) + "Shield" (brass) + "Funding" (mono caps, wide tracking)

**Core Capabilities:**
- Binary tree agent hierarchy management and recruitment via referral links.
- GBR (Gross Brokerage Revenue) waterfall for MCA commissions.
- Merchant Growth Platform subscription commission engine with decay.
- Holdback (70/30) and clawback system for risk management.
- Fulfillment agent tiering and rank advancement (Agent → Builder → Leader → Director → Partner).
- Platform fee management with production-based waivers.
- Lead distribution system with AI follow-up.
- Quarterly performance accelerators and renewal commissions.

**Products:**
- **Merchant Growth Platform (Subscription Tiers):**
    - Tier 1: Starter ($149/mo) - 750 verified lead credits, 5 email outreach sequences, Basic AI Brand Intelligence, integrates with existing CRM. (Powered by Lead Titan AI.)
    - Tier 2: Growth Foundation ($497/mo) - Advanced AI Brand Intelligence, native AI CRM (1,000 contacts + scoring), 24/7 AI chatbot lead capture, AI visual email, performance dashboard.
    - Tier 3: Revenue Growth System ($997/mo, Most Popular) - Everything in Growth Foundation plus 2,000 lead credits/mo, Darwin AI Chief of Staff, AI social content to Meta, Ask AI, CRM 10,000 contacts + automation.
    - Tier 4: Revenue Scale AI ($1,497/mo, Best Value) - Everything in Revenue Growth System plus AI Caller (750 outbound min/mo), AI paid ads + ad designer + insights, social to Meta/LinkedIn/X, AI blogs, CRM 25,000 contacts + advanced automation.

    Subscription tiers are delivered via an exclusive partnership with Marketing Titan AI + Lead Titan AI.
- **Merchant Cash Advance (MCA):** Traditional capital access with enhanced commissions when bundled with subscriptions.

The platform's core business logic includes binary tree placement for agent hierarchy, a GBR waterfall for MCA commissions, a subscription commission engine with decay, holdback/clawback systems, fulfillment agent tiering, and a rank advancement system. It also features platform fee management, a lead distribution system, quarterly performance accelerators, and renewal commissions.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Architecture

#### Frontend Architecture
- **Framework:** React 18 with TypeScript, built with Vite
- **Routing:** Wouter
- **State Management:** TanStack React Query
- **UI Components:** shadcn/ui (Radix UI primitives) with Tailwind CSS, leveraging the "New York" style for a polished, professional look.
- **Styling:** Tailwind CSS with custom design tokens (Vault Ink #0A1628, Brass #C9A24B, Clean Paper #F6F8FB, Steel #5C6B82, Verified Green #1C8A5B)
- **Fonts:** Archivo (display/headings), IBM Plex Sans (body), IBM Plex Mono (financial figures/eyebrows)
- **Icons:** Lucide React; brand crest is a custom inline SVG (shield + chevron) in `BrandMark`/`BrandLockup`

**Key Design Decisions:**
- Component library uses New York style shadcn/ui for a polished, professional look.
- Path aliases (`@/` for client/src, `@shared/` for shared code) for organization.
- Protected routes enforce authentication.
- **Public Marketing Landing Page:** Immersive dark hero with animated elements (Framer Motion), social proof, "How It Works" section, two revenue streams (MCA & Platform), Merchant Growth Platform tiers, income lifestyle scenarios, compensation plan details, testimonials, platform tools, 30-day roadmap, compliance information (FTC-compliant), FAQs, and a final CTA.
- **Legal/Compliance Pages:** Dedicated pages for Income Disclosure, Terms of Service, Privacy Policy, and Refund Policy.
- **Authentication Pages:** Features a dark gradient left panel and right panel for login/register forms with brass gradient CTAs, sponsor search, and placement preference. Includes legal consent checkbox and a forgot/reset password flow.
- **Training Page (LeaderShield Academy):** 6-module video course with progress tracking, sales playbooks, product-specific sales guidance, and a "Your First 30 Days" checklist.
- Uses Framer Motion for animations, `AnimatedSection` for scroll-triggered effects, `CountUp` for animated statistics, and `FAQItem` for accordions.

#### Backend Architecture
- **Runtime:** Node.js with Express 5
- **Language:** TypeScript (ESM modules)
- **API Design:** RESTful endpoints with Zod schema validation
- **Authentication:** Passport.js with local strategy, session-based via PostgreSQL using `connect-pg-simple`. Password hashing uses native `scrypt`.
- **Commission Engine:** A dual-path engine gated by each record's `commissionModel`. The 2026 producer model lives in `server/commissionEngine.ts`: MCA Opening Agent Pool (32.5% of gross funding commission) with agency-model producer/override splits and performance accelerators (cap +2.5%); subscription commissions on the commissionable basis with decay, distributor-tier pools, and subscription accelerators (cap +5%, top rate 60% at Elite); tiered lifetime residuals (GF 10%, RGS/Scale 15%, Starter none); 70/30 holdback; binary bonuses with rank-based caps; and membership waiver calculations. Legacy records retain the inline GBR waterfall (MAC/TFC/PICF/RSR) in `server/routes.ts`. The 1% affiliate referral tier has been removed.

**Key Backend Design Decisions:**
- Session storage uses `connect-pg-simple` for PostgreSQL-backed sessions.
- API routes defined in `shared/routes.ts` with type safety via Zod schemas.
- The build process bundles server dependencies for optimized performance and reduced cold start times.
- Password hashing uses Node's native `scrypt`.

#### Data Storage
- **Database:** PostgreSQL with Drizzle ORM
- **Schema Management:** Drizzle ORM with shared schema (`shared/schema.ts`) and custom migration runner with transactional integrity and advisory lock concurrency control.

**Core Data Models:**
- `agents`: User accounts, binary tree structure (`sponsorId`, `placementId`, `leg`).
- `deals`: Funded MCA loans, GBR tracking.
- `commissions`: Detailed earnings with various types, linked to subscriptions.
- `subscriptions`: Merchant subscription details (tier, amount, decay, Stripe integration).
- `holdbacks`: Deferred commission tracking (70% released at funding, 30% deferred).
- `fulfillment_tiers`: Agent performance levels.
- `payouts`: Payout batch management.
- `leads`: Lead management and distribution.
- `lead_requests`: Agent lead requests.
- `course_modules`/`course_progress`: Training system.
- `notifications`, `announcements`, `resources`, `admin_export_templates`.

#### Testing
- **Framework:** Vitest for server-side testing, verifying migration robustness and idempotent behavior.

### Commission Engine & Business Logic
- **Commission Engine:** 2026 producer model (MCA Opening Agent Pool 32.5% with agency producer/override splits; subscription pools on the commissionable basis by distributor tier with decay) plus MCA and subscription performance accelerators, tiered lifetime residuals, binary bonuses, membership waivers, and fulfillment tier rate determination. Legacy records retain the GBR waterfall (MAC/TFC/PICF/RSR).
- **Holdback & Clawback:** 70% commission released at funding, 30% deferred for 60-90 days, with a clawback schedule for early deal fall-offs.
- **Subscription Tiers:** Four tiers (Starter $149, Growth Foundation $497, Revenue Growth System $997, Revenue Scale AI $1,497/mo), powered by Marketing Titan AI + Lead Titan AI, with commission pools on the commissionable basis (premium products up to 55%, up to 60% with accelerators) and decay schedules, plus tiered lifetime residuals (GF 10%, RGS/Scale 15%, Starter none).
- **Platform Fee:** $99/month, with reductions and waivers based on agent revenue.
## External Dependencies

- **Stripe Billing:** Payment processing for merchant subscriptions. Utilizes `stripe` npm package for direct webhook handling (`invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`), and `@stripe/stripe-js` / `@stripe/react-stripe-js` for frontend elements. Environment variables: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_TIER_1`, `STRIPE_PRICE_TIER_2`, `STRIPE_PRICE_TIER_3`, `STRIPE_PRICE_TIER_4`.
- **PostgreSQL:** Primary database, connected via `DATABASE_URL`.
- **Drizzle ORM:** Type-safe database queries and schema management.
- **Passport.js:** Authentication middleware.
- **express-session & connect-pg-simple:** Session management and storage via PostgreSQL.
- **TanStack React Query:** Frontend server state management.
- **React Hook Form + Zod:** Form handling and validation.
- **Framer Motion:** UI animations.
- **Recharts:** Data visualization.
- **date-fns:** Date utility library.
- **Radix UI, Tailwind CSS, class-variance-authority, Lucide React:** UI framework, styling, and icons.
- **Vite & esbuild:** Frontend and backend bundling.
- **TypeScript:** Language for full-stack type safety.
- **Vitest:** Testing framework.
