import { test, expect } from "@playwright/test";

const TS = Date.now();

const ADMIN_EMAIL = "admin@psl.capital";
const ADMIN_PASSWORD = "password123";

const AGENT_EMAIL = `e2e-url-filters-${TS}@example.com`;
const AGENT_PASSWORD = "E2eUrlFilters1!";

async function loginAs(
  page: import("@playwright/test").Page,
  email: string,
  password: string
): Promise<Record<string, unknown>> {
  const res = await page.context().request.post("/api/login", {
    data: { username: email, password },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as Record<string, unknown>;
}

async function registerAndLoginAgent(
  page: import("@playwright/test").Page
): Promise<number> {
  await page.context().request.post("/api/register", {
    data: {
      firstName: "UrlFilter",
      lastName: `E2E${TS}`,
      email: AGENT_EMAIL,
      password: AGENT_PASSWORD,
      referralCode: "",
    },
    failOnStatusCode: false,
  });
  const me = await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
  return me.id as number;
}

async function createSubscription(
  page: import("@playwright/test").Page,
  merchantName: string
): Promise<number> {
  const res = await page.context().request.post("/api/subscriptions", {
    data: { merchantName, tier: "tier_1" },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.id as number;
}

async function adminChangeStatus(
  page: import("@playwright/test").Page,
  subscriptionId: number,
  status: "paused" | "cancelled"
): Promise<void> {
  const res = await page.context().request.patch(
    `/api/admin/subscriptions/${subscriptionId}/status`,
    { data: { status } }
  );
  expect(res.ok()).toBeTruthy();
}

test.describe("Admin subscriptions – filters initialised from URL params", () => {
  let agentId: number;
  let cancelledSubId: number;
  let activeSubId: number;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    agentId = await registerAndLoginAgent(page);

    activeSubId = await createSubscription(page, `UrlFilter Active ${TS}`);
    cancelledSubId = await createSubscription(page, `UrlFilter Cancelled ${TS}`);

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await adminChangeStatus(page, cancelledSubId, "cancelled");

    await context.close();
  });

  test("status=cancelled&agentId reads back the status select and shows only cancelled rows", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await page.goto(
      `/admin/subscriptions?status=cancelled&agentId=${agentId}`
    );

    // The status filter select should reflect "Cancelled" from the URL param
    await expect(page.getByTestId("select-status-filter")).toContainText(
      "Cancelled",
      { timeout: 10000 }
    );

    // The agent filter indicator should be present (agentId read from URL)
    await expect(page.getByTestId("agent-filter-indicator")).toBeVisible();

    // Only the cancelled subscription for this agent should be shown
    await expect(
      page.getByTestId(`row-subscription-${cancelledSubId}`)
    ).toBeVisible({ timeout: 10000 });

    // The active subscription for the same agent must be filtered out
    await expect(
      page.getByTestId(`row-subscription-${activeSubId}`)
    ).toHaveCount(0);
  });

  test("range=7d reads back the date range select as 'Last 7 days'", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await page.goto("/admin/subscriptions?range=7d");

    await expect(page.getByTestId("select-date-range-filter")).toContainText(
      "Last 7 days",
      { timeout: 10000 }
    );

    // The date range summary card for a 7-day window should appear
    await expect(page.getByTestId("date-range-summary-card")).toContainText(
      "Last 7 days"
    );
  });
});
