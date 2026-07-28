// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

import SettingsPage from "./settings";

function baseUser(emailPreferences: Record<string, boolean>) {
  return {
    id: 1,
    firstName: "Test",
    lastName: "Agent",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    bio: "",
    payoutMethod: "pending",
    payoutEmail: "",
    referralCode: "ABC123",
    emailPreferences,
  };
}

function renderSettings() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsPage />
    </QueryClientProvider>,
  );
}

async function openNotificationsTab() {
  const user = userEvent.setup();
  await user.click(screen.getByTestId("tab-notifications"));
}

beforeEach(() => {
  // Polyfills required by Radix UI primitives under jsdom.
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
});

afterEach(() => {
  cleanup();
  authState.user = null;
});

describe("Settings notifications: 'all notifications off' warning", () => {
  it("hides the warning when at least one subscription toggle is on", async () => {
    authState.user = baseUser({
      emailOnPaused: true,
      emailOnCancelled: false,
      emailOnReactivated: false,
    });
    renderSettings();
    await openNotificationsTab();

    expect(
      screen.getByTestId("button-save-notification-prefs"),
    ).toBeTruthy();
    expect(screen.queryByTestId("warning-all-notifications-off")).toBeNull();
  });

  it("shows the warning when all three subscription toggles (Paused, Cancelled, Reactivated) are off", async () => {
    authState.user = baseUser({
      emailOnPaused: false,
      emailOnCancelled: false,
      emailOnReactivated: false,
    });
    renderSettings();
    await openNotificationsTab();

    expect(
      screen.queryByTestId("warning-all-notifications-off"),
    ).not.toBeNull();
  });

  it("keeps the Save button enabled while the warning is shown", async () => {
    authState.user = baseUser({
      emailOnPaused: false,
      emailOnCancelled: false,
      emailOnReactivated: false,
    });
    renderSettings();
    await openNotificationsTab();

    expect(
      screen.queryByTestId("warning-all-notifications-off"),
    ).not.toBeNull();

    const saveButton = screen.getByTestId(
      "button-save-notification-prefs",
    ) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);
  });
});

describe("Settings notifications: unsaved changes indicator", () => {
  it("hides the unsaved-changes indicator when no toggles have been modified", async () => {
    authState.user = baseUser({ emailOnCommissionEarned: true });
    renderSettings();
    await openNotificationsTab();

    expect(screen.queryByTestId("text-unsaved-changes")).toBeNull();
    expect(
      screen.queryByTestId("warning-unsaved-notification-prefs"),
    ).toBeNull();
  });

  it("shows the unsaved-changes indicator after a toggle is changed", async () => {
    authState.user = baseUser({ emailOnCommissionEarned: true });
    const user = userEvent.setup();
    renderSettings();
    await openNotificationsTab();

    await user.click(screen.getByTestId("toggle-email-on-commission-earned"));
    await user.click(screen.getByTestId("dialog-confirm-disable"));

    expect(screen.queryByTestId("text-unsaved-changes")).not.toBeNull();
    expect(
      screen.queryByTestId("warning-unsaved-notification-prefs"),
    ).not.toBeNull();
  });

  it("warns with a confirmation dialog when navigating away with unsaved changes", async () => {
    authState.user = baseUser({ emailOnCommissionEarned: true });
    const user = userEvent.setup();
    renderSettings();
    await openNotificationsTab();

    await user.click(screen.getByTestId("toggle-email-on-commission-earned"));
    await user.click(screen.getByTestId("dialog-confirm-disable"));

    const link = document.createElement("a");
    link.setAttribute("href", "/dashboard");
    link.textContent = "Go to dashboard";
    document.body.appendChild(link);

    await user.click(link);

    expect(screen.queryByTestId("dialog-unsaved-changes")).not.toBeNull();

    document.body.removeChild(link);
  });
});

describe("Settings notifications: 'Payment Retry Pending' toggle", () => {
  it("renders the toggle", async () => {
    authState.user = baseUser({});
    renderSettings();
    await openNotificationsTab();

    expect(
      screen.getByTestId("toggle-email-on-payment-retry-pending"),
    ).toBeTruthy();
  });

  it("renders the toggle as off when emailOnPaymentRetryPending is stored false", async () => {
    authState.user = baseUser({ emailOnPaymentRetryPending: false });
    renderSettings();
    await openNotificationsTab();

    const toggle = screen.getByTestId("toggle-email-on-payment-retry-pending");
    expect(toggle.getAttribute("data-state")).toBe("unchecked");
  });

  it("includes emailOnPaymentRetryPending in the saved payload after toggling", async () => {
    authState.user = baseUser({ emailOnPaymentRetryPending: true });
    const user = userEvent.setup();

    let capturedBody: Record<string, unknown> | null = null;
    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      capturedBody = JSON.parse((init?.body as string) ?? "{}");
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderSettings();
    await openNotificationsTab();

    // Toggle off (triggers confirmation dialog)
    await user.click(
      screen.getByTestId("toggle-email-on-payment-retry-pending"),
    );
    await user.click(screen.getByTestId("dialog-confirm-disable"));

    // Save
    await user.click(screen.getByTestId("button-save-notification-prefs"));

    if (capturedBody === null) throw new Error("fetch was never called");
    const body = capturedBody as Record<string, unknown>;
    expect(
      Object.prototype.hasOwnProperty.call(body, "emailOnPaymentRetryPending"),
    ).toBe(true);
    expect(body.emailOnPaymentRetryPending).toBe(false);

    vi.restoreAllMocks();
  });
});
