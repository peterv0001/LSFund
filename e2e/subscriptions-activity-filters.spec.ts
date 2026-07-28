import { test, expect } from "@playwright/test";

const TS = Date.now();
const AGENT_EMAIL = `e2e-activity-filters-${TS}@example.com`;
const AGENT_PASSWORD = "E2eTestPass1!";

const MERCHANT_A = `Filter Merchant A ${TS}`;
const MERCHANT_B = `Filter Merchant B ${TS}`;

/**
 * Register and log in using the browser context's own request object so the
 * session cookie lives in the same cookie jar the page uses.
 */
async function setupAgent(page: import("@playwright/test").Page): Promise<void> {
  const ctx = page.context();

  await ctx.request.post("/api/register", {
    data: {
      firstName: "FilterE2E",
      lastName: "Agent",
      email: AGENT_EMAIL,
      password: AGENT_PASSWORD,
      referralCode: "",
    },
    failOnStatusCode: false,
  });

  const loginRes = await ctx.request.post("/api/login", {
    data: { username: AGENT_EMAIL, password: AGENT_PASSWORD },
  });
  expect(loginRes.ok()).toBeTruthy();
}

/**
 * Create a subscription and return its numeric id.
 */
async function createSubscription(
  page: import("@playwright/test").Page,
  merchantName: string
): Promise<number> {
  const res = await page.context().request.post("/api/subscriptions", {
    data: { merchantName, tier: "tier_1" },
  });
  expect(res.ok()).toBeTruthy();
  const sub = await res.json();
  expect(typeof sub.id).toBe("number");
  return sub.id;
}

/**
 * Pause a subscription so a "pause" activity log entry is created.
 */
async function pauseSubscription(
  page: import("@playwright/test").Page,
  subId: number
): Promise<void> {
  const res = await page.context().request.patch(
    `/api/subscriptions/${subId}/status`,
    { data: { status: "paused" } }
  );
  expect(res.ok()).toBeTruthy();
}

/**
 * Open the All Activity tab and wait for the timeline to render.
 */
async function openActivityTab(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/subscriptions");
  await page.getByTestId("tab-activity").click();
  await expect(page.getByTestId("activity-filter-bar")).toBeVisible({ timeout: 8000 });
  await page
    .getByTestId("all-activity-loading")
    .waitFor({ state: "hidden", timeout: 8000 })
    .catch(() => {/* may already be gone */});
  await expect(page.getByTestId("all-activity-timeline")).toBeVisible({ timeout: 8000 });
}

const entries = (page: import("@playwright/test").Page) =>
  page.locator('[data-testid^="activity-entry-"]');

test.describe("All Activity timeline — filter dropdowns narrow results", () => {
  let subAId: number;
  let subBId: number;

  test.beforeEach(async ({ page }) => {
    await setupAgent(page);
    // Fresh subscriptions for each test (each POST creates a "create" log entry).
    subAId = await createSubscription(page, MERCHANT_A);
    subBId = await createSubscription(page, MERCHANT_B);
    // Pause merchant B so there is a distinct "pause" action entry.
    await pauseSubscription(page, subBId);
  });

  test("subscription filter shows only entries for the selected merchant", async ({
    page,
  }) => {
    await openActivityTab(page);

    // Baseline: unfiltered view contains entries for BOTH merchants.
    const timeline = page.getByTestId("all-activity-timeline");
    await expect(entries(page).first()).toBeVisible({ timeout: 8000 });
    await expect(timeline.getByText(MERCHANT_A).first()).toBeVisible();
    await expect(timeline.getByText(MERCHANT_B).first()).toBeVisible();
    const countBefore = await entries(page).count();
    expect(countBefore).toBeGreaterThanOrEqual(3);

    // Filter to merchant A only.
    await page.getByTestId("select-filter-subscription").click();
    await page.getByTestId(`filter-sub-option-${subAId}`).click();

    // The trigger reflects the selection.
    await expect(page.getByTestId("select-filter-subscription")).toContainText(
      MERCHANT_A
    );

    // Wait for the refetched, narrowed result set.
    await expect(entries(page).first()).toBeVisible({ timeout: 8000 });

    // Every visible entry must be merchant A; merchant B must not appear.
    await expect(timeline.getByText(MERCHANT_A).first()).toBeVisible();
    await expect(timeline.getByText(MERCHANT_B)).toHaveCount(0);

    // Narrowed set is no larger than the full set.
    const countAfter = await entries(page).count();
    expect(countAfter).toBeLessThanOrEqual(countBefore);
    expect(countAfter).toBeGreaterThan(0);
  });

  test("action filter shows only entries matching the selected action", async ({
    page,
  }) => {
    await openActivityTab(page);

    const timeline = page.getByTestId("all-activity-timeline");
    await expect(entries(page).first()).toBeVisible({ timeout: 8000 });
    const countBefore = await entries(page).count();

    // Filter to the "Paused" action.
    await page.getByTestId("select-filter-action").click();
    await page.getByTestId("filter-action-option-pause").click();

    await expect(page.getByTestId("select-filter-action")).toContainText("Paused");

    // Wait for the narrowed result set.
    await expect(entries(page).first()).toBeVisible({ timeout: 8000 });

    // Only the paused merchant (B) should appear; the never-paused merchant (A) must not.
    await expect(timeline.getByText(MERCHANT_B).first()).toBeVisible();
    await expect(timeline.getByText(MERCHANT_A)).toHaveCount(0);

    // Every visible description must reference a pause ("paused").
    const descriptions = timeline.locator(
      '[data-testid^="activity-entry-"] p.font-medium'
    );
    const descCount = await descriptions.count();
    expect(descCount).toBeGreaterThan(0);
    for (let i = 0; i < descCount; i++) {
      await expect(descriptions.nth(i)).toContainText(/paus/i);
    }

    // Pause entries are a strict subset of all entries.
    const countAfter = await entries(page).count();
    expect(countAfter).toBeLessThan(countBefore);
    expect(countAfter).toBeGreaterThan(0);
  });

  test("filters survive a page reload — both dropdowns and results persist", async ({
    page,
  }) => {
    await openActivityTab(page);

    const timeline = page.getByTestId("all-activity-timeline");
    await expect(entries(page).first()).toBeVisible({ timeout: 8000 });

    // Apply subscription filter (merchant A only).
    await page.getByTestId("select-filter-subscription").click();
    await page.getByTestId(`filter-sub-option-${subAId}`).click();
    await expect(page.getByTestId("select-filter-subscription")).toContainText(MERCHANT_A);

    // Also apply action filter (pause).
    await page.getByTestId("select-filter-action").click();
    await page.getByTestId("filter-action-option-pause").click();
    await expect(page.getByTestId("select-filter-action")).toContainText("Paused");

    // Wait for results to settle; the combo of sub A + pause may yield 0 results
    // (merchant A was never paused), so capture the URL before checking counts.
    await page.waitForTimeout(500);

    // Capture the URL that encodes both filters.
    const filteredUrl = page.url();
    expect(filteredUrl).toContain("actSub=");
    expect(filteredUrl).toContain("actAction=pause");

    // Reload the page — tab defaults back to "subscriptions", filters stay in URL.
    await page.reload();

    // Navigate back to the activity tab.
    await page.getByTestId("tab-activity").click();
    await expect(page.getByTestId("activity-filter-bar")).toBeVisible({ timeout: 8000 });
    await page
      .getByTestId("all-activity-loading")
      .waitFor({ state: "hidden", timeout: 8000 })
      .catch(() => {/* may already be gone */});

    // Both dropdowns must still reflect the pre-reload selections.
    await expect(page.getByTestId("select-filter-subscription")).toContainText(MERCHANT_A);
    await expect(page.getByTestId("select-filter-action")).toContainText("Paused");

    // The clear-filters button is visible because filters are active.
    await expect(page.getByTestId("button-clear-activity-filters")).toBeVisible();

    // The filtered result set must not contain merchant B entries.
    const timelineOrEmpty = page.locator(
      '[data-testid="all-activity-timeline"], [data-testid="all-activity-empty"]'
    );
    await expect(timelineOrEmpty.first()).toBeVisible({ timeout: 8000 });
    await expect(timeline.getByText(MERCHANT_B)).toHaveCount(0);
  });

  test("deep link with actAction=pause pre-selects the action dropdown and filters results", async ({
    page,
  }) => {
    await setupAgent(page); // Note: setupAgent is idempotent (failOnStatusCode: false on register)

    // Navigate directly with the actAction filter in the URL.
    await page.goto(`/subscriptions?actAction=pause`);

    // Click the activity tab to reveal the timeline.
    await page.getByTestId("tab-activity").click();
    await expect(page.getByTestId("activity-filter-bar")).toBeVisible({ timeout: 8000 });
    await page
      .getByTestId("all-activity-loading")
      .waitFor({ state: "hidden", timeout: 8000 })
      .catch(() => {/* may already be gone */});

    // The action dropdown must reflect "pause" from the deep-linked URL.
    await expect(page.getByTestId("select-filter-action")).toContainText("Paused");

    // The subscription dropdown remains at its default.
    await expect(page.getByTestId("select-filter-subscription")).toContainText("All subscriptions");

    // The clear-filters button is visible (at least one filter is active).
    await expect(page.getByTestId("button-clear-activity-filters")).toBeVisible();

    // Either results appear (all "pause" entries) or the empty-state is shown.
    // If results exist, no "create" entries may appear (only pause actions).
    const timeline = page.getByTestId("all-activity-timeline");
    const emptyState = page.getByTestId("all-activity-empty");
    const hasResults = await timeline.isVisible().catch(() => false);

    if (hasResults) {
      await expect(entries(page).first()).toBeVisible({ timeout: 8000 });
      const descriptions = timeline.locator('[data-testid^="activity-entry-"] p.font-medium');
      const descCount = await descriptions.count();
      for (let i = 0; i < descCount; i++) {
        await expect(descriptions.nth(i)).toContainText(/paus/i);
      }
    } else {
      await expect(emptyState).toBeVisible({ timeout: 8000 });
    }
  });

  test("Clear filters button restores the full unfiltered list", async ({
    page,
  }) => {
    await openActivityTab(page);

    const timeline = page.getByTestId("all-activity-timeline");
    await expect(entries(page).first()).toBeVisible({ timeout: 8000 });
    const countBefore = await entries(page).count();

    // No Clear button until a filter is active.
    await expect(
      page.getByTestId("button-clear-activity-filters")
    ).toHaveCount(0);

    // Apply the action filter to narrow the list.
    await page.getByTestId("select-filter-action").click();
    await page.getByTestId("filter-action-option-pause").click();
    await expect(page.getByTestId("select-filter-action")).toContainText("Paused");
    await expect(entries(page).first()).toBeVisible({ timeout: 8000 });
    const countFiltered = await entries(page).count();
    expect(countFiltered).toBeLessThan(countBefore);

    // Clear filters restores everything.
    const clearBtn = page.getByTestId("button-clear-activity-filters");
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // Both dropdowns reset to their "all" defaults.
    await expect(page.getByTestId("select-filter-action")).toContainText(
      "All actions"
    );
    await expect(page.getByTestId("select-filter-subscription")).toContainText(
      "All subscriptions"
    );

    // The Clear button disappears once no filters are active.
    await expect(clearBtn).toHaveCount(0);

    // Full list is back: both merchants visible and count restored.
    await expect(entries(page).first()).toBeVisible({ timeout: 8000 });
    await expect(timeline.getByText(MERCHANT_A).first()).toBeVisible();
    await expect(timeline.getByText(MERCHANT_B).first()).toBeVisible();
    const countAfter = await entries(page).count();
    expect(countAfter).toBeGreaterThanOrEqual(countFiltered);
    expect(countAfter).toBe(countBefore);
  });
});

test.describe("All Activity timeline — search box narrows results", () => {
  let subAId: number;
  let subBId: number;

  test.beforeEach(async ({ page }) => {
    await setupAgent(page);
    subAId = await createSubscription(page, MERCHANT_A);
    subBId = await createSubscription(page, MERCHANT_B);
    await pauseSubscription(page, subBId);
  });

  test("typing a merchant name into the search box shows only matching entries", async ({
    page,
  }) => {
    await openActivityTab(page);

    const timeline = page.getByTestId("all-activity-timeline");
    await expect(entries(page).first()).toBeVisible({ timeout: 8000 });

    // Both merchants visible before searching.
    await expect(timeline.getByText(MERCHANT_A).first()).toBeVisible();
    await expect(timeline.getByText(MERCHANT_B).first()).toBeVisible();
    const countBefore = await entries(page).count();

    // Type merchant A's name into the search box.
    await page.getByTestId("input-activity-search").fill(MERCHANT_A);

    // Wait for the 300 ms debounce + network round-trip.
    await page.waitForTimeout(500);
    await expect(entries(page).first()).toBeVisible({ timeout: 8000 });

    // Merchant A entries visible; merchant B entries gone.
    await expect(timeline.getByText(MERCHANT_A).first()).toBeVisible();
    await expect(timeline.getByText(MERCHANT_B)).toHaveCount(0);

    // Narrowed set is smaller than (or equal to) the full set but non-empty.
    const countAfter = await entries(page).count();
    expect(countAfter).toBeLessThanOrEqual(countBefore);
    expect(countAfter).toBeGreaterThan(0);
  });

  test("a search term that matches nothing shows the empty-state message", async ({
    page,
  }) => {
    await openActivityTab(page);
    await expect(entries(page).first()).toBeVisible({ timeout: 8000 });

    // Type a term guaranteed to match no activity entries.
    await page.getByTestId("input-activity-search").fill(`__no_match_${TS}__`);

    // Wait for debounce + fetch.
    await page.waitForTimeout(500);

    await expect(page.getByTestId("all-activity-empty")).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByTestId("all-activity-timeline")).toHaveCount(0);
  });

  test("Clear filters button resets the search box and restores the full list", async ({
    page,
  }) => {
    await openActivityTab(page);

    const timeline = page.getByTestId("all-activity-timeline");
    await expect(entries(page).first()).toBeVisible({ timeout: 8000 });
    const countBefore = await entries(page).count();

    // No Clear button until a filter is active.
    await expect(
      page.getByTestId("button-clear-activity-filters")
    ).toHaveCount(0);

    // Type into the search box to narrow results.
    await page.getByTestId("input-activity-search").fill(MERCHANT_A);
    await page.waitForTimeout(500);
    await expect(entries(page).first()).toBeVisible({ timeout: 8000 });
    const countFiltered = await entries(page).count();
    expect(countFiltered).toBeLessThanOrEqual(countBefore);

    // Clear filters button appears.
    const clearBtn = page.getByTestId("button-clear-activity-filters");
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // Search box is cleared.
    await expect(page.getByTestId("input-activity-search")).toHaveValue("");

    // Clear button disappears once no filters are active.
    await expect(clearBtn).toHaveCount(0);

    // Full list is restored: both merchants visible and count matches original.
    await expect(entries(page).first()).toBeVisible({ timeout: 8000 });
    await expect(timeline.getByText(MERCHANT_A).first()).toBeVisible();
    await expect(timeline.getByText(MERCHANT_B).first()).toBeVisible();
    const countAfter = await entries(page).count();
    expect(countAfter).toBe(countBefore);
  });
});
