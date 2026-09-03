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

describe("Activity log browser back/forward restoration", () => {
  // Simulate the browser navigating through history: update the URL, then
  // dispatch a popstate event like the browser would on back/forward.
  async function popStateTo(url: string) {
    await act(async () => {
      window.history.replaceState(null, "", url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
  }

  it("restores search and date inputs from the URL on popstate", async () => {
    renderActivityLog();
    await advance(0);

    await popStateTo(
      "/admin/activity?search=stripe&startDate=2026-05-01&endDate=2026-05-31",
    );

    expect(
      (screen.getByTestId("input-log-search") as HTMLInputElement).value,
    ).toBe("stripe");
    expect(
      (screen.getByTestId("input-log-start-date") as HTMLInputElement).value,
    ).toBe("2026-05-01");
    expect(
      (screen.getByTestId("input-log-end-date") as HTMLInputElement).value,
    ).toBe("2026-05-31");
  });

  it("refetches once with the restored filters but does not fire an extra debounced request", async () => {
    renderActivityLog();
    await advance(0);
    const baseline = activityCalls().length;

    await popStateTo(
      "/admin/activity?search=payout&startDate=2026-06-01&endDate=2026-06-30",
    );
    // Flush the react-query refetch triggered by the filters state change.
    await advance(0);

    const afterPop = activityCalls();
    expect(afterPop.length).toBe(baseline + 1);
    const restored = afterPop[afterPop.length - 1];
    expect(restored).toContain("search=payout");
    expect(restored).toContain("startDate=2026-06-01");
    expect(restored).toContain("endDate=2026-06-30");

    // The skip-debounce flags must prevent the debounced effects from firing
    // an additional request after the 300ms window.
    await advance(500);
    expect(activityCalls().length).toBe(baseline + 1);
  });

  it("restores empty filters when navigating back to an unfiltered URL without extra debounced requests", async () => {
    // Start with filters in the URL so the initial state is populated.
    window.history.replaceState(
      null,
      "",
      "/admin/activity?search=deal&startDate=2026-07-01",
    );
    renderActivityLog();
    await advance(0);
    const baseline = activityCalls().length;
    expect(
      (screen.getByTestId("input-log-search") as HTMLInputElement).value,
    ).toBe("deal");

    await popStateTo("/admin/activity");
    await advance(0);

    expect(
      (screen.getByTestId("input-log-search") as HTMLInputElement).value,
    ).toBe("");
    expect(
      (screen.getByTestId("input-log-start-date") as HTMLInputElement).value,
    ).toBe("");

    const afterPop = activityCalls();
    expect(afterPop.length).toBe(baseline + 1);
    const restored = afterPop[afterPop.length - 1];
    expect(restored).not.toContain("search=");
    expect(restored).not.toContain("startDate=");

    await advance(500);
    expect(activityCalls().length).toBe(baseline + 1);
  });

  it("only skips the debounce for inputs the popstate actually changed", async () => {
    renderActivityLog();
    await advance(0);

    await popStateTo("/admin/activity?startDate=2026-08-01");
    await advance(500);
    const baseline = activityCalls().length;

    // A subsequent user edit must still debounce and fire normally,
    // proving the skip flags were consumed and not left set.
    fireEvent.change(screen.getByTestId("input-log-start-date"), {
      target: { value: "2026-08-15" },
    });
    await advance(299);
    expect(activityCalls().length).toBe(baseline);
    await advance(1);
    const calls = activityCalls();
    expect(calls.length).toBe(baseline + 1);
    expect(calls[calls.length - 1]).toContain("startDate=2026-08-15");
  });
});
describe("Activity log clear filters", () => {
  it("clicking Clear empties the search box and both date inputs", async () => {
    renderActivityLog();
    await advance(0);

    fireEvent.change(screen.getByTestId("input-log-search"), {
      target: { value: "merchant" },
    });
    fireEvent.change(screen.getByTestId("input-log-start-date"), {
      target: { value: "2026-05-01" },
    });
    fireEvent.change(screen.getByTestId("input-log-end-date"), {
      target: { value: "2026-05-31" },
    });
    // Let the debounced filters apply.
    await advance(300);

    fireEvent.click(screen.getByTestId("button-clear-filters"));
    await advance(0);

    expect(
      (screen.getByTestId("input-log-search") as HTMLInputElement).value,
    ).toBe("");
    expect(
      (screen.getByTestId("input-log-start-date") as HTMLInputElement).value,
    ).toBe("");
    expect(
      (screen.getByTestId("input-log-end-date") as HTMLInputElement).value,
    ).toBe("");
  });

  it("clicking Clear fires at most one new request with no date or search parameters, even after the debounce window", async () => {
    renderActivityLog();
    await advance(0);

    fireEvent.change(screen.getByTestId("input-log-search"), {
      target: { value: "merchant" },
    });
    fireEvent.change(screen.getByTestId("input-log-start-date"), {
      target: { value: "2026-05-01" },
    });
    fireEvent.change(screen.getByTestId("input-log-end-date"), {
      target: { value: "2026-05-31" },
    });
    await advance(300);
    const baseline = activityCalls().length;

    fireEvent.click(screen.getByTestId("button-clear-filters"));
    await advance(0);

    // Clearing applies immediately: exactly one new request, no filter params.
    let calls = activityCalls();
    expect(calls.length).toBe(baseline + 1);
    const clearedUrl = calls[calls.length - 1];
    expect(clearedUrl).not.toContain("startDate=");
    expect(clearedUrl).not.toContain("endDate=");
    expect(clearedUrl).not.toContain("search=");

    // The skip-debounce path must prevent stray requests after the 300ms window.
    await advance(1000);
    expect(activityCalls().length).toBe(baseline + 1);
  });

  it("clicking Clear when only the dates are set fires one request without dates and no debounce echoes", async () => {
    renderActivityLog();
    await advance(0);

    fireEvent.change(screen.getByTestId("input-log-start-date"), {
      target: { value: "2026-06-01" },
    });
    fireEvent.change(screen.getByTestId("input-log-end-date"), {
      target: { value: "2026-06-30" },
    });
    await advance(300);
    const baseline = activityCalls().length;
    expect(calledWithDates(activityCalls()[baseline - 1])).toBe(true);

    fireEvent.click(screen.getByTestId("button-clear-filters"));
    await advance(1000);

    const calls = activityCalls();
    expect(calls.length).toBe(baseline + 1);
    expect(calledWithDates(calls[calls.length - 1])).toBe(false);
  });
});

function calledWithDates(url: string): boolean {
  return url.includes("startDate=") || url.includes("endDate=");
}
