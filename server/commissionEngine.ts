// ============================================================================
// Commission Engine v2026
// ============================================================================
// Pure computation of the LeaderShield Compensation Architecture & Economics
// Manual money-flow for NEW deals/subscriptions (commissionModel = 'v2026').
//
// The `compute*` functions are PURE: they read only their arguments and the
// COMP_V2026 constants, never the DB. This keeps the money math fully unit
// testable. The `fire*` helpers at the bottom are the impure persistence layer;
// they accept a storage object so they can be reused from both routes.ts and
// webhookHandlers.ts without a circular import.
//
// Legacy records (commissionModel = 'legacy') are NOT handled here — call sites
// keep their existing legacy code path untouched and only delegate to this
// module when the record is flagged 'v2026'.
// ============================================================================

import {
  COMP_V2026,
  type DistributorTier,
  type SubscriptionProduct,
  type DecayBucket,
} from './config';
import { residualGovernanceFactor, type ResidualStatus } from './governance';

export type AgencyModel = 'independent' | 'small_agency' | 'leadership' | 'recruiting';
export type SubscriptionCommissionType = 'subscription_commission' | 'subscription_residual';

// Maps the agent's MCA-oriented agencyModel onto the subscription agency split
// keys from the Manual (small_agency → balanced 90/10; others share a name).
const SUBSCRIPTION_SPLIT_BY_AGENCY_MODEL: Record<AgencyModel, keyof typeof COMP_V2026.subscriptionAgencySplits> = {
  independent: 'independent',
  small_agency: 'balanced',
  leadership: 'leadership',
  recruiting: 'recruiting',
};

/**
 * Month-in-life → decay bucket. Boundaries mirror the legacy engine so the
 * crossover months line up: months 0-2 = m1to3, 3-5 = m4to6, 6-8 = m7to9,
 * 9-11 = m10to12, and 12+ = residual (Month 13+).
 */
export function getDecayBucket(monthsSinceStart: number): DecayBucket {
  if (monthsSinceStart < 3) return 'm1to3';
  if (monthsSinceStart < 6) return 'm4to6';
  if (monthsSinceStart < 9) return 'm7to9';
  if (monthsSinceStart < 12) return 'm10to12';
  return 'residual';
}

/** Sums applicable accelerator rates, clamped to the cap. */
export function cappedAcceleratorRate(rates: number[] | undefined, cap: number): number {
  const total = (rates ?? []).reduce((acc, r) => acc + r, 0);
  return Math.min(total, cap);
}

/**
 * Per-record-derivable MCA accelerators. Only the accelerators whose
 * qualification is knowable from the funded deal itself are sourced here:
 * subscription attachment (the merchant also has a subscription) and repeat
 * merchant (the merchant has a prior funded deal). The remaining MCA
 * accelerators (volume, product penetration) depend on monthly organizational
 * aggregates and are sourced by the monthly recalculation task (out of scope
 * here). The engine still clamps the total to the +2.5% cap.
 */
export function deriveMcaAcceleratorRates(ctx: {
  hasPairedSubscription?: boolean;
  isRepeatMerchant?: boolean;
}): number[] {
  const a = COMP_V2026.mcaAccelerators;
  const rates: number[] = [];
  if (ctx.hasPairedSubscription) rates.push(a.subscriptionAttachment);
  if (ctx.isRepeatMerchant) rates.push(a.repeatMerchant);
  return rates;
}

/**
 * Per-record-derivable subscription accelerators. MCA attachment (the
 * subscription is paired to a funded MCA deal) is knowable from the record.
 * The remaining subscription accelerators (volume, retention, premium-product
 * mix) depend on monthly organizational aggregates and are sourced by the
 * monthly recalculation task (out of scope here). The engine still clamps the
 * total to the +5% cap.
 */
export function deriveSubscriptionAcceleratorRates(ctx: {
  hasPairedMca?: boolean;
}): number[] {
  const a = COMP_V2026.subscriptionAccelerators;
  const rates: number[] = [];
  if (ctx.hasPairedMca) rates.push(a.mcaAttachment);
  return rates;
}

/**
 * Commissionable Revenue Basis (CRB) for a subscription product — retail price
 * less wholesale cost (Manual v1.1 Section 05). All subscription pool and
 * accelerator percentages are applied to this basis, NOT to full retail.
 */
export function commissionableBasis(tier: SubscriptionProduct): number {
  const p = COMP_V2026.subscriptionPricing[tier];
  return p.retail - p.wholesale;
}

/**
 * Splits an override amount across up to 3 upline levels using the Manual's
 * 80/15/5 distribution. Returns one entry per level (1-based); the caller pays
 * only the levels that have a real upline agent.
 */
export function distributeOverride(overrideAmount: number): { level: number; amount: number }[] {
  const { level1, level2, level3 } = COMP_V2026.downlineLevels;
  return [
    { level: 1, amount: overrideAmount * level1 },
    { level: 2, amount: overrideAmount * level2 },
    { level: 3, amount: overrideAmount * level3 },
  ];
}

// ── Subscriptions ───────────────────────────────────────────────────────────

export interface SubscriptionV2026Params {
  tier: SubscriptionProduct;
  distributorTier: DistributorTier;
  /** Collected revenue for the period (typically the monthly amount). */
  collectedRevenue: number;
  monthsSinceStart: number;
  agencyModel: AgencyModel;
  /** Internal member purchases generate NO commission. */
  isMemberPurchase?: boolean;
  /** Qualified accelerator rates (qualification is computed elsewhere). */
  acceleratorRates?: number[];
  /**
   * Residual governance (Task #473) — only affects the residual (Month 13+)
   * bucket. Defaults preserve prior behavior (good standing + active membership).
   */
  residualStatus?: ResidualStatus;
  membershipActive?: boolean;
}

export interface SubscriptionV2026Result {
  bucket: DecayBucket;
  isResidual: boolean;
  commType: SubscriptionCommissionType;
  poolRate: number;
  poolAmount: number;
  /** Selling agent's share of the pool (before accelerator). */
  producerAmount: number;
  /** Total override carved out of the pool, distributed upline. */
  overrideAmount: number;
  acceleratorRate: number;
  acceleratorAmount: number;
  /** What the selling agent is actually paid: producer share + accelerator. */
  producerTotal: number;
  overrideByLevel: { level: number; amount: number }[];
}

export function computeSubscriptionV2026(params: SubscriptionV2026Params): SubscriptionV2026Result {
  const bucket = getDecayBucket(params.monthsSinceStart);
  const isResidual = bucket === 'residual';
  const commType: SubscriptionCommissionType = isResidual
    ? 'subscription_residual'
    : 'subscription_commission';

  // Internal member purchases never generate commission.
  if (params.isMemberPurchase) {
    return {
      bucket,
      isResidual,
      commType,
      poolRate: 0,
      poolAmount: 0,
      producerAmount: 0,
      overrideAmount: 0,
      acceleratorRate: 0,
      acceleratorAmount: 0,
      producerTotal: 0,
      overrideByLevel: distributeOverride(0),
    };
  }

  const poolRate = COMP_V2026.subscriptionPools[params.distributorTier][params.tier][bucket];

  // Residual governance (Task #473): the residual (Month 13+) bucket only pays
  // when the distributor's residual standing & membership allow it. Suspended
  // residuals pay $0, reduced standing pays half. Active commissions (months
  // 1-12) are never affected — the factor is always 1 there.
  const govFactor = residualGovernanceFactor({
    isResidual,
    residualStatus: params.residualStatus ?? 'good_standing',
    membershipActive: params.membershipActive ?? true,
    tier: params.tier,
  });

  // All subscription compensation is paid on the Commissionable Revenue Basis
  // (retail − wholesale), NOT full collected retail (Manual v1.1 Section 05).
  // A period with no collected revenue pays nothing.
  const basis = params.collectedRevenue > 0 ? commissionableBasis(params.tier) : 0;
  const poolAmount = basis * poolRate * govFactor;

  const splitKey = SUBSCRIPTION_SPLIT_BY_AGENCY_MODEL[params.agencyModel];
  const split = COMP_V2026.subscriptionAgencySplits[splitKey];
  const producerAmount = poolAmount * split.producer;
  const overrideAmount = poolAmount * split.override;

  // Accelerators apply to premium products only — Starter (tier_1) is never
  // eligible (Manual v1.1 Section 06).
  const acceleratorRate = params.tier === 'tier_1'
    ? 0
    : cappedAcceleratorRate(
        params.acceleratorRates,
        COMP_V2026.subscriptionAccelerators.cap,
      );
  const acceleratorAmount = basis * acceleratorRate * govFactor;

  return {
    bucket,
    isResidual,
    commType,
    poolRate,
    poolAmount,
    producerAmount,
    overrideAmount,
    acceleratorRate,
    acceleratorAmount,
    producerTotal: producerAmount + acceleratorAmount,
    overrideByLevel: distributeOverride(overrideAmount),
  };
}

// ── MCA deals ────────────────────────────────────────────────────────────────

export interface McaV2026Params {
  /** Gross brokerage commission on the funded deal. */
  gross: number;
  agencyModel: AgencyModel;
  acceleratorRates?: number[];
}

export interface McaV2026Result {
  pmfAmount: number;            // 50% — funder, not an agent payout
  leadershieldEbitda: number;   // 15% — company, not an agent payout
  acceleratorPoolAmount: number; // 2.5% pool ceiling
  openingPoolAmount: number;    // 32.5% (producer + override)
  producerAmount: number;       // opening agent's producer share
  overrideAmount: number;       // agency override carved from opening pool
  acceleratorRate: number;
  acceleratorAmount: number;    // paid to the opening agent, <= 2.5% of gross
  overrideByLevel: { level: number; amount: number }[];
}

export function computeMcaV2026(params: McaV2026Params): McaV2026Result {
  const alloc = COMP_V2026.mcaAllocation;
  const gross = params.gross;

  const pmfAmount = gross * alloc.pmf;
  const leadershieldEbitda = gross * alloc.leadershieldEbitda;
  const acceleratorPoolAmount = gross * alloc.performanceAcceleratorPool;
  const openingPoolAmount = gross * alloc.openingAgentPool;

  const model = COMP_V2026.mcaAgencyModels[params.agencyModel];
  const producerAmount = gross * model.producer;
  const overrideAmount = gross * model.override;

  const acceleratorRate = cappedAcceleratorRate(
    params.acceleratorRates,
    COMP_V2026.mcaAccelerators.cap,
  );
  const acceleratorAmount = gross * acceleratorRate;

  return {
    pmfAmount,
    leadershieldEbitda,
    acceleratorPoolAmount,
    openingPoolAmount,
    producerAmount,
    overrideAmount,
    acceleratorRate,
    acceleratorAmount,
    overrideByLevel: distributeOverride(overrideAmount),
  };
}

// ── Impure persistence helpers ───────────────────────────────────────────────
// These accept a minimal storage surface so they can be shared by routes.ts and
// webhookHandlers.ts. They ONLY create commission records — notifications,
// emails and activity logging stay at the call site to match each site's
// existing behavior.

interface CommissionStorage {
  createCommission(commission: any): Promise<{ commission: { id: number }; isNew: boolean }>;
  findSubscriptionCommission(
    agentId: number,
    subscriptionId: number,
    periodDate: string,
    type: any,
  ): Promise<{ id: number } | null>;
  getUpline(agentId: number): Promise<{ id: number }[]>;
}

const SUBSCRIPTION_OVERRIDE_TYPE = 'subscription_residual';

/**
 * Computes and persists a v2026 subscription's commissions for one period:
 * the selling agent's producer payout (pool share + accelerator) plus the
 * agency override distributed up to 3 upline levels (80/15/5). Idempotent via
 * the subscription/period/type unique index.
 *
 * Returns the producer payout amount, its commission type, and whether a NEW
 * producer commission was created (false = it already existed for this period).
 */
export async function fireSubscriptionV2026(
  storage: CommissionStorage,
  opts: {
    sub: {
      id: number;
      agentId: number;
      tier: SubscriptionProduct;
      monthlyAmount: string | number;
      isMemberPurchase?: boolean | null;
      mcaPairedDealId?: number | null;
    };
    agent: {
      distributorTier: DistributorTier;
      agencyModel: AgencyModel;
      residualStatus?: ResidualStatus;
      membershipActive?: boolean;
    };
    monthsSinceStart: number;
    periodDate: string;
    /** Extra (monthly-aggregate) accelerator rates sourced by the caller. */
    acceleratorRates?: number[];
  },
): Promise<{ producerAmount: number; commType: SubscriptionCommissionType; created: boolean }> {
  const { sub, agent, monthsSinceStart, periodDate } = opts;

  // Per-record accelerators (MCA attachment) are derived from the subscription
  // itself; any caller-supplied monthly-aggregate rates are added on top. The
  // engine clamps the total to the +7% cap.
  const acceleratorRates = [
    ...deriveSubscriptionAcceleratorRates({ hasPairedMca: sub.mcaPairedDealId != null }),
    ...(opts.acceleratorRates ?? []),
  ];

  const result = computeSubscriptionV2026({
    tier: sub.tier,
    distributorTier: agent.distributorTier,
    collectedRevenue: Number(sub.monthlyAmount),
    monthsSinceStart,
    agencyModel: agent.agencyModel,
    isMemberPurchase: sub.isMemberPurchase ?? false,
    residualStatus: agent.residualStatus,
    membershipActive: agent.membershipActive,
    acceleratorRates,
  });

  if (result.producerTotal <= 0 && result.overrideByLevel.every((l) => l.amount <= 0)) {
    return { producerAmount: 0, commType: result.commType, created: false };
  }

  let created = false;
  if (result.producerTotal > 0) {
    const existing = await storage.findSubscriptionCommission(
      sub.agentId,
      sub.id,
      periodDate,
      result.commType,
    );
    if (!existing) {
      await storage.createCommission({
        agentId: sub.agentId,
        subscriptionId: sub.id,
        type: result.commType,
        amount: result.producerTotal.toFixed(2),
        periodDate,
        status: 'pending',
      });
      created = true;
    }
  }

  // Agency override → upline (80/15/5), only for levels that actually exist.
  if (result.overrideAmount > 0) {
    const upline = await storage.getUpline(sub.agentId);
    for (let i = 0; i < upline.length && i < result.overrideByLevel.length; i++) {
      const amount = result.overrideByLevel[i].amount;
      if (amount > 0) {
        await storage.createCommission({
          agentId: upline[i].id,
          subscriptionId: sub.id,
          type: SUBSCRIPTION_OVERRIDE_TYPE,
          amount: amount.toFixed(2),
          periodDate,
          sourceAgentId: sub.agentId,
          status: 'pending',
        });
      }
    }
  }

  return { producerAmount: result.producerTotal, commType: result.commType, created };
}
