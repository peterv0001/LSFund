import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@psl.capital";
const ADMIN_PASSWORD = "password123";

async function loginAsAdmin(page: import("@playwright/test").Page): Promise<void> {
  const res = await page.context().request.post("/api/login", {
    data: { username: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
}

test.describe("Agents page – sort state persists in the URL", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("clicking the Subscriptions header writes sortBy/sortOrder to the URL", async ({ page }) => {
    await page.goto("/admin/agents");

    const sortBtn = page.getByTestId("sort-subscriptions");
    await expect(sortBtn).toBeVisible();

    await sortBtn.click();

    await expect.poll(() => new URL(page.url()).searchParams.get("sortBy")).toBe(
      "subscriptionCount"
    );
    await expect.poll(() => new URL(page.url()).searchParams.get("sortOrder")).toBe(
      "desc"
    );

    // Toggling to ascending updates the URL order
    await sortBtn.click();
    await expect.poll(() => new URL(page.url()).searchParams.get("sortOrder")).toBe(
      "asc"
    );
  });

  test("sort is initialised from URL params on load", async ({ page }) => {
    await page.goto("/admin/agents?sortBy=subscriptionCount&sortOrder=asc");

    // Icon should reflect the ascending sort from the URL
    await expect(page.getByTestId("icon-sort-asc")).toBeVisible();
    await expect(page.getByTestId("icon-sort-neutral")).not.toBeVisible();
    await expect(page.getByTestId("icon-sort-desc")).not.toBeVisible();
  });

  test("sort survives a navigation round-trip via the browser Back button", async ({ page }) => {
    await page.goto("/admin/agents");

    const sortBtn = page.getByTestId("sort-subscriptions");
    await expect(sortBtn).toBeVisible();

    // Apply a descending sort
    await sortBtn.click();
    await expect.poll(() => new URL(page.url()).searchParams.get("sortBy")).toBe(
      "subscriptionCount"
    );
    await expect(page.getByTestId("icon-sort-desc")).toBeVisible();

    // Navigate away to the subscriptions page
    await page.goto("/admin/subscriptions");
    await expect(page).toHaveURL(/\/admin\/subscriptions/);

    // Press the browser Back button
    await page.goBack();
    await expect(page).toHaveURL(/sortBy=subscriptionCount/);
    await expect(page).toHaveURL(/sortOrder=desc/);

    // The sort indicator should be restored
    await expect(page.getByTestId("sort-subscriptions")).toBeVisible();
    await expect(page.getByTestId("icon-sort-desc")).toBeVisible();
    await expect(page.getByTestId("icon-sort-neutral")).not.toBeVisible();
  });
});
