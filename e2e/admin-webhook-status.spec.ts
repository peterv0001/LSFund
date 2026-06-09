import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@psl.capital";
const ADMIN_PASSWORD = "password123";

async function loginAsAdmin(page: import("@playwright/test").Page): Promise<void> {
  const res = await page.context().request.post("/api/login", {
    data: { username: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
}

test.describe("Admin Settings – Stripe Webhook status card", () => {
  test("the Stripe Webhook card is visible on /admin/settings", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/settings");

    await expect(
      page.getByText("Stripe Webhook", { exact: true })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText("Status of the Stripe webhook endpoint used for billing events")
    ).toBeVisible();
    await expect(
      page.getByTestId("button-test-webhook")
    ).toBeVisible({ timeout: 10000 });
  });

  test("either a 'Yes' or 'No' badge is shown for the stored secret", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/settings");

    // Wait until the card has resolved its loading state by waiting for the test button.
    await expect(
      page.getByTestId("button-test-webhook")
    ).toBeVisible({ timeout: 10000 });

    const secretStored = page.getByTestId("badge-secret-stored");
    const secretMissing = page.getByTestId("badge-secret-missing");

    // Exactly one of the two secret badges should be present and visible.
    const storedCount = await secretStored.count();
    const missingCount = await secretMissing.count();
    expect(storedCount + missingCount).toBe(1);

    if (storedCount === 1) {
      await expect(secretStored).toBeVisible();
      await expect(secretStored).toContainText("Yes");
    } else {
      await expect(secretMissing).toBeVisible();
      await expect(secretMissing).toContainText("No");
    }
  });

  test("clicking 'Test Webhook' calls the API and surfaces a result toast", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/settings");

    const btn = page.getByTestId("button-test-webhook");
    await expect(btn).toBeVisible({ timeout: 10000 });

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes("/api/admin/test-webhook") &&
          res.request().method() === "POST",
        { timeout: 15000 }
      ),
      btn.click(),
    ]);

    // The endpoint always returns 200 with a { success, message } payload
    // (it reports configuration/connectivity issues in the body, not via HTTP status).
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("success");
    expect(body).toHaveProperty("message");
    expect(typeof body.message).toBe("string");

    // A result toast should surface in the UI. Depending on the outcome the
    // title is "Webhook reachable", "Webhook check failed", or "Failed to test webhook".
    await expect(
      page
        .getByText(/Webhook reachable|Webhook check failed|Failed to test webhook/)
        .first()
    ).toBeVisible({ timeout: 10000 });
  });
});
