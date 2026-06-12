import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@psl.capital";
const ADMIN_PASSWORD = "password123";

async function loginAsAdmin(page: import("@playwright/test").Page): Promise<void> {
  const res = await page.context().request.post("/api/login", {
    data: { username: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
}

/**
 * Intercept the expiry-failures count endpoint and return a controlled fixture.
 * Only the exact GET endpoint is mocked; nothing else is touched so the real
 * activity log and DB are never read or mutated.
 */
async function mockExpiryFailures(
  page: import("@playwright/test").Page,
  body: { count: number; sinceDays: number }
): Promise<void> {
  await page.route(
    "**/api/admin/activity-log/expiry-failures",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    }
  );
}

test.describe("Admin dashboard – auto-expiry failure banner", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("shows the banner with pluralized count when failures exist", async ({
    page,
  }) => {
    await mockExpiryFailures(page, { count: 3, sinceDays: 7 });
    await page.goto("/admin");

    const banner = page.getByTestId("banner-expiry-failures");
    await expect(banner).toBeVisible({ timeout: 10000 });
    await expect(banner).toContainText("3 subscriptions failed to auto-expire");
    await expect(banner).toContainText("in the last 7 days");
  });

  test("shows the banner with singular text when exactly one failure exists", async ({
    page,
  }) => {
    await mockExpiryFailures(page, { count: 1, sinceDays: 7 });
    await page.goto("/admin");

    const banner = page.getByTestId("banner-expiry-failures");
    await expect(banner).toBeVisible({ timeout: 10000 });
    await expect(banner).toContainText("1 subscription failed to auto-expire");
    // Must not use the plural noun form.
    await expect(banner).not.toContainText("subscriptions failed");
  });

  test("hides the banner when there are no failures", async ({ page }) => {
    await mockExpiryFailures(page, { count: 0, sinceDays: 7 });
    await page.goto("/admin");

    // Wait for the dashboard to render before asserting absence.
    await expect(page.getByRole("heading", { name: "Admin Dashboard" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("banner-expiry-failures")).toHaveCount(0);
  });

  test("dismissing the banner hides it", async ({ page }) => {
    await mockExpiryFailures(page, { count: 2, sinceDays: 7 });
    await page.goto("/admin");

    const banner = page.getByTestId("banner-expiry-failures");
    await expect(banner).toBeVisible({ timeout: 10000 });

    await page.getByTestId("button-dismiss-expiry-failures").click();
    await expect(banner).toHaveCount(0);
  });

  test("the banner links to the filtered subscription error activity log", async ({
    page,
  }) => {
    await mockExpiryFailures(page, { count: 5, sinceDays: 7 });
    await page.goto("/admin");

    const link = page.getByTestId("link-expiry-failures");
    await expect(link).toBeVisible({ timeout: 10000 });
    await expect(link).toHaveAttribute(
      "href",
      "/admin/activity?entityType=subscription&action=error"
    );
  });
});
