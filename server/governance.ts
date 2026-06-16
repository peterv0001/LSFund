// ============================================================================
// Governance — Qualification, membership & residual governance (Task #473)
// ============================================================================
// Implements the 2026 Compensation Manual governance layer on top of the
// existing rank / binary-tree system (additive only):
//   1. Monthly distributor-tier recalculation (Standard / Enhanced / Elite)
//   2. Membership fees with automatic production-based waivers
//   3. Residual good-standing / suspension / reinstatement + buyout eligibility
//
// All thresholds come from COMP_V2026 (shared/compensation.ts) so the engine,
// the API and the UI can never drift from the Manual. Pure functions here are
// deterministic and fully unit-tested; the impure recalc helpers read/write
// through the storage interface.
// ============================================================================

import { COMP_V2026 } from './config';
import type {
  DistributorTier,
  SubscriptionProduct,
} from '../shared/compensation';

export type ResidualStatus = 'good_standing' | 'reduced' | 'suspended';
export type MembershipType =
  | 'individual'
  | 'small_agency'
  | 'growth_agency'
  | 'enterprise_agency';

// Products that carry a residual (Month 13+) and are therefore buyout-eligible.
// Starter (tier_1) has no residual, so it can never qualify for a buyout.
export const BUYOUT_ELIGIBLE_PRODUCTS: SubscriptionProduct[] = [
  'tier_2',
  'tier_3',
  'tier_4',
];

// A subscription must be active and in good standing for at least this many
// months before its residual stream is eligible to be bought out.
export const BUYOUT_MIN_MONTHS = 12;

// ── Distributor qualification ────────────────────────────────────────────────

export interface DistributorMetrics {
  /** Trailing-month funded MCA volume (sum of funded deal loan amounts). */
  fundedVolume: number;
  /** Monthly collected subscription revenue (active book MRR). */
  subscriptionRevenue: number;
  /** Count of currently active subscriptions. */
  activeSubscriptions: number;
}

/**
 * Determines a distributor's tier from trailing production. A distributor
 * qualifies for a tier by clearing ANY ONE of that tier's criteria. Elite is
 * checked first (highest), then Enhanced, otherwise Standard (the floor).
 *
 * Recalculated monthly — there is no permanent or grandfathered status; a
 * distributor that drops below a threshold moves back down on the next run.
 */
export function qualifyDistributorTier(metrics: DistributorMetrics): DistributorTier {
  const { enhanced, elite } = COMP_V2026.distributorQualification;

  if (
    metrics.fundedVolume >= elite.fundedVolume ||
    metrics.subscriptionRevenue >= elite.subscriptionRevenue ||
    metrics.activeSubscriptions >= elite.activeSubscriptions
  ) {
    return 'elite';
  }

  if (
    metrics.fundedVolume >= enhanced.fundedVolume ||
    metrics.subscriptionRevenue >= enhanced.subscriptionRevenue ||
    metrics.activeSubscriptions >= enhanced.activeSubscriptions
  ) {
    return 'enhanced';
  }

  return 'standard';
}

// ── Membership fees & automatic waivers ──────────────────────────────────────

export interface MembershipStatus {
  membershipType: MembershipType;
  fee: number;
  waiverThreshold: number;
  /** Whether collected commission revenue cleared the waiver threshold. */
  waived: boolean;
  /** Fee actually owed this cycle (0 when waived). */
  amountDue: number;
  collectedCommissionRevenue: number;
}

/**
 * Computes a membership's fee and whether it is automatically waived for the
 * cycle. Waivers are non-discretionary: when trailing collected commission
 * revenue clears the threshold for the membership tier, the fee is $0 — no
 * application or approval step. Recalculated monthly.
 */
export function computeMembershipStatus(
  membershipType: MembershipType,
  collectedCommissionRevenue: number,
): MembershipStatus {
  const plan =
    COMP_V2026.membership[membershipType] ?? COMP_V2026.membership.individual;
  const waived = collectedCommissionRevenue >= plan.waiverThreshold;
  return {
    membershipType,
    fee: plan.fee,
    waiverThreshold: plan.waiverThreshold,
    waived,
    amountDue: waived ? 0 : plan.fee,
    collectedCommissionRevenue,
  };
}

// ── Residual governance ──────────────────────────────────────────────────────

/**
 * Whether a subscription's residual stream should pay out at all. Residuals
 * require an active membership in good (or reduced) standing. Starter (tier_1)
 * never carries a residual.
 */
export function isResidualEligible(opts: {
  residualStatus: ResidualStatus;
  membershipActive: boolean;
  tier: SubscriptionProduct;
}): boolean {
  if (opts.tier === 'tier_1') return false;
  if (!opts.membershipActive) return false;
  if (opts.residualStatus === 'suspended') return false;
  return true;
}

/**
 * Multiplier applied to a residual payout based on standing:
 *   good_standing -> 1.0, reduced -> 0.5, suspended -> 0.0.
 */
export function residualMultiplier(residualStatus: ResidualStatus): number {
  switch (residualStatus) {
    case 'good_standing':
      return 1;
    case 'reduced':
      return 0.5;
    case 'suspended':
      return 0;
    default:
      return 1;
  }
}

/**
 * Combined residual governance factor for the residual (Month 13+) bucket:
 * 0 when ineligible, otherwise the standing multiplier. Active (non-residual)
 * commissions are never affected — callers pass isResidual=false for those.
 */
export function residualGovernanceFactor(opts: {
  isResidual: boolean;
  residualStatus: ResidualStatus;
  membershipActive: boolean;
  tier: SubscriptionProduct;
}): number {
  if (!opts.isResidual) return 1;
  if (
    !isResidualEligible({
      residualStatus: opts.residualStatus,
      membershipActive: opts.membershipActive,
      tier: opts.tier,
    })
  ) {
    return 0;
  }
  return residualMultiplier(opts.residualStatus);
}

/**
 * Whether a subscription's residual stream is eligible to be bought out:
 * a residual-carrying product, active & in good standing for >= 12 months.
 */
export function isBuyoutEligible(opts: {
  tier: SubscriptionProduct;
  monthsActive: number;
  residualStatus: ResidualStatus;
}): boolean {
  if (!BUYOUT_ELIGIBLE_PRODUCTS.includes(opts.tier)) return false;
  if (opts.residualStatus !== 'good_standing') return false;
  return opts.monthsActive >= BUYOUT_MIN_MONTHS;
}

// ── Impure recalculation helpers ─────────────────────────────────────────────
// These read trailing production from storage and persist tier changes. They
// keep notifications / activity logging at the call site.

/** The trailing-month window start for governance recalculation. */
export function trailingMonthStart(now: Date = new Date()): Date {
  const since = new Date(now);
  since.setMonth(since.getMonth() - 1);
  return since;
}

export interface GovernanceStorage {
  getAllAgents(): Promise<any[]>;
  getAgent(id: number): Promise<any | undefined>;
  updateAgent(id: number, data: any): Promise<any>;
  getFundedVolumeSince(agentId: number, since: Date): Promise<number>;
  getCollectedSubscriptionRevenue(agentId: number): Promise<number>;
  getActiveSubscriptionCount(agentId: number): Promise<number>;
  getCollectedCommissionRevenueSince(agentId: number, since: Date): Promise<number>;
}

export interface AgentGovernanceResult {
  agentId: number;
  previousTier: DistributorTier;
  newTier: DistributorTier;
  changed: boolean;
  metrics: DistributorMetrics;
  membership: MembershipStatus;
  membershipActive: boolean;
  residualStatus: ResidualStatus;
}

/**
 * Recalculates one agent's distributor tier from trailing production and
 * persists it only when it changed. Membership status is computed (derived,
 * never stored) and returned for surfacing. Returns null when the agent is
 * missing.
 */
export async function recalculateAgentGovernance(
  storage: GovernanceStorage,
  agentId: number,
  now: Date = new Date(),
): Promise<AgentGovernanceResult | null> {
  const agent = await storage.getAgent(agentId);
  if (!agent) return null;

  const since = trailingMonthStart(now);
  const [fundedVolume, subscriptionRevenue, activeSubscriptions, collectedCommissionRevenue] =
    await Promise.all([
      storage.getFundedVolumeSince(agentId, since),
      storage.getCollectedSubscriptionRevenue(agentId),
      storage.getActiveSubscriptionCount(agentId),
      storage.getCollectedCommissionRevenueSince(agentId, since),
    ]);

  const metrics: DistributorMetrics = {
    fundedVolume,
    subscriptionRevenue,
    activeSubscriptions,
  };
  const previousTier = agent.distributorTier as DistributorTier;
  const newTier = qualifyDistributorTier(metrics);
  const changed = newTier !== previousTier;

  if (changed) {
    await storage.updateAgent(agentId, { distributorTier: newTier });
  }

  const membership = computeMembershipStatus(
    agent.membershipType as MembershipType,
    collectedCommissionRevenue,
  );

  return {
    agentId,
    previousTier,
    newTier,
    changed,
    metrics,
    membership,
    membershipActive: agent.status === 'active',
    residualStatus: agent.residualStatus as ResidualStatus,
  };
}

export interface RecalculationSummary {
  processed: number;
  changed: number;
  changes: { agentId: number; from: DistributorTier; to: DistributorTier }[];
  ranAt: string;
}

/**
 * Recalculates distributor tiers for every agent. Used by the monthly
 * scheduler hook and the admin manual-trigger endpoint.
 */
export async function recalculateAllGovernance(
  storage: GovernanceStorage,
  now: Date = new Date(),
): Promise<RecalculationSummary> {
  const agents = await storage.getAllAgents();
  const changes: { agentId: number; from: DistributorTier; to: DistributorTier }[] = [];

  for (const agent of agents) {
    const result = await recalculateAgentGovernance(storage, agent.id, now);
    if (result?.changed) {
      changes.push({ agentId: result.agentId, from: result.previousTier, to: result.newTier });
    }
  }

  return {
    processed: agents.length,
    changed: changes.length,
    changes,
    ranAt: now.toISOString(),
  };
}
