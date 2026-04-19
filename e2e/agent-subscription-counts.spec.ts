import { test, expect } from "@playwright/test";

const TS = Date.now();

const ADMIN_EMAIL = "admin@psl.capital";
const ADMIN_PASSWORD = "password123";

const AGENT_EMAIL = `e2e-sub-counts-${TS}@example.com`;
const AGENT_PASSWORD = "E2eSubCounts1!";

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

async function registerAndLoginAgent(
  page: import("@playwright/test").Page
): Promise<void> {
  await page.context().request.post("/api/register", {
    data: {
      firstName: "SubCount",
      lastName: `E2E${TS}`,
      email: AGENT_EMAIL,
      password: AGENT_PASSWORD,
      referralCode: "",
    },
    failOnStatusCode: false,
  });
  await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
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

test.describe("Admin agents page – subscription counts display", () => {
  let sub1Id: number;
  let sub2Id: number;
  let sub3Id: number;
  let sub4Id: number;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await registerAndLoginAgent(page);

    sub1Id = await createSubscription(page, `SubCount Merchant A ${TS}`);
    sub2Id = await createSubscription(page, `SubCount Merchant B ${TS}`);
    sub3Id = await createSubscription(page, `SubCount Merchant C ${TS}`);
    sub4Id = await createSubscription(page, `SubCount Merchant D ${TS}`);

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await adminChangeStatus(page, sub3Id, "cancelled");
    await adminChangeStatus(page, sub4Id, "paused");

    await context.close();
  });

  test("Subscriptions cell shows 'active / total' format with correct numbers", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await page.goto("/admin/agents");

    const searchInput = page.getByTestId("input-agent-search");
    await expect(searchInput).toBeVisible({ timeout: 8000 });

    const responsePromise = page.waitForResponse(
      (r) => r.url().includes("/api/admin/agents") && r.status() === 200
    );
    await searchInput.fill(AGENT_EMAIL);
    await responsePromise;

    const agentRow = page
      .locator("tr")
      .filter({ hasText: AGENT_EMAIL })
      .first();
    await expect(agentRow).toBeVisible({ timeout: 10000 });

    const subscriptionLink = agentRow.locator('[data-testid^="link-subscription-count-"]');
    await expect(subscriptionLink).toBeVisible();

    const activeCountSpan = agentRow.locator('[data-testid^="text-active-count-"]');
    const totalCountSpan = agentRow.locator('[data-testid^="text-total-count-"]');

    await expect(activeCountSpan).toHaveText("2");
    await expect(totalCountSpan).toHaveText("4");

    await expect(subscriptionLink).toContainText("/");
  });

  test("Subscriptions cell link navigates to the subscriptions page filtered by agent", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await page.goto("/admin/agents");

    const searchInput = page.getByTestId("input-agent-search");
    await expect(searchInput).toBeVisible({ timeout: 8000 });

    const responsePromise = page.waitForResponse(
      (r) => r.url().includes("/api/admin/agents") && r.status() === 200
    );
    await searchInput.fill(AGENT_EMAIL);
    await responsePromise;

    const agentRow = page
      .locator("tr")
      .filter({ hasText: AGENT_EMAIL })
      .first();
    await expect(agentRow).toBeVisible({ timeout: 10000 });

    const subscriptionLink = agentRow.locator('[data-testid^="link-subscription-count-"]');
    const href = await subscriptionLink.getAttribute("href");
    expect(href).toMatch(/\/admin\/subscriptions\?agentId=\d+/);
  });
});
