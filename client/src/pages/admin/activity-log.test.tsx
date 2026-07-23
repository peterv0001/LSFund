// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/components/AdminSidebar", () => ({
  AdminSidebar: () => null,
}));

vi.mock("@/components/SchemaDriftBanner", () => ({
  SchemaDriftBanner: () => null,
}));

import AdminActivityLog from "./activity-log";

const ACTIVITY_LOG_PATH = "/api/admin/activity-log";

let fetchMock: ReturnType<typeof vi.fn>;

function emptyResponse() {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: () => Promise.resolve({ logs: [], total: 0, page: 1, pageSize: 50 }),
  };
}

function activityCalls(): string[] {
  return fetchMock.mock.calls
    .map((c) => String(c[0]))
    .filter((url) => url.startsWith(ACTIVITY_LOG_PATH));
}

function renderActivityLog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminActivityLog />
    </QueryClientProvider>,
  );
}

// Advance fake timers and flush pending promises (react-query fetch resolution).
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn(() => Promise.resolve(emptyResponse() as any));
  vi.stubGlobal("fetch", fetchMock);
  // Reset the URL so each test starts with no filters applied.
  window.history.replaceState(null, "", "/admin/activity");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Activity log date filter debouncing", () => {
  it("does not fire a request immediately when the From date changes, then fires once after 300ms with the correct value", async () => {
    renderActivityLog();
    // Flush the initial query that loads on mount.
    await advance(0);
    const baseline = activityCalls().length;
    expect(baseline).toBeGreaterThanOrEqual(1);

    fireEvent.change(screen.getByTestId("input-log-start-date"), {
      target: { value: "2026-01-15" },
    });

    // Before the 300ms debounce window elapses, no new request should fire.
    await advance(299);
    expect(activityCalls().length).toBe(baseline);

    // Once the debounce window completes, exactly one new request fires.
    await advance(1);
    const calls = activityCalls();
    expect(calls.length).toBe(baseline + 1);
    expect(calls[calls.length - 1]).toContain("startDate=2026-01-15");
  });

  it("does not fire a request immediately when the To date changes, then fires once after 300ms with the correct value", async () => {
    renderActivityLog();
    await advance(0);
    const baseline = activityCalls().length;
    expect(baseline).toBeGreaterThanOrEqual(1);

    fireEvent.change(screen.getByTestId("input-log-end-date"), {
      target: { value: "2026-02-20" },
    });

    await advance(299);
    expect(activityCalls().length).toBe(baseline);

    await advance(1);
    const calls = activityCalls();
    expect(calls.length).toBe(baseline + 1);
    expect(calls[calls.length - 1]).toContain("endDate=2026-02-20");
  });

  it("does not fire intermediate requests while the user keeps editing the From date, only the final value after the debounce", async () => {
    renderActivityLog();
    await advance(0);
    const baseline = activityCalls().length;

    const input = screen.getByTestId("input-log-start-date");

    // Simulate the user editing the date several times within the debounce window.
    fireEvent.change(input, { target: { value: "2026-03-01" } });
    await advance(100);
    fireEvent.change(input, { target: { value: "2026-03-10" } });
    await advance(100);
    fireEvent.change(input, { target: { value: "2026-03-31" } });

    // Still within the debounce window after the last change — no request yet.
    await advance(299);
    expect(activityCalls().length).toBe(baseline);

    // After the window completes, exactly one request fires with the final value.
    await advance(1);
    const calls = activityCalls();
    expect(calls.length).toBe(baseline + 1);
    expect(calls[calls.length - 1]).toContain("startDate=2026-03-31");
    expect(calls[calls.length - 1]).not.toContain("startDate=2026-03-01");
    expect(calls[calls.length - 1]).not.toContain("startDate=2026-03-10");
  });

  it("debounces the From and To dates independently when both are edited", async () => {
    renderActivityLog();
    await advance(0);
    const baseline = activityCalls().length;

    fireEvent.change(screen.getByTestId("input-log-start-date"), {
      target: { value: "2026-04-01" },
    });
    await advance(300);
    let calls = activityCalls();
    expect(calls.length).toBe(baseline + 1);
    expect(calls[calls.length - 1]).toContain("startDate=2026-04-01");

    fireEvent.change(screen.getByTestId("input-log-end-date"), {
      target: { value: "2026-04-30" },
    });
    await advance(299);
    expect(activityCalls().length).toBe(baseline + 1);

    await advance(1);
    calls = activityCalls();
    expect(calls.length).toBe(baseline + 2);
    expect(calls[calls.length - 1]).toContain("endDate=2026-04-30");
    // The previously applied From date should still be present in the request.
    expect(calls[calls.length - 1]).toContain("startDate=2026-04-01");
  });
});
