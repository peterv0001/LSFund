// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
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
let expiryCheckIntervalInvalid = false;
let expiryCheckIntervalRejectedValue: string | null = null;
const expiryCheckIntervalDefaultMs = 3_600_000;

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
    return jsonResponse({
      expiryCheckIntervalMs,
      expiryCheckIntervalInvalid,
      expiryCheckIntervalRejectedValue,
      expiryCheckIntervalDefaultMs,
      expiryWarningDays: 7,
      nodeEnv: "test",
      schedulerLastRunAt: null,
      schedulerNextRunAt: null,
    });
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
  expiryCheckIntervalInvalid = false;
  expiryCheckIntervalRejectedValue = null;
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

  it("does not show the invalid-interval alert when the configured value is valid", async () => {
    expiryCheckIntervalInvalid = false;

    renderSettings();

    // Wait for the card to render before asserting the alert is absent.
    await screen.findByTestId("badge-expiry-check-interval");
    expect(
      screen.queryByTestId("alert-invalid-scheduler-interval"),
    ).toBeNull();
  });

  it("alerts admins when the configured interval was rejected and the default is in use", async () => {
    expiryCheckIntervalInvalid = true;
    expiryCheckIntervalRejectedValue = "0";
    expiryCheckIntervalMs = 3_600_000; // fell back to the 1-hour default

    renderSettings();

    const alert = await screen.findByTestId("alert-invalid-scheduler-interval");
    // States the invalid value the operator entered.
    expect(
      within(alert).getByTestId("text-rejected-interval-value").textContent,
    ).toContain("0");
    // States the fallback interval now in use.
    const fallback = within(alert).getByTestId("text-fallback-interval");
    expect(fallback.textContent).toContain("1 hr");
    expect(fallback.textContent).toMatch(/3.?600.?000\s*ms/);
  });
});
