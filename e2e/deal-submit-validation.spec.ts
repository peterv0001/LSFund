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

    // Registration is done in a throwaway context that is immediately discarded.
    // Passport 0.7 calls req.session.regenerate() inside req.login(), so posting
    // to /api/register replaces the current session with an agent session. If we
    // used the admin context for registration, its admin session would be silently
    // overwritten, making subsequent admin API calls fail with 403 on every repeat.
    let agentId: number | undefined;
    const regCtx = await browser.newContext();
    try {
      const regRes = await regCtx.request.post("/api/register", {
        data: {
          firstName: "Deal",
          lastName: `Val${TS}`,
          email: AGENT_EMAIL,
          password: AGENT_PASSWORD,
          referralCode: "",
        },
        failOnStatusCode: false,
      });
      if (regRes.ok()) {
        agentId = (await regRes.json()).id;
      }
    } finally {
      await regCtx.close();
    }

    // Admin context is used ONLY for admin operations — never for registration —
    // so the admin session cookie is never overwritten by req.login(agent).
    const adminCtx = await browser.newContext();
    try {
      const adminLogin = await adminCtx.request.post("/api/login", {
        data: { username: "admin@psl.capital", password: "password123" },
      });
      if (!adminLogin.ok()) throw new Error("Admin login failed during test setup");

      // If registration was skipped (agent already exists from a prior repeat),
      // look them up via the admin agents search endpoint.
      if (agentId === undefined) {
        const searchRes = await adminCtx.request.get(
          `/api/admin/agents?search=${encodeURIComponent(AGENT_EMAIL)}&pageSize=5`,
        );
        if (searchRes.ok()) {
          const { agents } = await searchRes.json();
          agentId = agents?.[0]?.id;
        }
      }

      // Mark the agent's email as verified so POST /api/deals doesn't 403.
      if (agentId !== undefined) {
        const verifyRes = await adminCtx.request.post(
          `/api/admin/agents/${agentId}/verify-email`,
        );
        if (!verifyRes.ok()) throw new Error("Email verification failed during test setup");
      }
    } finally {
      await adminCtx.close();
    }

    // Log the test agent in exactly once with the shared context.
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

  test("clicking Next from Funding lands on Review and never submits the application", async () => {
    await openWizard();

    // Walk to step 3 with valid data.
    await fillStep1Valid("Review Gate Test LLC");
    await page.locator('[data-testid="button-next-step"]').click();
    await expect(page.getByText("Owner / Principal Information")).toBeVisible({ timeout: 5000 });

    await fillStep2Valid();
    await page.locator('[data-testid="button-next-step"]').click();
    await expect(
      page.getByRole("heading", { name: "Funding Details" })
    ).toBeVisible({ timeout: 5000 });

    // Step 3 — fully valid funding details so "Next" advances to Review.
    await page.locator('[data-testid="input-requested-amount"]').fill("50000");
    await page.locator('[data-testid="input-avg-monthly-revenue"]').fill("25000");
    await page.locator('[data-testid="input-loan-amount"]').fill("50000");

    // Network-level guard: the regression we're protecting against is the wizard
    // creating the deal on its own when the user only meant to advance to Review.
    // Record every deal-creation request so we can assert none fired before the
    // user explicitly clicks Submit. This is stronger than the UI check below —
    // it catches an auto-submit even if the success view rendering ever changes.
    const dealCreateRequests: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && new URL(req.url()).pathname === "/api/deals") {
        dealCreateRequests.push(req.url());
      }
    });

    // The click that caused the original bug: Next from Funding could race into
    // an immediate submit (the Next button's reused DOM node became the submit
    // button mid-click). It must instead land on the Review step.
    await page.locator('[data-testid="button-next-step"]').click();

    await expect(
      page.getByRole("heading", { name: "Review & Submit" })
    ).toBeVisible({ timeout: 5000 });
    // It must NOT have skipped straight to the success state.
    await expect(
      page.getByRole("heading", { name: "Application Submitted!" })
    ).toHaveCount(0);
    // The explicit submit button is present and ready for the user to review-then-submit.
    await expect(
      page.locator('[data-testid="button-submit-application"]')
    ).toBeVisible({ timeout: 5000 });

    // Give any stray submit a chance to surface on the wire, then assert that
    // advancing into Review fired NO deal-creation request. The deal must only
    // be created after the user explicitly clicks Submit on the review step.
    await page.waitForTimeout(500);
    expect(dealCreateRequests).toEqual([]);

    // Close the wizard so its modal overlay doesn't leak into the next serial test.
    await page.locator('[data-testid="button-cancel-deal"]').click();
    await expect(page.locator('[data-testid="input-merchant-name"]')).toHaveCount(0);
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

  test("double-clicking Submit only sends one POST /api/deals (no duplicate deal)", async () => {
    test.setTimeout(60000);
    const merchantName = `E2E Double-Click Merchant ${TS}`;

    await openWizard();

    // Step 1
    await fillStep1Valid(merchantName);
    await page.locator('[data-testid="button-next-step"]').click();
    await expect(page.getByText("Owner / Principal Information")).toBeVisible({ timeout: 5000 });

    // Step 2
    await fillStep2Valid();
    await page.locator('[data-testid="button-next-step"]').click();

    // Step 3 — funding details
    await expect(
      page.getByRole("heading", { name: "Funding Details" })
    ).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="input-requested-amount"]').fill("60000");
    await page.locator('[data-testid="input-avg-monthly-revenue"]').fill("30000");
    await page.locator('[data-testid="input-loan-amount"]').fill("60000");
    await page.locator('[data-testid="button-next-step"]').click();

    // Step 4 — review & submit
    await expect(
      page.getByRole("heading", { name: "Review & Submit" })
    ).toBeVisible({ timeout: 5000 });

    // Count every POST /api/deals that the browser sends.
    const dealCreateRequests: string[] = [];
    const trackDeals = (req: import("@playwright/test").Request) => {
      if (req.method() === "POST" && new URL(req.url()).pathname === "/api/deals") {
        dealCreateRequests.push(req.url());
      }
    };
    page.on("request", trackDeals);

    // Hold the POST /api/deals response until we explicitly release it. This keeps
    // isPending=true — and therefore the button disabled — long enough for a genuine
    // second click to land on the disabled element. Without the hold the dialog
    // closes immediately after the first click and the second click never dispatches.
    let releaseRequest!: () => void;
    const requestHeld = new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });
    await page.route("**/api/deals", async (route) => {
      await requestHeld;
      await route.continue();
    });

    const submitBtn = page.locator('[data-testid="button-submit-application"]');
    await submitBtn.waitFor({ state: "visible", timeout: 5000 });

    // First click: fires the form submission. The request is held in-flight so
    // isPending stays true and the button transitions to disabled.
    await submitBtn.click();

    // Wait until the submit button is actually disabled (isPending = true). This
    // confirms the first click was received and the mutation is in progress.
    await expect(submitBtn).toBeDisabled({ timeout: 3000 });

    // Second click on the disabled button. force:true bypasses Playwright's
    // "element must be actionable" check so we can assert that a disabled submit
    // button does NOT trigger a second form submission, not that Playwright won't
    // even attempt to interact with it.
    await submitBtn.click({ force: true });

    // Brief pause so any stray second request would have time to appear.
    await page.waitForTimeout(300);

    // Core assertion: exactly one deal-creation request was sent to the server
    // (the second click on the disabled button did not produce another one).
    expect(dealCreateRequests).toHaveLength(1);

    // Release the held response so the deal is actually created on the server.
    // Do NOT unroute yet — calling page.unroute() while route.continue() is
    // still in-flight aborts the request. Wait for the success view to render
    // (confirming the server round-trip completed) before tearing down the intercept.
    releaseRequest();

    // Success state confirms the deal was created and the wizard completed.
    await expect(
      page.locator('[data-testid="text-submission-success-title"]')
    ).toHaveText("Application Submitted!", { timeout: 15000 });

    // Safe to clean up now — the route.continue() has already resolved.
    await page.unroute("**/api/deals");
    page.off("request", trackDeals);

    // Close the success view and verify the deal appears exactly once in the table.
    try {
      await page.locator('[data-testid="button-close-success"]').click({ timeout: 5000 });
    } catch {
      // Best effort: element may detach as the dialog closes.
    }

    const dealRows = page.locator("table").getByText(merchantName, { exact: false });
    await expect(dealRows.first()).toBeVisible({ timeout: 10000 });
    await expect(dealRows).toHaveCount(1);
  });
});
