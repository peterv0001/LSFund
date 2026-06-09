import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@psl.capital";
const ADMIN_PASSWORD = "password123";

// Names crafted so list order encodes the predecessor relationship the UI relies on:
//  - BASE is already applied
//  - NONBLOCKED is pending but its only predecessor (BASE) is applied -> Apply enabled
//  - BLOCKED is pending and is preceded by the still-pending NONBLOCKED -> Apply disabled
const BASE = "e2e_blocked_apply_001_base";
const NONBLOCKED = "e2e_blocked_apply_002_ready";
const BLOCKED = "e2e_blocked_apply_003_waiting";

const MOCK_MIGRATIONS = [
  { name: BASE, hasDown: true, appliedAt: new Date("2026-01-01T00:00:00Z").toISOString() },
  { name: NONBLOCKED, hasDown: true, appliedAt: null },
  { name: BLOCKED, hasDown: true, appliedAt: null },
];

async function loginAsAdmin(page: import("@playwright/test").Page): Promise<void> {
  const res = await page.context().request.post("/api/login", {
    data: { username: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
}

/**
 * Intercept the migrations list endpoint and return a controlled fixture.
 * Only the exact GET /api/admin/migrations list is mocked; the per-migration
 * apply/revert sub-routes are left untouched so we never mutate the real DB.
 */
async function mockMigrationsList(page: import("@playwright/test").Page): Promise<void> {
  await page.route("**/api/admin/migrations", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname.endsWith("/api/admin/migrations")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_MIGRATIONS),
      });
      return;
    }
    await route.continue();
  });
}

test.describe("Admin Migrations – blocked Apply safeguard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await mockMigrationsList(page);
  });

  test("a migration with an unapplied predecessor shows a disabled Apply button", async ({ page }) => {
    await page.goto("/admin/migrations");

    // The blocked row should render with its explanatory blocked message.
    await expect(page.getByTestId(`migration-row-pending-${BLOCKED}`)).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId(`text-blocked-${BLOCKED}`)).toContainText(NONBLOCKED);

    // The Apply button for the blocked migration must be disabled (not clickable).
    const blockedApplyBtn = page.getByTestId(`button-apply-${BLOCKED}`);
    await expect(blockedApplyBtn).toBeVisible();
    await expect(blockedApplyBtn).toBeDisabled();

    // Clicking the disabled button (its wrapper) must NOT open the confirmation dialog.
    await page.getByTestId(`button-apply-blocked-${BLOCKED}`).click({ force: true });
    await expect(page.getByText("Apply migration?")).toHaveCount(0);
  });

  test("hovering the blocked Apply button reveals the predecessor tooltip", async ({ page }) => {
    await page.goto("/admin/migrations");

    const blockedWrapper = page.getByTestId(`button-apply-blocked-${BLOCKED}`);
    await expect(blockedWrapper).toBeVisible({ timeout: 10000 });

    await blockedWrapper.hover();

    // The tooltip should explain which earlier migration must be applied first.
    const tooltip = page.getByRole("tooltip").filter({ hasText: NONBLOCKED });
    await expect(tooltip.first()).toBeVisible({ timeout: 5000 });
    await expect(tooltip.first()).toContainText("earlier migration");
  });

  test("a non-blocked pending migration has an enabled Apply button that opens the dialog", async ({ page }) => {
    await page.goto("/admin/migrations");

    const readyApplyBtn = page.getByTestId(`button-apply-${NONBLOCKED}`);
    await expect(readyApplyBtn).toBeVisible({ timeout: 10000 });
    await expect(readyApplyBtn).toBeEnabled();

    // Clicking the enabled Apply button opens the confirmation dialog.
    await readyApplyBtn.click();
    await expect(page.getByText("Apply migration?")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("button-confirm-apply")).toBeVisible();

    // Cancel so the test leaves no lingering dialog and never confirms the apply.
    await page.getByTestId("button-cancel-apply").click();
    await expect(page.getByText("Apply migration?")).toHaveCount(0);
  });
});
