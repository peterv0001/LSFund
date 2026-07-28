import { storage } from "./storage";
import { emailService } from "./email";
import { recalculateAllGovernance } from "./governance";
import { maybeNotifyAdminsAgentLostLastSubscription } from "./adminAlerts";

const DEFAULT_EXPIRY_CHECK_INTERVAL_MS = 60 * 60 * 1000; // default: 1 hour

// Result of resolving EXPIRY_CHECK_INTERVAL_MS. When the configured value is
// rejected, `invalid` is true and `rejectedValue` holds exactly what the
// operator set so the admin dashboard can surface the bad configuration.
type ResolvedExpiryInterval = {
  intervalMs: number;
  invalid: boolean;
  rejectedValue: string | null;
};

function resolveExpiryCheckInterval(): ResolvedExpiryInterval {
  const raw = process.env.EXPIRY_CHECK_INTERVAL_MS;
  if (raw === undefined) {
    return { intervalMs: DEFAULT_EXPIRY_CHECK_INTERVAL_MS, invalid: false, rejectedValue: null };
  }

  const trimmed = raw.trim();
  // Reject anything that is not a plain positive integer (no decimals, no
  // leading/trailing junk, no signs). An operator who fat-fingers this value to
  // 0, a negative number, or a non-numeric string would otherwise break the
  // scheduler silently or spin it in a tight loop.
  const parsed = Number(trimmed);
  if (
    trimmed === "" ||
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    console.warn(
      `[Scheduler] Invalid EXPIRY_CHECK_INTERVAL_MS value "${raw}" — must be a positive integer (milliseconds). Falling back to the default of ${DEFAULT_EXPIRY_CHECK_INTERVAL_MS}ms (1 hour).`,
    );
    return { intervalMs: DEFAULT_EXPIRY_CHECK_INTERVAL_MS, invalid: true, rejectedValue: raw };
  }

  return { intervalMs: parsed, invalid: false, rejectedValue: null };
}

const resolvedExpiryInterval = resolveExpiryCheckInterval();

export const EXPIRY_CHECK_INTERVAL_MS = resolvedExpiryInterval.intervalMs;

// Reports whether the configured EXPIRY_CHECK_INTERVAL_MS was rejected and the
// safe default is in use. The admin dashboard uses this to alert operators that
// their configured value was invalid, so they can fix it before it affects how
// often expiry checks run.
export function getSchedulerConfigHealth(): {
  intervalMs: number;
  intervalInvalid: boolean;
  rejectedIntervalValue: string | null;
  defaultIntervalMs: number;
} {
  return {
    intervalMs: EXPIRY_CHECK_INTERVAL_MS,
    intervalInvalid: resolvedExpiryInterval.invalid,
    rejectedIntervalValue: resolvedExpiryInterval.rejectedValue,
    defaultIntervalMs: DEFAULT_EXPIRY_CHECK_INTERVAL_MS,
  };
}

// Track scheduler timing so the admin System Info panel can report when the
// expiry checks last ran and when they are next due, without reading logs.
// lastRunAt is also persisted to platform settings so it survives restarts.
let lastRunAt: Date | null = null;
let nextRunAt: Date | null = null;

export function getSchedulerStatus(): { lastRunAt: string | null; nextRunAt: string | null } {
  return {
    lastRunAt: lastRunAt ? lastRunAt.toISOString() : null,
    nextRunAt: nextRunAt ? nextRunAt.toISOString() : null,
  };
}

// Reads the persisted last-run timestamp from platform settings and populates
// the in-memory lastRunAt so the System Info panel is not blank right after a
// restart. Called once during startup before the first scheduler tick.
export async function initSchedulerStatus(): Promise<void> {
  try {
    const stored = await storage.getPlatformSetting('schedulerLastRunAt');
    if (typeof stored === 'string') {
      const parsed = new Date(stored);
      if (!Number.isNaN(parsed.getTime())) {
        lastRunAt = parsed;
      }
    }
  } catch (err) {
    // Non-fatal: if the setting is missing we just start blank.
    console.warn('[Scheduler] Could not read persisted last-run time:', err);
  }
}

function recordSchedulerRun(): void {
  lastRunAt = new Date();
  nextRunAt = new Date(lastRunAt.getTime() + EXPIRY_CHECK_INTERVAL_MS);
  // Persist so the timestamp survives a restart. Fire-and-forget; a failure
  // only affects the admin display, not the scheduler itself.
  storage.savePlatformSetting('schedulerLastRunAt', lastRunAt.toISOString())
    .catch((err) => console.warn('[Scheduler] Could not persist last-run time:', err));
}

export async function resolveExpiryWarningDays(): Promise<number> {
  const savedDays = await storage.getPlatformSetting('expiryWarningDays');
  const rawDays = typeof savedDays === 'number' ? savedDays : 7;
  return Math.min(90, Math.max(1, Math.round(rawDays)));
}

// Sends the expiry warning (in-app notification + email) for a single
// subscription and marks it as warned. Shared by the hourly scheduler and the
// admin "Send warnings now" action so both produce identical side effects.
// Returns true when the warning was sent, false when it was skipped (e.g. the
// owning agent could not be found).
//
// The expiry warning in-app notification and email are critical,
// time-sensitive operational notifications: they tell the agent that a
// subscription's commission accrual is about to stop and that the
// merchant must renew. Like the post-expiry email in the admin route
// (PATCH /api/admin/subscriptions/:id/status), they are intentionally
// NOT gated behind any emailPreferences flag — there is no opt-out, so
// agents are always warned even when every other email preference is
// turned off. Other email types (paused/cancelled/reactivated/etc.)
// continue to respect emailPreferences elsewhere.
export async function sendSubscriptionExpiryWarning(
  sub: Awaited<ReturnType<typeof storage.getSubscriptionsDueForWarning>>[number],
): Promise<boolean> {
  const agent = await storage.getAgent(sub.agentId);
  if (!agent) return false;

  const expiryDate = new Date(sub.endDate!).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const msUntilExpiry = new Date(sub.endDate!).getTime() - Date.now();
  const daysUntilExpiry = Math.round(msUntilExpiry / (24 * 60 * 60 * 1000));

  const tierLabel = sub.tier.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

  storage.createNotification({
    agentId: sub.agentId,
    type: 'system',
    title: `Subscription Expiring Soon: ${sub.merchantName}`,
    message: `Your ${tierLabel} subscription for ${sub.merchantName} expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''} on ${expiryDate}. Commission accrual will stop at that time.`,
  }).catch((err) => console.error('[Scheduler] Failed to create expiry warning notification:', err));

  emailService.sendSubscriptionExpiringWarningEmail(agent.email, {
    firstName: agent.firstName,
    merchantName: sub.merchantName,
    tier: tierLabel,
    expiryDate,
    daysUntilExpiry,
  }).catch((err) => console.error('[Scheduler] Failed to send subscription expiry warning email:', err));

  await storage.markSubscriptionWarningSent(sub.id);

  console.log(`[Scheduler] Sent expiry warning for subscription #${sub.id} (${sub.merchantName}, expires ${expiryDate})`);
  return true;
}

// Sends warnings for every subscription currently in the warning window and
// reports how many were sent. Used by the admin "Send warnings now" endpoint.
export async function sendDueExpiryWarnings(): Promise<{ days: number; total: number; sent: number }> {
  const days = await resolveExpiryWarningDays();
  const due = await storage.getSubscriptionsDueForWarning(days);
  let sent = 0;

  for (const sub of due) {
    try {
      if (await sendSubscriptionExpiryWarning(sub)) sent++;
    } catch (err) {
      console.error(`[Scheduler] Failed to process expiry warning for subscription #${sub.id}:`, err);
    }
  }

  return { days, total: due.length, sent };
}

export async function warnUpcomingExpirations(): Promise<void> {
  try {
    const expiryWarningDays: number = await resolveExpiryWarningDays();
    const due = await storage.getSubscriptionsDueForWarning(expiryWarningDays);
    if (due.length === 0) return;

    console.log(`[Scheduler] Found ${due.length} subscription(s) expiring soon — sending warnings`);

    for (const sub of due) {
      try {
        await sendSubscriptionExpiryWarning(sub);
      } catch (err) {
        console.error(`[Scheduler] Failed to process expiry warning for subscription #${sub.id}:`, err);
      }
    }
  } catch (err) {
    console.error('[Scheduler] Expiry warning check failed:', err);
  }
}

export async function expireOverdueSubscriptions(): Promise<void> {
  try {
    const due = await storage.getSubscriptionsDueForExpiry();
    if (due.length === 0) return;

    console.log(`[Scheduler] Found ${due.length} subscription(s) to auto-expire`);

    for (const sub of due) {
      // Isolate the status transition so a failure logs an admin alert
      // and the subscription is retried on the next scheduler tick.
      try {
        await storage.updateSubscriptionStatus(sub.id, 'expired');
      } catch (err) {
        console.error(`[Scheduler] Failed to auto-expire subscription #${sub.id}:`, err);

        storage.logActivity({
          actorId: 0,
          actorType: 'system',
          action: 'error',
          entityType: 'subscription',
          entityId: sub.id,
          description: `Auto-expiry failed for subscription #${sub.id} (merchant: "${sub.merchantName}", tier: ${sub.tier}) — will retry on next scheduler run`,
          details: {
            merchantName: sub.merchantName,
            tier: sub.tier,
            endDate: sub.endDate,
            currentStatus: sub.status,
            error: err instanceof Error ? err.message : String(err),
          },
          ipAddress: null,
          userAgent: null,
        }).catch((logErr) => console.error(`[Scheduler] Failed to log auto-expiry failure for subscription #${sub.id}:`, logErr));

        continue;
      }

      // Status transition succeeded; side effects are fire-and-forget.
      const agent = await storage.getAgent(sub.agentId).catch(() => null);

      // Alert admins if expiry caused this agent to lose their last active sub.
      if (agent) {
        maybeNotifyAdminsAgentLostLastSubscription(
          agent.id,
          `${agent.firstName} ${agent.lastName}`,
        ).catch((err) => console.error('[AdminAlert] last-sub alert error (scheduler):', err));
      }

      const effectiveDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const tierLabel = sub.tier.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

      if (agent) {
        storage.createNotification({
          agentId: sub.agentId,
          type: 'system',
          title: `Subscription Expired: ${sub.merchantName}`,
          message: `Your ${tierLabel} subscription for ${sub.merchantName} has expired as of ${effectiveDate}. Commission accrual has stopped.`,
        }).catch((err) => console.error('[Scheduler] Failed to create expiry notification:', err));

        emailService.sendSubscriptionExpiredEmail(agent.email, {
          firstName: agent.firstName,
          merchantName: sub.merchantName,
          tier: tierLabel,
          effectiveDate,
        }).catch((err) => console.error('[Scheduler] Failed to send subscription expired email:', err));
      }

      storage.logActivity({
        actorId: 0,
        actorType: 'system',
        action: 'update',
        entityType: 'subscription',
        entityId: sub.id,
        description: `System auto-expired subscription #${sub.id} for merchant "${sub.merchantName}" (tier: ${sub.tier}) — end date passed`,
        details: {
          previousStatus: sub.status,
          newStatus: 'expired',
          merchantName: sub.merchantName,
          tier: sub.tier,
          endDate: sub.endDate,
        },
        ipAddress: null,
        userAgent: null,
      }).catch((err) => console.error('[Scheduler] Failed to log auto-expiry activity:', err));

      console.log(`[Scheduler] Auto-expired subscription #${sub.id} for merchant "${sub.merchantName}"`);
    }
  } catch (err) {
    console.error('[Scheduler] Expiry check failed:', err);
  }
}

// Governance (Task #473): distributor tiers are recalculated once per calendar
// month from trailing production. The hourly scheduler tick calls this guard,
// which only runs the (network-wide) recalculation when the month rolls over.
// Best-effort: an in-memory marker is enough because the admin can also trigger
// a recalculation manually, and a missed month self-corrects on the next run.
let lastGovernanceMonthKey: string | null = null;

function currentMonthKey(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${now.getUTCMonth()}`;
}

export async function recalculateGovernanceIfDue(now: Date = new Date()): Promise<void> {
  const key = currentMonthKey(now);
  if (lastGovernanceMonthKey === key) return;
  lastGovernanceMonthKey = key;
  try {
    const summary = await recalculateAllGovernance(storage, now);
    console.log(`[Scheduler] Monthly distributor-tier recalculation complete: ${summary.changed}/${summary.processed} agents changed`);
  } catch (err) {
    // Allow a retry on the next tick if this run failed.
    lastGovernanceMonthKey = null;
    console.error('[Scheduler] Monthly governance recalculation failed:', err);
  }
}

export async function startScheduler(): Promise<void> {
  // Restore the persisted last-run time before the first tick so the System
  // Info panel shows the previous run immediately after a restart.
  await initSchedulerStatus();
  recordSchedulerRun();
  warnUpcomingExpirations();
  expireOverdueSubscriptions();
  recalculateGovernanceIfDue();
  setInterval(() => {
    recordSchedulerRun();
    warnUpcomingExpirations();
    expireOverdueSubscriptions();
    recalculateGovernanceIfDue();
  }, EXPIRY_CHECK_INTERVAL_MS);
  console.log(`[Scheduler] Subscription expiry scheduler started (interval: ${EXPIRY_CHECK_INTERVAL_MS}ms)`);
}
