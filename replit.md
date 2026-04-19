# Leadershield Network - Agent Portal

## Overview
Leadershield Network is a full-stack network marketing (MLM) platform for Merchant Cash Advance (MCA) lending and recurring subscription products (Merchant Growth Platform). It enables agents to sign up, log deals, manage subscriptions, and earn multi-tiered commissions based on GBR waterfall and subscription decay. The platform includes an agent portal, an admin portal, and a public marketing website for recruitment.

Leadershield Network is a full-stack network marketing (MLM) platform for Merchant Cash Advance (MCA) lending and Merchant Growth Platform (subscription products). Its primary purpose is to enable agents to manage their sales, track commissions, and recruit new agents. The platform features an agent portal, an admin portal, and a public marketing website for recruitment.

**Core Capabilities:**
- Agent recruitment via referral links and binary tree placement.
- Tracking of funded MCA deals and merchant subscriptions.
- Multi-tiered commission system based on GBR waterfall for MCA and a decay structure for subscriptions.
- Holdback/clawback mechanisms for risk management.
- Rank advancement and platform fee management with waivers.
- Lead distribution system with AI follow-up.
- Quarterly Performance Accelerators and renewal commissions.

**Branding:**
- **Domain:** leadershield.com
- **Color Palette:** Deep navy (#002147) and platinum (#E5E4E2)
- **Fonts:** Montserrat (headings) and Open Sans (body)

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework:** React 18 with TypeScript, Vite
- **Routing:** Wouter
- **State Management:** TanStack React Query
- **UI Components:** shadcn/ui (Radix UI primitives)
- **Styling:** Tailwind CSS with custom design tokens (deep navy + gold)
- **Fonts:** Cinzel (display) and Manrope (body)
- **Logo:** ShieldCheck icon (lucide-react) with gold gradient

**Key Design Decisions:**
- Component library uses New York style shadcn/ui.
- Path aliases (`@/` for client/src, `@shared/` for shared code) for organization.
- Protected routes enforce authentication.
- Public landing page features immersive dark hero, social proof, "How It Works" section, two revenue streams, Merchant Growth Platform tiers, income scenarios, compensation plan details, testimonials, platform tools, 30-day roadmap, compliance information, FAQs, and a final CTA.
- Comprehensive legal and compliance pages for Income Disclosure, Terms of Service, Privacy Policy, and Refund Policy.
- Authentication page includes immersive design, login/registration forms, sponsor search, placement preference, and a forgot password flow.
- Training page (Leadershield Academy) offers a 6-module video course with progress tracking, sales playbooks, and a "Your First 30 Days" checklist.

### Backend
- **Runtime:** Node.js with Express 5
- **Language:** TypeScript (ESM modules)
- **API Design:** RESTful endpoints with Zod schema validation
- **Authentication:** Passport.js with local strategy, session-based via PostgreSQL

**Key Design Decisions:**
- Session storage uses `connect-pg-simple` for PostgreSQL-backed sessions.
- Password hashing uses native `scrypt`.
- API routes defined in `shared/routes.ts` with Zod for type safety.

### Data Storage
- **Database:** PostgreSQL with Drizzle ORM
- **Schema Location:** `shared/schema.ts`
- **Migrations:** Custom migration runner with transactional integrity and concurrency control.

**Core Data Models:**
- `agents`: User accounts, binary tree structure.
- `deals`: Funded MCA loans, GBR tracking.
- `commissions`: Detailed earnings with various types, linked to subscriptions.
- `subscriptions`: Merchant subscription details (tier, amount, decay, Stripe integration).
- `holdbacks`: Deferred commission tracking.
- `fulfillment_tiers`: Agent performance levels.
- `payouts`: Payout batch management.
- `leads`: Lead management and distribution.
- `course_modules`/`course_progress`: Training system.
- `notifications`, `announcements`, `resources`, `admin_export_templates`.

### Commission Engine
- Implements GBR waterfall, MAC sponsor overrides, subscription commission decay, MCA pairing enhancement, binary bonuses, and platform fee waivers.

## External Dependencies

- **Stripe:** Payment processing for merchant subscriptions. Utilizes `stripe` npm package, `stripe-replit-sync` for webhook event mirroring, and `@stripe/stripe-js` for frontend elements.
- **PostgreSQL:** Primary database for all application data.
- **Drizzle ORM:** Used for type-safe database interactions.
- **Passport.js:** Authentication middleware.
- **express-session & connect-pg-simple:** Session management and storage.
- **TanStack React Query:** Frontend server state management.
- **React Hook Form + Zod:** Form handling and validation.
- **Framer Motion:** UI animations.
- **Recharts:** Data visualization.
- **date-fns:** Date utility library.
- **Radix UI:** Core accessible UI primitives.
- **Tailwind CSS:** Utility-first styling framework.
- **Lucide React:** Icon library.
- **Vite & esbuild:** Frontend and backend bundling.
- **TypeScript:** Language for full-stack type safety.
- **Vitest:** Testing framework.
