import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type Stripe from 'stripe';
import express from 'express';
import request from 'supertest';

// ── Mock stripeClient before any import that uses it ─────────────────────
// vi.mock is hoisted by Vitest, so this runs before static imports.
vi.mock('./stripeClient.js', () => ({
  getUncachableStripeClient: vi.fn(),
}));

// ── Mock the database module ──────────────────────────────────────────────
// processWebhook does a DB select for the stripe_webhook_secret row. The env
// var takes precedence, but the select is still awaited so we must stub it.
vi.mock('./db.js', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

// ── Mock storage so commission/notification side-effects don't touch DB ──
vi.mock('./storage.js', () => ({
  storage: {
    createCommission: vi.fn().mockResolvedValue({}),
    getUpline: vi.fn().mockResolvedValue([]),
    logActivity: vi.fn().mockResolvedValue({}),
    createNotification: vi.fn().mockResolvedValue({}),
    getAgent: vi.fn().mockResolvedValue(undefined),
  },
}));

// ── Mock the email service so the payment-failed alert doesn't hit Resend ──
vi.mock('./email.js', () => ({
  emailService: {
    sendSubscriptionPaymentFailedEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

import { WebhookHandlers, WebhookConfigError } from './webhookHandlers.js';
import { getUncachableStripeClient } from './stripeClient.js';
import { db } from './db.js';
import { storage } from './storage.js';
import { emailService } from './email.js';

// ── Helper: build a minimal mock Stripe client ────────────────────────────
function buildMockStripeWithEvent(event: Partial<Stripe.Event>) {
  return {
    webhooks: {
      constructEvent: vi.fn().mockReturnValue(event),
    },
  };
}

// ── Typed helper: stub db.select() to resolve with the given rows ─────────
// Uses the pattern established in this codebase (as unknown as T) to satisfy
// the complex drizzle chain type without losing intent.
type DbSelectChain = ReturnType<typeof db.select>;

function mockDbSelectResult(rows: unknown[]): DbSelectChain {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  } as unknown as DbSelectChain;
}

// ── Typed helper: assert the billingStatus passed to db.update().set() ────
function getSetCallArg(callIndex = 0): Record<string, unknown> {
  const setFn = vi.mocked(db.update).mock.results[callIndex]?.value?.set;
  expect(setFn).toBeDefined();
  const [firstArg] = setFn.mock.calls[0] ?? [];
  return firstArg as Record<string, unknown>;
}

// ── Build a minimal Express app replicating the webhook route ─────────────
// Mirrors the route setup in server/index.ts so tests exercise the real
// HTTP path (raw body, stripe-signature header, error responses).
function buildWebhookApp() {
  const app = express();
  app.post(
    '/api/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const signature = req.headers['stripe-signature'];
      if (!signature) {
        return res.status(400).json({ error: 'Missing stripe-signature header' });
      }
      try {
        const sig = Array.isArray(signature) ? signature[0] : signature;
        await WebhookHandlers.processWebhook(req.body as Buffer, sig);
        res.status(200).json({ received: true });
      } catch (error: unknown) {
        if (error instanceof WebhookConfigError) {
          console.error('[Stripe Webhook] Configuration error:', error.message);
          return res.status(400).json({ error: 'Webhook not configured' });
        }
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Stripe Webhook] Error:', message);
        res.status(400).json({ error: 'Webhook processing error' });
      }
    }
  );
  return app;
}

// ── Env / cleanup helpers ─────────────────────────────────────────────────
const TEST_WEBHOOK_SECRET = 'whsec_test_secret_for_unit_tests';

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
  vi.clearAllMocks();
});

afterEach(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
  vi.restoreAllMocks();
});

// ── Signature verification ────────────────────────────────────────────────
describe('WebhookHandlers.processWebhook – signature verification', () => {
  it('throws when constructEvent throws due to a bad signature', async () => {
    const mockStripe = {
      webhooks: {
        constructEvent: vi.fn().mockImplementation(() => {
          throw new Error('No signatures found matching the expected signature for payload');
        }),
      },
    };
    vi.mocked(getUncachableStripeClient).mockResolvedValue(mockStripe as unknown as Stripe);

    const payload = Buffer.from(JSON.stringify({ type: 'invoice.paid' }));

    await expect(
      WebhookHandlers.processWebhook(payload, 'bad_signature')
    ).rejects.toThrow('Webhook signature verification failed');
  });

  it('throws when payload is not a Buffer', async () => {
    await expect(
      WebhookHandlers.processWebhook('not-a-buffer' as unknown as Buffer, 'sig')
    ).rejects.toThrow('Payload must be a Buffer');
  });

  it('throws when no webhook secret is configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const payload = Buffer.from(JSON.stringify({ type: 'invoice.paid' }));

    await expect(
      WebhookHandlers.processWebhook(payload, 'some_signature')
    ).rejects.toThrow('No STRIPE_WEBHOOK_SECRET');
  });

  it('throws a WebhookConfigError when no webhook secret is configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    vi.mocked(db.select).mockReturnValueOnce(mockDbSelectResult([])); // no platformSettings secret

    const payload = Buffer.from(JSON.stringify({ type: 'invoice.paid' }));

    await expect(
      WebhookHandlers.processWebhook(payload, 'some_signature')
    ).rejects.toBeInstanceOf(WebhookConfigError);
  });
});

// ── POST /api/webhooks/stripe – misconfigured webhook secret ──────────────
// Guards the production hardening: when no secret is configured the route must
// respond 400 (never 500) with a safe, non-leaking message, and must not leak
// the underlying configuration detail to the caller.
describe('POST /api/webhooks/stripe – missing webhook secret', () => {
  it('responds 400 with a generic message when no webhook secret is configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    vi.mocked(db.select).mockReturnValueOnce(mockDbSelectResult([])); // no platformSettings secret

    const app = buildWebhookApp();

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'some_signature')
      .send(Buffer.from(JSON.stringify({ type: 'invoice.paid' })))
      .expect(400);

    expect(res.body).toEqual({ error: 'Webhook not configured' });
    // The raw configuration detail must never reach the caller.
    expect(JSON.stringify(res.body)).not.toContain('STRIPE_WEBHOOK_SECRET');
    expect(db.update).not.toHaveBeenCalled();
  });
});

// ── Event routing – invoice.paid ──────────────────────────────────────────
describe('WebhookHandlers.processWebhook – invoice.paid routing', () => {
  it('calls handleInvoicePaid with the subscription ID from the invoice', async () => {
    const stripeSubId = 'sub_invoice_paid_test';
    const invoiceObject = {
      subscription: stripeSubId,
      lines: { data: [{ period: { end: Math.floor(Date.now() / 1000) + 2592000 } }] },
    };

    const fakeEvent: Partial<Stripe.Event> = {
      type: 'invoice.paid',
      data: { object: invoiceObject as unknown as Stripe.Event.Data['object'] },
    };

    const mockStripe = buildMockStripeWithEvent(fakeEvent);
    vi.mocked(getUncachableStripeClient).mockResolvedValue(mockStripe as unknown as Stripe);

    const handleInvoicePaidSpy = vi
      .spyOn(WebhookHandlers, 'handleInvoicePaid')
      .mockResolvedValue(undefined);

    const payload = Buffer.from(JSON.stringify(fakeEvent));
    await WebhookHandlers.processWebhook(payload, 'valid_signature');

    expect(handleInvoicePaidSpy).toHaveBeenCalledTimes(1);
    expect(handleInvoicePaidSpy).toHaveBeenCalledWith(stripeSubId, invoiceObject);
  });

  it('does not call handleInvoicePaid when the invoice has no subscription ID', async () => {
    const invoiceObject = { subscription: null, lines: { data: [] } };

    const fakeEvent: Partial<Stripe.Event> = {
      type: 'invoice.paid',
      data: { object: invoiceObject as unknown as Stripe.Event.Data['object'] },
    };

    const mockStripe = buildMockStripeWithEvent(fakeEvent);
    vi.mocked(getUncachableStripeClient).mockResolvedValue(mockStripe as unknown as Stripe);

    const handleInvoicePaidSpy = vi
      .spyOn(WebhookHandlers, 'handleInvoicePaid')
      .mockResolvedValue(undefined);

    const payload = Buffer.from(JSON.stringify(fakeEvent));
    await WebhookHandlers.processWebhook(payload, 'valid_signature');

    expect(handleInvoicePaidSpy).not.toHaveBeenCalled();
  });
});

// ── Event routing – invoice.payment_failed ───────────────────────────────
describe('WebhookHandlers.processWebhook – invoice.payment_failed routing', () => {
  it('calls handleInvoicePaymentFailed with the subscription ID from the invoice', async () => {
    const stripeSubId = 'sub_invoice_failed_test';
    const invoiceObject = { subscription: stripeSubId, lines: { data: [] } };

    const fakeEvent: Partial<Stripe.Event> = {
      type: 'invoice.payment_failed',
      data: { object: invoiceObject as unknown as Stripe.Event.Data['object'] },
    };

    const mockStripe = buildMockStripeWithEvent(fakeEvent);
    vi.mocked(getUncachableStripeClient).mockResolvedValue(mockStripe as unknown as Stripe);

    const handleInvoicePaymentFailedSpy = vi
      .spyOn(WebhookHandlers, 'handleInvoicePaymentFailed')
      .mockResolvedValue(undefined);

    const payload = Buffer.from(JSON.stringify(fakeEvent));
    await WebhookHandlers.processWebhook(payload, 'valid_signature');

    expect(handleInvoicePaymentFailedSpy).toHaveBeenCalledTimes(1);
    expect(handleInvoicePaymentFailedSpy).toHaveBeenCalledWith(stripeSubId);
  });

  it('does not call handleInvoicePaymentFailed when the invoice has no subscription ID', async () => {
    const invoiceObject = { subscription: null, lines: { data: [] } };

    const fakeEvent: Partial<Stripe.Event> = {
      type: 'invoice.payment_failed',
      data: { object: invoiceObject as unknown as Stripe.Event.Data['object'] },
    };

    const mockStripe = buildMockStripeWithEvent(fakeEvent);
    vi.mocked(getUncachableStripeClient).mockResolvedValue(mockStripe as unknown as Stripe);

    const handleInvoicePaymentFailedSpy = vi
      .spyOn(WebhookHandlers, 'handleInvoicePaymentFailed')
      .mockResolvedValue(undefined);

    const payload = Buffer.from(JSON.stringify(fakeEvent));
    await WebhookHandlers.processWebhook(payload, 'valid_signature');

    expect(handleInvoicePaymentFailedSpy).not.toHaveBeenCalled();
  });
});

// ── Unit – handleInvoicePaymentFailed updates billingStatus in the DB ─────
describe('WebhookHandlers.handleInvoicePaymentFailed – updates billingStatus', () => {
  it('updates the matched subscription billingStatus to "past_due"', async () => {
    const stripeSubId = 'sub_handler_past_due_test';
    const fakeSubscription = { id: 101, stripeSubscriptionId: stripeSubId, ...fakeSubscriptionBase };

    vi.mocked(db.select).mockReturnValueOnce(mockDbSelectResult([fakeSubscription]));

    await WebhookHandlers.handleInvoicePaymentFailed(stripeSubId);

    expect(db.update).toHaveBeenCalledTimes(1);
    expect(getSetCallArg()).toMatchObject({ billingStatus: 'past_due' });
  });

  it('does not update anything when no subscription matches the stripe ID', async () => {
    vi.mocked(db.select).mockReturnValueOnce(mockDbSelectResult([]));

    await WebhookHandlers.handleInvoicePaymentFailed('sub_nonexistent_test');

    expect(db.update).not.toHaveBeenCalled();
  });

  it("logs a 'billing_failed' activity entry for the subscription's agent", async () => {
    const stripeSubId = 'sub_handler_activity_test';
    const fakeSubscription = { id: 110, stripeSubscriptionId: stripeSubId, ...fakeSubscriptionBase };

    vi.mocked(db.select).mockReturnValueOnce(mockDbSelectResult([fakeSubscription]));

    await WebhookHandlers.handleInvoicePaymentFailed(stripeSubId);

    expect(storage.logActivity).toHaveBeenCalledTimes(1);
    expect(storage.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: fakeSubscription.agentId,
        action: 'billing_failed',
        entityType: 'subscription',
        entityId: fakeSubscription.id,
      })
    );
  });

  it("creates a 'Payment Failed' notification for the subscription's agent", async () => {
    const stripeSubId = 'sub_handler_notification_test';
    const fakeSubscription = { id: 111, stripeSubscriptionId: stripeSubId, ...fakeSubscriptionBase };

    vi.mocked(db.select).mockReturnValueOnce(mockDbSelectResult([fakeSubscription]));

    await WebhookHandlers.handleInvoicePaymentFailed(stripeSubId);

    expect(storage.createNotification).toHaveBeenCalledTimes(1);
    expect(storage.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: fakeSubscription.agentId,
        title: 'Payment Failed',
      })
    );
  });

  it('does not log activity or notify when no subscription matches the stripe ID', async () => {
    vi.mocked(db.select).mockReturnValueOnce(mockDbSelectResult([]));

    await WebhookHandlers.handleInvoicePaymentFailed('sub_nonexistent_alert_test');

    expect(storage.logActivity).not.toHaveBeenCalled();
    expect(storage.createNotification).not.toHaveBeenCalled();
  });
});

// ── Unit – handleInvoicePaymentFailed emails the agent ────────────────────
describe('WebhookHandlers.handleInvoicePaymentFailed – emails the agent', () => {
  const fakeAgent = {
    id: 1,
    email: 'agent@example.com',
    firstName: 'Dana',
    emailPreferences: {},
  };

  it("sends a payment-failed email to the subscription's agent", async () => {
    const stripeSubId = 'sub_email_test';
    const fakeSubscription = { id: 120, stripeSubscriptionId: stripeSubId, ...fakeSubscriptionBase };

    vi.mocked(db.select).mockReturnValueOnce(mockDbSelectResult([fakeSubscription]));
    vi.mocked(storage.getAgent).mockResolvedValueOnce(fakeAgent as never);

    await WebhookHandlers.handleInvoicePaymentFailed(stripeSubId);
    // Allow the fire-and-forget getAgent().then() chain to settle.
    await new Promise((resolve) => setImmediate(resolve));

    expect(storage.getAgent).toHaveBeenCalledWith(fakeSubscription.agentId);
    expect(emailService.sendSubscriptionPaymentFailedEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendSubscriptionPaymentFailedEmail).toHaveBeenCalledWith(
      fakeAgent.email,
      expect.objectContaining({
        firstName: fakeAgent.firstName,
        merchantName: fakeSubscription.merchantName,
        tier: fakeSubscription.tier,
      })
    );
  });

  it('respects the agent opting out via emailOnPaymentRetryFailed: false', async () => {
    const stripeSubId = 'sub_email_optout_test';
    const fakeSubscription = { id: 121, stripeSubscriptionId: stripeSubId, ...fakeSubscriptionBase };

    vi.mocked(db.select).mockReturnValueOnce(mockDbSelectResult([fakeSubscription]));
    vi.mocked(storage.getAgent).mockResolvedValueOnce({
      ...fakeAgent,
      emailPreferences: { emailOnPaymentRetryFailed: false },
    } as never);

    await WebhookHandlers.handleInvoicePaymentFailed(stripeSubId);
    await new Promise((resolve) => setImmediate(resolve));

    expect(emailService.sendSubscriptionPaymentFailedEmail).not.toHaveBeenCalled();
  });

  it('does not email when the agent cannot be found', async () => {
    const stripeSubId = 'sub_email_no_agent_test';
    const fakeSubscription = { id: 122, stripeSubscriptionId: stripeSubId, ...fakeSubscriptionBase };

    vi.mocked(db.select).mockReturnValueOnce(mockDbSelectResult([fakeSubscription]));
    vi.mocked(storage.getAgent).mockResolvedValueOnce(undefined as never);

    await WebhookHandlers.handleInvoicePaymentFailed(stripeSubId);
    await new Promise((resolve) => setImmediate(resolve));

    expect(emailService.sendSubscriptionPaymentFailedEmail).not.toHaveBeenCalled();
  });

  it('does not throw when the email send rejects', async () => {
    const stripeSubId = 'sub_email_reject_test';
    const fakeSubscription = { id: 123, stripeSubscriptionId: stripeSubId, ...fakeSubscriptionBase };

    vi.mocked(db.select).mockReturnValueOnce(mockDbSelectResult([fakeSubscription]));
    vi.mocked(storage.getAgent).mockResolvedValueOnce(fakeAgent as never);
    vi.mocked(emailService.sendSubscriptionPaymentFailedEmail).mockRejectedValueOnce(
      new Error('Resend down')
    );

    await expect(
      WebhookHandlers.handleInvoicePaymentFailed(stripeSubId)
    ).resolves.toBeUndefined();
    await new Promise((resolve) => setImmediate(resolve));

    expect(emailService.sendSubscriptionPaymentFailedEmail).toHaveBeenCalledTimes(1);
  });
});

// ── Event routing – customer.subscription.deleted ─────────────────────────
describe('WebhookHandlers.processWebhook – customer.subscription.deleted routing', () => {
  it('calls handleSubscriptionDeleted with the subscription ID', async () => {
    const stripeSubId = 'sub_deleted_test';
    const subscriptionObject = { id: stripeSubId };

    const fakeEvent: Partial<Stripe.Event> = {
      type: 'customer.subscription.deleted',
      data: { object: subscriptionObject as unknown as Stripe.Event.Data['object'] },
    };

    const mockStripe = buildMockStripeWithEvent(fakeEvent);
    vi.mocked(getUncachableStripeClient).mockResolvedValue(mockStripe as unknown as Stripe);

    const handleSubscriptionDeletedSpy = vi
      .spyOn(WebhookHandlers, 'handleSubscriptionDeleted')
      .mockResolvedValue(undefined);

    const payload = Buffer.from(JSON.stringify(fakeEvent));
    await WebhookHandlers.processWebhook(payload, 'valid_signature');

    expect(handleSubscriptionDeletedSpy).toHaveBeenCalledTimes(1);
    expect(handleSubscriptionDeletedSpy).toHaveBeenCalledWith(stripeSubId);
  });
});

// ── Unrecognised event types ──────────────────────────────────────────────
describe('WebhookHandlers.processWebhook – unrecognised event types', () => {
  it('resolves without error for an unknown event type', async () => {
    const fakeEvent: Partial<Stripe.Event> = {
      type: 'some.unrecognised.event' as Stripe.Event['type'],
      data: { object: {} as Stripe.Event.Data['object'] },
    };

    const mockStripe = buildMockStripeWithEvent(fakeEvent);
    vi.mocked(getUncachableStripeClient).mockResolvedValue(mockStripe as unknown as Stripe);

    const handleInvoicePaidSpy = vi
      .spyOn(WebhookHandlers, 'handleInvoicePaid')
      .mockResolvedValue(undefined);
    const handleSubscriptionDeletedSpy = vi
      .spyOn(WebhookHandlers, 'handleSubscriptionDeleted')
      .mockResolvedValue(undefined);

    const payload = Buffer.from(JSON.stringify(fakeEvent));
    await expect(
      WebhookHandlers.processWebhook(payload, 'valid_signature')
    ).resolves.toBeUndefined();

    expect(handleInvoicePaidSpy).not.toHaveBeenCalled();
    expect(handleSubscriptionDeletedSpy).not.toHaveBeenCalled();
  });
});

// ── Shared fixture for billing-status integration tests ───────────────────
const STRIPE_SUB_ID_PAID = 'sub_billing_active_test';
const STRIPE_SUB_ID_FAILED = 'sub_billing_past_due_test';

const fakeSubscriptionBase = {
  agentId: 1,
  tier: 'tier_1',
  monthlyAmount: '100.00',
  merchantName: 'Test Merchant',
  startDate: new Date('2025-01-01'),
  mcaPairedDealId: null,
};

const INVOICE_PERIOD_END = Math.floor(Date.now() / 1000) + 2592000;

// ── POST /api/webhooks/stripe – invoice.paid flips billingStatus to active ─
// These tests exercise the full HTTP path (raw body → signature check →
// event dispatch → handleInvoicePaid → db.update) to guard against
// regressions anywhere in the webhook pipeline.
describe('POST /api/webhooks/stripe – invoice.paid sets billingStatus to active', () => {
  const stripeSubId = STRIPE_SUB_ID_PAID;
  const fakeSubscription = { id: 99, stripeSubscriptionId: stripeSubId, ...fakeSubscriptionBase };

  const invoiceObject = {
    subscription: stripeSubId,
    lines: { data: [{ period: { end: INVOICE_PERIOD_END } }] },
  };

  const fakeEvent: Partial<Stripe.Event> = {
    type: 'invoice.paid',
    data: { object: invoiceObject as unknown as Stripe.Event.Data['object'] },
  };

  it('responds 200 and sets billingStatus to "active" when invoice.paid arrives', async () => {
    // processWebhook calls db.select once for the webhook secret (before signature
    // verification) and once inside handleInvoicePaid for the subscription lookup.
    vi.mocked(db.select)
      .mockReturnValueOnce(mockDbSelectResult([]))              // platformSettings secret lookup
      .mockReturnValueOnce(mockDbSelectResult([fakeSubscription])); // subscription lookup

    vi.mocked(getUncachableStripeClient).mockResolvedValue(
      buildMockStripeWithEvent(fakeEvent) as unknown as Stripe
    );

    const payload = Buffer.from(JSON.stringify(fakeEvent));
    const app = buildWebhookApp();

    await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid_sig_for_test')
      .send(payload)
      .expect(200)
      .expect({ received: true });

    expect(db.update).toHaveBeenCalledTimes(1);
    expect(getSetCallArg()).toMatchObject({ billingStatus: 'active' });
  });

  it('responds 400 when stripe-signature header is missing', async () => {
    const app = buildWebhookApp();

    await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('{}'))
      .expect(400)
      .expect({ error: 'Missing stripe-signature header' });
  });

  it('responds 400 when signature verification fails', async () => {
    vi.mocked(getUncachableStripeClient).mockResolvedValue({
      webhooks: {
        constructEvent: vi.fn().mockImplementation(() => {
          throw new Error('No matching signatures found');
        }),
      },
    } as unknown as Stripe);

    const app = buildWebhookApp();

    await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'bad_signature')
      .send(Buffer.from(JSON.stringify(fakeEvent)))
      .expect(400)
      .expect({ error: 'Webhook processing error' });

    expect(db.update).not.toHaveBeenCalled();
  });
});

// ── POST /api/webhooks/stripe – invoice.payment_failed flips to past_due ──
describe('POST /api/webhooks/stripe – invoice.payment_failed sets billingStatus to past_due', () => {
  const stripeSubId = STRIPE_SUB_ID_FAILED;
  const fakeSubscription = { id: 100, stripeSubscriptionId: stripeSubId, ...fakeSubscriptionBase };

  const invoiceObject = { subscription: stripeSubId, lines: { data: [] } };

  const fakeEvent: Partial<Stripe.Event> = {
    type: 'invoice.payment_failed',
    data: { object: invoiceObject as unknown as Stripe.Event.Data['object'] },
  };

  it('responds 200 and sets billingStatus to "past_due" when invoice.payment_failed arrives', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(mockDbSelectResult([]))              // platformSettings secret lookup
      .mockReturnValueOnce(mockDbSelectResult([fakeSubscription])); // subscription lookup

    vi.mocked(getUncachableStripeClient).mockResolvedValue(
      buildMockStripeWithEvent(fakeEvent) as unknown as Stripe
    );

    const payload = Buffer.from(JSON.stringify(fakeEvent));
    const app = buildWebhookApp();

    await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid_sig_for_test')
      .send(payload)
      .expect(200)
      .expect({ received: true });

    expect(db.update).toHaveBeenCalledTimes(1);
    expect(getSetCallArg()).toMatchObject({ billingStatus: 'past_due' });
  });
});

// ── Unit – handleInvoicePaid fires commissions via storage ────────────────
// fireCommissions runs after the billingStatus update. monthsSinceStart is
// derived from sub.startDate vs the handler's internal new Date(); using a
// startDate of "now" keeps monthsSinceStart at 0 → decayRate 1.00 and the
// commission type "subscription_commission", giving deterministic amounts.
describe('WebhookHandlers.handleInvoicePaid – fires commission payouts', () => {
  const invoiceData = {
    lines: { data: [{ period: { end: INVOICE_PERIOD_END } }] },
  };

  it('creates a pending commission for the agent with the expected type and amount', async () => {
    const stripeSubId = 'sub_commission_agent_test';
    // tier_1 pool 0.25 × decay 1.00 × $100 monthly = $25.00 commission.
    const fakeSubscription = {
      id: 201,
      stripeSubscriptionId: stripeSubId,
      agentId: 1,
      tier: 'tier_1',
      monthlyAmount: '100.00',
      merchantName: 'Test Merchant',
      startDate: new Date(),
      mcaPairedDealId: null,
    };

    vi.mocked(db.select).mockReturnValueOnce(mockDbSelectResult([fakeSubscription]));
    vi.mocked(storage.getUpline).mockResolvedValueOnce([]);

    await WebhookHandlers.handleInvoicePaid(stripeSubId, invoiceData);

    expect(storage.createCommission).toHaveBeenCalledTimes(1);
    expect(storage.createCommission).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 1,
        subscriptionId: 201,
        type: 'subscription_commission',
        amount: '25.00',
        status: 'pending',
      })
    );
  });

  it('fires upline override commissions when the agent has a sponsor', async () => {
    const stripeSubId = 'sub_commission_upline_test';
    const fakeSubscription = {
      id: 202,
      stripeSubscriptionId: stripeSubId,
      agentId: 5,
      tier: 'tier_1',
      monthlyAmount: '100.00',
      merchantName: 'Test Merchant',
      startDate: new Date(),
      mcaPairedDealId: null,
    };

    vi.mocked(db.select).mockReturnValueOnce(mockDbSelectResult([fakeSubscription]));
    // Single L1 sponsor: $100 × pool 0.25 × l1Rate 0.10 × decay 1.00 = $2.50.
    vi.mocked(storage.getUpline).mockResolvedValueOnce([{ id: 7 } as any]);

    await WebhookHandlers.handleInvoicePaid(stripeSubId, invoiceData);

    // One commission for the agent, one override for the sponsor.
    expect(storage.createCommission).toHaveBeenCalledTimes(2);
    expect(storage.createCommission).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 7,
        subscriptionId: 202,
        type: 'subscription_residual',
        amount: '2.50',
        sourceAgentId: 5,
        status: 'pending',
      })
    );
  });

  it('pays both L1 and L2 sponsor overrides at month 0 (no decay)', async () => {
    const stripeSubId = 'sub_commission_l1_l2_test';
    // tier_4 pool 0.50 × decay 1.00. Override rates: l1 0.10, l2 0.05.
    const fakeSubscription = {
      id: 204,
      stripeSubscriptionId: stripeSubId,
      agentId: 5,
      tier: 'tier_4',
      monthlyAmount: '100.00',
      merchantName: 'Test Merchant',
      startDate: new Date(),
      mcaPairedDealId: null,
    };

    vi.mocked(db.select).mockReturnValueOnce(mockDbSelectResult([fakeSubscription]));
    // L1 = id 7, L2 = id 8.
    vi.mocked(storage.getUpline).mockResolvedValueOnce([{ id: 7 } as any, { id: 8 } as any]);

    await WebhookHandlers.handleInvoicePaid(stripeSubId, invoiceData);

    // One commission for the agent, one override each for L1 and L2.
    expect(storage.createCommission).toHaveBeenCalledTimes(3);
    // L1: $100 × 0.50 × 0.10 × 1.00 = $5.00.
    expect(storage.createCommission).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 7,
        subscriptionId: 204,
        type: 'subscription_residual',
        amount: '5.00',
        sourceAgentId: 5,
        status: 'pending',
      })
    );
    // L2: $100 × 0.50 × 0.05 × 1.00 = $2.50.
    expect(storage.createCommission).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 8,
        subscriptionId: 204,
        type: 'subscription_residual',
        amount: '2.50',
        sourceAgentId: 5,
        status: 'pending',
      })
    );
  });

  it('shrinks the L1 upline override by decay for an aged subscription', async () => {
    const stripeSubId = 'sub_commission_upline_aged_test';
    // ~7.5 months old → monthsSinceStart 7 → decayRate 0.50 (months7to9 bucket).
    const agedStartDate = new Date(Date.now() - 7.5 * 30.44 * 24 * 60 * 60 * 1000);
    const fakeSubscription = {
      id: 205,
      stripeSubscriptionId: stripeSubId,
      agentId: 5,
      tier: 'tier_4',
      monthlyAmount: '100.00',
      merchantName: 'Test Merchant',
      startDate: agedStartDate,
      mcaPairedDealId: null,
    };

    vi.mocked(db.select).mockReturnValueOnce(mockDbSelectResult([fakeSubscription]));
    vi.mocked(storage.getUpline).mockResolvedValueOnce([{ id: 7 } as any]);

    await WebhookHandlers.handleInvoicePaid(stripeSubId, invoiceData);

    // L1 decayed: $100 × 0.50 × 0.10 × 0.50 = $2.50 (half the month-0 $5.00).
    expect(storage.createCommission).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 7,
        subscriptionId: 205,
        type: 'subscription_residual',
        amount: '2.50',
        sourceAgentId: 5,
        status: 'pending',
      })
    );
  });

  it('does not create any commission when the calculated amount is zero', async () => {
    const stripeSubId = 'sub_commission_zero_test';
    const fakeSubscription = {
      id: 203,
      stripeSubscriptionId: stripeSubId,
      agentId: 9,
      tier: 'tier_1',
      monthlyAmount: '0.00',
      merchantName: 'Test Merchant',
      startDate: new Date(),
      mcaPairedDealId: null,
    };

    vi.mocked(db.select).mockReturnValueOnce(mockDbSelectResult([fakeSubscription]));
    vi.mocked(storage.getUpline).mockResolvedValueOnce([{ id: 7 } as any]);

    await WebhookHandlers.handleInvoicePaid(stripeSubId, invoiceData);

    expect(storage.createCommission).not.toHaveBeenCalled();
  });

  it('adds the MCA pairing bonus when a recent subscription is paired with a deal', async () => {
    const stripeSubId = 'sub_commission_paired_recent_test';
    // tier_1 pool 0.25 + pairing bonus 0.05 = 0.30 × decay 1.00 × $100 = $30.00.
    const fakeSubscription = {
      id: 204,
      stripeSubscriptionId: stripeSubId,
      agentId: 1,
      tier: 'tier_1',
      monthlyAmount: '100.00',
      merchantName: 'Test Merchant',
      startDate: new Date(),
      mcaPairedDealId: 42,
    };

    vi.mocked(db.select).mockReturnValueOnce(mockDbSelectResult([fakeSubscription]));
    vi.mocked(storage.getUpline).mockReset();
    vi.mocked(storage.getUpline).mockResolvedValue([]);

    await WebhookHandlers.handleInvoicePaid(stripeSubId, invoiceData);

    expect(storage.createCommission).toHaveBeenCalledTimes(1);
    expect(storage.createCommission).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 1,
        subscriptionId: 204,
        type: 'subscription_commission',
        amount: '30.00',
        status: 'pending',
      })
    );
  });

  it('does not add the MCA pairing bonus once the subscription is older than 3 months', async () => {
    const stripeSubId = 'sub_commission_paired_old_test';
    // Started ~4 months ago: monthsSinceStart is in the 4–6 band → decay 0.75.
    // Pairing bonus is gated to monthsSinceStart < 3, so it must NOT apply.
    // tier_1 pool 0.25 × decay 0.75 × $100 = $18.75 (no +0.05 bonus).
    const fourMonthsAgo = new Date();
    fourMonthsAgo.setDate(fourMonthsAgo.getDate() - 122);
    const fakeSubscription = {
      id: 205,
      stripeSubscriptionId: stripeSubId,
      agentId: 1,
      tier: 'tier_1',
      monthlyAmount: '100.00',
      merchantName: 'Test Merchant',
      startDate: fourMonthsAgo,
      mcaPairedDealId: 42,
    };

    vi.mocked(db.select).mockReturnValueOnce(mockDbSelectResult([fakeSubscription]));
    vi.mocked(storage.getUpline).mockReset();
    vi.mocked(storage.getUpline).mockResolvedValue([]);

    await WebhookHandlers.handleInvoicePaid(stripeSubId, invoiceData);

    expect(storage.createCommission).toHaveBeenCalledTimes(1);
    expect(storage.createCommission).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 1,
        subscriptionId: 205,
        type: 'subscription_commission',
        amount: '18.75',
        status: 'pending',
      })
    );
  });

  it('pays the upline override on a paired deal using the base pool rate, WITHOUT the pairing bonus', async () => {
    const stripeSubId = 'sub_commission_paired_upline_test';
    // Paired, recent subscription. The direct agent earns the +0.05 pairing bonus
    // (tier_1 pool 0.25 + 0.05 = 0.30 × decay 1.00 × $100 = $30.00), but the upline
    // override intentionally uses ONLY the base pool rate:
    //   $100 × pool 0.25 × l1Rate 0.10 × decay 1.00 = $2.50 (no +0.05 bonus).
    const fakeSubscription = {
      id: 206,
      stripeSubscriptionId: stripeSubId,
      agentId: 5,
      tier: 'tier_1',
      monthlyAmount: '100.00',
      merchantName: 'Test Merchant',
      startDate: new Date(),
      mcaPairedDealId: 42,
    };

    vi.mocked(db.select).mockReturnValueOnce(mockDbSelectResult([fakeSubscription]));
    vi.mocked(storage.getUpline).mockReset();
    vi.mocked(storage.getUpline).mockResolvedValueOnce([{ id: 7 } as any]);

    await WebhookHandlers.handleInvoicePaid(stripeSubId, invoiceData);

    // One commission for the agent (with bonus), one override for the sponsor (no bonus).
    expect(storage.createCommission).toHaveBeenCalledTimes(2);

    // Direct agent gets the pairing bonus.
    expect(storage.createCommission).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 5,
        subscriptionId: 206,
        type: 'subscription_commission',
        amount: '30.00',
        status: 'pending',
      })
    );

    // Upline sponsor override is computed on the base pool rate, excluding the bonus.
    expect(storage.createCommission).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 7,
        subscriptionId: 206,
        type: 'subscription_residual',
        amount: '2.50',
        sourceAgentId: 5,
        status: 'pending',
      })
    );
  });
});

// ── Unit – handleInvoicePaid applies the subscription decay schedule ───────
// monthsSinceStart is floor((now - startDate) / 30.44 days). By back-dating
// startDate to the middle of a decay band we land deterministically inside
// that band, so the agent commission shrinks as the subscription ages:
//   months 1-3  → 1.00   (covered by the month-0 tests above)
//   months 4-6  → 0.75
//   months 7-9  → 0.50
//   months 10-12→ 0.25
//   after 12    → 0.10   (and the type switches to subscription_residual)
describe('WebhookHandlers.handleInvoicePaid – decay schedule by subscription age', () => {
  const invoiceData = {
    lines: { data: [{ period: { end: INVOICE_PERIOD_END } }] },
  };

  // vi.clearAllMocks() (global beforeEach) clears call history but NOT the
  // queued mockResolvedValueOnce implementations. The earlier "zero amount"
  // test queues a getUpline once-value that never gets consumed (createCommission
  // is skipped), so without a reset it would leak into the first test here and
  // fire an unexpected upline override. mockReset drains that queue.
  beforeEach(() => {
    vi.mocked(storage.getUpline).mockReset();
  });

  // Returns a startDate that yields the given monthsSinceStart. Adding 0.5 of a
  // month lands mid-band so Math.floor reliably produces the target value.
  function startDateForMonths(months: number): Date {
    const msPerMonth = 30.44 * 24 * 60 * 60 * 1000;
    return new Date(Date.now() - (months + 0.5) * msPerMonth);
  }

  function buildSub(months: number, id: number) {
    return {
      id,
      stripeSubscriptionId: `sub_decay_${months}m_test`,
      agentId: 1,
      tier: 'tier_1',
      monthlyAmount: '100.00',
      merchantName: 'Test Merchant',
      startDate: startDateForMonths(months),
      mcaPairedDealId: null,
    };
  }

  it('pays 75% at 4-6 months (tier_1 pool 0.25 × 0.75 × $100 = $18.75)', async () => {
    const sub = buildSub(4, 301);
    vi.mocked(db.select).mockReturnValueOnce(mockDbSelectResult([sub]));
    vi.mocked(storage.getUpline).mockResolvedValueOnce([]);

    await WebhookHandlers.handleInvoicePaid(sub.stripeSubscriptionId, invoiceData);

    expect(storage.createCommission).toHaveBeenCalledTimes(1);
    expect(storage.createCommission).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 1,
        subscriptionId: 301,
        type: 'subscription_commission',
        amount: '18.75',
        status: 'pending',
      })
    );
  });

  it('pays 50% at 7-9 months (tier_1 pool 0.25 × 0.50 × $100 = $12.50)', async () => {
    const sub = buildSub(7, 302);
    vi.mocked(db.select).mockReturnValueOnce(mockDbSelectResult([sub]));
    vi.mocked(storage.getUpline).mockResolvedValueOnce([]);

    await WebhookHandlers.handleInvoicePaid(sub.stripeSubscriptionId, invoiceData);

    expect(storage.createCommission).toHaveBeenCalledTimes(1);
    expect(storage.createCommission).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 1,
        subscriptionId: 302,
        type: 'subscription_commission',
        amount: '12.50',
        status: 'pending',
      })
    );
  });

  it('pays 25% at 10-12 months (tier_1 pool 0.25 × 0.25 × $100 = $6.25)', async () => {
    const sub = buildSub(10, 303);
    vi.mocked(db.select).mockReturnValueOnce(mockDbSelectResult([sub]));
    vi.mocked(storage.getUpline).mockResolvedValueOnce([]);

    await WebhookHandlers.handleInvoicePaid(sub.stripeSubscriptionId, invoiceData);

    expect(storage.createCommission).toHaveBeenCalledTimes(1);
    expect(storage.createCommission).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 1,
        subscriptionId: 303,
        type: 'subscription_commission',
        amount: '6.25',
        status: 'pending',
      })
    );
  });

  it('pays 10% and switches type to subscription_residual after 12 months (0.25 × 0.10 × $100 = $2.50)', async () => {
    const sub = buildSub(13, 304);
    vi.mocked(db.select).mockReturnValueOnce(mockDbSelectResult([sub]));
    vi.mocked(storage.getUpline).mockResolvedValueOnce([]);

    await WebhookHandlers.handleInvoicePaid(sub.stripeSubscriptionId, invoiceData);

    expect(storage.createCommission).toHaveBeenCalledTimes(1);
    expect(storage.createCommission).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 1,
        subscriptionId: 304,
        type: 'subscription_residual',
        amount: '2.50',
        status: 'pending',
      })
    );
  });
});
