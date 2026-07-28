// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

vi.mock("@/components/AdminSidebar", () => ({
  AdminSidebar: () => null,
}));

vi.mock("@/components/SchemaDriftBanner", () => ({
  SchemaDriftBanner: () => null,
}));

import AdminSubscriptions from "./subscriptions";
import { api } from "@shared/routes";

// ── API paths ─────────────────────────────────────────────────────────────────
const LIST_PATH = api.admin.subscriptions.list.path;       // /api/admin/subscriptions
const DFW_PATH = api.admin.subscriptions.dueForWarning.path; // /api/admin/subscriptions/due-for-warning
const AGENTS_PATH = api.admin.agents.list.path;            // /api/admin/agents
const USER_PATH = api.auth.me.path;                        // /api/user
const TEMPLATES_PATH = "/api/admin/export-templates";

// ── Fixture data ──────────────────────────────────────────────────────────────

function makeSub(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    agentId: 1,
    agent: { id: 1, firstName: "Alice", lastName: "Agent", email: "alice@example.com" },
    merchantName: `Merchant ${id}`,
    merchantEmail: null,
    tier: "tier_1",
    monthlyAmount: "199.00",
    status: "active",
    mcaPairedDealId: null,
    startDate: "2026-01-01",
    endDate: "2026-09-01",
    cancelledAt: null,
    pausedAt: null,
    reactivatedAt: null,
    cancelledById: null,
    pausedById: null,
    reactivatedById: null,
    pausedBy: null,
    cancelledBy: null,
    reactivatedBy: null,
    billingStatus: "active",
    stripeSubscriptionId: null,
    cardLast4: null,
    cardBrand: null,
    lastChargedAt: null,
    nextBillingDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

function installFetch(
  subscriptions: ReturnType<typeof makeSub>[],
  dueForWarning: { days: number; count: number; subscriptionIds: number[] },
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes(USER_PATH)) {
        return jsonResponse({
          id: 99,
          email: "admin@example.com",
          firstName: "Admin",
          lastName: "User",
          isAdmin: true,
          currentRank: "agent",
          highestRank: "agent",
          emailVerifiedAt: "2026-01-01T00:00:00.000Z",
        });
      }
      if (url.includes(DFW_PATH)) {
        return jsonResponse(dueForWarning);
      }
      if (url.includes(LIST_PATH)) {
        return jsonResponse(subscriptions);
      }
      if (url.includes(AGENTS_PATH)) {
        return jsonResponse({ agents: [] });
      }
      if (url.includes(TEMPLATES_PATH)) {
        return jsonResponse([]);
      }
      return jsonResponse({});
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
      <AdminSubscriptions />
    </QueryClientProvider>,
  );
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  // Polyfills required by Radix UI components under jsdom.
  window.HTMLElement.prototype.hasPointerCapture = vi.fn() as unknown as typeof window.HTMLElement.prototype.hasPointerCapture;
  window.HTMLElement.prototype.releasePointerCapture = vi.fn() as unknown as typeof window.HTMLElement.prototype.releasePointerCapture;
  window.HTMLElement.prototype.scrollIntoView = vi.fn() as unknown as typeof window.HTMLElement.prototype.scrollIntoView;
  (window as unknown as Record<string, unknown>).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // Reset URL to a clean state so tests don't bleed into each other.
  window.history.replaceState(null, "", "/admin/subscriptions");
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Admin subscriptions page – ?dueForWarning=1 deep link", () => {
  it("shows only the rows whose IDs are in subscriptionIds when ?dueForWarning=1 is in the URL", async () => {
    // Three subscriptions total; only IDs 1 and 2 are due for warning.
    const subs = [makeSub(1), makeSub(2), makeSub(3)];
    installFetch(subs, { days: 14, count: 2, subscriptionIds: [1, 2] });

    window.history.replaceState(null, "", "/admin/subscriptions?dueForWarning=1");
    renderPage();

    // IDs 1 and 2 must appear.
    await waitFor(() => {
      expect(screen.getByTestId("row-subscription-1")).toBeTruthy();
      expect(screen.getByTestId("row-subscription-2")).toBeTruthy();
    });

    // ID 3 must be filtered out.
    expect(screen.queryByTestId("row-subscription-3")).toBeNull();
  });

  it("shows the due-for-warning banner with the correct day window from the API response", async () => {
    const subs = [makeSub(10), makeSub(20)];
    installFetch(subs, { days: 7, count: 2, subscriptionIds: [10, 20] });

    window.history.replaceState(null, "", "/admin/subscriptions?dueForWarning=1");
    renderPage();

    // The banner must appear and display the day window returned by the API.
    // Wait for the async dueForWarning query to resolve so the "(7d window)"
    // suffix is rendered alongside the base label.
    await waitFor(() => {
      const banner = screen.getByTestId("due-for-warning-filter-indicator");
      expect(banner.textContent).toContain("Due for expiry warning");
      expect(banner.textContent).toContain("7d window");
    });
  });

  it("shows all subscriptions (no dueForWarning filter) when ?dueForWarning=1 is absent", async () => {
    const subs = [makeSub(1), makeSub(2), makeSub(3)];
    // The due-for-warning endpoint should not be called, but provide a fallback
    // to keep fetch clean. Only IDs 1 and 2 would match if the filter were on.
    installFetch(subs, { days: 14, count: 2, subscriptionIds: [1, 2] });

    window.history.replaceState(null, "", "/admin/subscriptions");
    renderPage();

    // All three rows must be present.
    await waitFor(() => {
      expect(screen.getByTestId("row-subscription-1")).toBeTruthy();
      expect(screen.getByTestId("row-subscription-2")).toBeTruthy();
      expect(screen.getByTestId("row-subscription-3")).toBeTruthy();
    });

    // No due-for-warning banner.
    expect(screen.queryByTestId("due-for-warning-filter-indicator")).toBeNull();
  });
});
