import { test, expect } from "@playwright/test";

const TS = Date.now();

const ADMIN_EMAIL = "admin@psl.capital";
const ADMIN_PASSWORD = "password123";

const AGENT_EMAIL = `e2e-expiring-soon-${TS}@example.com`;
const AGENT_PASSWORD = "E2eExpiringSoon1!";

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
): Promise<void> {
  await page.context().request.post("/api/register", {
    data: {
      firstName: "Expiring",
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

async function adminSetEndDate(
  page: import("@playwright/test").Page,
  subscriptionId: number,
  endDate: string
): Promise<void> {
  const res = await page.context().request.patch(
    `/api/admin/subscriptions/${subscriptionId}/end-date`,
    { data: { endDate } }
  );
  expect(res.ok()).toBeTruthy();
}

test.describe("Expiring-soon subscription warning banners", () => {
  let expiringSubId: number;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await registerAndLoginAgent(page);
    expiringSubId = await createSubscription(page, `Expiring Soon Merchant ${TS}`);

    // Set an end date 3 days out (within the 7-day "expiring soon" window).
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 3);

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await adminSetEndDate(page, expiringSubId, endDate.toISOString());

    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
  });

  test("dashboard shows the expiring-soon banner when a subscription expires within 7 days", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    const banner = page.getByTestId(
      "banner-expiring-soon-subscriptions-dashboard"
    );
    await expect(banner).toBeVisible({ timeout: 10000 });
    await expect(banner).toContainText("expiring within 7 days");

    // The link to view the affected subscriptions should be present.
    await expect(
      page.getByTestId("link-view-expiring-soon-subscriptions")
    ).toBeVisible();
  });

  test("SubscriptionCard shows the amber expiring-soon banner for the affected subscription", async ({
    page,
  }) => {
    await page.goto("/subscriptions");

    const banner = page.getByTestId(`banner-expiring-soon-${expiringSubId}`);
    await expect(banner).toBeVisible({ timeout: 10000 });
    await expect(banner).toContainText("Expiring soon");
  });
});
