import { describe, it, expect } from 'vitest';
import {
  qualifyDistributorTier,
  computeMembershipStatus,
  isResidualEligible,
  residualMultiplier,
  residualGovernanceFactor,
  isBuyoutEligible,
  trailingMonthStart,
  recalculateAgentGovernance,
  recalculateAllGovernance,
} from './governance';
import { COMP_V2026 } from './config';

describe('qualifyDistributorTier', () => {
  it('returns standard when below all enhanced thresholds', () => {
    expect(qualifyDistributorTier({ fundedVolume: 0, subscriptionRevenue: 0, activeSubscriptions: 0 })).toBe('standard');
    expect(qualifyDistributorTier({ fundedVolume: 74999, subscriptionRevenue: 2499, activeSubscriptions: 2 })).toBe('standard');
  });

  it('qualifies enhanced on ANY single enhanced criterion', () => {
    const { enhanced } = COMP_V2026.distributorQualification;
    expect(qualifyDistributorTier({ fundedVolume: enhanced.fundedVolume, subscriptionRevenue: 0, activeSubscriptions: 0 })).toBe('enhanced');
    expect(qualifyDistributorTier({ fundedVolume: 0, subscriptionRevenue: enhanced.subscriptionRevenue, activeSubscriptions: 0 })).toBe('enhanced');
    expect(qualifyDistributorTier({ fundedVolume: 0, subscriptionRevenue: 0, activeSubscriptions: enhanced.activeSubscriptions })).toBe('enhanced');
  });

  it('qualifies elite on ANY single elite criterion and elite outranks enhanced', () => {
    const { elite } = COMP_V2026.distributorQualification;
    expect(qualifyDistributorTier({ fundedVolume: elite.fundedVolume, subscriptionRevenue: 0, activeSubscriptions: 0 })).toBe('elite');
    expect(qualifyDistributorTier({ fundedVolume: 0, subscriptionRevenue: elite.subscriptionRevenue, activeSubscriptions: 0 })).toBe('elite');
    expect(qualifyDistributorTier({ fundedVolume: 0, subscriptionRevenue: 0, activeSubscriptions: elite.activeSubscriptions })).toBe('elite');
  });
});

describe('computeMembershipStatus', () => {
  it('charges the plan fee when below the waiver threshold', () => {
    const s = computeMembershipStatus('individual', 0);
    expect(s.fee).toBe(COMP_V2026.membership.individual.fee);
    expect(s.waived).toBe(false);
    expect(s.amountDue).toBe(COMP_V2026.membership.individual.fee);
  });

  it('waives the fee once collected commission revenue clears the threshold', () => {
    const threshold = COMP_V2026.membership.individual.waiverThreshold;
    const s = computeMembershipStatus('individual', threshold);
    expect(s.waived).toBe(true);
    expect(s.amountDue).toBe(0);
  });

  it('uses tier-specific thresholds and falls back to individual for unknown types', () => {
    const ent = computeMembershipStatus('enterprise_agency', 0);
    expect(ent.fee).toBe(COMP_V2026.membership.enterprise_agency.fee);
    const fallback = computeMembershipStatus('nonexistent' as any, 0);
    expect(fallback.fee).toBe(COMP_V2026.membership.individual.fee);
  });
});

describe('isResidualEligible', () => {
  it('is never eligible for tier_1 (Starter)', () => {
    expect(isResidualEligible({ tier: 'tier_1', residualStatus: 'good_standing', membershipActive: true })).toBe(false);
  });

  it('requires an active membership', () => {
    expect(isResidualEligible({ tier: 'tier_2', residualStatus: 'good_standing', membershipActive: false })).toBe(false);
  });

  it('is blocked when suspended but allowed when good or reduced', () => {
    expect(isResidualEligible({ tier: 'tier_2', residualStatus: 'suspended', membershipActive: true })).toBe(false);
    expect(isResidualEligible({ tier: 'tier_2', residualStatus: 'good_standing', membershipActive: true })).toBe(true);
    expect(isResidualEligible({ tier: 'tier_2', residualStatus: 'reduced', membershipActive: true })).toBe(true);
  });
});

describe('residualMultiplier', () => {
  it('maps standing to 1 / 0.5 / 0', () => {
    expect(residualMultiplier('good_standing')).toBe(1);
    expect(residualMultiplier('reduced')).toBe(0.5);
    expect(residualMultiplier('suspended')).toBe(0);
  });
});

describe('residualGovernanceFactor', () => {
  const base = { residualStatus: 'good_standing' as const, membershipActive: true, tier: 'tier_2' as const };

  it('never touches non-residual (active) commissions', () => {
    expect(residualGovernanceFactor({ ...base, isResidual: false, residualStatus: 'suspended' })).toBe(1);
    expect(residualGovernanceFactor({ ...base, isResidual: false, membershipActive: false })).toBe(1);
  });

  it('zeroes residual when ineligible', () => {
    expect(residualGovernanceFactor({ ...base, isResidual: true, membershipActive: false })).toBe(0);
    expect(residualGovernanceFactor({ ...base, isResidual: true, residualStatus: 'suspended' })).toBe(0);
    expect(residualGovernanceFactor({ ...base, isResidual: true, tier: 'tier_1' })).toBe(0);
  });

  it('scales eligible residual by standing', () => {
    expect(residualGovernanceFactor({ ...base, isResidual: true })).toBe(1);
    expect(residualGovernanceFactor({ ...base, isResidual: true, residualStatus: 'reduced' })).toBe(0.5);
  });
});

describe('isBuyoutEligible', () => {
  it('requires a residual-carrying product, good standing and >= 12 months', () => {
    expect(isBuyoutEligible({ tier: 'tier_1', monthsActive: 24, residualStatus: 'good_standing' })).toBe(false);
    expect(isBuyoutEligible({ tier: 'tier_2', monthsActive: 11, residualStatus: 'good_standing' })).toBe(false);
    expect(isBuyoutEligible({ tier: 'tier_2', monthsActive: 12, residualStatus: 'reduced' })).toBe(false);
    expect(isBuyoutEligible({ tier: 'tier_2', monthsActive: 12, residualStatus: 'good_standing' })).toBe(true);
    expect(isBuyoutEligible({ tier: 'tier_4', monthsActive: 18, residualStatus: 'good_standing' })).toBe(true);
  });
});

describe('trailingMonthStart', () => {
  it('returns one month before the reference date', () => {
    const since = trailingMonthStart(new Date('2026-06-16T00:00:00Z'));
    expect(since.getMonth()).toBe(new Date('2026-05-16T00:00:00Z').getMonth());
  });
});

// ── Impure recalculation against an in-memory storage stub ───────────────────

function makeStorage(agents: any[], metrics: Record<number, Partial<{
  fundedVolume: number; subRevenue: number; activeSubs: number; commissionRevenue: number;
}>> = {}) {
  const updates: { id: number; data: any }[] = [];
  return {
    updates,
    async getAllAgents() { return agents; },
    async getAgent(id: number) { return agents.find((a) => a.id === id); },
    async updateAgent(id: number, data: any) {
      updates.push({ id, data });
      const a = agents.find((x) => x.id === id);
      if (a) Object.assign(a, data);
      return a;
    },
    async getFundedVolumeSince(id: number) { return metrics[id]?.fundedVolume ?? 0; },
    async getCollectedSubscriptionRevenue(id: number) { return metrics[id]?.subRevenue ?? 0; },
    async getActiveSubscriptionCount(id: number) { return metrics[id]?.activeSubs ?? 0; },
    async getCollectedCommissionRevenueSince(id: number) { return metrics[id]?.commissionRevenue ?? 0; },
  };
}

describe('recalculateAgentGovernance', () => {
  it('persists a tier change only when the tier actually changes', async () => {
    const agents = [{ id: 1, distributorTier: 'standard', membershipType: 'individual', residualStatus: 'good_standing', status: 'active' }];
    const storage = makeStorage(agents, { 1: { fundedVolume: COMP_V2026.distributorQualification.elite.fundedVolume } });
    const result = await recalculateAgentGovernance(storage as any, 1);
    expect(result?.changed).toBe(true);
    expect(result?.newTier).toBe('elite');
    expect(storage.updates).toHaveLength(1);
    expect(storage.updates[0].data).toEqual({ distributorTier: 'elite' });
  });

  it('does not write when the tier is unchanged', async () => {
    const agents = [{ id: 2, distributorTier: 'standard', membershipType: 'individual', residualStatus: 'good_standing', status: 'active' }];
    const storage = makeStorage(agents, { 2: { fundedVolume: 0 } });
    const result = await recalculateAgentGovernance(storage as any, 2);
    expect(result?.changed).toBe(false);
    expect(storage.updates).toHaveLength(0);
  });

  it('returns null for a missing agent', async () => {
    const storage = makeStorage([]);
    expect(await recalculateAgentGovernance(storage as any, 999)).toBeNull();
  });
});

describe('recalculateAllGovernance', () => {
  it('summarises processed and changed counts across the network', async () => {
    const agents = [
      { id: 1, distributorTier: 'standard', membershipType: 'individual', residualStatus: 'good_standing', status: 'active' },
      { id: 2, distributorTier: 'standard', membershipType: 'individual', residualStatus: 'good_standing', status: 'active' },
    ];
    const storage = makeStorage(agents, {
      1: { activeSubs: COMP_V2026.distributorQualification.enhanced.activeSubscriptions },
      2: { fundedVolume: 0 },
    });
    const summary = await recalculateAllGovernance(storage as any);
    expect(summary.processed).toBe(2);
    expect(summary.changed).toBe(1);
    expect(summary.changes[0]).toMatchObject({ agentId: 1, from: 'standard', to: 'enhanced' });
  });
});
