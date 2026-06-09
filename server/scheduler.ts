import { storage } from "./storage";
import { emailService } from "./email";

export const EXPIRY_CHECK_INTERVAL_MS = process.env.EXPIRY_CHECK_INTERVAL_MS
  ? parseInt(process.env.EXPIRY_CHECK_INTERVAL_MS, 10)
  : 60 * 60 * 1000; // default: 1 hour

export async function warnUpcomingExpirations(): Promise<void> {
  try {
    const savedDays = await storage.getPlatformSetting('expiryWarningDays');
    const rawDays = typeof savedDays === 'number' ? savedDays : 7;
    const expiryWarningDays: number = Math.min(90, Math.max(1, Math.round(rawDays)));
    const due = await storage.getSubscriptionsDueForWarning(expiryWarningDays);
    if (due.length === 0) return;

    console.log(`[Scheduler] Found ${due.length} subscription(s) expiring soon — sending warnings`);

    for (const sub of due) {
      try {
        const agent = await storage.getAgent(sub.agentId);
        if (!agent) continue;

        const expiryDate = new Date(sub.endDate!).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        const msUntilExpiry = new Date(sub.endDate!).getTime() - Date.now();
        const daysUntilExpiry = Math.round(msUntilExpiry / (24 * 60 * 60 * 1000));

        const tierLabel = sub.tier.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

        // The expiry warning in-app notification and email are critical,
        // time-sensitive operational notifications: they tell the agent that a
        // subscription's commission accrual is about to stop and that the
        // merchant must renew. Like the post-expiry email in the admin route
        // (PATCH /api/admin/subscriptions/:id/status), they are intentionally
        // NOT gated behind any emailPreferences flag — there is no opt-out, so
        // agents are always warned even when every other email preference is
        // turned off. Other email types (paused/cancelled/reactivated/etc.)
        // continue to respect emailPreferences elsewhere.
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

export function startScheduler(): void {
  warnUpcomingExpirations();
  expireOverdueSubscriptions();
  setInterval(() => {
    warnUpcomingExpirations();
    expireOverdueSubscriptions();
  }, EXPIRY_CHECK_INTERVAL_MS);
  console.log(`[Scheduler] Subscription expiry scheduler started (interval: ${EXPIRY_CHECK_INTERVAL_MS}ms)`);
}
