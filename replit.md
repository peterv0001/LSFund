# Leadershield Network - Agent Portal

## Overview

Leadershield Network is a full-stack network marketing (MLM) platform designed for Merchant Cash Advance (MCA) lending operations and the Merchant Growth Platform (recurring subscription products). The system enables agents to sign up via referral links, log funded deals, manage merchant subscriptions, and receive multi-tiered commissions through a GBR waterfall and subscription decay structure. The platform includes an agent portal, an admin portal, and a public marketing website for agent recruitment.

**Brand:** Leadershield Network (formerly PSL Capital)
**Domain:** leadershield.com
**Color Palette:** Deep navy (#002147 / HSL 212 100% 14%) primary + platinum (#E5E4E2 / HSL 40 6% 89%) secondary
**Fonts:** Montserrat (display/headings) + Open Sans (body)
**Logo:** `/client/public/logo.png` — used with `brightness-0 invert` filter on dark backgrounds

**Core Business Logic:**
- Binary tree placement for agent hierarchy
- GBR (Gross Brokerage Revenue) waterfall for MCA commissions
- Merchant Growth Platform subscription commission engine with decay schedule
- Holdback/clawback system for risk management
- Fulfillment agent tiering for transaction completion
- Rank advancement system (Agent → Builder → Leader → Director → Partner)
- Platform fee management with production-based waivers
- Lead distribution system with AI follow-up queue
- Quarterly Performance Accelerators (up to 3% bonus)
- Renewal commissions (15% MAC for renewed deals)

## User Preferences

Preferred communication style: Simple, everyday language.

## Products

### Merchant Growth Platform (Subscription Tiers)
- **Tier 1: Merchant Essentials ($199/mo)**: Financial reporting dashboards, 30-day forecasting, AI expense categorization, credit monitoring & fraud alerts
- **Tier 2: Growth Accelerator ($429/mo)**: Google Business optimization, automated review capture, SMS/email marketing automation, CRM & AI chatbot
- **Tier 3: Elite AI Revenue System ($749/mo)**: AI-driven lead generation, appointment booking automation, advanced conversion funnels, competitive ad intelligence

### Merchant Cash Advance (MCA)
Traditional capital access providing immediate cash flow commissions, with pairing enhancement when bundled with subscription products.

## Commission Architecture

### MCA Commission (GBR Waterfall)
When a deal is funded, GBR is allocated:
- **MAC (Merchant Acquisition Compensation)**: 30% of GBR
  - Primary Referring Agent: 22% of GBR
  - Senior Referral Sponsor (L1): 5% of GBR
  - Executive Referral Sponsor (L2): 3% of GBR
- **TFC (Transaction Fulfillment Compensation)**: 30-40% of GBR (based on fulfillment tier)
- **PICF (Platform Infrastructure & Compliance Fee)**: 25-35% retained
- **RSR (Risk Stabilization Reserve)**: 5% reserved

### Holdback & Clawback
- 70% of commission released at funding
- 30% deferred for 60-90 days
- Clawback: 0-30 days = 100%, 31-90 days = 50%, after 90 days = none

### Fulfillment Tiers (TFC Rate)
- Tier 1: 30% | Tier 2: 33% | Tier 3: 36% | Tier 4: 40%

### Quarterly Performance Accelerators
- $250K+ funded volume: 0.5% bonus
- $500K+ funded volume: 1.0% bonus
- $1M+ funded volume: 2.0% bonus
- $2M+ funded volume: 3.0% bonus

### Renewal Commissions
- MAC for renewals: 15% of GBR (11% primary, 2.5% senior, 1.5% executive)

### Subscription Commission (Merchant Growth Platform)
Three subscription tiers: Merchant Essentials ($199/mo), Growth Accelerator ($429/mo), Elite AI ($749/mo)
- Commission pools: Tier 1 = 50%, Tier 2 = 60%, Tier 3 = 70%
- Decay schedule: Months 1-3: 100%, 4-6: 75%, 7-9: 50%, 10-12: 25%, Post-12: 10% residual
- MCA pairing bonus: +5% during months 1-3 if paired with funded MCA
- Residual requires: $3,000 collected revenue OR 1 funded MCA + 1 new subscription/month

### Platform Fee ($99/month per agent)
- Level 1 ($3,000+ revenue): 50% reduction
- Level 2 ($5,000+ revenue): 100% waiver
- Level 3 ($8,500+ revenue): 100% waiver + $100 credit

### Binary Bonus
- Builder: 5% (max $2,500) | Leader: 6% (max $5,000) | Director: 7% (max $10,000) | Partner: 8% (max $25,000)

## Agent Roles
- **Primary Referring Agent (Opener)**: Sources and qualifies merchant leads, collects documentation, submits files
- **Fulfillment Agent (Closer)**: Coordinates underwriting/approval, manages merchant-funder communication, drives to funding
- **Sponsor (Senior & Executive)**: Provides coaching/training, drives team performance, ensures compliance

## System Architecture

### Frontend Architecture
- **Framework:** React 18 with TypeScript, built with Vite
- **Routing:** Wouter (lightweight client-side routing)
- **State Management:** TanStack React Query for server state
- **UI Components:** shadcn/ui (Radix UI primitives) with Tailwind CSS
- **Styling:** Tailwind CSS with custom design tokens (deep navy + gold color palette)
- **Fonts:** Cinzel (display) and Manrope (body) from Google Fonts
- **Logo:** ShieldCheck icon (lucide-react) with gold gradient background

**Key Design Decisions:**
- Component library uses New York style shadcn/ui for polished, professional look
- Path aliases configured: `@/` for client/src, `@shared/` for shared code
- Protected routes wrap components with auth checks before rendering

### Landing Page Structure (ACN/Family First Life-style Marketing)
The public marketing landing page (`client/src/pages/landing.tsx`) includes:
- **Immersive dark hero** with animated gradient blobs, "Build Your Financial Legacy" messaging, Framer Motion entrance animations
- **Social proof stats bar** with animated CountUp counters ($200B+ industry, 30M+ businesses, 70% max pool, 48hr funding)
- **"How It Works" 3-step section** (Join & Learn, Sell & Earn, Build & Scale) with gradient accent cards
- **Two Revenue Streams** dark section with glass-morphism cards (MCA immediate + Platform recurring)
- **Merchant Growth Platform tiers** with "Most Popular" badge, color-coded tier cards, feature lists
- **Income lifestyle scenarios** (Part-Time, Full-Time, Team Builder) with monthly projection table
- **Compensation plan** dark section with 4 earning streams + payout mechanics + quarterly accelerators
- **Testimonials section** with agent success stories and avatars
- **Platform & tools section** with CRM, Academy, Compliance, Support cards + platform fee waivers
- **Your First 30 Days roadmap** with connected timeline dots and week-by-week cards
- **Compliance section** (centralized pricing, disclosures, clear comp, regulatory)
- **FAQ accordion** with Framer Motion expand/collapse
- **Final CTA** dark section with gradient text and urgency messaging
- **FTC-compliant legal disclaimers** (FTC Income Disclosure, Independent Contractor, No Guaranteed Income, Business Opportunity, Commission Structure, Testimonial, Anti-Pyramid Scheme, Material Connection, State-Specific Business Opportunity) with cross-reference links to all legal pages
- **Legal footer** with links to Income Disclosure, Terms of Service, Privacy Policy, and Refund Policy
- Uses `AnimatedSection` (Framer Motion scroll-triggered), `CountUp` (animated stat counter), `FAQItem` (accordion)
- Scroll-aware navigation bar with transparency-to-solid transition

### Legal/Compliance Pages
- **Income Disclosure Statement** (`/income-disclosure`): Comprehensive FTC-compliant income disclosure with earnings by rank table, median/average figures, material assumptions, anti-pyramid statement
- **Terms of Service** (`/terms`): Full terms covering independent contractor status, commission terms, clawback policies, dispute resolution, arbitration, limitation of liability
- **Privacy Policy** (`/privacy`): Data collection, usage, sharing, retention, cookies, user rights, COPPA, CCPA/CPRA compliance
- **Refund Policy** (`/refund-policy`): Subscription cancellation, 14-day cooling-off period, refund eligibility, clawback impact on agent commissions

### Auth Page
- **Left panel**: Immersive dark gradient matching landing hero, animated shield logo, 4 earning bullet points, stats bar
- **Right panel**: Login/register forms with gold gradient CTAs, sponsor search, placement preference
- **Legal consent checkbox**: Required checkbox linking to Terms, Privacy, and Income Disclosure before account creation
- **Forgot password flow**: Login form links to `/forgot-password` page, which sends a reset email via Resend. Reset link goes to `/reset-password?token=...` page where user sets a new password. Tokens expire after 1 hour.
- Mobile-responsive with branding header on small screens

### Training Page (Leadershield Academy)
The training page (`client/src/pages/training.tsx`) includes:
- 6-module video course with progress tracking
- Sales playbook with consultative approach (Discovery, Presentation, Objections, Closing)
- Merchant Growth Platform sales section
- MCA pairing enhancement selling points
- Subscription tier quick reference
- Your First 30 Days checklist
- Agent role descriptions

### Backend Architecture
- **Runtime:** Node.js with Express 5
- **Language:** TypeScript (ESM modules)
- **API Design:** RESTful endpoints with Zod schema validation
- **Authentication:** Passport.js with local strategy, session-based auth stored in PostgreSQL

**Key Design Decisions:**
- Session storage uses `connect-pg-simple` for PostgreSQL-backed sessions
- Password hashing uses Node's native `scrypt` with random salt
- API routes defined in `shared/routes.ts` with full type safety via Zod schemas
- Build process bundles server dependencies to reduce cold start times

### Data Storage
- **Database:** PostgreSQL with Drizzle ORM
- **Schema Location:** `shared/schema.ts` (shared between client/server)
- **Migrations:** Drizzle Kit with `db:push` command

**Core Tables:**
- `agents` - User accounts with binary tree structure (sponsorId, placementId, leg)
- `deals` - Funded MCA loans with GBR tracking and fulfillment agent assignment
- `commissions` - Earnings with types: mac_primary, mac_sponsor_l1, mac_sponsor_l2, tfc, subscription_commission, subscription_residual, binary_bonus, personal_deal
- `subscriptions` - Merchant subscription tracking (tier, monthly amount, MCA pairing, decay)
- `holdbacks` - Deferred commission tracking with release dates and clawback management
- `fulfillment_tiers` - Monthly fulfillment agent performance tiers
- `payouts` - Payout batch tracking
- `leads` - Lead management with assignment and AI follow-up
- `lead_requests` - Agent lead requests
- `notifications` - System notifications for agents
- `announcements` - Company-wide messages
- `resources` - Training materials and documents
- `course_modules` / `course_progress` - Training module system

**Binary Tree Structure:**
- Each agent has `sponsorId` (who recruited them) and `placementId` (position in binary tree)
- `leg` field indicates left or right placement under parent
- Volume tracking for left/right legs enables binary bonus calculations

### Commission Engine
Located in `server/routes.ts`, implements:
- GBR waterfall allocation (MAC/TFC/PICF/RSR) with 70/30 holdback
- MAC sponsor overrides with compression (unqualified sponsors skipped)
- Subscription commission decay over 12 months
- MCA pairing enhancement (+5% months 1-3)
- Binary bonus with rank-based caps
- Platform fee waiver calculations
- Fulfillment tier rate determination

## External Dependencies

### Database & Storage
- **PostgreSQL:** Primary database (connection via `DATABASE_URL` env var)
- **Drizzle ORM:** Type-safe database queries and schema management

### Authentication
- **Passport.js:** Authentication middleware with local strategy
- **express-session:** Session management
- **connect-pg-simple:** PostgreSQL session store

### Frontend Libraries
- **TanStack React Query:** Server state management and caching
- **React Hook Form + Zod:** Form handling with validation
- **Framer Motion:** Page transitions and animations
- **Recharts:** Data visualization for commission stats
- **date-fns:** Date formatting utilities

### UI Framework
- **Radix UI:** Accessible component primitives (dialogs, dropdowns, tabs, etc.)
- **Tailwind CSS:** Utility-first styling
- **class-variance-authority:** Component variant management
- **Lucide React:** Icon library

### Build Tools
- **Vite:** Frontend bundler with HMR
- **esbuild:** Server bundling for production
- **TypeScript:** Full type safety across stack
