import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type Stripe from 'stripe';

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

// ── Helper: build a minimal mock Stripe client ────────────────────────────
function buildMockStripeWithEvent(event: Partial<Stripe.Event>) {
  return {
    webhooks: {
      constructEvent: vi.fn().mockReturnValue(event),
    },
  };
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
