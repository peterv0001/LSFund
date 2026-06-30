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
    tier_2: 497,
    tier_3: 997,
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
// The NEW (2026) model now lives in `shared/compensation.ts` so the client UI
// (marketing site + agent portal) and the server engine read the exact same
// numbers and can never drift. It is re-exported here so existing server
// imports (`from "./config"`) keep working unchanged.
// ============================================================================

export { COMP_V2026 } from "@shared/compensation";
export type {
  DistributorTier,
  SubscriptionProduct,
  DecayBucket,
} from "@shared/compensation";
