import { db } from './db';
import { subscriptions, platformSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { storage } from './storage';
import { CONFIG } from './config';
import Stripe from 'stripe';
import { getUncachableStripeClient } from './stripeClient';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const envSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, 'stripe_webhook_secret'));
    const dbSecret = row?.value as string | undefined;
    const webhookSecret = envSecret || dbSecret;

    if (!webhookSecret) {
      throw new Error('[Webhook] No STRIPE_WEBHOOK_SECRET env var or stripe_webhook_secret in platform_settings — cannot verify signature');
    }

    const stripe = await getUncachableStripeClient();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    console.log(`[Webhook] Processing event: ${event.type}`);

    switch (event.type) {
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        if (subId) {
          await WebhookHandlers.handleInvoicePaid(subId, invoice);
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        if (subId) {
          await WebhookHandlers.handleInvoicePaymentFailed(subId);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await WebhookHandlers.handleSubscriptionDeleted(sub.id);
        break;
      }
      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }
  }

  static async handleInvoicePaid(stripeSubscriptionId: string, invoiceData: any): Promise<void> {
    const [sub] = await db.select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));

    if (!sub) {
      console.log(`[Webhook] No subscription found for stripeSubscriptionId: ${stripeSubscriptionId}`);
      return;
    }

    const now = new Date();
    const periodEnd = invoiceData.lines?.data?.[0]?.period?.end
      ? new Date(invoiceData.lines.data[0].period.end * 1000)
      : null;

    await db.update(subscriptions)
      .set({
        billingStatus: 'active',
        lastChargedAt: now,
        nextBillingDate: periodEnd,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, sub.id));

    console.log(`[Webhook] Subscription ${sub.id} billing status set to active`);

    await WebhookHandlers.fireCommissions(sub, now);
  }

  static async handleInvoicePaymentFailed(stripeSubscriptionId: string): Promise<void> {
    const [sub] = await db.select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));

    if (!sub) return;

    await db.update(subscriptions)
      .set({ billingStatus: 'past_due', updatedAt: new Date() })
      .where(eq(subscriptions.id, sub.id));

    console.log(`[Webhook] Subscription ${sub.id} billing status set to past_due`);

    storage.logActivity({
      actorId: sub.agentId,
      actorType: 'system',
      action: 'billing_failed',
      entityType: 'subscription',
      entityId: sub.id,
      description: `Payment failed for ${sub.tier} subscription for merchant "${sub.merchantName}"`,
      details: { stripeSubscriptionId },
      ipAddress: null,
      userAgent: null,
    }).catch(console.error);

    storage.createNotification({
      agentId: sub.agentId,
      type: 'system',
      title: 'Payment Failed',
      message: `A payment failed for your ${sub.tier} subscription for merchant "${sub.merchantName}". Please update payment information.`,
    }).catch(console.error);
  }

  static async handleSubscriptionDeleted(stripeSubscriptionId: string): Promise<void> {
    const [sub] = await db.select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));

    if (!sub) return;

    await db.update(subscriptions)
      .set({ billingStatus: 'cancelled', updatedAt: new Date() })
      .where(eq(subscriptions.id, sub.id));

    console.log(`[Webhook] Subscription ${sub.id} billing status set to cancelled`);
  }

  private static async fireCommissions(sub: any, now: Date): Promise<void> {
    try {
      const startDate = new Date(sub.startDate);
      const monthsSinceStart = Math.floor(
        (now.getTime() - startDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000)
      );

      let decayRate: number;
      if (monthsSinceStart < 3) decayRate = CONFIG.subscriptionDecay.months1to3;
      else if (monthsSinceStart < 6) decayRate = CONFIG.subscriptionDecay.months4to6;
      else if (monthsSinceStart < 9) decayRate = CONFIG.subscriptionDecay.months7to9;
      else if (monthsSinceStart < 12) decayRate = CONFIG.subscriptionDecay.months10to12;
      else decayRate = CONFIG.subscriptionDecay.postMonth12;

      const monthlyAmount = Number(sub.monthlyAmount);
      const poolRate = CONFIG.subscriptionPools[sub.tier] || 0.50;
      let commissionRate = poolRate * decayRate;

      if (sub.mcaPairedDealId && monthsSinceStart < 3) {
        commissionRate += CONFIG.mcaPairingBonus;
      }

      const commissionAmount = monthlyAmount * commissionRate;
      const commType = monthsSinceStart >= 12 ? 'subscription_residual' : 'subscription_commission';
      const periodDate = now.toISOString().split('T')[0];

      if (commissionAmount > 0) {
        await storage.createCommission({
          agentId: sub.agentId,
          subscriptionId: sub.id,
          type: commType,
          amount: commissionAmount.toFixed(2),
          periodDate,
          status: 'pending',
        });

        const upline = await storage.getUpline(sub.agentId);
        const uplineRates = [
          CONFIG.subscriptionUplinesOverride.l1Rate,
          CONFIG.subscriptionUplinesOverride.l2Rate,
        ];
        for (let i = 0; i < upline.length && i < uplineRates.length; i++) {
          const sponsor = upline[i];
          const uplineAmount = monthlyAmount * poolRate * uplineRates[i] * decayRate;
          if (uplineAmount > 0) {
            await storage.createCommission({
              agentId: sponsor.id,
              subscriptionId: sub.id,
              type: 'subscription_residual',
              amount: uplineAmount.toFixed(2),
              periodDate,
              sourceAgentId: sub.agentId,
              status: 'pending',
            });
          }
        }
        console.log(`[Webhook] Fired commissions for subscription ${sub.id}, amount: $${commissionAmount.toFixed(2)}`);
      }
    } catch (err) {
      console.error(`[Webhook] Failed to fire commissions for subscription ${sub.id}:`, err);
    }
  }
}
