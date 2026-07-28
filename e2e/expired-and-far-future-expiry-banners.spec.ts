import { test, expect } from "@playwright/test";

const TS = Date.now();

const ADMIN_EMAIL = "admin@psl.capital";
const ADMIN_PASSWORD = "password123";

const AGENT_EMAIL = `e2e-expiry-banners-${TS}@example.com`;
const AGENT_PASSWORD = "E2eExpiryBanners1!";

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
      firstName: "ExpiryBanners",
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

async function adminSetStatus(
  page: import("@playwright/test").Page,
  subscriptionId: number,
  status: "active" | "paused" | "cancelled" | "expired"
): Promise<void> {
  const res = await page.context().request.patch(
    `/api/admin/subscriptions/${subscriptionId}/status`,
    { data: { status } }
  );
  expect(res.ok()).toBeTruthy();
}

test.describe("Expired subscription dashboard banner", () => {
  let expiredSubId: number;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await registerAndLoginAgent(page);
    expiredSubId = await createSubscription(page, `Expired Merchant ${TS}`);

    // Explicitly drive the subscription to "expired" via the admin status endpoint
    // so the test is deterministic and does not rely on the scheduler running.
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await adminSetStatus(page, expiredSubId, "expired");

    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
  });

  test("dashboard shows the red expired banner when a subscription has expired", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    const banner = page.getByTestId("banner-expired-subscriptions-dashboard");
    await expect(banner).toBeVisible({ timeout: 10000 });
    await expect(banner).toContainText("expired");

    // A link to view the affected subscriptions should be present.
    await expect(
      page.getByTestId("link-view-expired-subscriptions")
    ).toBeVisible();
  });
});

test.describe("Scheduled-to-expire (far future) subscription note", () => {
  let farFutureSubId: number;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await registerAndLoginAgent(page);
    farFutureSubId = await createSubscription(
      page,
      `Far Future Merchant ${TS}`
    );

    // Set an end date well beyond the 7-day expiring-soon window (30 days out).
    const farDate = new Date();
    farDate.setDate(farDate.getDate() + 30);

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await adminSetEndDate(page, farFutureSubId, farDate.toISOString());

    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
  });

  test("SubscriptionCard shows 'Scheduled to expire' note for an end date more than 7 days out", async ({
    page,
  }) => {
    await page.goto("/subscriptions");

    const expiresOnNote = page.getByTestId(`text-expires-on-${farFutureSubId}`);
    await expect(expiresOnNote).toBeVisible({ timeout: 10000 });
    await expect(expiresOnNote).toContainText("Scheduled to expire on");
  });

  test("SubscriptionCard does NOT show the amber expiring-soon banner for an end date more than 7 days out", async ({
    page,
  }) => {
    await page.goto("/subscriptions");

    // Ensure the card itself is rendered before asserting the banner is absent.
    await expect(
      page.getByTestId(`card-subscription-${farFutureSubId}`)
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.getByTestId(`banner-expiring-soon-${farFutureSubId}`)
    ).not.toBeVisible();
  });
});
