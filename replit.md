# PSL Capital - MCA Back Office Platform

## Overview

PSL Capital is a full-stack network marketing (MLM) platform designed for Merchant Cash Advance (MCA) lending operations. The system enables agents to sign up via referral links, log funded deals, and receive multi-tier commissions through a binary tree structure. The platform includes both an agent portal for managing personal business, an admin portal for company-wide operations, and a public marketing website for agent recruitment.

**Core Business Logic:**
- Binary tree placement for agent hierarchy
- Four commission types: personal deal, generation override, binary bonus, and course sales
- Rank advancement system (Agent → Builder → Leader → Director → Partner)
- Weekly payout cycles with volume tracking

## User Preferences

Preferred communication style: Simple, everyday language.

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
- `deals` - Funded MCA loans with merchant info and amounts
- `commissions` - Calculated earnings per agent per deal
- `payouts` - Payout batch tracking
- `notifications` - System notifications for agents
- `announcements` - Company-wide messages
- `resources` - Training materials and documents

**Binary Tree Structure:**
- Each agent has `sponsorId` (who recruited them) and `placementId` (position in binary tree)
- `leg` field indicates left or right placement under parent
- Volume tracking for left/right legs enables binary bonus calculations

### Commission Engine
Located in `server/routes.ts`, implements:
- Personal commission rates by rank (40-60%)
- Binary bonus with rank-based caps
- Generation override for upline sponsors
- Volume accumulation for rank qualification

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