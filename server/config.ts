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
    tier_1: 0.50,
    tier_2: 0.60,
    tier_3: 0.70,
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
    l1Rate: 0.10,
    l2Rate: 0.05,
  },
  subscriptionTierPrices: {
    tier_1: 199,
    tier_2: 429,
    tier_3: 749,
  } as Record<string, number>,
  stripePriceIds: {
    tier_1: process.env.STRIPE_PRICE_TIER_1 ?? '',
    tier_2: process.env.STRIPE_PRICE_TIER_2 ?? '',
    tier_3: process.env.STRIPE_PRICE_TIER_3 ?? '',
  } as Record<string, string>,
};
