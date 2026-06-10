import { test, expect, type Page, type BrowserContext } from "@playwright/test";

const TS = Date.now();

const AGENT_EMAIL = `e2e-deal-validation-${TS}@example.com`;
const AGENT_PASSWORD = "E2eDealVal1!";

// Share one authenticated context/page across the serial tests so we log in
// only once and don't trip the login endpoint's rate limiting.
test.describe.configure({ mode: "serial" });

let context: BrowserContext;
let page: Page;

async function openWizard(): Promise<void> {
  await page.goto("/deals");
  await page.locator('[data-testid="button-submit-deal"]').click();
  await expect(page.locator('[data-testid="input-merchant-name"]')).toBeVisible({
    timeout: 10000,
  });
}

async function selectOption(triggerTestId: string, optionName: string): Promise<void> {
  await page.locator(`[data-testid="${triggerTestId}"]`).click();
  await page.getByRole("option", { name: optionName, exact: true }).click();
}

// Fill all required step-1 fields with valid values.
async function fillStep1Valid(merchantName = "Validation Test LLC"): Promise<void> {
  await page.locator('[data-testid="input-merchant-name"]').fill(merchantName);
  await page.locator('[data-testid="input-merchant-phone"]').fill("5551234567");
  await page.locator('[data-testid="input-business-address"]').fill("123 Main St");
  await page.locator('[data-testid="input-business-city"]').fill("Austin");
  await selectOption("select-business-state", "TX");
  await page.locator('[data-testid="input-business-zip"]').fill("78701");
}

// Fill all required step-2 fields with valid values.
async function fillStep2Valid(): Promise<void> {
  await page.locator('[data-testid="input-owner-first-name"]').fill("John");
  await page.locator('[data-testid="input-owner-last-name"]').fill("Smith");
  await page.locator('[data-testid="input-owner-phone"]').fill("5559876543");
  await page.locator('[data-testid="input-owner-pct"]').fill("100");
}

test.describe("MCA application wizard surfaces validation errors instead of failing silently", () => {
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await context.request.post("/api/register", {
      data: {
        firstName: "Deal",
        lastName: `Val${TS}`,
        email: AGENT_EMAIL,
        password: AGENT_PASSWORD,
        referralCode: "",
      },
      failOnStatusCode: false,
    });
    const res = await context.request.post("/api/login", {
      data: { username: AGENT_EMAIL, password: AGENT_PASSWORD },
    });
    expect(res.ok()).toBeTruthy();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("an invalid EIN shows a clear error and blocks advancing past step 1", async () => {
    await openWizard();
    await fillStep1Valid();
    await page.locator('[data-testid="input-ein"]').fill("12-345");

    await page.locator('[data-testid="button-next-step"]').click();

    await expect(page.getByText("EIN format: XX-XXXXXXX")).toBeVisible({ timeout: 5000 });
    // Still on step 1: the owner step heading should not be present.
    await expect(page.getByText("Owner / Principal Information")).toHaveCount(0);
  });

  test("an under-age date of birth shows a clear error and blocks advancing past step 2", async () => {
    await openWizard();
    await fillStep1Valid();
    await page.locator('[data-testid="button-next-step"]').click();
    await expect(page.getByText("Owner / Principal Information")).toBeVisible({ timeout: 5000 });

    await fillStep2Valid();
    // A date of birth that makes the owner under 18.
    await page.locator('[data-testid="input-owner-dob"]').fill("2020-01-01");
    await page.locator('[data-testid="button-next-step"]').click();

    await expect(
      page.getByText("Enter a valid date of birth (owner must be 18+)")
    ).toBeVisible({ timeout: 5000 });
    // Still on step 2: the step-3 (Funding) submit fields should not be present.
    await expect(page.locator('[data-testid="input-requested-amount"]')).toHaveCount(0);
  });

  test("submitting with an invalid field always shows feedback and jumps to the offending step instead of doing nothing", async () => {
    await openWizard();

    // Walk to step 2, then step 3, with valid data.
    await fillStep1Valid("Silent Submit Test LLC");
    await page.locator('[data-testid="button-next-step"]').click();
    await expect(page.getByText("Owner / Principal Information")).toBeVisible({ timeout: 5000 });

    await fillStep2Valid();
    await page.locator('[data-testid="button-next-step"]').click();
    await expect(
      page.getByRole("heading", { name: "Funding Details" })
    ).toBeVisible({ timeout: 5000 });

    // Step 3 — funding details. Fill the other fields validly, but make the
    // loan amount invalid (below the $1,000 minimum). The per-step "Next" gate
    // would block advancing from here, so the only way this value reaches the
    // form submit is exactly the condition the onInvalid safety net guards.
    await page.locator('[data-testid="input-requested-amount"]').fill("50000");
    await page.locator('[data-testid="input-avg-monthly-revenue"]').fill("25000");
    await page.locator('[data-testid="input-loan-amount"]').fill("100");

    // Step back to step 2. "Back" does NOT re-validate, so we now sit on step 2
    // while the form still holds an invalid step-3 value — the silent-submit
    // setup. (We deliberately never reach step 4: clicking "Next" into the
    // review step swaps the Next button for the submit button at the same spot,
    // which can race a click into an unintended submit.)
    await page.locator('[data-testid="button-prev-step"]').click();
    await expect(page.getByText("Owner / Principal Information")).toBeVisible({ timeout: 5000 });

    // Fire the form's submit exactly as the "Submit to Closing Team" button does.
    // (That button only renders on step 4; submitting the form here exercises the
    // onInvalid safety net so a regression that makes submit fail silently — no
    // toast, no navigation — is caught.)
    await page.evaluate(() => {
      const formEl = document.querySelector('[role="dialog"] form') as HTMLFormElement | null;
      formEl?.requestSubmit();
    });

    // The safety net must (1) show the error toast...
    await expect(
      page.getByText("Please fix the highlighted fields")
    ).toBeVisible({ timeout: 5000 });
    // ...and (2) jump from step 2 to the offending step (step 3) so the user can
    // fix it, rather than doing nothing.
    await expect(
      page.getByRole("heading", { name: "Funding Details" })
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator('[data-testid="input-loan-amount"]')
    ).toBeVisible({ timeout: 5000 });
    // The form must NOT have silently submitted.
    await expect(
      page.getByRole("heading", { name: "Application Submitted!" })
    ).toHaveCount(0);
  });

  test("a fully valid application submits successfully and appears in the deals list", async () => {
    test.setTimeout(60000);
    const merchantName = `E2E Valid Merchant ${TS}`;

    await openWizard();

    // Step 1
    await fillStep1Valid(merchantName);
    await page.locator('[data-testid="button-next-step"]').click();
    await expect(page.getByText("Owner / Principal Information")).toBeVisible({ timeout: 5000 });

    // Step 2
    await fillStep2Valid();
    await page.locator('[data-testid="button-next-step"]').click();

    // Step 3 — funding details (requested amount is required and gated)
    await page.locator('[data-testid="input-requested-amount"]').fill("50000");
    await page.locator('[data-testid="input-avg-monthly-revenue"]').fill("25000");
    await page.locator('[data-testid="input-loan-amount"]').fill("50000");
    await page.locator('[data-testid="button-next-step"]').click();

    // Step 4 — review & submit
    await expect(
      page.getByRole("heading", { name: "Review & Submit" })
    ).toBeVisible({ timeout: 5000 });
    // The submit fires, then the button disables (isPending) and detaches as
    // the dialog swaps to the success view. Playwright can't settle its
    // post-click checks on that flapping element, so bound the click and rely
    // on the success state below as the real verification.
    try {
      await page
        .locator('[data-testid="button-submit-application"]')
        .click({ timeout: 10000 });
    } catch {
      // Expected: element detaches as the success view renders.
    }

    // Success state confirms the deal was created with no silent failure.
    await expect(page.locator('[data-testid="text-submission-success-title"]')).toHaveText(
      "Application Submitted!",
      { timeout: 10000 }
    );

    // Back to the list — the new deal should be visible in the deals table
    // (scope to the table to avoid also matching the name in the success dialog).
    try {
      await page.locator('[data-testid="button-close-success"]').click({ timeout: 5000 });
    } catch {
      // Best effort: the success dialog may detach as it closes.
    }
    await expect(
      page.locator("table").getByText(merchantName, { exact: false }).first()
    ).toBeVisible({ timeout: 10000 });
  });
});
