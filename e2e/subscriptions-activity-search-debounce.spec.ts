import { test, expect } from "@playwright/test";

const TS = Date.now();
const AGENT_EMAIL = `e2e-search-debounce-${TS}@example.com`;
const AGENT_PASSWORD = "E2eTestPass1!";

// Distinct, searchable merchant names. The "create" activity log description
// embeds the merchant name, so the server-side search matches against it.
const SEARCH_TOKEN = "Zephyr";
const MERCHANT_MATCH = `${SEARCH_TOKEN} Search Merchant ${TS}`;
const MERCHANT_OTHER = `Quasar Other Merchant ${TS}`;

/**
 * Register and log in using the browser context's own request object so the
 * session cookie lives in the same cookie jar the page uses.
 */
async function setupAgent(page: import("@playwright/test").Page): Promise<void> {
  const ctx = page.context();

  await ctx.request.post("/api/register", {
    data: {
      firstName: "SearchE2E",
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

async function createSubscription(
  page: import("@playwright/test").Page,
  merchantName: string
): Promise<void> {
  const res = await page.context().request.post("/api/subscriptions", {
    data: { merchantName, tier: "tier_1" },
  });
  expect(res.ok()).toBeTruthy();
}

/**
 * Open the All Activity tab and wait for the timeline to render.
 */
async function openActivityTab(
  page: import("@playwright/test").Page
): Promise<void> {
  await page.goto("/subscriptions");
  await page.getByTestId("tab-activity").click();
  await expect(page.getByTestId("activity-filter-bar")).toBeVisible({
    timeout: 8000,
  });
  await page
    .getByTestId("all-activity-loading")
    .waitFor({ state: "hidden", timeout: 8000 })
    .catch(() => {
      /* may already be gone */
    });
  await expect(page.getByTestId("all-activity-timeline")).toBeVisible({
    timeout: 8000,
  });
}

const entries = (page: import("@playwright/test").Page) =>
  page.locator('[data-testid^="activity-entry-"]');

test.describe("All Activity timeline — search input is debounced", () => {
  test.beforeEach(async ({ page }) => {
    await setupAgent(page);
    await createSubscription(page, MERCHANT_MATCH);
    await createSubscription(page, MERCHANT_OTHER);
  });

  test("rapid typing fires only one search request and shows the matching result", async ({
    page,
  }) => {
    await openActivityTab(page);

    // Baseline: both merchants are present in the unfiltered timeline.
    const timeline = page.getByTestId("all-activity-timeline");
    await expect(entries(page).first()).toBeVisible({ timeout: 8000 });
    await expect(timeline.getByText(MERCHANT_MATCH).first()).toBeVisible();
    await expect(timeline.getByText(MERCHANT_OTHER).first()).toBeVisible();

    // Track every history request that carries a non-empty `search` query param.
    // Without debounce, each keystroke would issue its own request.
    const searchRequests: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (
        url.includes("/api/subscriptions/history") &&
        /[?&]search=[^&]+/.test(url)
      ) {
        searchRequests.push(url);
      }
    });

    // Type the token character-by-character, faster than the 300ms debounce.
    const input = page.getByTestId("input-activity-search");
    await input.click();
    await input.pressSequentially(SEARCH_TOKEN, { delay: 40 });

    // Wait for the single debounced request to land and resolve.
    await page.waitForResponse(
      (res) =>
        res.url().includes("/api/subscriptions/history") &&
        /[?&]search=/.test(res.url()) &&
        res.status() === 200,
      { timeout: 8000 }
    );

    // The narrowed timeline should show only the matching merchant.
    await expect(timeline.getByText(MERCHANT_MATCH).first()).toBeVisible({
      timeout: 8000,
    });
    await expect(timeline.getByText(MERCHANT_OTHER)).toHaveCount(0);
    await expect(entries(page).first()).toBeVisible();

    // Allow time for any (incorrect) trailing per-character requests to arrive,
    // then confirm exactly one search request was made despite many keystrokes.
    await page.waitForTimeout(600);
    expect(searchRequests.length).toBe(1);
    expect(searchRequests[0]).toContain(`search=${SEARCH_TOKEN}`);
  });

  test("clearing the search restores the full timeline without re-applying the filter", async ({
    page,
  }) => {
    await openActivityTab(page);

    // Baseline: both merchants are present in the unfiltered timeline.
    const timeline = page.getByTestId("all-activity-timeline");
    await expect(entries(page).first()).toBeVisible({ timeout: 8000 });
    await expect(timeline.getByText(MERCHANT_MATCH).first()).toBeVisible();
    await expect(timeline.getByText(MERCHANT_OTHER).first()).toBeVisible();

    // Narrow the timeline down to just the matching merchant first.
    const input = page.getByTestId("input-activity-search");
    await input.click();
    await input.pressSequentially(SEARCH_TOKEN, { delay: 40 });

    await page.waitForResponse(
      (res) =>
        res.url().includes("/api/subscriptions/history") &&
        /[?&]search=/.test(res.url()) &&
        res.status() === 200,
      { timeout: 8000 }
    );

    await expect(timeline.getByText(MERCHANT_MATCH).first()).toBeVisible({
      timeout: 8000,
    });
    await expect(timeline.getByText(MERCHANT_OTHER)).toHaveCount(0);

    // Track every history request made from this point on. The "remove filter"
    // path should fire at most one additional debounced request — never one per
    // deleted character. (The unfiltered result is cached from the initial load,
    // so React Query may legitimately restore it from cache with zero requests;
    // what we guard against is the debounce firing repeatedly.)
    const clearRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/subscriptions/history")) {
        clearRequests.push(req.url());
      }
    });

    // Clear the search box by deleting the typed token character-by-character,
    // faster than the 300ms debounce — the reverse of the typing flow.
    await input.click();
    for (let i = 0; i < SEARCH_TOKEN.length; i++) {
      await page.keyboard.press("Backspace");
      await page.waitForTimeout(40);
    }
    await expect(input).toHaveValue("");

    // The full, unfiltered timeline should return: the previously-hidden entry
    // reappears alongside the one that matched the search.
    await expect(timeline.getByText(MERCHANT_MATCH).first()).toBeVisible({
      timeout: 8000,
    });
    await expect(timeline.getByText(MERCHANT_OTHER).first()).toBeVisible({
      timeout: 8000,
    });
    await expect(entries(page).first()).toBeVisible();

    // Allow time for any (incorrect) per-character requests to arrive, then
    // confirm clearing fired at most one request and none of them carried a
    // `search` param (i.e. the filter was truly removed, not re-applied).
    await page.waitForTimeout(600);
    expect(clearRequests.length).toBeLessThanOrEqual(1);
    for (const url of clearRequests) {
      expect(/[?&]search=/.test(url)).toBe(false);
    }
  });
});
