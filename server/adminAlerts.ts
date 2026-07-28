/**
 * Proactive admin-facing alerts fired when significant agent events occur.
 * Keeping this separate from storage.ts keeps individual concerns small and
 * makes it easy to import from both routes.ts and webhookHandlers.ts without
 * circular-dependency risk.
 */
import { storage } from './storage';

const LAST_SUB_ALERT_TITLE = 'Agent Lost Last Active Subscription';

/**
 * If `agentId` just lost their last active subscription (activeCount drops to 0
 * while totalCount > 0), create one admin-facing notification per admin that
 * links to the agent's subscription list.
 *
 * Idempotent: does nothing when the agent still has active subscriptions, never
 * had any, or when any admin already holds an unread alert for this agent
 * (prevents duplicate fan-out on rapid back-to-back events such as two subs
 * being cancelled in the same request or duplicate webhook delivery).
 */
export async function maybeNotifyAdminsAgentLostLastSubscription(
  agentId: number,
  agentName: string,
): Promise<void> {
  try {
    const [activeCount, totalCount] = await Promise.all([
      storage.getActiveSubscriptionCount(agentId),
      storage.getTotalSubscriptionCountForAgent(agentId),
    ]);

    // Agent still has active subscriptions — no alert needed.
    if (activeCount > 0) return;

    // Agent never had any subscriptions — nothing to win back.
    if (totalCount === 0) return;

    // An unread alert already exists for this agent across the admin pool — skip.
    const alreadyAlerted = await storage.hasUnreadAdminLastSubAlertForAgent(agentId);
    if (alreadyAlerted) return;

    const admins = await storage.getAdminAgents();
    if (admins.length === 0) return;

    const message =
      `${agentName} no longer has any active subscriptions (${totalCount} total). ` +
      `Consider reaching out for retention or win-back. ` +
      // Embed the subject agent ID so the dedup query can find this notification.
      `[agent-id:${agentId}] /admin/agents/${agentId}/subscriptions`;

    await Promise.all(
      admins.map((admin) =>
        storage.createNotification({
          agentId: admin.id,
          type: 'system',
          title: LAST_SUB_ALERT_TITLE,
          message,
          isRead: false,
          emailSent: false,
        }).catch((err) =>
          console.error(
            `[AdminAlert] Failed to notify admin ${admin.id} about agent ${agentId} losing last sub:`,
            err,
          )
        )
      )
    );

    console.log(
      `[AdminAlert] Notified ${admins.length} admin(s) that agent ${agentId} (${agentName}) lost their last active subscription`,
    );
  } catch (err) {
    // Alert failures must never propagate to the caller — the primary operation
    // (status change, webhook ack) must still succeed.
    console.error('[AdminAlert] maybeNotifyAdminsAgentLostLastSubscription error:', err);
  }
}
