// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Lead } from "@shared/schema";

// The leads page pulls in the sidebar (with its own data needs); it is not
// relevant to the source-attribution display under test, so stub it out.
vi.mock("@/components/Sidebar", () => ({
  Sidebar: () => null,
  MobileHeaderSpacer: () => null,
}));

const leadsState = vi.hoisted(() => ({
  leads: [] as Lead[],
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
      if (queryKey[0] === "/api/leads") {
        return { data: leadsState.leads, isLoading: false };
      }
      return { data: [], isLoading: false };
    },
    useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  };
});

import LeadsPage from "./leads";

function makeLead(overrides: Partial<Lead>): Lead {
  return {
    id: 1,
    contactName: "Jane Owner",
    contactEmail: "jane@example.com",
    contactPhone: null,
    companyName: "Acme Co",
    companySize: null,
    industry: null,
    address: null,
    city: null,
    state: null,
    zip: null,
    enrichmentData: null,
    assignedAgentId: 1,
    assignedAt: null,
    assignedById: null,
    status: "new",
    statusUpdatedAt: null,
    aiFollowupRequested: false,
    aiFollowupRequestedAt: null,
    aiFollowupProcessed: false,
    aiFollowupProcessedAt: null,
    notes: null,
    source: null,
    batchId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Lead;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LeadsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  leadsState.leads = [];
});

afterEach(() => {
  cleanup();
});

describe("LeadsPage source attribution", () => {
  it("shows the friendly page name for each Merchant Growth Platform landing page", () => {
    leadsState.leads = [
      makeLead({ id: 1, source: "landing:lp-platform-overview" }),
      makeLead({ id: 2, source: "landing:lp-platform-leaks" }),
      makeLead({ id: 3, source: "landing:lp-platform-scale" }),
    ];
    renderPage();

    expect(screen.getByTestId("badge-source-1").textContent).toContain("Platform");
    expect(screen.getByTestId("badge-source-2").textContent).toContain("Leaks");
    expect(screen.getByTestId("badge-source-3").textContent).toContain("Scale");
  });

  it("surfaces captured tier interest and the page-specific question", () => {
    leadsState.leads = [
      makeLead({
        id: 5,
        source: "landing:lp-platform-overview",
        enrichmentData: {
          campaign: "lp-platform-overview",
          tier_interest: "Revenue Growth System",
          bottleneck: "Following up with leads",
        },
      }),
    ];
    renderPage();

    expect(
      screen.getByTestId("text-captured-5-tier-interest").textContent,
    ).toContain("Revenue Growth System");
    expect(
      screen.getByTestId("text-captured-5-bottleneck").textContent,
    ).toContain("Following up with leads");
  });

  it("falls back to a generic Shared Link label for unknown landing campaigns", () => {
    leadsState.leads = [makeLead({ id: 7, source: "landing:lp-unknown-campaign" })];
    renderPage();

    expect(screen.getByTestId("badge-source-7").textContent).toContain("Shared Link");
  });

  it("shows no source badge for non-landing leads", () => {
    leadsState.leads = [makeLead({ id: 9, source: "excel_import" })];
    renderPage();

    expect(screen.queryByTestId("badge-source-9")).toBeNull();
    expect(screen.getByTestId("cell-source-9").textContent).toContain("-");
  });
});
