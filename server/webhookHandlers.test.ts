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
  },
}));

import { WebhookHandlers } from './webhookHandlers.js';
import { getUncachableStripeClient } from './stripeClient.js';
import { db } from './db.js';

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
