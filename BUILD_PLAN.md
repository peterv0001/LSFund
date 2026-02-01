# MCA Back Office — Exigo-Grade Build Plan

## Current State ✅
- Auth (register, login, sessions, referral codes)
- Dashboard with stats
- Deals page with create dialog
- Basic earnings/commissions page
- Team page with tree visualization
- Commission engine (personal deal, generation override, binary bonus)
- Binary tree placement logic

---

## Phase 1: Schema & Infrastructure Expansion

### New Tables Needed
- [ ] `payouts` — Track payout batches and individual disbursements
- [ ] `notifications` — System notifications for agents
- [ ] `announcements` — Company-wide announcements
- [ ] `resources` — Training materials and documents
- [ ] `rank_qualifications` — Track qualification status per period
- [ ] `activity_log` — Audit trail for admin actions

### Schema Enhancements
- [ ] Add `referralCode` field to agents (unique, human-readable)
- [ ] Add `address`, `city`, `state`, `zip`, `country` to agents
- [ ] Add `profileImageUrl`, `bio` to agents
- [ ] Add `totalPersonalVolume`, `totalTeamVolume` to agents (denormalized for speed)
- [ ] Add `qualifiedRank` vs `paidAsRank` distinction

---

## Phase 2: Agent Portal Features

### Profile & Settings Page (`/settings`)
- [ ] Personal info editing
- [ ] Password change
- [ ] Payout method setup (bank/PayPal/Stripe Connect)
- [ ] Notification preferences
- [ ] Referral code display + link generator

### Rank Advancement Page (`/rank`)
- [ ] Current rank display with badge
- [ ] Requirements for next rank (PV, TV, legs)
- [ ] Progress bars for each requirement
- [ ] Rank history timeline

### Reports Page (`/reports`)
- [ ] Personal Volume by period
- [ ] Team Volume breakdown (left/right)
- [ ] Commission breakdown by type
- [ ] Downloadable CSV exports

### Leaderboards (`/leaderboards`)
- [ ] Top earners this week/month
- [ ] Top recruiters
- [ ] Rank advancement celebrations
- [ ] Company-wide stats

### Resources Page (`/resources`)
- [ ] Training videos
- [ ] PDF downloads
- [ ] Compliance materials
- [ ] Marketing assets

### Notifications System
- [ ] Bell icon with badge
- [ ] Notification dropdown
- [ ] Mark as read
- [ ] Types: deal funded, commission earned, rank up, team activity

---

## Phase 3: Admin Portal

### Admin Dashboard (`/admin`)
- [ ] Total agents, active vs inactive
- [ ] Total deals, volume this period
- [ ] Total commissions, pending payouts
- [ ] New signups chart
- [ ] Quick actions

### Agent Management (`/admin/agents`)
- [ ] Searchable/filterable agent list
- [ ] View agent details modal
- [ ] Edit agent (rank, status, info)
- [ ] Suspend/activate agent
- [ ] Login as agent (impersonation)
- [ ] View agent's genealogy

### Deal Management (`/admin/deals`)
- [ ] All deals list with filters
- [ ] Approve/reject pending deals
- [ ] Edit deal details
- [ ] Manual deal creation (on behalf of agent)

### Commission Management (`/admin/commissions`)
- [ ] View all pending commissions
- [ ] Bulk approve commissions
- [ ] Adjust/void commissions
- [ ] Commission audit log

### Payout Processing (`/admin/payouts`)
- [ ] Create payout batch
- [ ] Select date range
- [ ] Review totals per agent
- [ ] Process payouts (Stripe/manual)
- [ ] Mark as paid
- [ ] Payout history

### Announcements (`/admin/announcements`)
- [ ] Create/edit announcements
- [ ] Schedule publish date
- [ ] Target audience (all, rank-based)
- [ ] Pin important announcements

### System Settings (`/admin/settings`)
- [ ] Commission rate configuration
- [ ] Rank requirements editor
- [ ] Binary bonus caps
- [ ] Company info

---

## Phase 4: Enhanced Features

### Placement Tool
- [ ] Visual tree with drag-drop placement
- [ ] "Place new recruit" modal
- [ ] Suggested placement (weak leg)

### Genealogy Enhancements
- [ ] Deep tree visualization (horizontal)
- [ ] Search within tree
- [ ] Filter by rank, status
- [ ] Volume breakdown per node
- [ ] Expand/collapse branches

### Mobile Responsiveness
- [ ] Collapsible sidebar on mobile
- [ ] Touch-friendly tables
- [ ] Mobile-optimized tree view

### Email Notifications
- [ ] Welcome email on signup
- [ ] Deal funded notification
- [ ] Commission earned notification
- [ ] Weekly summary email
- [ ] Rank advancement celebration

---

## Tech Notes

### Stack
- Frontend: React + Vite + TypeScript + shadcn/ui + Tailwind
- Backend: Express + Drizzle ORM + PostgreSQL
- Auth: Passport.js with sessions

### Key Patterns
- `api` object in `shared/routes.ts` for type-safe API calls
- Zod schemas for validation
- React Query for data fetching
- Wouter for routing

---

## Build Order

1. **Schema expansion** — New tables + agent fields
2. **Admin auth** — Admin-only routes and middleware
3. **Admin dashboard** — Stats and overview
4. **Admin agent management** — CRUD + search
5. **Admin payouts** — Batch processing
6. **Agent settings** — Profile + payout setup
7. **Agent rank page** — Progress tracking
8. **Notifications** — System + UI
9. **Reports** — Volume and commission breakdowns
10. **Leaderboards** — Gamification
11. **Resources** — Training center
12. **Mobile polish** — Responsive design
