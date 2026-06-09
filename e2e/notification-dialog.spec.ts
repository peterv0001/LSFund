import { test, expect } from "@playwright/test";

const TS = Date.now();

async function setupAgent(page: import("@playwright/test").Page): Promise<void> {
  const email = `e2e-notif-${TS}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = "E2eTestPass1!";
  const ctx = page.context();

  await ctx.request.post("/api/register", {
    data: {
      firstName: "E2E",
      lastName: "NotifTester",
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

async function navigateToNotifications(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/settings");
  await page.getByTestId("tab-notifications").click();
  await expect(page.getByTestId("toggle-email-on-paused")).toBeVisible({ timeout: 6000 });
}

test.describe("Notification confirmation dialog", () => {
  test.beforeEach(async ({ page }) => {
    await setupAgent(page);
  });

  test("clicking a toggle OFF opens the confirmation dialog", async ({ page }) => {
    await navigateToNotifications(page);

    const toggle = page.getByTestId("toggle-email-on-paused");
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    await toggle.click();

    await expect(page.getByTestId("dialog-cancel-disable")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("dialog-confirm-disable")).toBeVisible();
  });

  test("clicking 'Keep Enabled' closes the dialog and leaves the toggle ON", async ({ page }) => {
    await navigateToNotifications(page);

    const toggle = page.getByTestId("toggle-email-on-cancelled");
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    await toggle.click();
    await expect(page.getByTestId("dialog-cancel-disable")).toBeVisible({ timeout: 5000 });

    await page.getByTestId("dialog-cancel-disable").click();

    await expect(page.getByTestId("dialog-cancel-disable")).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("toggle-email-on-cancelled")).toHaveAttribute("aria-checked", "true");
  });

  test("clicking 'Turn Off' closes the dialog and sets the toggle to OFF", async ({ page }) => {
    await navigateToNotifications(page);

    const toggle = page.getByTestId("toggle-email-on-reactivated");
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    await toggle.click();
    await expect(page.getByTestId("dialog-confirm-disable")).toBeVisible({ timeout: 5000 });

    await page.getByTestId("dialog-confirm-disable").click();

    await expect(page.getByTestId("dialog-confirm-disable")).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("toggle-email-on-reactivated")).toHaveAttribute("aria-checked", "false");
  });

  test("preference is NOT persisted until Save is clicked", async ({ page }) => {
    await navigateToNotifications(page);

    const toggle = page.getByTestId("toggle-email-on-paused");
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    await toggle.click();
    await expect(page.getByTestId("dialog-confirm-disable")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("dialog-confirm-disable").click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");

    await page.goto("/settings");
    await page.getByTestId("tab-notifications").click();
    await expect(page.getByTestId("toggle-email-on-paused")).toBeVisible({ timeout: 6000 });
    await expect(page.getByTestId("toggle-email-on-paused")).toHaveAttribute("aria-checked", "true");
  });

  test("preference IS persisted after clicking Save", async ({ page }) => {
    await navigateToNotifications(page);

    const toggle = page.getByTestId("toggle-email-on-paused");
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    await toggle.click();
    await expect(page.getByTestId("dialog-confirm-disable")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("dialog-confirm-disable").click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");

    await page.getByTestId("button-save-notification-prefs").click();

    await expect(page.getByText("Notification preferences saved")).toBeVisible({ timeout: 5000 });

    await page.goto("/settings");
    await page.getByTestId("tab-notifications").click();
    await expect(page.getByTestId("toggle-email-on-paused")).toBeVisible({ timeout: 6000 });
    await expect(page.getByTestId("toggle-email-on-paused")).toHaveAttribute("aria-checked", "false");
  });

  test("success toast appears after saving preferences", async ({ page }) => {
    await navigateToNotifications(page);

    await page.getByTestId("button-save-notification-prefs").click();

    await expect(page.getByText("Notification preferences saved")).toBeVisible({ timeout: 5000 });
  });

  test("Deal Funded toggle OFF opens the confirmation dialog", async ({ page }) => {
    await navigateToNotifications(page);

    const toggle = page.getByTestId("toggle-email-on-deal-funded");
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    await toggle.click();

    await expect(page.getByTestId("dialog-cancel-disable")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("dialog-confirm-disable")).toBeVisible();
  });

  test("Deal Funded 'Keep Enabled' leaves the toggle ON", async ({ page }) => {
    await navigateToNotifications(page);

    const toggle = page.getByTestId("toggle-email-on-deal-funded");
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    await toggle.click();
    await expect(page.getByTestId("dialog-cancel-disable")).toBeVisible({ timeout: 5000 });

    await page.getByTestId("dialog-cancel-disable").click();

    await expect(page.getByTestId("dialog-cancel-disable")).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("toggle-email-on-deal-funded")).toHaveAttribute("aria-checked", "true");
  });

  test("Deal Funded 'Turn Off' sets the toggle to OFF", async ({ page }) => {
    await navigateToNotifications(page);

    const toggle = page.getByTestId("toggle-email-on-deal-funded");
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    await toggle.click();
    await expect(page.getByTestId("dialog-confirm-disable")).toBeVisible({ timeout: 5000 });

    await page.getByTestId("dialog-confirm-disable").click();

    await expect(page.getByTestId("dialog-confirm-disable")).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("toggle-email-on-deal-funded")).toHaveAttribute("aria-checked", "false");
  });

  test("New Team Signup toggle OFF opens the confirmation dialog", async ({ page }) => {
    await navigateToNotifications(page);

    const toggle = page.getByTestId("toggle-email-on-team-signup");
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    await toggle.click();

    await expect(page.getByTestId("dialog-cancel-disable")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("dialog-confirm-disable")).toBeVisible();
  });

  test("New Team Signup 'Keep Enabled' leaves the toggle ON", async ({ page }) => {
    await navigateToNotifications(page);

    const toggle = page.getByTestId("toggle-email-on-team-signup");
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    await toggle.click();
    await expect(page.getByTestId("dialog-cancel-disable")).toBeVisible({ timeout: 5000 });

    await page.getByTestId("dialog-cancel-disable").click();

    await expect(page.getByTestId("dialog-cancel-disable")).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("toggle-email-on-team-signup")).toHaveAttribute("aria-checked", "true");
  });

  test("New Team Signup 'Turn Off' sets the toggle to OFF", async ({ page }) => {
    await navigateToNotifications(page);

    const toggle = page.getByTestId("toggle-email-on-team-signup");
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    await toggle.click();
    await expect(page.getByTestId("dialog-confirm-disable")).toBeVisible({ timeout: 5000 });

    await page.getByTestId("dialog-confirm-disable").click();

    await expect(page.getByTestId("dialog-confirm-disable")).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("toggle-email-on-team-signup")).toHaveAttribute("aria-checked", "false");
  });

  test("error toast appears when saving preferences fails", async ({ page }) => {
    await navigateToNotifications(page);

    await page.route("**/api/agents/notification-preferences", async (route) => {
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

    await page.getByTestId("button-save-notification-prefs").click();

    await expect(page.getByText("Failed to save notification preferences", { exact: true })).toBeVisible({ timeout: 5000 });
  });
});
