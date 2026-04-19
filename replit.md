# Leadershield Network - Agent Portal

## Overview
Leadershield Network is a full-stack network marketing (MLM) platform for Merchant Cash Advance (MCA) lending and recurring subscription products (Merchant Growth Platform). It enables agents to sign up, log deals, manage subscriptions, and earn multi-tiered commissions based on GBR waterfall and subscription decay. The platform includes an agent portal, an admin portal, and a public marketing website for recruitment.

Leadershield Network is a full-stack network marketing (MLM) platform for Merchant Cash Advance (MCA) lending and Merchant Growth Platform (subscription products). It enables agents to manage deals, subscriptions, and multi-tiered commissions through a GBR waterfall and subscription decay structure. The platform includes an agent portal, an admin portal, and a public marketing website for recruitment.

**Brand:** Leadershield Network
**Domain:** leadershield.com
**Color Palette:** Deep navy (#002147) and platinum (#E5E4E2)
**Fonts:** Montserrat (headings) and Open Sans (body)
**Logo:** `/client/public/logo.png`

**Core Capabilities:**
- Agent recruitment via referral links and binary tree placement.
- Tracking of funded MCA deals and merchant subscriptions.
- Multi-tiered commission system based on GBR waterfall for MCA and a decay structure for subscriptions.
- Holdback/clawback mechanisms for risk management.
- Fulfillment agent tiering and rank advancement.
- Platform fee management with production-based waivers.
- Lead distribution system with AI follow-up.
- Quarterly Performance Accelerators and renewal commissions.
- Binary tree agent hierarchy
- Fulfillment agent tiering
- Rank advancement system (Agent → Builder → Leader → Director → Partner)
- Platform fee management with production-based waivers

**Branding:**
- **Domain:** leadershield.com
- **Color Palette:** Deep navy (#002147) and platinum (#E5E4E2)
- **Fonts:** Montserrat (headings), Cinzel (display), and Manrope/Open Sans (body)
- **Logo:** ShieldCheck icon (lucide-react) with gold gradient
## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Architecture

#### Frontend Architecture
- **Framework:** React 18 with TypeScript, Vite
- **Routing:** Wouter
- **State Management:** TanStack React Query
- **UI Components:** shadcn/ui (Radix UI primitives)
- **Styling:** Tailwind CSS with custom design tokens (deep navy + gold)
- **Fonts:** Cinzel (display) and Manrope (body)
- **Logo:** ShieldCheck icon (lucide-react) with gold gradient background

**Key Design Decisions:**
- Component library uses New York style shadcn/ui for a polished, professional look.
- Path aliases (`@/` for client/src, `@shared/` for shared code) for organization.
- Protected routes enforce authentication.

#### Backend Architecture
**Key Features:**
- **Public Marketing Landing Page:** Immersive dark hero, social proof, "How It Works" section, two revenue streams (MCA & Platform), subscription tiers, income scenarios, compensation plan, testimonials, platform tools, 30-day roadmap, compliance, FAQ, final CTA, and FTC-compliant legal disclaimers.
- **Legal/Compliance Pages:** Income Disclosure Statement, Terms of Service, Privacy Policy, Refund Policy.
- **Auth Page:** Login/register forms, sponsor search, placement preference, legal consent, forgot password flow.
- **Training Page (Leadershield Academy):** 6-module video course with progress tracking, sales playbook, product selling points, and a 30-day checklist.

### Backend Architecture
- **Runtime:** Node.js with Express 5
- **Language:** TypeScript (ESM modules)
- **API Design:** RESTful endpoints with Zod schema validation
- **Authentication:** Passport.js with local strategy, session-based via PostgreSQL. Password hashing uses native `scrypt`.

**Key Design Decisions:**
- Session storage uses `connect-pg-simple` for PostgreSQL-backed sessions.
- API routes defined in `shared/routes.ts` with type safety via Zod schemas.
- The build process bundles server dependencies for optimized performance and reduced cold start times.
- Password hashing uses Node's native `scrypt`.

#### Data Storage
- **Database:** PostgreSQL with Drizzle ORM
- **Schema Location:** `shared/schema.ts`
- **Migrations:** Custom migration runner with transactional integrity and advisory lock concurrency control ensuring data integrity.

**Core Data Models:**
- `agents`: User accounts, binary tree structure (sponsorId, placementId, leg).
- `deals`: Funded MCA loans, GBR tracking.
- `commissions`: Detailed earnings with various types, linked to subscriptions.
- `subscriptions`: Merchant subscription details (tier, amount, decay, Stripe integration).
- `holdbacks`: Deferred commission tracking.
- `fulfillment_tiers`: Agent performance levels.
- `payouts`: Payout batch management.
- `leads`: Lead management and distribution.
- `lead_requests`: Agent lead requests.
- `course_modules`/`course_progress`: Training system.
- `notifications`, `announcements`, `resources`, `admin_export_templates`.

### Commission Engine & Business Logic
- **Commission Engine:** Implements GBR waterfall (MAC/TFC/PICF/RSR), MAC sponsor overrides with compression, subscription commission decay, MCA pairing enhancement, binary bonuses, platform fee waivers, and fulfillment tier rate determination.
- **Holdback & Clawback:** 70% commission released at funding, 30% deferred for 60-90 days, with a clawback schedule for early deal fall-offs.
- **Subscription Tiers:** Three tiers (Merchant Essentials, Growth Accelerator, Elite AI Revenue System) with defined commission pools and decay schedules.
- **Platform Fee:** $99/month, with reductions and waivers based on agent revenue.

## External Dependencies

### Stripe Billing
- **Stripe:** Payment processing for merchant subscriptions. Utilizes `stripe` npm package, `stripe-replit-sync` for webhook event mirroring (`invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`), and `@stripe/stripe-js` / `@stripe/react-stripe-js` for frontend elements.

### Database & Storage
- **PostgreSQL:** Primary database for all application data.
- **Drizzle ORM:** Used for type-safe database interactions.

### Authentication
- **Passport.js:** Authentication middleware.
- **express-session & connect-pg-simple:** Session management and storage via PostgreSQL.

### Frontend Libraries
- **TanStack React Query:** Frontend server state management.
- **React Hook Form + Zod:** Form handling and validation.
- **Framer Motion:** UI animations.
- **Recharts:** Data visualization.
- **date-fns:** Date utility library.

### UI Framework
- **Radix UI:** Core accessible UI primitives.
- **Tailwind CSS:** Utility-first styling framework.
- **class-variance-authority:** Component variant management.
- **Lucide React:** Icon library.

### Build Tools
- **Vite & esbuild:** Frontend and backend bundling.
- **TypeScript:** Language for full-stack type safety.
- **Vitest:** Testing framework.
