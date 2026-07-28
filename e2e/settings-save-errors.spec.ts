import { test, expect } from "@playwright/test";

const TS = Date.now();

async function setupAgent(page: import("@playwright/test").Page): Promise<void> {
  const email = `e2e-settings-err-${TS}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = "E2eTestPass1!";
  const ctx = page.context();

  await ctx.request.post("/api/register", {
    data: {
      firstName: "E2E",
      lastName: "SettingsErr",
      email,
      password,
      referralCode: "",
    },
    failOnStatusCode: false,
  });

  const loginRes = await ctx.request.post("/api/login", {
    data: { username: email, password },
  });
  expect(loginRes.ok()).toBeTruthy();
}

test.describe("Settings save error toasts", () => {
  test.beforeEach(async ({ page }) => {
    await setupAgent(page);
    await page.goto("/settings");
  });

  test("shows error toast when saving profile fails", async ({ page }) => {
    // Profile tab is default; wait for a form field to be ready
    await expect(page.getByRole("button", { name: /Save Changes/i })).toBeVisible({ timeout: 6000 });

    await page.route("**/api/agents/profile", async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Internal Server Error" }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByRole("button", { name: /Save Changes/i }).click();

    await expect(
      page.getByText("Failed to update profile", { exact: true })
    ).toBeVisible({ timeout: 5000 });
  });

  test("shows error toast when saving payout settings fails", async ({ page }) => {
    await page.getByRole("tab", { name: /Payout/i }).click();
    await expect(page.getByRole("button", { name: /Save Payout Settings/i })).toBeVisible({ timeout: 6000 });

    await page.route("**/api/agents/payout-method", async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Internal Server Error" }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByRole("button", { name: /Save Payout Settings/i }).click();

    await expect(
      page.getByText("Failed to update payout method", { exact: true })
    ).toBeVisible({ timeout: 5000 });
  });

  test("shows server error message in toast when changing password fails", async ({ page }) => {
    await page.getByRole("tab", { name: /Security/i }).click();
    await expect(page.getByRole("button", { name: /Update Password/i })).toBeVisible({ timeout: 6000 });

    const serverMessage = "Current password is incorrect";

    await page.route("**/api/auth/change-password", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ message: serverMessage }),
        });
      } else {
        await route.continue();
      }
    });

    // Fill in all three password fields so client-side validation passes.
    // The Label components are siblings of the Inputs (no htmlFor), so we use
    // positional selectors within the security tab content.
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill("WrongPass1!");
    await passwordInputs.nth(1).fill("NewPass123!");
    await passwordInputs.nth(2).fill("NewPass123!");

    await page.getByRole("button", { name: /Update Password/i }).click();

    await expect(
      page.getByText(serverMessage, { exact: true })
    ).toBeVisible({ timeout: 5000 });
  });
});
