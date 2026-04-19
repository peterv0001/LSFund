import { storage } from "./storage";
import { emailService } from "./email";

const EXPIRY_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const EXPIRY_WARNING_DAYS = 7;

export async function expireOverdueSubscriptions(): Promise<void> {
  try {
    const due = await storage.getSubscriptionsDueForExpiry();
    if (due.length === 0) return;

    console.log(`[Scheduler] Found ${due.length} subscription(s) to auto-expire`);

    for (const sub of due) {
      try {
        await storage.updateSubscriptionStatus(sub.id, 'expired');

        const agent = await storage.getAgent(sub.agentId);
        if (!agent) continue;

        const effectiveDate = new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        const tierLabel = sub.tier.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

        storage.createNotification({
          agentId: sub.agentId,
          type: 'system',
          title: `Subscription Expired: ${sub.merchantName}`,
          message: `Your ${tierLabel} subscription for ${sub.merchantName} has expired as of ${effectiveDate}. Commission accrual has stopped.`,
        }).catch((err) => console.error('[Scheduler] Failed to create expiry notification:', err));

        const emailData = {
          firstName: agent.firstName,
          merchantName: sub.merchantName,
          tier: tierLabel,
          effectiveDate,
        };

        emailService.sendSubscriptionExpiredEmail(agent.email, emailData)
          .catch((err) => console.error('[Scheduler] Failed to send subscription expired email:', err));

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
      } catch (err) {
        console.error(`[Scheduler] Failed to auto-expire subscription #${sub.id}:`, err);
      }
    }
  } catch (err) {
    console.error('[Scheduler] Expiry check failed:', err);
  }
}

async function notifyApproachingExpiries(): Promise<void> {
  try {
    const approaching = await storage.getSubscriptionsApproachingExpiry(EXPIRY_WARNING_DAYS);
    if (approaching.length === 0) return;

    console.log(`[Scheduler] Found ${approaching.length} subscription(s) approaching expiry in ${EXPIRY_WARNING_DAYS} days`);

    for (const sub of approaching) {
      try {
        const agent = await storage.getAgent(sub.agentId);
        if (!agent) continue;

        if (!agent.emailNotifications) {
          console.log(`[Scheduler] Skipping expiry warning email for subscription #${sub.id} — agent ${agent.id} has email notifications disabled`);
          continue;
        }

        const expirationDate = sub.endDate
          ? new Date(sub.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : 'Unknown';
        const tierLabel = sub.tier.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

        storage.createNotification({
          agentId: sub.agentId,
          type: 'system',
          title: `Subscription Expiring Soon: ${sub.merchantName}`,
          message: `Your ${tierLabel} subscription for ${sub.merchantName} will expire on ${expirationDate}. Act now to avoid losing commission accrual.`,
        }).catch((err) => console.error('[Scheduler] Failed to create expiry warning notification:', err));

        const emailData = {
          firstName: agent.firstName,
          merchantName: sub.merchantName,
          tier: tierLabel,
          expirationDate,
          daysUntilExpiry: EXPIRY_WARNING_DAYS,
        };

        emailService.sendSubscriptionExpiringWarningEmail(agent.email, emailData)
          .catch((err) => console.error('[Scheduler] Failed to send subscription expiry warning email:', err));

        console.log(`[Scheduler] Sent expiry warning for subscription #${sub.id} for merchant "${sub.merchantName}" (expires ${expirationDate})`);
      } catch (err) {
        console.error(`[Scheduler] Failed to process expiry warning for subscription #${sub.id}:`, err);
      }
    }
  } catch (err) {
    console.error('[Scheduler] Expiry warning check failed:', err);
  }
}

export function startScheduler(): void {
  expireOverdueSubscriptions();
  notifyApproachingExpiries();
  setInterval(() => {
    expireOverdueSubscriptions();
    notifyApproachingExpiries();
  }, EXPIRY_CHECK_INTERVAL_MS);
  console.log('[Scheduler] Subscription expiry scheduler started (interval: 1 hour)');
}
