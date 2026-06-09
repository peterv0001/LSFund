import { test, expect } from "@playwright/test";

const TS = Date.now();

const ADMIN_EMAIL = "admin@psl.capital";
const ADMIN_PASSWORD = "password123";

const LOST_EMAIL = `e2e-lost-subs-${TS}@example.com`;
const LOST_PASSWORD = "E2eLostSubs1!";

const ACTIVE_EMAIL = `e2e-active-subs-${TS}@example.com`;
const ACTIVE_PASSWORD = "E2eActiveSubs1!";

const NONE_EMAIL = `e2e-no-subs-${TS}@example.com`;
const NONE_PASSWORD = "E2eNoSubs1!";

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
  page: import("@playwright/test").Page,
  email: string,
  password: string
): Promise<void> {
  await page.context().request.post("/api/register", {
    data: {
      firstName: "LostSub",
      lastName: `E2E${TS}`,
      email,
      password,
      referralCode: "",
    },
    failOnStatusCode: false,
  });
  await loginAs(page, email, password);
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

async function searchForAgent(
  page: import("@playwright/test").Page,
  email: string
): Promise<import("@playwright/test").Locator> {
  await page.goto("/admin/agents");

  const searchInput = page.getByTestId("input-agent-search");
  await expect(searchInput).toBeVisible({ timeout: 8000 });

  const responsePromise = page.waitForResponse(
    (r) => r.url().includes("/api/admin/agents") && r.status() === 200
  );
  await searchInput.fill(email);
  await responsePromise;

  const agentRow = page.locator("tr").filter({ hasText: email }).first();
  await expect(agentRow).toBeVisible({ timeout: 10000 });
  return agentRow;
}

test.describe("Admin agents page – lost-all-subscriptions warning", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Agent who has lost all subscriptions (all cancelled/paused).
    await registerAndLoginAgent(page, LOST_EMAIL, LOST_PASSWORD);
    const lostSub1 = await createSubscription(page, `Lost Merchant A ${TS}`);
    const lostSub2 = await createSubscription(page, `Lost Merchant B ${TS}`);

    // Agent who still has an active subscription.
    await registerAndLoginAgent(page, ACTIVE_EMAIL, ACTIVE_PASSWORD);
    await createSubscription(page, `Active Merchant A ${TS}`);

    // Agent with no subscriptions at all (NONE_EMAIL) is just registered.
    await registerAndLoginAgent(page, NONE_EMAIL, NONE_PASSWORD);

    // Admin cancels/pauses both of the LOST agent's subscriptions.
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await adminChangeStatus(page, lostSub1, "cancelled");
    await adminChangeStatus(page, lostSub2, "paused");

    await context.close();
  });

  test("warning treatment appears when active=0 but total>0", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    const agentRow = await searchForAgent(page, LOST_EMAIL);

    const cell = agentRow.locator('[data-testid^="cell-subscriptions-"]');
    await expect(cell).toHaveAttribute("data-lost-all", "true");

    const warningIcon = agentRow.locator(
      '[data-testid^="icon-lost-subscriptions-"]'
    );
    await expect(warningIcon).toBeVisible();

    await expect(
      agentRow.locator('[data-testid^="text-active-count-"]')
    ).toHaveText("0");
    await expect(
      agentRow.locator('[data-testid^="text-total-count-"]')
    ).toHaveText("2");
  });

  test("no warning when the agent still has an active subscription", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    const agentRow = await searchForAgent(page, ACTIVE_EMAIL);

    const cell = agentRow.locator('[data-testid^="cell-subscriptions-"]');
    await expect(cell).toHaveAttribute("data-lost-all", "false");

    await expect(
      agentRow.locator('[data-testid^="icon-lost-subscriptions-"]')
    ).toHaveCount(0);

    await expect(
      agentRow.locator('[data-testid^="text-active-count-"]')
    ).toHaveText("1");
  });

  test("no warning when the agent has no subscriptions at all", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    const agentRow = await searchForAgent(page, NONE_EMAIL);

    const cell = agentRow.locator('[data-testid^="cell-subscriptions-"]');
    await expect(cell).toHaveAttribute("data-lost-all", "false");

    await expect(
      agentRow.locator('[data-testid^="icon-lost-subscriptions-"]')
    ).toHaveCount(0);

    await expect(
      agentRow.locator('[data-testid^="text-active-count-"]')
    ).toHaveText("0");
    await expect(
      agentRow.locator('[data-testid^="text-total-count-"]')
    ).toHaveText("0");
  });
});
