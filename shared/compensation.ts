// ============================================================================
// COMP_V2026 — LeaderShield Compensation Architecture & Economics Manual
// ============================================================================
// Single source of truth for the NEW (2026) compensation model. Lives in
// `shared/` so BOTH the server commission engine and the client-facing UI read
// the exact same numbers — the marketing site and agent portal can never drift
// from the engine because they import these constants directly.
//
// All numbers below come directly from the Manual. They are organized for:
//   - pool % by (distributor tier, product, month-in-life)
//   - MCA gross allocation %, agency models, downline splits
//   - subscription & MCA performance accelerators (with caps)
//   - distributor qualification thresholds
//   - membership fees + automatic waiver thresholds
//   - retail / member / wholesale product pricing
//
// Where the task brief and the attached Distributor Compensation Guide differ,
// the task brief (the authoritative Manual values) is used:
//   - MCA "Repeat Merchant" accelerator: 1.0% (guide shows 0.5%)
//   - Small Agency headcount band: 1-5 (guide shows 1-4)
// ============================================================================

export type DistributorTier = 'standard' | 'enhanced' | 'elite';
export type SubscriptionProduct = 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';
export type DecayBucket = 'm1to3' | 'm4to6' | 'm7to9' | 'm10to12' | 'residual';

export const COMP_V2026 = {
  // --- Subscription product pricing (Retail / Member / Wholesale) ---
  // Member purchases inside the LeaderShield network pay NO commission.
  subscriptionPricing: {
    tier_1: { retail: 149, member: 99, wholesale: 59 },   // CRB $90
    tier_2: { retail: 497, member: 249, wholesale: 175 },  // CRB $322
    tier_3: { retail: 997, member: 449, wholesale: 300 },  // CRB $697
    tier_4: { retail: 1497, member: 899, wholesale: 600 }, // CRB $897
  } as Record<SubscriptionProduct, { retail: number; member: number; wholesale: number }>,

  // --- Subscription commission pools (% of the Commissionable Revenue Basis) ---
  // Indexed by distributor tier → product → decay bucket. Per Manual v1.1
  // Section 05: the three premium products (Growth Foundation, Revenue Growth
  // System, Revenue Scale AI) share ONE unified schedule; Starter has its own.
  // residual = Month 13+ (GF 10%, RGS/Scale 15%, Starter 0% — not eligible).
  subscriptionPools: {
    standard: {
      tier_1: { m1to3: 0.25, m4to6: 0.20, m7to9: 0.15, m10to12: 0.15, residual: 0.00 },
      tier_2: { m1to3: 0.45, m4to6: 0.35, m7to9: 0.25, m10to12: 0.15, residual: 0.10 },
      tier_3: { m1to3: 0.45, m4to6: 0.35, m7to9: 0.25, m10to12: 0.15, residual: 0.15 },
      tier_4: { m1to3: 0.45, m4to6: 0.35, m7to9: 0.25, m10to12: 0.15, residual: 0.15 },
    },
    enhanced: {
      tier_1: { m1to3: 0.30, m4to6: 0.25, m7to9: 0.20, m10to12: 0.20, residual: 0.00 },
      tier_2: { m1to3: 0.50, m4to6: 0.40, m7to9: 0.30, m10to12: 0.20, residual: 0.10 },
      tier_3: { m1to3: 0.50, m4to6: 0.40, m7to9: 0.30, m10to12: 0.20, residual: 0.15 },
      tier_4: { m1to3: 0.50, m4to6: 0.40, m7to9: 0.30, m10to12: 0.20, residual: 0.15 },
    },
    elite: {
      tier_1: { m1to3: 0.35, m4to6: 0.30, m7to9: 0.25, m10to12: 0.25, residual: 0.00 },
      tier_2: { m1to3: 0.55, m4to6: 0.45, m7to9: 0.35, m10to12: 0.25, residual: 0.10 },
      tier_3: { m1to3: 0.55, m4to6: 0.45, m7to9: 0.35, m10to12: 0.25, residual: 0.15 },
      tier_4: { m1to3: 0.55, m4to6: 0.45, m7to9: 0.35, m10to12: 0.25, residual: 0.15 },
    },
  } as Record<DistributorTier, Record<SubscriptionProduct, Record<DecayBucket, number>>>,

  // --- Mature residual flat rates (Month 13+) ---
  // Starter pays no residual; others settle to a flat rate for the life of the
  // subscription. (Mirrors the `residual` bucket above; kept explicit for
  // governance lookups.)
  matureResidual: {
    tier_1: 0.00,
    tier_2: 0.10,
    tier_3: 0.15,
    tier_4: 0.15,
  } as Record<SubscriptionProduct, number>,

  // --- MCA gross commission allocation ---
  // Splits the gross brokerage commission on a funded MCA deal.
  mcaAllocation: {
    pmf: 0.500,                       // PMF / Premium Merchant Funding
    openingAgentPool: 0.325,          // Opening Agent Pool (producer + agency override)
    performanceAcceleratorPool: 0.025, // Performance Accelerator Pool
    leadershieldEbitda: 0.150,        // LeaderShield EBITDA
  },

  // --- MCA agency models (taken WITHIN the 32.5% opening pool, never additive) ---
  // producer + override always sums to 0.325.
  mcaAgencyModels: {
    independent: { producer: 0.325, override: 0.000 },
    small_agency: { producer: 0.295, override: 0.030 },
    leadership: { producer: 0.275, override: 0.050 },
    recruiting: { producer: 0.245, override: 0.080 },
  } as Record<string, { producer: number; override: number }>,

  // --- Subscription agency split options (fractions of the subscription pool) ---
  // producer + override always sums to 1.00.
  subscriptionAgencySplits: {
    independent: { producer: 1.00, override: 0.00 },
    balanced: { producer: 0.90, override: 0.10 },
    leadership: { producer: 0.85, override: 0.15 },
    recruiting: { producer: 0.80, override: 0.20 },
  } as Record<string, { producer: number; override: number }>,

  // --- Downline override distribution (max 3 levels) ---
  // Applied to the override portion. Sums to 1.00.
  downlineLevels: {
    level1: 0.80,
    level2: 0.15,
    level3: 0.05,
  },
  maxDownlineLevels: 3,

  // --- Subscription performance accelerators (recalculated monthly) ---
  // Manual v1.1 Section 06: four triggers, premium products only (Starter is
  // not eligible). Separate from pools; additive up to the +5% cap → 60% top
  // rate at Elite. Applied to the Commissionable Revenue Basis.
  subscriptionAccelerators: {
    volume: 0.02,            // 20+ active subscriptions
    retention: 0.01,         // Quality & Retention (12-mo churn below thresholds)
    premiumProductMix: 0.01, // 60%+ of subs in Revenue Growth System / Revenue Scale AI
    mcaAttachment: 0.01,     // Merchant Outcomes — strong MCA ↔ subscription attachment
    cap: 0.05,
  },

  // --- MCA performance accelerators (paid from the 2.5% pool, monthly) ---
  // Additive up to the cap of +2.5% of gross.
  mcaAccelerators: {
    volume: 0.010,
    subscriptionAttachment: 0.010,
    productPenetration: 0.010,
    repeatMerchant: 0.010, // Manual: 1.0% (attached guide lists 0.5%)
    cap: 0.025,
  },

  // --- Distributor qualification thresholds (recalculated monthly) ---
  // Qualify for a tier via ANY one of its criteria. Standard is the floor
  // (active membership + minimum production).
  distributorQualification: {
    enhanced: {
      fundedVolume: 75000,
      subscriptionRevenue: 2500,
      activeSubscriptions: 3,
    },
    elite: {
      fundedVolume: 250000,
      subscriptionRevenue: 7500,
      activeSubscriptions: 8,
    },
  },

  // --- Membership fees + automatic waiver thresholds ---
  // Waivers are based on collected commission revenue. Headcount bands shown in
  // comments. (Manual: Small Agency 1-5; attached guide lists 1-4.)
  membership: {
    individual: { fee: 99, waiverThreshold: 500 },          // Individual Distributor
    small_agency: { fee: 149, waiverThreshold: 1500 },      // Small Agency (1-5)
    growth_agency: { fee: 249, waiverThreshold: 3000 },     // Growth Agency (5-10)
    enterprise_agency: { fee: 499, waiverThreshold: 7500 }, // Enterprise Agency (11+)
  } as Record<string, { fee: number; waiverThreshold: number }>,
} as const;
