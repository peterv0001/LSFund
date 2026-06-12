// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api } from "@shared/routes";

const authState = vi.hoisted(() => ({ user: null as any }));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: authState.user,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    login: vi.fn(),
    isLoggingIn: false,
    register: vi.fn(),
    isRegistering: false,
    logout: vi.fn(),
    isLoggingOut: false,
  }),
}));

vi.mock("@/components/Sidebar", () => ({
  Sidebar: () => null,
  MobileHeaderSpacer: () => null,
}));

import Dashboard from "./dashboard";

type ShareStat = { views: number; leads: number };

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function mockFetch(shareStats: unknown) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes(api.agents.shareStats.path)) {
      return jsonResponse(shareStats);
    }
    if (url.includes(api.agents.referralLink.path)) {
      return jsonResponse({ referralCode: "ABC123", referralUrl: "https://x/ABC123" });
    }
    if (url.includes(api.agents.referralStats.path)) {
      return jsonResponse({ totalReferrals: 0 });
    }
    if (url.includes("/api/subscriptions")) {
      return jsonResponse([]);
    }
    if (url.includes(api.commissions.stats.path)) {
      return jsonResponse({
        totalEarned: 0,
        thisWeek: 0,
        pending: 0,
        byType: {},
      });
    }
    // Any other endpoint hit by the dashboard.
    return jsonResponse({});
  });
}

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  authState.user = { id: 1, firstName: "Test", referralCode: "ABC123" };
});

afterEach(() => {
  cleanup();
  authState.user = null;
  vi.restoreAllMocks();
});

describe("Dashboard share cards: views and leads counts", () => {
  it("renders the Views and Leads values from /api/agents/share-stats on each card", async () => {
    const shareStats: Record<"platform" | "leaks" | "scale", ShareStat> = {
      platform: { views: 120, leads: 8 },
      leaks: { views: 45, leads: 3 },
      scale: { views: 7, leads: 0 },
    };
    vi.stubGlobal("fetch", mockFetch(shareStats));

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId("text-views-platform").textContent).toBe("120");
    });

    expect(screen.getByTestId("text-leads-platform").textContent).toBe("8");
    expect(screen.getByTestId("text-views-leaks").textContent).toBe("45");
    expect(screen.getByTestId("text-leads-leaks").textContent).toBe("3");
    expect(screen.getByTestId("text-views-scale").textContent).toBe("7");
    expect(screen.getByTestId("text-leads-scale").textContent).toBe("0");

    expect(screen.getByTestId("stats-share-platform")).toBeTruthy();
    expect(screen.getByTestId("stats-share-leaks")).toBeTruthy();
    expect(screen.getByTestId("stats-share-scale")).toBeTruthy();
  });

  it("falls back to 0 for every card when share stats are missing", async () => {
    vi.stubGlobal("fetch", mockFetch(undefined));

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId("stats-share-platform")).toBeTruthy();
    });

    for (const key of ["platform", "leaks", "scale"] as const) {
      expect(screen.getByTestId(`text-views-${key}`).textContent).toBe("0");
      expect(screen.getByTestId(`text-leads-${key}`).textContent).toBe("0");
    }
  });
});
