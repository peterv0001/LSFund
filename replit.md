# PSL Capital - MCA Back Office Platform

## Overview

PSL Capital is a full-stack network marketing (MLM) platform designed for Merchant Cash Advance (MCA) lending operations and recurring subscription products. The system enables agents to sign up via referral links, log funded deals, manage merchant subscriptions, and receive multi-tiered commissions through a GBR waterfall and subscription decay structure. The platform includes an agent portal, an admin portal, and a public marketing website for agent recruitment.

**Core Business Logic:**
- Binary tree placement for agent hierarchy
- GBR (Gross Brokerage Revenue) waterfall for MCA commissions
- Subscription commission engine with decay schedule
- Holdback/clawback system for risk management
- Fulfillment agent tiering for transaction completion
- Rank advancement system (Agent → Builder → Leader → Director → Partner)
- Platform fee management with production-based waivers
- Lead distribution system with AI follow-up queue

## User Preferences

Preferred communication style: Simple, everyday language.

## Commission Architecture

### MCA Commission (GBR Waterfall)
When a deal is funded, GBR is allocated:
- **MAC (Merchant Acquisition Compensation)**: 30% of GBR
  - Primary Agent: 22% of GBR
  - Senior Sponsor (L1): 5% of GBR
  - Executive Sponsor (L2): 3% of GBR
- **TFC (Transaction Fulfillment Compensation)**: 30-40% of GBR (based on fulfillment tier)
- **PICF (Platform Infrastructure & Compliance Fee)**: 25-35% retained
- **RSR (Risk Stabilization Reserve)**: 5% reserved

### Holdback & Clawback
- 70% of commission released at funding
- 30% deferred for 75 days
- Clawback: 0-30 days = 100%, 31-90 days = 50%, after 90 days = none

### Fulfillment Tiers (TFC Rate)
- Tier 1: 30% | Tier 2: 33% | Tier 3: 36% | Tier 4: 40%

### Subscription Commission
Three subscription tiers: Merchant Essentials ($199/mo), Growth Accelerator ($429/mo), Elite AI ($749/mo)
- Commission pools: Tier 1 = 50%, Tier 2 = 60%, Tier 3 = 70%
- Decay schedule: Months 1-3: 100%, 4-6: 75%, 7-9: 50%, 10-12: 25%, Post-12: 10% residual
- MCA pairing bonus: +5% during months 1-3 if paired with funded MCA

### Platform Fee ($99/month per agent)
- Level 1 ($3,000+ revenue): 50% reduction
- Level 2 ($5,000+ revenue): 100% waiver
- Level 3 ($8,500+ revenue): 100% waiver + $100 credit

### Binary Bonus (unchanged)
- Builder: 5% (max $2,500) | Leader: 6% (max $5,000) | Director: 7% (max $10,000) | Partner: 8% (max $25,000)

## System Architecture

### Frontend Architecture
- **Framework:** React 18 with TypeScript, built with Vite
- **Routing:** Wouter (lightweight client-side routing)
- **State Management:** TanStack React Query for server state
- **UI Components:** shadcn/ui (Radix UI primitives) with Tailwind CSS
- **Styling:** Tailwind CSS with custom design tokens (deep navy + gold color palette)
- **Fonts:** Cinzel (display) and Manrope (body) from Google Fonts

**Key Design Decisions:**
- Component library uses New York style shadcn/ui for polished, professional look
- Path aliases configured: `@/` for client/src, `@shared/` for shared code
- Protected routes wrap components with auth checks before rendering

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
