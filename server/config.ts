// ============================================================================
// LeaderShield Compensation Configuration — Single Source of Truth
// ============================================================================
// This module centralizes every compensation constant used by the platform.
//
// Two distinct value sets live here:
//
//   1. CONFIG       — the LEGACY model (the terms in force before the 2026
//                     compensation realignment). Existing deals/subscriptions
//                     that carry `commissionModel = 'legacy'` are paid on these
//                     numbers. Consumed today by server/routes.ts (the engine)
//                     and server/webhookHandlers.ts. Values are UNCHANGED from
//                     their previous inline definitions — do not alter them, as
//                     historical records depend on them.
//
//   2. COMP_V2026   — the NEW model from the LeaderShield Compensation
//                     Architecture & Economics Manual. New records
//                     (`commissionModel = 'v2026'`) will be paid on these terms
//                     once the Commission Engine v2026 task wires them up. This
//                     task only LANDS the constants; no payout math reads them
//                     yet.
//
// Keeping both here lets the going-forward switch (the per-record
// `commissionModel` flag) select the correct number set without touching
// historical data.
// ============================================================================

export const CONFIG = {
  gbrWaterfall: {
    mac: 0.30,
    macSplit: {
      primaryAgent: 0.22,
      seniorSponsor: 0.05,
      executiveSponsor: 0.03,
    },
    tfc: { min: 0.30, max: 0.40 },
    picf: { min: 0.25, max: 0.35 },
    rsr: 0.05,
  },
  fulfillmentTierRates: {
    tier_1: 0.30,
    tier_2: 0.33,
    tier_3: 0.36,
    tier_4: 0.40,
  } as Record<string, number>,
  holdback: {
    immediateRelease: 0.70,
    deferred: 0.30,
    deferralDays: 75,
  },
  clawback: {
    days0to30: 1.00,
    days31to90: 0.50,
    after90: 0.00,
  },
  subscriptionPools: {
    tier_1: 0.25,
    tier_2: 0.35,
    tier_3: 0.45,
    tier_4: 0.50,
  } as Record<string, number>,
  subscriptionDecay: {
    months1to3: 1.00,
    months4to6: 0.75,
    months7to9: 0.50,
    months10to12: 0.25,
    postMonth12: 0.10,
  },
  mcaPairingBonus: 0.05,
  subscriptionUplinesOverride: {
    l1Rate: 0.10, // L1 sponsor earns 10% of the subscription pool × decay
    l2Rate: 0.05, // L2 sponsor earns 5% of the subscription pool × decay
  },
  subscriptionTierPrices: {
    tier_1: 149,
    tier_2: 397,
    tier_3: 697,
    tier_4: 1497,
  } as Record<string, number>,
  platformFee: {
    standard: 99,
    waivers: {
      level1: { threshold: 3000, reduction: 0.50 },
      level2: { threshold: 5000, reduction: 1.00 },
      level3: { threshold: 8500, reduction: 1.00, credit: 100 },
    },
  },
  residualProduction: {
    minRevenue: 3000,
    minMcaAndSub: { mca: 1, subscriptions: 1 },
    reductionAfterDays: 90,
    reductionPercent: 0.50,
    suspensionAfterMonths: 6,
  },
  binaryBonus: {
    builder: { rate: 0.05, max: 2500 },
    leader: { rate: 0.06, max: 5000 },
    director: { rate: 0.07, max: 10000 },
    partner: { rate: 0.08, max: 25000 },
  } as Record<string, { rate: number; max: number }>,
  rankRequirements: {
    builder: { personalVolume: 1000, weakLegVolume: 2500 },
    leader: { personalVolume: 2500, weakLegVolume: 10000 },
    director: { personalVolume: 5000, weakLegVolume: 25000 },
    partner: { personalVolume: 10000, weakLegVolume: 100000 },
  } as Record<string, { personalVolume: number; weakLegVolume: number }>,
  stripePriceIds: {
    tier_1: process.env.STRIPE_PRICE_TIER_1 ?? '',
    tier_2: process.env.STRIPE_PRICE_TIER_2 ?? '',
    tier_3: process.env.STRIPE_PRICE_TIER_3 ?? '',
    tier_4: process.env.STRIPE_PRICE_TIER_4 ?? '',
  } as Record<string, string>,
};

// ============================================================================
// COMP_V2026 — LeaderShield Compensation Architecture & Economics Manual
// ============================================================================
// All numbers below come directly from the Manual. They are organized for the
// Commission Engine v2026 task to look up:
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
    tier_1: { retail: 149, member: 99, wholesale: 59 },
    tier_2: { retail: 397, member: 249, wholesale: 175 },
    tier_3: { retail: 697, member: 449, wholesale: 300 },
    tier_4: { retail: 1497, member: 899, wholesale: 600 },
  } as Record<SubscriptionProduct, { retail: number; member: number; wholesale: number }>,

  // --- Subscription commission pools (% of collected revenue) ---
  // Indexed by distributor tier → product → decay bucket.
  // residual = Month 13+. Starter (tier_1) has NO residual (0%).
  subscriptionPools: {
    standard: {
      tier_1: { m1to3: 0.20, m4to6: 0.15, m7to9: 0.10, m10to12: 0.10, residual: 0.00 },
      tier_2: { m1to3: 0.45, m4to6: 0.35, m7to9: 0.25, m10to12: 0.15, residual: 0.10 },
      tier_3: { m1to3: 0.50, m4to6: 0.40, m7to9: 0.30, m10to12: 0.20, residual: 0.15 },
      tier_4: { m1to3: 0.50, m4to6: 0.40, m7to9: 0.30, m10to12: 0.20, residual: 0.15 },
    },
    enhanced: {
      tier_1: { m1to3: 0.25, m4to6: 0.20, m7to9: 0.15, m10to12: 0.15, residual: 0.00 },
      tier_2: { m1to3: 0.50, m4to6: 0.40, m7to9: 0.30, m10to12: 0.20, residual: 0.10 },
      tier_3: { m1to3: 0.55, m4to6: 0.45, m7to9: 0.35, m10to12: 0.25, residual: 0.15 },
      tier_4: { m1to3: 0.55, m4to6: 0.45, m7to9: 0.35, m10to12: 0.25, residual: 0.15 },
    },
    elite: {
      tier_1: { m1to3: 0.30, m4to6: 0.25, m7to9: 0.20, m10to12: 0.20, residual: 0.00 },
      tier_2: { m1to3: 0.55, m4to6: 0.45, m7to9: 0.35, m10to12: 0.25, residual: 0.10 },
      tier_3: { m1to3: 0.60, m4to6: 0.50, m7to9: 0.40, m10to12: 0.30, residual: 0.15 },
      tier_4: { m1to3: 0.60, m4to6: 0.50, m7to9: 0.40, m10to12: 0.30, residual: 0.15 },
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
  // Separate from pools; additive up to the cap.
  subscriptionAccelerators: {
    mcaAttachment: 0.02,
    revenueGrowthSystemMix: 0.02,
    volume: 0.02,
    quality: 0.01,
    organizationalDevelopment: 0.01,
    cap: 0.07,
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
