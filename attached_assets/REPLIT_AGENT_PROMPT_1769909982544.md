# Capital Partners — MLM Platform for MCA Lending

Build a full-stack network marketing platform with binary tree structure and multi-tier commission engine.

## What We're Building

A web app where:
1. Agents sign up via referral link and get placed in a binary tree
2. Agents log deals (funded merchant cash advance loans)
3. System calculates 4 types of commissions automatically
4. Agents see their earnings, team, and genealogy
5. Admin can manage agents, run commission calculations, and process payouts

## Tech Stack

- Next.js 14 with App Router
- PostgreSQL database
- NextAuth.js for authentication
- Tailwind CSS + shadcn/ui for styling
- Prisma ORM

## Database Schema

Create these models in Prisma:

```prisma
model Agent {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  firstName     String
  lastName      String
  phone         String?
  
  // Tree structure (binary)
  sponsorId     String?
  sponsor       Agent?    @relation("Sponsorship", fields: [sponsorId], references: [id])
  sponsored     Agent[]   @relation("Sponsorship")
  
  placementId   String?
  placement     Agent?    @relation("Placement", fields: [placementId], references: [id])
  placedUnder   Agent[]   @relation("Placement")
  
  leg           String?   // "left" or "right"
  leftChildId   String?   @unique
  leftChild     Agent?    @relation("LeftChild", fields: [leftChildId], references: [id])
  leftParent    Agent?    @relation("LeftChild")
  
  rightChildId  String?   @unique
  rightChild    Agent?    @relation("RightChild", fields: [rightChildId], references: [id])
  rightParent   Agent?    @relation("RightChild")
  
  // Status
  currentRank   String    @default("agent") // agent, builder, leader, director, partner
  status        String    @default("active")
  
  // Payment
  payoutEmail   String?
  stripeAccountId String?
  
  // Timestamps
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  // Relations
  deals         Deal[]
  courseSales   CourseSale[]
  commissions   Commission[]
  payouts       Payout[]
  
  isAdmin       Boolean   @default(false)
}

model Deal {
  id              String    @id @default(cuid())
  agentId         String
  agent           Agent     @relation(fields: [agentId], references: [id])
  
  loanAmount      Decimal
  companyRevenue  Decimal   // 10% of loan
  merchantName    String?
  status          String    @default("funded")
  fundedAt        DateTime  @default(now())
  
  createdAt       DateTime  @default(now())
  
  commissions     Commission[]
}

model CourseSale {
  id                String    @id @default(cuid())
  sellerId          String
  seller            Agent     @relation(fields: [sellerId], references: [id])
  
  buyerEmail        String
  courseType        String    // starter, pro, elite
  price             Decimal
  sellerCommission  Decimal
  sponsorOverride   Decimal?
  
  createdAt         DateTime  @default(now())
}

model Commission {
  id              String    @id @default(cuid())
  agentId         String
  agent           Agent     @relation(fields: [agentId], references: [id])
  
  commissionType  String    // personal_deal, binary_bonus, generation_override, course_sale
  amount          Decimal
  
  dealId          String?
  deal            Deal?     @relation(fields: [dealId], references: [id])
  
  periodWeek      DateTime
  status          String    @default("pending") // pending, approved, paid
  
  createdAt       DateTime  @default(now())
  paidAt          DateTime?
}

model Payout {
  id              String    @id @default(cuid())
  agentId         String
  agent           Agent     @relation(fields: [agentId], references: [id])
  
  amount          Decimal
  status          String    @default("pending")
  stripeTransferId String?
  
  createdAt       DateTime  @default(now())
  processedAt     DateTime?
}
```

## Commission Configuration

```typescript
// lib/commission-config.ts
export const CONFIG = {
  ranks: ['agent', 'builder', 'leader', 'director', 'partner'],
  
  personalCommission: {
    agent: 0.40,
    builder: 0.45,
    leader: 0.50,
    director: 0.55,
    partner: 0.60
  },
  
  binaryBonus: {
    builder: { rate: 0.05, weeklyMax: 2500 },
    leader: { rate: 0.06, weeklyMax: 5000 },
    director: { rate: 0.07, weeklyMax: 10000 },
    partner: { rate: 0.08, weeklyMax: 25000 }
  },
  
  generationOverride: {
    leader: { 1: 0.10 },
    director: { 1: 0.15, 2: 0.10 },
    partner: { 1: 0.20, 2: 0.15, 3: 0.10, 4: 0.05 }
  },
  
  courseCommission: {
    seller: 0.80,
    sponsor: 0.10
  },
  
  coursePrices: {
    starter: 997,
    pro: 1997,
    elite: 2997
  }
};
```

## Core Features to Build

### 1. Authentication
- Sign up with referral link (`/signup?ref=AGENT_ID`)
- Login/logout
- Protected routes
- Admin vs agent roles

### 2. Agent Signup Flow
- Capture sponsor from URL
- Registration form (email, password, name, phone)
- Show binary tree placement options (left/right under sponsor or auto)
- Create agent record with proper tree placement

### 3. Agent Dashboard (`/dashboard`)
- Welcome with rank badge
- Stats cards: This week earnings, This month, All-time, Team size
- Recent activity feed
- Quick action buttons

### 4. Team/Genealogy Page (`/team`)
- Binary tree visualization (can use a simple nested list or find a tree component)
- Show left and right legs
- Each agent shows: name, rank, status
- Left/right leg volume totals

### 5. Earnings Page (`/earnings`)
- Table of all commissions (type, amount, date, status)
- Filter by type and date range
- Summary totals by type
- Pending vs Paid breakdown

### 6. Add Deal Form (`/deals/new`)
- Form: merchant name, loan amount, funded date
- Auto-calculate company revenue (10% of loan)
- On submit:
  - Create deal
  - Calculate personal commission based on agent's rank
  - Create commission record
  - Calculate and create generation overrides for upline

### 7. Admin Dashboard (`/admin`)
- Total agents, deals, commissions stats
- Run weekly commission calculation button
- View all pending commissions
- Approve commissions button

### 8. Admin Agent Management (`/admin/agents`)
- List all agents with search
- View/edit agent details
- Change rank manually

## Commission Calculation Logic

### Personal Commission (on deal creation)
```typescript
async function calculatePersonalCommission(deal: Deal) {
  const agent = await prisma.agent.findUnique({ where: { id: deal.agentId }});
  const rate = CONFIG.personalCommission[agent.currentRank];
  const amount = Number(deal.companyRevenue) * rate;
  
  await prisma.commission.create({
    data: {
      agentId: deal.agentId,
      commissionType: 'personal_deal',
      amount,
      dealId: deal.id,
      periodWeek: getWeekStart(new Date()),
      status: 'pending'
    }
  });
  
  // Also calculate generation overrides
  await calculateGenerationOverrides(deal, amount);
}
```

### Generation Override (walk up sponsor tree)
```typescript
async function calculateGenerationOverrides(deal: Deal, closerCommission: number) {
  let currentId = deal.agentId;
  let generation = 0;
  
  while (generation < 4) {
    const current = await prisma.agent.findUnique({ 
      where: { id: currentId },
      include: { sponsor: true }
    });
    
    if (!current?.sponsor) break;
    
    const sponsor = current.sponsor;
    
    // Check if sponsor qualifies as a generation (Leader+)
    if (['leader', 'director', 'partner'].includes(sponsor.currentRank)) {
      generation++;
      
      const overrideRates = CONFIG.generationOverride[sponsor.currentRank];
      const rate = overrideRates?.[generation];
      
      if (rate) {
        await prisma.commission.create({
          data: {
            agentId: sponsor.id,
            commissionType: 'generation_override',
            amount: closerCommission * rate,
            dealId: deal.id,
            periodWeek: getWeekStart(new Date()),
            status: 'pending'
          }
        });
      }
    }
    
    currentId = sponsor.id;
  }
}
```

### Binary Bonus (weekly calculation)
```typescript
async function calculateBinaryBonuses() {
  const weekStart = getWeekStart(new Date());
  const agents = await prisma.agent.findMany({
    where: { 
      currentRank: { in: ['builder', 'leader', 'director', 'partner'] },
      status: 'active'
    }
  });
  
  for (const agent of agents) {
    const leftVolume = await getLegVolume(agent.id, 'left', weekStart);
    const rightVolume = await getLegVolume(agent.id, 'right', weekStart);
    
    const weakerLeg = Math.min(leftVolume, rightVolume);
    const config = CONFIG.binaryBonus[agent.currentRank];
    
    if (config && weakerLeg > 0) {
      let bonus = weakerLeg * config.rate;
      bonus = Math.min(bonus, config.weeklyMax);
      
      await prisma.commission.create({
        data: {
          agentId: agent.id,
          commissionType: 'binary_bonus',
          amount: bonus,
          periodWeek: weekStart,
          status: 'pending'
        }
      });
    }
  }
}

async function getLegVolume(agentId: string, leg: 'left' | 'right', weekStart: Date): Promise<number> {
  const agent = await prisma.agent.findUnique({ where: { id: agentId }});
  const childId = leg === 'left' ? agent?.leftChildId : agent?.rightChildId;
  
  if (!childId) return 0;
  
  // Get child's personal volume this week
  const deals = await prisma.deal.findMany({
    where: {
      agentId: childId,
      fundedAt: { gte: weekStart }
    }
  });
  const personalVolume = deals.reduce((sum, d) => sum + Number(d.companyRevenue), 0);
  
  // Recursively get child's legs
  const leftSub = await getLegVolume(childId, 'left', weekStart);
  const rightSub = await getLegVolume(childId, 'right', weekStart);
  
  return personalVolume + leftSub + rightSub;
}
```

## Pages Structure

```
/app
  /(auth)
    /login/page.tsx
    /signup/page.tsx
  /(agent)
    /dashboard/page.tsx
    /team/page.tsx
    /earnings/page.tsx
    /deals/page.tsx
    /deals/new/page.tsx
    /settings/page.tsx
  /(admin)
    /admin/page.tsx
    /admin/agents/page.tsx
    /admin/commissions/page.tsx
  /api
    /auth/[...nextauth]/route.ts
    /agents/route.ts
    /deals/route.ts
    /commissions/route.ts
    /admin/run-binary/route.ts
```

## UI Components Needed

Use shadcn/ui components:
- Card (for stats)
- Table (for data lists)
- Form, Input, Button (for forms)
- Badge (for rank display)
- Tabs (for page sections)
- Sidebar navigation

## Start Here

1. Set up Next.js with TypeScript
2. Install and configure Prisma with PostgreSQL
3. Create the database schema
4. Set up NextAuth.js with credentials provider
5. Build the signup flow with binary tree placement
6. Build the agent dashboard
7. Build the add deal form with commission calculation
8. Build the earnings view
9. Build the admin panel

Let me know if you need clarification on any part!
