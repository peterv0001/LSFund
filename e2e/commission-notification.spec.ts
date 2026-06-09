import { test, expect } from "@playwright/test";

const TS = Date.now();

const ADMIN_EMAIL = "admin@psl.capital";
const ADMIN_PASSWORD = "password123";

const AGENT_EMAIL = `e2e-comm-notif-${TS}@example.com`;
const AGENT_PASSWORD = "E2eCommNotif1!";

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

test.describe("Agent sees commission notifications in the bell", () => {
  const merchantName = `CommNotif Merchant ${TS}`;

  // Register the agent, give them an active subscription, then run the admin
  // commission calculation so a commission_earned notification is created.
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.context().request.post("/api/register", {
      data: {
        firstName: "Comm",
        lastName: `Notif${TS}`,
        email: AGENT_EMAIL,
        password: AGENT_PASSWORD,
        referralCode: "",
      },
      failOnStatusCode: false,
    });

    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);

    const subRes = await page.context().request.post("/api/subscriptions", {
      data: { merchantName, tier: "tier_1" },
    });
    expect(subRes.ok()).toBeTruthy();

    // Admin triggers the subscription commission calculation, which creates the
    // in-app commission_earned notification for the agent.
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const calcRes = await page.context().request.post(
      "/api/admin/subscriptions/calculate-commissions"
    );
    expect(calcRes.ok()).toBeTruthy();
    const calcBody = await calcRes.json();
    expect(calcBody.processed).toBeGreaterThanOrEqual(1);

    await context.close();
  });

  test("notification bell shows the commission_earned notification with correct title and message", async ({
    page,
  }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
    await page.goto("/dashboard");

    // The unread badge should appear on the (visible) bell once polling /
    // initial fetch resolves.
    const bell = page.locator('[data-testid="button-notification-bell"]:visible');
    await expect(bell).toBeVisible({ timeout: 10000 });

    // Open the notification popover, which triggers the notifications fetch.
    await bell.click();

    // The commission_earned notification should be listed with its title and
    // a message referencing the subscription's merchant.
    await expect(
      page.getByText("Subscription Commission Earned!")
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText(merchantName, { exact: false })
    ).toBeVisible();
  });
});
