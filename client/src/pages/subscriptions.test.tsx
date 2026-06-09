// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

// Stripe Elements cannot run inside jsdom, so we replace the React bindings
// with light stand-ins. `useStripe`/`useElements` return objects so the dialog
// renders its form instead of the "Loading payment form…" state, and the
// mocked CardElement exposes a button that fires its onChange with
// `complete: true` to enable the submit button (mirroring a fully-typed card).
const stripeState = vi.hoisted(() => ({
  createPaymentMethod: vi.fn(async () => ({
    paymentMethod: { id: "pm_test_123" },
    error: null,
  })),
}));

vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => children,
  CardElement: ({
    onChange,
  }: {
    onChange?: (e: { complete: boolean; error: null }) => void;
  }) => (
    <button
      type="button"
      data-testid="mock-card-complete"
      onClick={() => onChange?.({ complete: true, error: null })}
    >
      card
    </button>
  ),
  useStripe: () => ({
    createPaymentMethod: (...args: unknown[]) =>
      stripeState.createPaymentMethod(...(args as [])),
  }),
  useElements: () => ({ getElement: () => ({}) }),
}));

vi.mock("@stripe/stripe-js", () => ({
  loadStripe: () => Promise.resolve({}),
}));

vi.mock("@/components/Sidebar", () => ({
  Sidebar: () => null,
  MobileHeaderSpacer: () => null,
}));

import SubscriptionsPage from "./subscriptions";

const SUB_ID = 4242;

type AnySub = Record<string, unknown>;

function pastDueSub(overrides: AnySub = {}): AnySub {
  return {
    id: SUB_ID,
    agentId: 1,
    merchantName: "Acme Diner",
    merchantEmail: null,
    tier: "tier_1",
    monthlyAmount: "199.00",
    status: "active",
    mcaPairedDealId: null,
    startDate: "2026-01-01",
    endDate: null,
    cancelledAt: null,
    pausedAt: null,
    reactivatedAt: null,
    reactivatedById: null,
    reactivatedByName: null,
    pausedById: null,
    pausedByName: null,
    cancelledById: null,
    cancelledByName: null,
    billingStatus: "past_due",
    stripeSubscriptionId: "sub_test_123",
    cardLast4: "4242",
    cardBrand: "visa",
    lastChargedAt: null,
    nextBillingDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeRes(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

// Mutable server state for the stubbed fetch. `patchResult` controls what the
// PATCH /payment-method endpoint returns for the next call, and `currentSubs`
// is what GET /api/subscriptions returns (kept in sync so the post-success
// refetch reflects the new billing status).
let currentSubs: AnySub[] = [];
let patchResult: AnySub = {};

function installFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.includes("/api/stripe/publishable-key")) {
        return makeRes({ publishableKey: "pk_test_123" });
      }
      if (url.includes("/api/deals")) {
        return makeRes([]);
      }
      if (url.endsWith("/payment-method") && method === "PATCH") {
        currentSubs = currentSubs.map((s) =>
          s.id === SUB_ID ? { ...s, ...patchResult } : s,
        );
        const merged = { ...pastDueSub(), ...patchResult };
        return makeRes(merged);
      }
      if (url.includes("/api/subscriptions")) {
        return makeRes(currentSubs);
      }
      return makeRes({});
    }),
  );
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, queryFn: getQueryFn({ on401: "throw" }) },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SubscriptionsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  // Polyfills required by Radix UI (Dialog) under jsdom.
  // @ts-expect-error - jsdom does not implement these.
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
  // @ts-expect-error - jsdom does not implement these.
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  // @ts-expect-error - jsdom does not implement ResizeObserver.
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  currentSubs = [pastDueSub()];
  patchResult = {};
  stripeState.createPaymentMethod.mockClear();
  stripeState.createPaymentMethod.mockResolvedValue({
    paymentMethod: { id: "pm_test_123" },
    error: null,
  });
  installFetch();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * Opens the Update Card dialog and enters a (mocked) complete card so the
 * submit button is enabled. Returns the configured user-event instance.
 */
async function openDialogAndCompleteCard() {
  const user = userEvent.setup();

  const updateBtn = await screen.findByTestId(`button-update-card-${SUB_ID}`);
  await user.click(updateBtn);

  await screen.findByTestId("dialog-update-card");

  // Mark the card input as complete to enable the submit button.
  await user.click(await screen.findByTestId("mock-card-complete"));

  return user;
}

describe("UpdateCardDialog success state", () => {
  it("shows the green success state after a successful card update", async () => {
    // Server reports the outstanding payment was collected.
    patchResult = { billingStatus: "active", declineCode: null };

    renderPage();
    const user = await openDialogAndCompleteCard();

    await user.click(screen.getByTestId("button-submit-update-card"));

    const success = await screen.findByTestId("update-card-success");
    expect(success).toBeTruthy();
    expect(success.textContent).toContain("Payment successful!");

    // The card-update path (not the existing-card retry) was used.
    expect(stripeState.createPaymentMethod).toHaveBeenCalledTimes(1);

    // No error banner should be present in the success state.
    expect(screen.queryByTestId("update-card-error-message")).toBeNull();
  });

  it("removes the billing warning banner on the page after a successful update", async () => {
    patchResult = { billingStatus: "active", declineCode: null };

    renderPage();

    // Banner is present before the update.
    expect(
      await screen.findByTestId(`banner-payment-failed-${SUB_ID}`),
    ).toBeTruthy();

    const user = await openDialogAndCompleteCard();
    await user.click(screen.getByTestId("button-submit-update-card"));

    // Success state confirms the update completed.
    await screen.findByTestId("update-card-success");

    // Banner disappears immediately once billing is active.
    await waitFor(() => {
      expect(
        screen.queryByTestId(`banner-payment-failed-${SUB_ID}`),
      ).toBeNull();
    });
  });
});

describe("UpdateCardDialog failure state", () => {
  it("shows a plain-English decline message and keeps the dialog open", async () => {
    // Server reports the retry failed with a card_declined decline code.
    patchResult = { billingStatus: "failed", declineCode: "card_declined" };

    renderPage();
    const user = await openDialogAndCompleteCard();

    await user.click(screen.getByTestId("button-submit-update-card"));

    const errorBanner = await screen.findByTestId("update-card-error-message");
    expect(errorBanner.textContent).toContain(
      "Your card was declined. Please try a different card.",
    );

    // The success state must NOT appear on a decline.
    expect(screen.queryByTestId("update-card-success")).toBeNull();

    // The dialog stays open so the agent can try again.
    expect(screen.getByTestId("dialog-update-card")).toBeTruthy();
    expect(screen.getByTestId("button-submit-update-card")).toBeTruthy();
  });

  it("maps an unknown decline code to a friendly fallback message", async () => {
    patchResult = { billingStatus: "failed", declineCode: "some_unknown_code" };

    renderPage();
    const user = await openDialogAndCompleteCard();

    await user.click(screen.getByTestId("button-submit-update-card"));

    const errorBanner = await screen.findByTestId("update-card-error-message");
    expect(errorBanner.textContent).toContain(
      "Your card was declined. Please try a different card or contact your bank.",
    );
    expect(screen.queryByTestId("update-card-success")).toBeNull();
  });
});
