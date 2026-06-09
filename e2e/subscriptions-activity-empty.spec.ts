import { test, expect } from "@playwright/test";

const TS = Date.now();
const AGENT_EMAIL = `e2e-activity-empty-${TS}@example.com`;
const AGENT_PASSWORD = "E2eTestPass1!";

/**
 * Register and log in a brand-new agent using the browser context's own request
 * object so the session cookie lands in the same jar the page uses. This agent
 * intentionally has NO subscriptions so the All Activity tab should render its
 * empty state.
 */
async function setupAgentWithNoSubscriptions(
  page: import("@playwright/test").Page
): Promise<void> {
  const ctx = page.context();

  await ctx.request.post("/api/register", {
    data: {
      firstName: "E2E",
      lastName: "EmptyState",
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

test.describe("All Activity timeline – empty state for agents with no subscriptions", () => {
  test.beforeEach(async ({ page }) => {
    await setupAgentWithNoSubscriptions(page);
  });

  test("shows the empty state and no entries or pagination when the agent has no subscriptions", async ({
    page,
  }) => {
    // Sanity check: this fresh agent really has no subscription history.
    const historyRes = await page
      .context()
      .request.get("/api/subscriptions/history");
    expect(historyRes.ok()).toBeTruthy();
    const history = await historyRes.json();
    expect(history.total).toBe(0);
    expect(Array.isArray(history.logs)).toBeTruthy();
    expect(history.logs.length).toBe(0);

    await page.goto("/subscriptions");

    // Switch to the All Activity tab.
    await page.getByTestId("tab-activity").click();
    await expect(page.getByTestId("tab-content-activity")).toBeVisible();

    // Wait for any loading state to clear.
    await page
      .getByTestId("all-activity-loading")
      .waitFor({ state: "hidden", timeout: 8000 })
      .catch(() => {
        // May already be gone before the assertion runs.
      });

    // The friendly empty state should be shown.
    await expect(page.getByTestId("all-activity-empty")).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByTestId("all-activity-empty")).toContainText(
      "No subscription activity yet."
    );

    // No error and no timeline list should be rendered.
    await expect(page.getByTestId("all-activity-error")).not.toBeVisible();
    await expect(page.getByTestId("all-activity-timeline")).not.toBeVisible();

    // No activity entries should exist.
    await expect(
      page.locator('[data-testid^="activity-entry-"]')
    ).toHaveCount(0);

    // No pagination controls should appear when there is nothing to paginate.
    await expect(page.getByTestId("activity-pagination")).not.toBeVisible();
  });
});
