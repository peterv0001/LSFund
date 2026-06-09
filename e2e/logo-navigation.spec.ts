import { test, expect } from "@playwright/test";

/**
 * Verifies that the clickable brand logo navigates to the correct destination
 * from every place it appears:
 *  - Agent sidebar logo  -> /dashboard
 *  - Admin sidebar logo  -> /admin
 *  - Auth / landing / policy page logos -> /
 *
 * Navigation is driven by clicking the actual <Link> in the rendered UI so a
 * regression in any logo href is caught here.
 */

const TS = Date.now();

const ADMIN_EMAIL = "admin@psl.capital";
const ADMIN_PASSWORD = "password123";

const AGENT_EMAIL = `e2e-logo-nav-${TS}@example.com`;
const AGENT_PASSWORD = "E2eLogoNav1!";

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

async function registerAndLoginAgent(
  page: import("@playwright/test").Page
): Promise<void> {
  await page.context().request.post("/api/register", {
    data: {
      firstName: "LogoNav",
      lastName: `E2E${TS}`,
      email: AGENT_EMAIL,
      password: AGENT_PASSWORD,
      referralCode: "",
    },
    failOnStatusCode: false,
  });
  await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
}

// ─── Agent sidebar logo -> /dashboard ────────────────────────────────────────

test.describe("Agent sidebar logo", () => {
  test("clicking the agent sidebar logo navigates to /dashboard", async ({
    page,
  }) => {
    await registerAndLoginAgent(page);

    // Start on a non-dashboard authenticated page so the navigation is meaningful.
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // The sidebar renders in both a desktop and a (hidden) mobile drawer, so
    // scope to the visible instance on the desktop viewport.
    const logo = page.locator('[data-testid="link-logo-home"]:visible');
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute("href", "/dashboard");

    await logo.click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

// ─── Admin sidebar logo -> /admin ────────────────────────────────────────────

test.describe("Admin sidebar logo", () => {
  test("clicking the admin sidebar logo navigates to /admin", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Start on a non-dashboard admin page so the navigation is meaningful.
    await page.goto("/admin/agents");
    await page.waitForLoadState("networkidle");

    const logo = page.getByTestId("link-logo-admin");
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute("href", "/admin");

    await logo.click();
    await expect(page).toHaveURL(/\/admin$/);
  });
});

// ─── Public page logos -> / ──────────────────────────────────────────────────

const publicPages: { name: string; path: string; testId: string }[] = [
  { name: "auth (login)", path: "/login", testId: "link-logo-auth" },
  { name: "landing", path: "/", testId: "link-logo-landing" },
  { name: "landing footer", path: "/", testId: "link-logo-footer" },
  { name: "terms", path: "/terms", testId: "link-logo-terms" },
  { name: "privacy", path: "/privacy", testId: "link-logo-privacy" },
  {
    name: "refund policy",
    path: "/refund-policy",
    testId: "link-logo-refund-policy",
  },
  {
    name: "income disclosure",
    path: "/income-disclosure",
    testId: "link-logo-income-disclosure",
  },
  {
    name: "forgot password",
    path: "/forgot-password",
    testId: "link-logo-forgot-password",
  },
];

test.describe("Public page logos navigate home", () => {
  for (const { name, path, testId } of publicPages) {
    test(`clicking the ${name} logo navigates to /`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const logo = page.getByTestId(testId);
      await expect(logo).toBeVisible();
      await expect(logo).toHaveAttribute("href", "/");

      await logo.click();
      await expect(page).toHaveURL(`http://localhost:5000/`);
    });
  }
});
