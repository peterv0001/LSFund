import { test, expect } from "@playwright/test";
import pg from "pg";

const { Pool } = pg;

const TS = Date.now();

const ADMIN_EMAIL = "admin@psl.capital";
const ADMIN_PASSWORD = "password123";

/**
 * A direct DB connection is required to set billing_status and
 * stripe_subscription_id — no public API endpoint exposes these fields.
 * This simulates what a Stripe webhook would normally do when a payment fails.
 */
function makePool(): InstanceType<typeof Pool> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set to run billing-retry E2E tests");
  }
  return new Pool({ connectionString: process.env.DATABASE_URL });
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

async function loginAsAdmin(page: import("@playwright/test").Page): Promise<void> {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
}

/**
 * Register a fresh agent via the public API and log in.
 * Returns the agent email (for cleanup) and the subscription id.
 */
async function setupBillingFailedSubscription(
  page: import("@playwright/test").Page,
  suffix: string
): Promise<{ agentEmail: string; subId: number }> {
  const agentEmail = `e2e-billing-retry-${suffix}-${TS}@example.com`;
  const agentPassword = "E2eBillingRetry1!";

  await page.context().request.post("/api/register", {
    data: {
      firstName: "BillingRetry",
      lastName: `E2E${suffix}${TS}`,
      email: agentEmail,
      password: agentPassword,
      referralCode: "",
    },
    failOnStatusCode: false,
  });
  await loginAs(page, agentEmail, agentPassword);

  const subRes = await page.context().request.post("/api/subscriptions", {
    data: { merchantName: `BillingRetryE2E ${suffix} ${TS}`, tier: "tier_1" },
  });
  expect(subRes.ok()).toBeTruthy();
  const body = await subRes.json();
  const subId = body.id as number;

  const pool = makePool();
  try {
    await pool.query(
      `UPDATE subscriptions
          SET billing_status        = 'past_due',
              stripe_subscription_id = 'sub_test_e2e_billing_retry_${TS}_${suffix}'
        WHERE id = $1`,
      [subId]
    );
  } finally {
    await pool.end();
  }

  return { agentEmail, subId };
}

async function cleanupSubscriptionAndAgent(agentEmail: string, subId: number): Promise<void> {
  const pool = makePool();
  try {
    await pool.query("DELETE FROM subscriptions WHERE id = $1", [subId]);
    await pool.query("DELETE FROM agents WHERE email = $1", [agentEmail]);
  } finally {
    await pool.end();
  }
}

// ─── Suite 1: Agent "Update Card" button ─────────────────────────────────────

test.describe("Billing-failed subscriptions – agent 'Update Card' button", () => {
  let agentEmail: string;
  let agentPassword: string;
  let subId: number;

  test.beforeAll(async ({ browser }) => {
    agentPassword = "E2eBillingRetry1!";
    const page = await browser.newPage();
    const setup = await setupBillingFailedSubscription(page, "agent");
    agentEmail = setup.agentEmail;
    subId = setup.subId;
    await page.close();
  });

  test.afterAll(async () => {
    await cleanupSubscriptionAndAgent(agentEmail, subId);
  });

  test("billing warning banner is visible for a past_due subscription", async ({ page }) => {
    await loginAs(page, agentEmail, agentPassword);
    await page.goto("/subscriptions");
    await expect(
      page.getByTestId(`banner-payment-failed-${subId}`)
    ).toBeVisible({ timeout: 10000 });
  });

  test("'Update Card' button is visible for a past_due subscription", async ({ page }) => {
    await loginAs(page, agentEmail, agentPassword);
    await page.goto("/subscriptions");
    await expect(
      page.getByTestId(`button-update-card-${subId}`)
    ).toBeVisible({ timeout: 10000 });
  });

  test("'Update Card' button contains the text 'Update Card'", async ({ page }) => {
    await loginAs(page, agentEmail, agentPassword);
    await page.goto("/subscriptions");
    const btn = page.getByTestId(`button-update-card-${subId}`);
    await expect(btn).toBeVisible({ timeout: 10000 });
    await expect(btn).toContainText("Update Card");
  });

  test("clicking 'Update Card' button opens the update-card dialog", async ({ page }) => {
    await loginAs(page, agentEmail, agentPassword);
    await page.goto("/subscriptions");

    const btn = page.getByTestId(`button-update-card-${subId}`);
    await expect(btn).toBeVisible({ timeout: 10000 });
    await btn.click();

    await expect(page.getByTestId("dialog-update-card")).toBeVisible({ timeout: 5000 });
  });

  test("update-card dialog prompts for new payment details and can be dismissed", async ({ page }) => {
    await loginAs(page, agentEmail, agentPassword);
    await page.goto("/subscriptions");

    const btn = page.getByTestId(`button-update-card-${subId}`);
    await expect(btn).toBeVisible({ timeout: 10000 });
    await btn.click();

    const dialog = page.getByTestId("dialog-update-card");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Heading prompting the user to update their payment method.
    await expect(
      dialog.getByRole("heading", { name: /update payment method/i })
    ).toBeVisible();

    // The dialog must prompt for new card details. Stripe Elements is loaded
    // asynchronously, so the card-input wrapper appears once Stripe.js + the
    // publishable key resolve. Assert the wrapper and its embedded Stripe
    // iframe (the actual card-number/expiry/cvc input) are present.
    const cardWrapper = page.getByTestId("update-card-element");
    await expect(cardWrapper).toBeVisible({ timeout: 15000 });
    await expect(cardWrapper.locator("iframe").first()).toBeVisible({ timeout: 15000 });

    // Dismiss the dialog via the Cancel button and confirm it disappears.
    await page.getByTestId("button-cancel-update-card").click();
    await expect(dialog).toBeHidden({ timeout: 5000 });
  });

  test("PATCH /api/subscriptions/:id/payment-method endpoint is accessible for authenticated owner session", async ({ page }) => {
    await loginAs(page, agentEmail, agentPassword);

    /**
     * Verifies the update-card endpoint is reachable and auth passes for the
     * subscription owner. The request includes a syntactically valid paymentMethodId
     * but no real Stripe billing linkage exists (stripeCustomerId is null), so
     * the server returns 400 — not 401/403 — confirming the route is reached and
     * ownership check passes.
     */
    const res = await page.context().request.patch(
      `/api/subscriptions/${subId}/payment-method`,
      { data: { paymentMethodId: "pm_test_billing_retry_e2e" } }
    );
    expect(res.status()).not.toBe(401);
    expect(res.status()).not.toBe(403);
    expect(res.status()).toBe(400);
  });
});

// ─── Suite 2: Admin "Retry" button ───────────────────────────────────────────

test.describe("Billing-failed subscriptions – admin 'Retry' button", () => {
  let agentEmail: string;
  let subId: number;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const setup = await setupBillingFailedSubscription(page, "admin");
    agentEmail = setup.agentEmail;
    subId = setup.subId;
    await page.close();
  });

  test.afterAll(async () => {
    await cleanupSubscriptionAndAgent(agentEmail, subId);
  });

  test("'Retry' button is visible on admin subscriptions page for a past_due subscription", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/subscriptions");
    await expect(
      page.getByTestId(`button-retry-payment-${subId}`)
    ).toBeVisible({ timeout: 10000 });
  });

  test("clicking 'Retry' button calls POST /api/admin/subscriptions/:id/retry-payment", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/subscriptions");

    const btn = page.getByTestId(`button-retry-payment-${subId}`);
    await expect(btn).toBeVisible({ timeout: 10000 });

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/admin/subscriptions/${subId}/retry-payment`) &&
          res.request().method() === "POST",
        { timeout: 10000 }
      ),
      btn.click(),
    ]);

    /**
     * The subscription has a stripe_subscription_id but no stripe_customer_id.
     * The route checks for both (line: `if (!sub.stripeSubscriptionId || !sub.stripeCustomerId)`)
     * and returns 400 when either is missing. This confirms:
     * (a) the route exists, (b) admin auth passed, (c) the subscription was found.
     */
    expect(response.status()).not.toBe(401);
    expect(response.status()).not.toBe(403);
    expect(response.status()).toBe(400);
  });
});
