import { test, expect } from "@playwright/test";

/**
 * Seeded admin credentials (matches server/seed.ts and the existing database).
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
 * Open the "Recently changed" date-range dropdown and pick the option with the
 * given visible label (e.g. "Last 7 days", "Last 30 days", "All time").
 */
async function selectDateRange(
  page: import("@playwright/test").Page,
  optionLabel: string
): Promise<void> {
  await page.getByTestId("select-date-range-filter").click();
  await page.getByRole("option", { name: optionLabel, exact: true }).click();
}

test.describe("Admin subscriptions – date range summary card visibility", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/subscriptions");
    await expect(page.getByTestId("select-date-range-filter")).toBeVisible({
      timeout: 8000,
    });
  });

  test("shows the summary card with 'Summary: Last 7 days' when the 7-day filter is selected", async ({
    page,
  }) => {
    await selectDateRange(page, "Last 7 days");

    const card = page.getByTestId("date-range-summary-card");
    await expect(card).toBeVisible({ timeout: 8000 });
    await expect(card).toContainText("Summary: Last 7 days");
  });

  test("shows the summary card with 'Summary: Last 30 days' when the 30-day filter is selected", async ({
    page,
  }) => {
    await selectDateRange(page, "Last 30 days");

    const card = page.getByTestId("date-range-summary-card");
    await expect(card).toBeVisible({ timeout: 8000 });
    await expect(card).toContainText("Summary: Last 30 days");
  });

  test("does NOT show the summary card when the 'All time' filter is selected", async ({
    page,
  }) => {
    // First select a range that DOES show the card, to prove the card can render…
    await selectDateRange(page, "Last 7 days");
    await expect(page.getByTestId("date-range-summary-card")).toBeVisible({
      timeout: 8000,
    });

    // …then switch back to "All time" and confirm it disappears.
    await selectDateRange(page, "All time");
    await expect(page.getByTestId("select-date-range-filter")).toContainText(
      "All time"
    );
    await expect(page.getByTestId("date-range-summary-card")).toHaveCount(0);
  });

  test("hides and re-shows the card as the filter switches between 7-day, 30-day and All time", async ({
    page,
  }) => {
    const card = page.getByTestId("date-range-summary-card");

    await selectDateRange(page, "Last 7 days");
    await expect(card).toContainText("Summary: Last 7 days");

    await selectDateRange(page, "Last 30 days");
    await expect(card).toContainText("Summary: Last 30 days");

    await selectDateRange(page, "All time");
    await expect(card).toHaveCount(0);
  });
});
