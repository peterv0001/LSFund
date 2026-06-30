import { describe, it, expect } from 'vitest';
import {
  getDecayBucket,
  cappedAcceleratorRate,
  distributeOverride,
  computeSubscriptionV2026,
  computeMcaV2026,
  deriveMcaAcceleratorRates,
  deriveSubscriptionAcceleratorRates,
  fireSubscriptionV2026,
} from './commissionEngine';
import { COMP_V2026 } from './config';

// Minimal in-memory storage so the impure fire* helper can be exercised without
// a database — proves the derive → compute → persist path end-to-end.
function makeFakeStorage(upline: { id: number }[] = []) {
  const created: any[] = [];
  return {
    created,
    async createCommission(c: any) {
      created.push(c);
      return { id: created.length };
    },
    async findSubscriptionCommission() {
      return null;
    },
    async getUpline() {
      return upline;
    },
  };
}

const approx = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('getDecayBucket', () => {
  it('maps month-in-life to the correct bucket at every boundary', () => {
    expect(getDecayBucket(0)).toBe('m1to3');
    expect(getDecayBucket(2)).toBe('m1to3');
    expect(getDecayBucket(3)).toBe('m4to6');
    expect(getDecayBucket(5)).toBe('m4to6');
    expect(getDecayBucket(6)).toBe('m7to9');
    expect(getDecayBucket(8)).toBe('m7to9');
    expect(getDecayBucket(9)).toBe('m10to12');
    expect(getDecayBucket(11)).toBe('m10to12');
    expect(getDecayBucket(12)).toBe('residual');
    expect(getDecayBucket(36)).toBe('residual');
  });
});

describe('cappedAcceleratorRate', () => {
  it('sums rates but never exceeds the cap', () => {
    expect(cappedAcceleratorRate([0.02, 0.02], 0.07)).toBeCloseTo(0.04, 6);
    expect(cappedAcceleratorRate([0.02, 0.02, 0.02, 0.01, 0.01], 0.07)).toBeCloseTo(0.07, 6);
    expect(cappedAcceleratorRate([0.02, 0.02, 0.02, 0.02, 0.02], 0.07)).toBeCloseTo(0.07, 6);
    expect(cappedAcceleratorRate(undefined, 0.07)).toBe(0);
    expect(cappedAcceleratorRate([], 0.07)).toBe(0);
  });
});

describe('distributeOverride', () => {
  it('splits an override 80/15/5 across 3 levels', () => {
    const d = distributeOverride(100);
    expect(d.map((l) => l.level)).toEqual([1, 2, 3]);
    approx(d[0].amount, 80);
    approx(d[1].amount, 15);
    approx(d[2].amount, 5);
    approx(d.reduce((s, l) => s + l.amount, 0), 100);
  });
});

describe('computeSubscriptionV2026', () => {
  it('computes pool × split for a standard independent tier_3 in months 1-3', () => {
    const r = computeSubscriptionV2026({
      tier: 'tier_3',
      distributorTier: 'standard',
      collectedRevenue: 697,
      monthsSinceStart: 0,
      agencyModel: 'independent',
    });
    expect(r.bucket).toBe('m1to3');
    expect(r.isResidual).toBe(false);
    expect(r.commType).toBe('subscription_commission');
    // standard/tier_3/m1to3 = 0.50 pool; independent = 100% producer
    approx(r.poolRate, 0.5);
    approx(r.poolAmount, 697 * 0.5);
    approx(r.producerAmount, 697 * 0.5);
    approx(r.overrideAmount, 0);
    approx(r.producerTotal, 697 * 0.5);
  });

  it('carves agency override and distributes it 80/15/5 (recruiting split)', () => {
    const r = computeSubscriptionV2026({
      tier: 'tier_2',
      distributorTier: 'enhanced',
      collectedRevenue: 397,
      monthsSinceStart: 0,
      agencyModel: 'recruiting',
    });
    // enhanced/tier_2/m1to3 = 0.50 pool; recruiting split 80/20
    approx(r.poolRate, 0.5);
    const pool = 397 * 0.5;
    approx(r.producerAmount, pool * 0.8);
    approx(r.overrideAmount, pool * 0.2);
    approx(r.overrideByLevel[0].amount, pool * 0.2 * 0.8);
    approx(r.overrideByLevel[1].amount, pool * 0.2 * 0.15);
    approx(r.overrideByLevel[2].amount, pool * 0.2 * 0.05);
  });

  it('maps small_agency to the balanced 90/10 subscription split', () => {
    const r = computeSubscriptionV2026({
      tier: 'tier_3',
      distributorTier: 'elite',
      collectedRevenue: 1000,
      monthsSinceStart: 0,
      agencyModel: 'small_agency',
    });
    // elite/tier_3/m1to3 = 0.60 pool
    const pool = 1000 * 0.6;
    approx(r.producerAmount, pool * 0.9);
    approx(r.overrideAmount, pool * 0.1);
  });

  it('treats month 13+ as residual and pays nothing for tier_1 (no residual)', () => {
    const r = computeSubscriptionV2026({
      tier: 'tier_1',
      distributorTier: 'elite',
      collectedRevenue: 149,
      monthsSinceStart: 13,
      agencyModel: 'independent',
    });
    expect(r.bucket).toBe('residual');
    expect(r.isResidual).toBe(true);
    expect(r.commType).toBe('subscription_residual');
    approx(r.poolRate, 0);
    approx(r.producerTotal, 0);
  });

  it('pays a residual for tier_2 in month 13+', () => {
    const r = computeSubscriptionV2026({
      tier: 'tier_2',
      distributorTier: 'standard',
      collectedRevenue: 397,
      monthsSinceStart: 13,
      agencyModel: 'independent',
    });
    expect(r.commType).toBe('subscription_residual');
    approx(r.poolRate, 0.1);
    approx(r.producerTotal, 397 * 0.1);
  });

  it('adds capped accelerator on top of the producer pool share', () => {
    const r = computeSubscriptionV2026({
      tier: 'tier_3',
      distributorTier: 'standard',
      collectedRevenue: 697,
      monthsSinceStart: 0,
      agencyModel: 'independent',
      acceleratorRates: [0.02, 0.02, 0.02, 0.02, 0.02], // 0.10 → capped to 0.07
    });
    approx(r.acceleratorRate, 0.07);
    approx(r.acceleratorAmount, 697 * 0.07);
    approx(r.producerTotal, 697 * 0.5 + 697 * 0.07);
  });

  it('pays nothing for an internal member purchase', () => {
    const r = computeSubscriptionV2026({
      tier: 'tier_3',
      distributorTier: 'elite',
      collectedRevenue: 697,
      monthsSinceStart: 0,
      agencyModel: 'recruiting',
      isMemberPurchase: true,
      acceleratorRates: [0.05],
    });
    approx(r.poolAmount, 0);
    approx(r.producerTotal, 0);
    approx(r.overrideAmount, 0);
    expect(r.overrideByLevel.every((l) => l.amount === 0)).toBe(true);
  });
});

describe('computeMcaV2026', () => {
  it('splits gross 50/32.5/2.5/15 with independent producer taking the whole opening pool', () => {
    const gross = 10000;
    const r = computeMcaV2026({ gross, agencyModel: 'independent' });
    approx(r.pmfAmount, gross * 0.5);
    approx(r.leadershieldEbitda, gross * 0.15);
    approx(r.acceleratorPoolAmount, gross * 0.025);
    approx(r.openingPoolAmount, gross * 0.325);
    approx(r.producerAmount, gross * 0.325);
    approx(r.overrideAmount, 0);
    // PMF + EBITDA + accel pool + opening pool accounts for 100% of gross
    approx(
      r.pmfAmount + r.leadershieldEbitda + r.acceleratorPoolAmount + r.openingPoolAmount,
      gross,
    );
  });

  it('carves agency override from the opening pool (recruiting) and distributes 80/15/5', () => {
    const gross = 10000;
    const r = computeMcaV2026({ gross, agencyModel: 'recruiting' });
    // recruiting: producer 0.245, override 0.080 (sums to 0.325)
    approx(r.producerAmount, gross * 0.245);
    approx(r.overrideAmount, gross * 0.08);
    approx(r.producerAmount + r.overrideAmount, gross * 0.325);
    approx(r.overrideByLevel[0].amount, gross * 0.08 * 0.8);
    approx(r.overrideByLevel[1].amount, gross * 0.08 * 0.15);
    approx(r.overrideByLevel[2].amount, gross * 0.08 * 0.05);
  });

  it('caps the MCA accelerator at 2.5% of gross', () => {
    const gross = 10000;
    const r = computeMcaV2026({
      gross,
      agencyModel: 'independent',
      acceleratorRates: [0.01, 0.01, 0.01, 0.01], // 0.04 → capped to 0.025
    });
    approx(r.acceleratorRate, 0.025);
    approx(r.acceleratorAmount, gross * 0.025);
  });

  it('keeps every agency model producer+override summed to the 32.5% opening pool', () => {
    for (const model of Object.keys(COMP_V2026.mcaAgencyModels) as Array<keyof typeof COMP_V2026.mcaAgencyModels>) {
      const r = computeMcaV2026({ gross: 1, agencyModel: model });
      approx(r.producerAmount + r.overrideAmount, 0.325);
    }
  });
});

describe('deriveMcaAcceleratorRates', () => {
  it('returns no rates when nothing qualifies', () => {
    expect(deriveMcaAcceleratorRates({})).toEqual([]);
  });

  it('adds subscription-attachment and repeat-merchant accelerators', () => {
    expect(deriveMcaAcceleratorRates({ hasPairedSubscription: true })).toEqual([
      COMP_V2026.mcaAccelerators.subscriptionAttachment,
    ]);
    expect(deriveMcaAcceleratorRates({ isRepeatMerchant: true })).toEqual([
      COMP_V2026.mcaAccelerators.repeatMerchant,
    ]);
    expect(
      deriveMcaAcceleratorRates({ hasPairedSubscription: true, isRepeatMerchant: true }),
    ).toEqual([
      COMP_V2026.mcaAccelerators.subscriptionAttachment,
      COMP_V2026.mcaAccelerators.repeatMerchant,
    ]);
  });

  it('feeds computeMcaV2026 a real (capped) accelerator end-to-end', () => {
    const gross = 10000;
    const rates = deriveMcaAcceleratorRates({ hasPairedSubscription: true, isRepeatMerchant: true });
    const r = computeMcaV2026({ gross, agencyModel: 'independent', acceleratorRates: rates });
    // 1.0% + 1.0% = 2.0% (under the 2.5% cap) → non-zero payout to opening agent
    approx(r.acceleratorRate, 0.02);
    approx(r.acceleratorAmount, gross * 0.02);
  });
});

describe('deriveSubscriptionAcceleratorRates', () => {
  it('returns no rates when nothing qualifies', () => {
    expect(deriveSubscriptionAcceleratorRates({})).toEqual([]);
  });

  it('adds the MCA-attachment accelerator when paired to an MCA deal', () => {
    expect(deriveSubscriptionAcceleratorRates({ hasPairedMca: true })).toEqual([
      COMP_V2026.subscriptionAccelerators.mcaAttachment,
    ]);
  });

  it('feeds computeSubscriptionV2026 a real accelerator end-to-end', () => {
    const rev = 697;
    const rates = deriveSubscriptionAcceleratorRates({ hasPairedMca: true });
    const r = computeSubscriptionV2026({
      tier: 'tier_3',
      distributorTier: 'standard',
      collectedRevenue: rev,
      monthsSinceStart: 0,
      agencyModel: 'independent',
      acceleratorRates: rates,
    });
    // standard/tier_3/m1to3 pool 0.50 + 2.0% MCA-attachment accelerator
    approx(r.acceleratorRate, 0.02);
    approx(r.acceleratorAmount, rev * 0.02);
    approx(r.producerTotal, rev * 0.5 + rev * 0.02);
  });
});

describe('fireSubscriptionV2026 (persistence path)', () => {
  it('persists a producer commission that includes the MCA-attachment accelerator', async () => {
    const storage = makeFakeStorage();
    const res = await fireSubscriptionV2026(storage as any, {
      sub: {
        id: 1,
        agentId: 10,
        tier: 'tier_3',
        monthlyAmount: '697.00',
        mcaPairedDealId: 555, // paired → +2% accelerator sourced inside the helper
      },
      agent: { distributorTier: 'standard', agencyModel: 'independent' },
      monthsSinceStart: 0,
      periodDate: '2026-06-01',
    });

    // pool 0.50 × 697 + 0.02 × 697 accelerator = 348.50 + 13.94 = 362.44
    expect(res.created).toBe(true);
    approx(res.producerAmount, 697 * 0.5 + 697 * 0.02);
    const producerRow = storage.created.find((c) => c.type === 'subscription_commission');
    expect(producerRow).toBeDefined();
    expect(producerRow.amount).toBe((697 * 0.5 + 697 * 0.02).toFixed(2));
  });

  it('pays no accelerator when the subscription is not MCA-paired', async () => {
    const storage = makeFakeStorage();
    await fireSubscriptionV2026(storage as any, {
      sub: { id: 2, agentId: 10, tier: 'tier_3', monthlyAmount: '697.00', mcaPairedDealId: null },
      agent: { distributorTier: 'standard', agencyModel: 'independent' },
      monthsSinceStart: 0,
      periodDate: '2026-06-01',
    });
    const producerRow = storage.created.find((c) => c.type === 'subscription_commission');
    expect(producerRow.amount).toBe((697 * 0.5).toFixed(2));
  });

  it('persists nothing for an internal member purchase', async () => {
    const storage = makeFakeStorage([{ id: 99 }]);
    const res = await fireSubscriptionV2026(storage as any, {
      sub: {
        id: 3,
        agentId: 10,
        tier: 'tier_3',
        monthlyAmount: '697.00',
        mcaPairedDealId: 555,
        isMemberPurchase: true,
      },
      agent: { distributorTier: 'elite', agencyModel: 'recruiting' },
      monthsSinceStart: 0,
      periodDate: '2026-06-01',
    });
    expect(res.created).toBe(false);
    expect(storage.created).toHaveLength(0);
  });
});

// Proves the residual governance factor (Task #473) actually flows through the
// real billing path: an admin setting an agent to "reduced"/"suspended" must
// halve/zero a Month 13+ residual payout — not just in the unit-tested pure
// function, but in the commission record that fireSubscriptionV2026 persists.
describe('fireSubscriptionV2026 residual governance (standing → payout)', () => {
  // tier_2 / standard / residual bucket pool rate = 0.10; independent model means
  // the producer keeps the whole pool, so the persisted amount is a clean
  // collectedRevenue × 0.10 × standingFactor with no override noise.
  const fullResidual = 397 * 0.1;

  function fireResidual(
    storage: ReturnType<typeof makeFakeStorage>,
    agent: { residualStatus?: 'good_standing' | 'reduced' | 'suspended'; membershipActive?: boolean },
  ) {
    return fireSubscriptionV2026(storage as any, {
      sub: { id: 7, agentId: 10, tier: 'tier_2', monthlyAmount: '397.00', mcaPairedDealId: null },
      agent: { distributorTier: 'standard', agencyModel: 'independent', ...agent },
      monthsSinceStart: 13,
      periodDate: '2026-06-01',
    });
  }

  it('pays a full residual for a good-standing, active-membership agent (control)', async () => {
    const storage = makeFakeStorage();
    const res = await fireResidual(storage, { residualStatus: 'good_standing', membershipActive: true });
    expect(res.created).toBe(true);
    expect(res.commType).toBe('subscription_residual');
    approx(res.producerAmount, fullResidual);
    const row = storage.created.find((c) => c.type === 'subscription_residual');
    expect(row.amount).toBe(fullResidual.toFixed(2));
  });

  it('halves a residual payout when the agent is in reduced standing', async () => {
    const storage = makeFakeStorage();
    const res = await fireResidual(storage, { residualStatus: 'reduced', membershipActive: true });
    expect(res.created).toBe(true);
    approx(res.producerAmount, fullResidual * 0.5);
    const row = storage.created.find((c) => c.type === 'subscription_residual');
    expect(row.amount).toBe((fullResidual * 0.5).toFixed(2));
  });

  it('zeroes a residual payout (persists nothing) when the agent is suspended', async () => {
    const storage = makeFakeStorage();
    const res = await fireResidual(storage, { residualStatus: 'suspended', membershipActive: true });
    expect(res.created).toBe(false);
    approx(res.producerAmount, 0);
    expect(storage.created).toHaveLength(0);
  });

  it('zeroes a residual payout when the membership is inactive', async () => {
    const storage = makeFakeStorage();
    const res = await fireResidual(storage, { residualStatus: 'good_standing', membershipActive: false });
    expect(res.created).toBe(false);
    expect(storage.created).toHaveLength(0);
  });

  it('leaves an active (Month 1-12) subscription untouched even for a suspended agent', async () => {
    const storage = makeFakeStorage();
    const res = await fireSubscriptionV2026(storage as any, {
      sub: { id: 8, agentId: 10, tier: 'tier_2', monthlyAmount: '397.00', mcaPairedDealId: null },
      agent: {
        distributorTier: 'standard',
        agencyModel: 'independent',
        residualStatus: 'suspended',
        membershipActive: false,
      },
      monthsSinceStart: 0,
      periodDate: '2026-06-01',
    });
    // m1to3 active pool, paid in full — standing never gates active (Month 1-12) commissions.
    const activePool = 397 * COMP_V2026.subscriptionPools.standard.tier_2.m1to3;
    expect(res.created).toBe(true);
    expect(res.commType).toBe('subscription_commission');
    approx(res.producerAmount, activePool);
    const row = storage.created.find((c) => c.type === 'subscription_commission');
    expect(row.amount).toBe(activePool.toFixed(2));
  });
});
