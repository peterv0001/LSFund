import { test, expect } from "@playwright/test";

const TS = Date.now();
const AGENT_EMAIL = `e2e-activity-${TS}@example.com`;
const AGENT_PASSWORD = "E2eTestPass1!";

/**
 * Register and log in using the browser context's own request object so that
 * the session cookie is stored in the same cookie jar the page uses.
 */
async function setupAgent(page: import("@playwright/test").Page): Promise<void> {
  const ctx = page.context();

  await ctx.request.post("/api/register", {
    data: {
      firstName: "E2E",
      lastName: "Tester",
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

test.describe("All Activity timeline – tab switching", () => {
  test.beforeEach(async ({ page }) => {
    await setupAgent(page);
  });

  test("switches to the All Activity tab and renders the timeline container", async ({
    page,
  }) => {
    // Create a subscription via the authenticated context so an activity entry exists
    const subRes = await page.context().request.post("/api/subscriptions", {
      data: { merchantName: "Tab Switch Merchant", tier: "tier_1" },
    });
    expect(subRes.ok()).toBeTruthy();

    await page.goto("/subscriptions");

    // Both tabs should be visible and Subscriptions should be the default
    await expect(page.getByTestId("tab-subscriptions")).toBeVisible();
    await expect(page.getByTestId("tab-activity")).toBeVisible();
    await expect(page.getByTestId("tab-content-subscriptions")).toBeVisible();

    // Click the All Activity tab
    await page.getByTestId("tab-activity").click();

    // The All Activity content area should now be visible
    await expect(page.getByTestId("tab-content-activity")).toBeVisible();

    // Wait for any loading state to clear
    await page
      .getByTestId("all-activity-loading")
      .waitFor({ state: "hidden", timeout: 8000 })
      .catch(() => {
        // May already be gone before assertion
      });

    // Timeline renders without error
    await expect(page.getByTestId("all-activity-error")).not.toBeVisible();
    await expect(page.getByTestId("all-activity-timeline")).toBeVisible();
  });

  test("switches back to the Subscriptions tab after viewing All Activity", async ({
    page,
  }) => {
    await page.context().request.post("/api/subscriptions", {
      data: { merchantName: "Round Trip Merchant", tier: "tier_1" },
    });

    await page.goto("/subscriptions");

    await page.getByTestId("tab-activity").click();
    await expect(page.getByTestId("all-activity-timeline")).toBeVisible();

    // Switch back to Subscriptions
    await page.getByTestId("tab-subscriptions").click();
    await expect(page.getByTestId("tab-content-subscriptions")).toBeVisible();
  });
});

test.describe("All Activity timeline – activity entries after subscription actions", () => {
  test.beforeEach(async ({ page }) => {
    await setupAgent(page);
  });

  test("shows a create entry with the correct merchant name after logging a subscription", async ({
    page,
  }) => {
    const merchantName = `E2E Create Merchant ${TS}`;
    const subRes = await page.context().request.post("/api/subscriptions", {
      data: { merchantName, tier: "tier_1" },
    });
    expect(subRes.ok()).toBeTruthy();

    await page.goto("/subscriptions");
    await page.getByTestId("tab-activity").click();

    // Wait for the timeline to load
    await expect(page.getByTestId("all-activity-timeline")).toBeVisible({
      timeout: 8000,
    });

    // At least one activity entry must be visible
    const entries = page.locator('[data-testid^="activity-entry-"]');
    await expect(entries.first()).toBeVisible({ timeout: 8000 });

    // The merchant name should appear somewhere in the timeline
    // (may match in description text and label span — first() handles strict mode)
    await expect(
      page.getByTestId("all-activity-timeline").getByText(merchantName).first()
    ).toBeVisible();
  });
});

test.describe("Subscription history timeline – color legend", () => {
  test.beforeEach(async ({ page }) => {
    await setupAgent(page);
  });

  test("shows all five legend entries with the correct labels when a history panel is expanded", async ({
    page,
  }) => {
    const subRes = await page.context().request.post("/api/subscriptions", {
      data: { merchantName: `Legend Merchant ${TS}`, tier: "tier_1" },
    });
    expect(subRes.ok()).toBeTruthy();

    await page.goto("/subscriptions");

    // Subscriptions tab is the default; expand the first subscription's history panel
    const toggleBtn = page
      .locator('[data-testid^="button-toggle-history-"]')
      .first();
    await expect(toggleBtn).toBeVisible({ timeout: 8000 });
    await toggleBtn.click();

    // Wait for the history to finish loading (legend only renders once entries load)
    const legend = page.locator('[data-testid^="history-legend-"]').first();
    await expect(legend).toBeVisible({ timeout: 8000 });

    // All five legend entries must be present with the correct labels
    const expectedEntries: Array<{ key: string; label: string }> = [
      { key: "create", label: "Created" },
      { key: "pause", label: "Paused" },
      { key: "cancel", label: "Cancelled" },
      { key: "reactivate", label: "Reactivated" },
      { key: "expire", label: "Expired" },
    ];

    for (const { key, label } of expectedEntries) {
      const entry = page.getByTestId(`legend-entry-${key}`).first();
      await expect(entry).toBeVisible();
      await expect(entry).toContainText(label);
    }
  });
});

test.describe("All Activity timeline – pagination controls", () => {
  test.beforeEach(async ({ page }) => {
    await setupAgent(page);
  });

  test("shows pagination controls and navigates to the next page when more than 20 entries exist", async ({
    page,
  }) => {
    const merchantBase = `Pagination Merchant ${TS}`;
    // Create 21 subscriptions — each POST creates one "create" activity log entry
    for (let i = 0; i < 21; i++) {
      const res = await page.context().request.post("/api/subscriptions", {
        data: { merchantName: `${merchantBase} ${i + 1}`, tier: "tier_1" },
      });
      expect(res.ok()).toBeTruthy();
    }

    await page.goto("/subscriptions");
    await page.getByTestId("tab-activity").click();

    // Wait for timeline to render
    await expect(page.getByTestId("all-activity-timeline")).toBeVisible({
      timeout: 10000,
    });

    // Pagination bar should be present
    await expect(page.getByTestId("activity-pagination")).toBeVisible();

    // Previous button should be disabled on page 1
    const prevBtn = page.getByTestId("button-activity-prev");
    await expect(prevBtn).toBeVisible();
    await expect(prevBtn).toBeDisabled();

    // Next button should be enabled because there are > 20 entries
    const nextBtn = page.getByTestId("button-activity-next");
    await expect(nextBtn).toBeVisible();
    await expect(nextBtn).toBeEnabled();

    // Navigate to page 2
    await nextBtn.click();

    // Previous button becomes enabled on page 2
    await expect(prevBtn).toBeEnabled({ timeout: 5000 });

    // Navigate back to page 1
    await prevBtn.click();
    await expect(prevBtn).toBeDisabled({ timeout: 5000 });
  });
});
