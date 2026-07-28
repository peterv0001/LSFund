import { test, expect } from "@playwright/test";

const TS = Date.now();
const AGENT_EMAIL = `e2e-url-roundtrip-${TS}@example.com`;
const AGENT_PASSWORD = "E2eTestPass1!";

const ADMIN_EMAIL = "admin@psl.capital";
const ADMIN_PASSWORD = "password123";

const SEARCH_TOKEN = "Zephyr";
const MERCHANT_MATCH = `${SEARCH_TOKEN} UrlTest Merchant ${TS}`;
const MERCHANT_OTHER = `Quasar UrlTest Merchant ${TS}`;

// Persisted across tests so the second beforeEach can reuse the same agent id
// even though registration returns a conflict on the second call.
let agentId: number | null = null;

/**
 * Register a fresh test agent and return its id. Does not log in.
 * If the agent already exists (concurrent or repeated beforeEach), the stored
 * id from the first registration is returned instead.
 */
async function registerAgent(
  page: import("@playwright/test").Page
): Promise<number> {
  if (agentId !== null) return agentId;
  const res = await page.context().request.post("/api/register", {
    data: {
      firstName: "UrlRoundtrip",
      lastName: "Agent",
      email: AGENT_EMAIL,
      password: AGENT_PASSWORD,
      referralCode: "",
    },
    failOnStatusCode: false,
  });
  const body = await res.json();
  agentId = body.id as number;
  return agentId;
}

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
 * Create a subscription via the admin API (bypasses the email-verification
 * gate on the regular agent endpoint).
 */
async function adminCreateSubscription(
  page: import("@playwright/test").Page,
  agentId: number,
  merchantName: string
): Promise<void> {
  const res = await page.context().request.post("/api/admin/subscriptions", {
    data: { agentId, merchantName, tier: "tier_1" },
  });
  expect(res.ok()).toBeTruthy();
}

/**
 * Click the activity tab and wait for the timeline to be ready.
 * The Tabs component uses local state (defaultValue), so the tab must be
 * clicked after every page navigation — it is never driven by the URL.
 */
async function openActivityTab(
  page: import("@playwright/test").Page
): Promise<void> {
  await page.getByTestId("tab-activity").click();
  await expect(page.getByTestId("activity-filter-bar")).toBeVisible({
    timeout: 10000,
  });
  await page
    .getByTestId("all-activity-loading")
    .waitFor({ state: "hidden", timeout: 10000 })
    .catch(() => {
      /* may already be gone */
    });
  await expect(page.getByTestId("all-activity-timeline")).toBeVisible({
    timeout: 10000,
  });
}

test.describe("All Activity timeline — URL round-trip and browser history", () => {
  test.beforeEach(async ({ page }) => {
    const agentId = await registerAgent(page);
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await adminCreateSubscription(page, agentId, MERCHANT_MATCH);
    await adminCreateSubscription(page, agentId, MERCHANT_OTHER);
    // Switch back to the test agent for the actual page assertions.
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
  });

  test("navigating directly to a URL with actSearch pre-fills the input and narrows the timeline", async ({
    page,
  }) => {
    // Land on the subscriptions page with a pre-applied search filter in the
    // URL query string. The tab itself is local state so we still need to
    // click it, but actSearch must be picked up from the URL immediately on render.
    await page.goto(
      `/subscriptions?actSearch=${encodeURIComponent(SEARCH_TOKEN)}`
    );
    await openActivityTab(page);

    // The search input must reflect the URL param — no user interaction needed.
    const input = page.getByTestId("input-activity-search");
    await expect(input).toHaveValue(SEARCH_TOKEN);

    // Only the matching merchant should appear; the other must be absent.
    const timeline = page.getByTestId("all-activity-timeline");
    await expect(timeline.getByText(MERCHANT_MATCH).first()).toBeVisible({
      timeout: 8000,
    });
    await expect(timeline.getByText(MERCHANT_OTHER)).toHaveCount(0);
  });

  test("browser Back restores the unfiltered state and Forward re-applies the filter", async ({
    page,
  }) => {
    // === Step 1: land on the unfiltered subscriptions page (history entry A) ===
    await page.goto("/subscriptions");
    await openActivityTab(page);

    const timeline = page.getByTestId("all-activity-timeline");
    const input = page.getByTestId("input-activity-search");

    // Confirm both merchants appear in the unfiltered view.
    await expect(timeline.getByText(MERCHANT_MATCH).first()).toBeVisible({
      timeout: 8000,
    });
    await expect(timeline.getByText(MERCHANT_OTHER).first()).toBeVisible({
      timeout: 8000,
    });

    // === Step 2: navigate to the same page carrying the search filter (history entry B) ===
    // page.goto always pushes a new browser history entry, so Back/Forward works
    // even though in-app filter updates use replace:true to avoid keystroke spam.
    await page.goto(
      `/subscriptions?actSearch=${encodeURIComponent(SEARCH_TOKEN)}`
    );
    await openActivityTab(page);

    await expect(input).toHaveValue(SEARCH_TOKEN);
    await expect(timeline.getByText(MERCHANT_MATCH).first()).toBeVisible({
      timeout: 8000,
    });
    await expect(timeline.getByText(MERCHANT_OTHER)).toHaveCount(0);

    // === Step 3: press Back — should land on entry A (unfiltered) ===
    await page.goBack();
    // After a full navigation the tab resets to its defaultValue; open it again.
    await openActivityTab(page);

    // The search input must be empty (URL no longer carries actSearch).
    await expect(input).toHaveValue("");

    // Both merchants must be visible again.
    await expect(timeline.getByText(MERCHANT_MATCH).first()).toBeVisible({
      timeout: 8000,
    });
    await expect(timeline.getByText(MERCHANT_OTHER).first()).toBeVisible({
      timeout: 8000,
    });

    // === Step 4: press Forward — should land on entry B (filtered) ===
    await page.goForward();
    await openActivityTab(page);

    // The filter must be restored from the URL.
    await expect(input).toHaveValue(SEARCH_TOKEN);
    await expect(timeline.getByText(MERCHANT_MATCH).first()).toBeVisible({
      timeout: 8000,
    });
    await expect(timeline.getByText(MERCHANT_OTHER)).toHaveCount(0);
  });
});
