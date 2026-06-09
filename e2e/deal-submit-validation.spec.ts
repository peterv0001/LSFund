import { test, expect } from "@playwright/test";

const TS = Date.now();

const AGENT_EMAIL = `e2e-deal-validation-${TS}@example.com`;
const AGENT_PASSWORD = "E2eDealVal1!";

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

test.describe("MCA application wizard surfaces validation errors instead of failing silently", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.context().request.post("/api/register", {
      data: {
        firstName: "Deal",
        lastName: `Val${TS}`,
        email: AGENT_EMAIL,
        password: AGENT_PASSWORD,
        referralCode: "",
      },
      failOnStatusCode: false,
    });
    await context.close();
  });

  test("an invalid EIN shows a clear error and blocks advancing past step 1", async ({
    page,
  }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
    await page.goto("/deals");

    // Open the MCA application wizard.
    await page.locator('[data-testid="button-submit-deal"]').click();
    await expect(page.locator('[data-testid="input-merchant-name"]')).toBeVisible({
      timeout: 10000,
    });

    // Fill the step-1 required text fields validly, but give a malformed EIN.
    await page.locator('[data-testid="input-merchant-name"]').fill("Validation Test LLC");
    await page.locator('[data-testid="input-merchant-phone"]').fill("5551234567");
    await page.locator('[data-testid="input-business-address"]').fill("123 Main St");
    await page.locator('[data-testid="input-business-city"]').fill("Austin");
    await page.locator('[data-testid="input-business-zip"]').fill("78701");
    await page.locator('[data-testid="input-ein"]').fill("12-345");

    // Attempt to advance. Previously a bad format here was swallowed silently.
    await page.locator('[data-testid="button-next-step"]').click();

    // The EIN error must now be visible to the user...
    await expect(page.getByText("EIN format: XX-XXXXXXX")).toBeVisible({
      timeout: 5000,
    });

    // ...and we must still be on step 1 (owner step heading should not appear).
    await expect(
      page.getByText("Owner / Principal Information")
    ).toHaveCount(0);
  });
});
