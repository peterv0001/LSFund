import { test, expect } from "@playwright/test";

const TS = Date.now();
const AGENT_EMAIL = `e2e-activity-filtered-empty-${TS}@example.com`;
const AGENT_PASSWORD = "E2eTestPass1!";

const ADMIN_EMAIL = "admin@psl.capital";
const ADMIN_PASSWORD = "password123";

const MERCHANT_NAME = `FilteredEmpty Merchant ${TS}`;

/**
 * Register a fresh test agent (without logging in yet).
 */
async function registerAgent(
  page: import("@playwright/test").Page
): Promise<number> {
  const res = await page.context().request.post("/api/register", {
    data: {
      firstName: "FilteredEmpty",
      lastName: "E2E",
      email: AGENT_EMAIL,
      password: AGENT_PASSWORD,
      referralCode: "",
    },
    failOnStatusCode: false,
  });
  const body = await res.json();
  return body.id as number;
}

/**
 * Log in as the given user using the browser context's own request object
 * so the session cookie lives in the same jar the page uses.
 */
async function loginAs(
  page: import("@playwright/test").Page,
  email: string,
  password: string
): Promise<void> {
  const res = await page.context().request.post("/api/login", {
    data: { username: email, password },
  });
  expect(res.ok()).toBeTruthy();
}

/**
 * Create a subscription for the given agent via the admin API, bypassing the
 * email-verification gate on the regular agent endpoint. Returns the new
 * subscription id.
 */
async function adminCreateSubscription(
  page: import("@playwright/test").Page,
  agentId: number
): Promise<number> {
  const res = await page.context().request.post("/api/admin/subscriptions", {
    data: { agentId, merchantName: MERCHANT_NAME, tier: "tier_1" },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(typeof body.id).toBe("number");
  return body.id as number;
}

test.describe("All Activity timeline – filtered empty state", () => {
  test.beforeEach(async ({ page }) => {
    // Register the test agent, then sign in as admin to create a subscription
    // for them (bypasses the email-verification gate on the agent endpoint).
    const agentId = await registerAgent(page);
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await adminCreateSubscription(page, agentId);

    // Switch back to the test agent so the page renders the agent's view.
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
  });

  test("shows the filtered empty state when a search term matches no activity entries", async ({
    page,
  }) => {
    // Sanity check: the agent has at least one activity log entry unfiltered.
    const historyRes = await page
      .context()
      .request.get("/api/subscriptions/history");
    expect(historyRes.ok()).toBeTruthy();
    const history = await historyRes.json();
    expect(history.total).toBeGreaterThan(0);

    await page.goto("/subscriptions");

    // Switch to the All Activity tab.
    await page.getByTestId("tab-activity").click();
    await expect(page.getByTestId("tab-content-activity")).toBeVisible();

    // Wait for the timeline to finish loading (unfiltered).
    await page
      .getByTestId("all-activity-loading")
      .waitFor({ state: "hidden", timeout: 8000 })
      .catch(() => {/* may already be gone */});
    await expect(page.getByTestId("all-activity-timeline")).toBeVisible({
      timeout: 8000,
    });

    // Apply a search term that cannot match any existing entry.
    const searchInput = page.getByTestId("input-activity-search");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("ZZZNOMATCH_xyzxyz_9999");

    // Wait for the debounced query to fire and the timeline to disappear.
    await expect(page.getByTestId("all-activity-timeline")).not.toBeVisible({
      timeout: 8000,
    });

    // The filtered empty state must appear.
    await expect(page.getByTestId("all-activity-empty")).toBeVisible({
      timeout: 8000,
    });

    // It must show the filter-specific message, not the no-subscriptions message.
    await expect(page.getByTestId("all-activity-empty")).toContainText(
      "No activity matches the selected filters."
    );
    await expect(page.getByTestId("all-activity-empty")).not.toContainText(
      "No subscription activity yet."
    );

    // The helper subtext ("Changes to your subscriptions will appear here.")
    // must NOT appear in the filtered empty state.
    await expect(page.getByTestId("all-activity-empty")).not.toContainText(
      "Changes to your subscriptions will appear here."
    );

    // No timeline list or error block should be visible.
    await expect(page.getByTestId("all-activity-error")).not.toBeVisible();

    // No individual entries should be rendered.
    await expect(
      page.locator('[data-testid^="activity-entry-"]')
    ).toHaveCount(0);

    // No pagination controls should appear for an empty result set.
    await expect(page.getByTestId("activity-pagination")).not.toBeVisible();
  });

  test("shows the filtered empty state when the action filter matches nothing", async ({
    page,
  }) => {
    await page.goto("/subscriptions");

    // Switch to the All Activity tab and wait for unfiltered timeline.
    await page.getByTestId("tab-activity").click();
    await expect(page.getByTestId("tab-content-activity")).toBeVisible();
    await page
      .getByTestId("all-activity-loading")
      .waitFor({ state: "hidden", timeout: 8000 })
      .catch(() => {/* may already be gone */});
    await expect(page.getByTestId("all-activity-timeline")).toBeVisible({
      timeout: 8000,
    });

    // The only activity for this agent is a "create" entry (from admin setup).
    // Filtering to "cancel" should yield zero results.
    await page.getByTestId("select-filter-action").click();
    await page.getByTestId("filter-action-option-cancel").click();

    await expect(page.getByTestId("select-filter-action")).toContainText(
      "Cancelled"
    );

    // Wait for the filtered result to render.
    await expect(page.getByTestId("all-activity-timeline")).not.toBeVisible({
      timeout: 8000,
    });

    await expect(page.getByTestId("all-activity-empty")).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByTestId("all-activity-empty")).toContainText(
      "No activity matches the selected filters."
    );
    await expect(page.getByTestId("all-activity-empty")).not.toContainText(
      "Changes to your subscriptions will appear here."
    );

    await expect(
      page.locator('[data-testid^="activity-entry-"]')
    ).toHaveCount(0);
  });
});
