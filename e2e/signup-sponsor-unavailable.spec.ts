import { test, expect } from "@playwright/test";

const TS = Date.now();

// A referral code that resolves to no active sponsor. The registration API
// returns a 400 "referral link is no longer valid" for both missing and
// inactive sponsors, so an unknown code exercises the same UI path.
const DEAD_REFERRAL = `DEADREF${TS}`;

async function fillRegisterForm(page: import("@playwright/test").Page, email: string): Promise<void> {
  await page.locator('[data-testid="input-first-name"]').fill("Sponsor");
  await page.locator('[data-testid="input-last-name"]').fill("Test");
  await page.locator('[data-testid="input-email"]').fill(email);
  await page.locator('[data-testid="input-phone"]').fill("5551234567");
  await page.locator('[data-testid="input-password"]').fill("SponsorTest1!");
  await page.locator('[data-testid="checkbox-legal-consent"]').click();
}

test.describe("signup surfaces an unavailable referral sponsor gracefully", () => {
  test("shows an inline message and lets the user continue without a referral in one click", async ({ page }) => {
    test.setTimeout(60000);
    const email = `e2e-dead-ref-${TS}@example.com`;

    await page.goto(`/signup?ref=${DEAD_REFERRAL}`);

    // The page opens on the login form; switch to the register form.
    await page.getByRole("button", { name: "Apply Now" }).click();
    await expect(page.locator('[data-testid="button-create-account"]')).toBeVisible({
      timeout: 10000,
    });

    // The dead referral code is prefilled and shown as applied.
    await expect(page.getByText(`Sponsor Code Applied: ${DEAD_REFERRAL}`)).toBeVisible({
      timeout: 5000,
    });

    await fillRegisterForm(page, email);
    await page.locator('[data-testid="button-create-account"]').click();

    // The friendly inline message must appear instead of a generic toast, and
    // the user must stay on the signup page (no navigation to the dashboard).
    await expect(page.locator('[data-testid="alert-sponsor-unavailable"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('[data-testid="text-sponsor-unavailable"]')).toContainText(
      "referral link is no longer valid"
    );
    await expect(page).not.toHaveURL(/\/dashboard/);

    // One click to clear the referral and continue as a direct signup. This
    // resubmits the form without the sponsor and lands on the dashboard.
    await page.locator('[data-testid="button-continue-without-referral"]').click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });
});
