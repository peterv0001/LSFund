import { test, expect } from "@playwright/test";

const TS = Date.now();

/**
 * Seeded admin credentials (matches server/seed.ts and the existing database).
 * Password is the same plain-text value hashed during seeding.
 */
const ADMIN_EMAIL = "admin@psl.capital";
const ADMIN_PASSWORD = "password123";

async function loginAsAdmin(page: import("@playwright/test").Page): Promise<void> {
  const res = await page.context().request.post("/api/login", {
    data: { username: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
}

/**
 * Register a fresh agent and log in so we can create activity entries
 * attributed to an "agent" actor type.
 */
async function loginAsFreshAgent(page: import("@playwright/test").Page): Promise<string> {
  const email = `e2e-filter-${TS}-${Math.random().toString(36).slice(2)}@example.com`;
  await page.context().request.post("/api/register", {
    data: {
      firstName: "FilterE2E",
      lastName: "Agent",
      email,
      password: "E2eTestPass1!",
      referralCode: "",
    },
    failOnStatusCode: false,
  });
  const res = await page.context().request.post("/api/login", {
    data: { username: email, password: "E2eTestPass1!" },
  });
  expect(res.ok()).toBeTruthy();
  return email;
}

/**
 * Wait for any loading spinner to disappear and the table / empty-state to settle.
 */
async function waitForResults(page: import("@playwright/test").Page): Promise<void> {
  const spinner = page.locator(".animate-spin");
  await spinner
    .waitFor({ state: "hidden", timeout: 8000 })
    .catch(() => {/* may already be gone */});
}

/**
 * Return the number of activity rows currently visible.
 */
async function rowCount(page: import("@playwright/test").Page): Promise<number> {
  return page.locator('[data-testid^="row-activity-"]').count();
}

// ─── Suite 1: Applying filters updates the URL ────────────────────────────────

test.describe("Activity log filters — URL update on filter change", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("selecting an actor type filter updates the URL query string", async ({ page }) => {
    await page.goto("/admin/activity");
    await expect(page.getByTestId("select-actor-type")).toBeVisible({ timeout: 8000 });

    await page.getByTestId("select-actor-type").click();
    await page.getByRole("option", { name: "Agent" }).click();

    await expect(page).toHaveURL(/actorType=agent/, { timeout: 5000 });
  });

  test("selecting an entity type filter updates the URL query string", async ({ page }) => {
    await page.goto("/admin/activity");
    await expect(page.getByTestId("select-entity-type")).toBeVisible({ timeout: 8000 });

    await page.getByTestId("select-entity-type").click();
    await page.getByRole("option", { name: "Subscription" }).click();

    await expect(page).toHaveURL(/entityType=subscription/, { timeout: 5000 });
  });

  test("selecting an action filter updates the URL query string", async ({ page }) => {
    await page.goto("/admin/activity");
    await expect(page.getByTestId("select-action")).toBeVisible({ timeout: 8000 });

    await page.getByTestId("select-action").click();
    await page.getByRole("option", { name: "Create" }).click();

    await expect(page).toHaveURL(/action=create/, { timeout: 5000 });
  });

  test("typing in the search box updates the URL after debounce", async ({ page }) => {
    await page.goto("/admin/activity");
    await expect(page.getByTestId("input-log-search")).toBeVisible({ timeout: 8000 });

    await page.getByTestId("input-log-search").fill("testquery");

    // The search input has a 300 ms debounce; wait long enough for it to fire
    await expect(page).toHaveURL(/search=testquery/, { timeout: 3000 });
  });

  test("the URL does NOT update immediately while typing – results apply after debounce", async ({ page }) => {
    await page.goto("/admin/activity");
    await waitForResults(page);

    // Baseline: unfiltered view must have rows
    const rows = page.locator('[data-testid^="row-activity-"]');
    await expect(rows.first()).toBeVisible({ timeout: 8000 });
    const countBefore = await rows.count();
    expect(countBefore).toBeGreaterThan(0);

    const searchInput = page.getByTestId("input-log-search");

    // Unique term guaranteed not to match any existing log entry
    const uniqueTerm = `zz-no-match-${Date.now()}`;

    // Type quickly — simulates real user typing
    await searchInput.pressSequentially(uniqueTerm, { delay: 30 });

    // Immediately after finishing typing: URL must NOT yet have the search param
    const urlRightAfterTyping = page.url();
    expect(urlRightAfterTyping).not.toMatch(/search=/);

    // And the original rows should still be visible (query has not re-fired yet)
    const countRightAfterTyping = await rows.count();
    expect(countRightAfterTyping).toBeGreaterThan(0);

    // After debounce settles (300 ms): URL gains the search param
    await expect(page).toHaveURL(/search=/, { timeout: 2000 });

    // Results update: unique term matches nothing → empty state
    await waitForResults(page);
    await expect(
      page.getByText("No activity matches your filters.")
    ).toBeVisible({ timeout: 5000 });
  });

  test("setting the start date updates the URL query string", async ({ page }) => {
    await page.goto("/admin/activity");
    await expect(page.getByTestId("input-log-start-date")).toBeVisible({ timeout: 8000 });

    await page.getByTestId("input-log-start-date").fill("2026-01-01");
    // Date inputs fire immediately (no debounce)
    await expect(page).toHaveURL(/startDate=2026-01-01/, { timeout: 3000 });
  });

  test("setting the end date updates the URL query string", async ({ page }) => {
    await page.goto("/admin/activity");
    await expect(page.getByTestId("input-log-end-date")).toBeVisible({ timeout: 8000 });

    await page.getByTestId("input-log-end-date").fill("2026-12-31");
    await expect(page).toHaveURL(/endDate=2026-12-31/, { timeout: 3000 });
  });

  test("multiple filters together produce a URL with all query params", async ({ page }) => {
    await page.goto("/admin/activity");
    await expect(page.getByTestId("select-actor-type")).toBeVisible({ timeout: 8000 });

    await page.getByTestId("select-actor-type").click();
    await page.getByRole("option", { name: "Admin" }).click();
    await expect(page).toHaveURL(/actorType=admin/, { timeout: 5000 });

    await page.getByTestId("select-entity-type").click();
    await page.getByRole("option", { name: "Deal" }).click();
    await expect(page).toHaveURL(/entityType=deal/, { timeout: 5000 });

    const url = page.url();
    expect(url).toMatch(/actorType=admin/);
    expect(url).toMatch(/entityType=deal/);
  });
});

// ─── Suite 2: Pre-filtered URL restores filter state ─────────────────────────

test.describe("Activity log filters — pre-filtered URL restores filter state", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("navigating to a URL with actorType=agent pre-selects the Actor filter", async ({ page }) => {
    await page.goto("/admin/activity?actorType=agent");
    await expect(page.getByTestId("select-actor-type")).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId("select-actor-type")).toContainText("Agent");
  });

  test("navigating to a URL with entityType=subscription pre-selects the Entity Type filter", async ({ page }) => {
    await page.goto("/admin/activity?entityType=subscription");
    await expect(page.getByTestId("select-entity-type")).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId("select-entity-type")).toContainText("Subscription");
  });

  test("navigating to a URL with action=create pre-selects the Action filter", async ({ page }) => {
    await page.goto("/admin/activity?action=create");
    await expect(page.getByTestId("select-action")).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId("select-action")).toContainText("Create");
  });

  test("navigating to a URL with search param pre-fills the search input", async ({ page }) => {
    await page.goto("/admin/activity?search=importantterm");
    await expect(page.getByTestId("input-log-search")).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId("input-log-search")).toHaveValue("importantterm");
  });

  test("navigating to a URL with startDate pre-fills the start date input", async ({ page }) => {
    await page.goto("/admin/activity?startDate=2026-03-01");
    await expect(page.getByTestId("input-log-start-date")).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId("input-log-start-date")).toHaveValue("2026-03-01");
  });

  test("navigating to a URL with endDate pre-fills the end date input", async ({ page }) => {
    await page.goto("/admin/activity?endDate=2026-03-31");
    await expect(page.getByTestId("input-log-end-date")).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId("input-log-end-date")).toHaveValue("2026-03-31");
  });

  test("navigating to a URL with multiple filter params restores all of them", async ({ page }) => {
    await page.goto("/admin/activity?entityType=subscription&actorType=agent&action=create");
    await expect(page.getByTestId("select-entity-type")).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId("select-entity-type")).toContainText("Subscription");
    await expect(page.getByTestId("select-actor-type")).toContainText("Agent");
    await expect(page.getByTestId("select-action")).toContainText("Create");
  });

  test("the Clear button appears when navigating to a URL with active filters", async ({ page }) => {
    await page.goto("/admin/activity?actorType=agent");
    await expect(page.getByTestId("button-clear-filters")).toBeVisible({ timeout: 8000 });
  });

  test("the Clear button resets all filters, clears URL params, and restores full results", async ({ page }) => {
    // Navigate with a filter that yields fewer results (action=create has 8 of ~56 entries)
    await page.goto("/admin/activity?action=create&actorType=admin");
    await waitForResults(page);

    await expect(page.getByTestId("select-action")).toContainText("Create");
    await expect(page.getByTestId("select-actor-type")).toContainText("Admin");

    const rowsFiltered = page.locator('[data-testid^="row-activity-"]');
    await expect(rowsFiltered.first()).toBeVisible({ timeout: 8000 });
    const countFiltered = await rowsFiltered.count();

    const clearBtn = page.getByTestId("button-clear-filters");
    await expect(clearBtn).toBeVisible({ timeout: 8000 });
    await clearBtn.click();

    await expect(page).not.toHaveURL(/entityType=/, { timeout: 5000 });
    await expect(page).not.toHaveURL(/actorType=/, { timeout: 5000 });
    await expect(page).not.toHaveURL(/action=/, { timeout: 5000 });

    await expect(page.getByTestId("select-entity-type")).toContainText("All types");
    await expect(page.getByTestId("select-actor-type")).toContainText("All actors");
    await expect(page.getByTestId("select-action")).toContainText("All actions");

    // The full unfiltered result set must be larger than the filtered set
    await waitForResults(page);
    const rowsAll = page.locator('[data-testid^="row-activity-"]');
    await expect(rowsAll.first()).toBeVisible({ timeout: 8000 });
    const countAll = await rowsAll.count();
    expect(countAll).toBeGreaterThan(countFiltered);
  });

  test("the Clear button resets the search input and restores full results", async ({ page }) => {
    await page.goto("/admin/activity");
    await waitForResults(page);

    const rows = page.locator('[data-testid^="row-activity-"]');
    await expect(rows.first()).toBeVisible({ timeout: 8000 });
    const countBefore = await rows.count();

    const searchInput = page.getByTestId("input-log-search");

    // Unique term → empty state
    const uniqueTerm = `zz-clear-test-${Date.now()}`;
    await searchInput.fill(uniqueTerm);
    await expect(page).toHaveURL(/search=/, { timeout: 2000 });
    await waitForResults(page);
    await expect(
      page.getByText("No activity matches your filters.")
    ).toBeVisible({ timeout: 5000 });

    const clearBtn = page.getByTestId("button-clear-filters");
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    await expect(page).toHaveURL(/\/admin\/activity$/, { timeout: 5000 });
    await expect(searchInput).toHaveValue("");
    await expect(clearBtn).not.toBeVisible();

    // Full result set is restored
    await waitForResults(page);
    await expect(rows.first()).toBeVisible({ timeout: 8000 });
    const countAfter = await rows.count();
    expect(countAfter).toBeGreaterThanOrEqual(countBefore);
  });
});

// ─── Suite 3: Filtered results match the applied filters ─────────────────────

test.describe("Activity log filters — filtered results match filter criteria", () => {
  test("filtering by entityType=subscription shows only subscription rows", async ({ page }) => {
    await loginAsFreshAgent(page);
    const merchantName = `FilterE2E Merchant ${TS}`;
    const subRes = await page.context().request.post("/api/subscriptions", {
      data: { merchantName, tier: "tier_1" },
    });
    expect(subRes.ok()).toBeTruthy();

    await loginAsAdmin(page);
    await page.goto("/admin/activity?entityType=subscription");

    await expect(page.locator('[data-testid^="row-activity-"]').first()).toBeVisible({
      timeout: 10000,
    });

    const entityCells = page.locator('[data-testid^="row-activity-"] td:nth-child(4)');
    const count = await entityCells.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(entityCells.nth(i)).toContainText("subscription", { ignoreCase: true });
    }
  });

  test("filtering by action=create narrows the result set", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/activity");
    await waitForResults(page);

    const rows = page.locator('[data-testid^="row-activity-"]');
    await expect(rows.first()).toBeVisible({ timeout: 8000 });
    const countBefore = await rows.count();

    // Apply action=create filter via dropdown (no submit button)
    await page.getByTestId("select-action").click();
    await page.getByRole("option", { name: "Create" }).click();

    await expect(page).toHaveURL(/action=create/, { timeout: 5000 });
    await waitForResults(page);

    // create entries exist and are fewer than the full log
    await expect(rows.first()).toBeVisible({ timeout: 8000 });
    const countAfter = await rows.count();
    expect(countAfter).toBeLessThan(countBefore);
    expect(countAfter).toBeGreaterThan(0);
  });

  test("filtering by actorType=system shows empty state (no system-actor entries in seed data)", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/activity");
    await waitForResults(page);

    // Baseline has rows
    await expect(page.locator('[data-testid^="row-activity-"]').first()).toBeVisible({ timeout: 8000 });

    // Switch actor filter to System — there are no system-actor log entries
    await page.getByTestId("select-actor-type").click();
    await page.getByRole("option", { name: "System" }).click();

    await expect(page).toHaveURL(/actorType=system/, { timeout: 5000 });
    await waitForResults(page);
    await expect(
      page.getByText("No activity matches your filters.")
    ).toBeVisible({ timeout: 8000 });
  });

  test("filters applied via UI survive a page reload", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/activity");
    await expect(page.getByTestId("select-entity-type")).toBeVisible({ timeout: 8000 });

    // Apply filters through the UI controls
    await page.getByTestId("select-actor-type").click();
    await page.getByRole("option", { name: "Agent" }).click();
    await expect(page).toHaveURL(/actorType=agent/, { timeout: 5000 });

    await page.getByTestId("select-entity-type").click();
    await page.getByRole("option", { name: "Subscription" }).click();
    await expect(page).toHaveURL(/entityType=subscription/, { timeout: 5000 });

    // Reload and confirm both filters are still active
    await page.reload();

    await expect(page.getByTestId("select-entity-type")).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId("select-entity-type")).toContainText("Subscription");
    await expect(page.getByTestId("select-actor-type")).toContainText("Agent");
    await expect(page).toHaveURL(/entityType=subscription/);
    await expect(page).toHaveURL(/actorType=agent/);
  });

  test("page reload preserves the applied dropdown, search, and date filters", async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto("/admin/activity?entityType=subscription&actorType=agent&search=merchant&startDate=2026-01-01&endDate=2026-12-31");

    await expect(page.getByTestId("select-entity-type")).toBeVisible({ timeout: 8000 });

    const urlBeforeReload = page.url();
    await page.reload();

    expect(page.url()).toBe(urlBeforeReload);

    await expect(page.getByTestId("select-entity-type")).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId("select-entity-type")).toContainText("Subscription");
    await expect(page.getByTestId("select-actor-type")).toContainText("Agent");
    await expect(page.getByTestId("input-log-search")).toHaveValue("merchant");
    await expect(page.getByTestId("input-log-start-date")).toHaveValue("2026-01-01");
    await expect(page.getByTestId("input-log-end-date")).toHaveValue("2026-12-31");
  });
});
