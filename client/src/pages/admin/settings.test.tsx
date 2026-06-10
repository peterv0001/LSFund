// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/components/AdminSidebar", () => ({
  AdminSidebar: () => null,
}));

vi.mock("@/components/SchemaDriftBanner", () => ({
  SchemaDriftBanner: () => null,
}));

import AdminSettings from "./settings";
import { getQueryFn } from "@/lib/queryClient";
import { api } from "@shared/routes";

const SETTINGS_PATH = api.admin.settings.get.path;
const DUE_FOR_WARNING_PATH = api.admin.subscriptions.dueForWarning.path;
const WEBHOOK_STATUS_PATH = api.admin.webhookStatus.get.path;
const SYSTEM_INFO_PATH = api.admin.systemInfo.get.path;

let fetchMock: ReturnType<typeof vi.fn>;
let expiryCheckIntervalMs = 3_600_000;

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: () => Promise.resolve(body),
  };
}

function routeFetch(url: string) {
  if (url.startsWith(SYSTEM_INFO_PATH)) {
    return jsonResponse({ expiryCheckIntervalMs });
  }
  if (url.startsWith(WEBHOOK_STATUS_PATH)) {
    return jsonResponse({
      secretStored: false,
      endpointId: null,
      endpointUrl: null,
      endpointActive: null,
    });
  }
  if (url.startsWith(DUE_FOR_WARNING_PATH)) {
    return jsonResponse({ days: 7, count: 0, subscriptionIds: [] });
  }
  if (url.startsWith(SETTINGS_PATH)) {
    return jsonResponse({
      commissionRates: null,
      rankRequirements: null,
      binaryBonusCaps: null,
      companyInfo: null,
      expiryWarningDays: 7,
    });
  }
  return jsonResponse({});
}

function renderSettings() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, queryFn: getQueryFn({ on401: "throw" }) },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminSettings />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fetchMock = vi.fn((input: any) =>
    Promise.resolve(routeFetch(String(input)) as any),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  expiryCheckIntervalMs = 3_600_000;
});

describe("Admin settings – System Info card", () => {
  it("renders the formatted scheduler interval returned by the API", async () => {
    expiryCheckIntervalMs = 3_600_000; // 1 hour

    renderSettings();

    const badge = await screen.findByTestId("badge-expiry-check-interval");
    expect(badge.textContent).toContain("1 hr");
    // The raw millisecond value is shown alongside the friendly label.
    // Match the digits with any locale grouping separators to avoid flake.
    expect(badge.textContent).toMatch(/3.?600.?000\s*ms/);
  });

  it("formats a sub-minute interval in seconds", async () => {
    expiryCheckIntervalMs = 30_000; // 30 seconds

    renderSettings();

    const badge = await screen.findByTestId("badge-expiry-check-interval");
    await waitFor(() => {
      expect(badge.textContent).toContain("30 sec");
    });
    expect(badge.textContent).toMatch(/30.?000\s*ms/);
  });
});
