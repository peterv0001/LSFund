import { test, expect } from "@playwright/test";

/**
 * Verifies that the legal/policy links navigate to the correct pages from
 * every place they appear:
 *  - Landing-page footer legal column (footer-link-*)
 *  - Landing-page footer bottom row (footer-bottom-*)
 *  - Agent sidebar footer (link-*-sidebar)
 *
 * Navigation is driven by clicking the actual rendered link so a regression
 * in any legal href silently breaking compliance navigation is caught here.
 */

const TS = Date.now();

const AGENT_EMAIL = `e2e-legal-links-${TS}@example.com`;
const AGENT_PASSWORD = "E2eLegalLinks1!";

const legalPages = [
  { name: "Income Disclosure", path: "/income-disclosure" },
  { name: "Terms of Service", path: "/terms" },
  { name: "Privacy Policy", path: "/privacy" },
  { name: "Refund Policy", path: "/refund-policy" },
] as const;

// ─── Landing-page footer legal column ────────────────────────────────────────

const footerLinkIds: Record<string, string> = {
  "/income-disclosure": "footer-link-income-disclosure",
  "/terms": "footer-link-terms",
  "/privacy": "footer-link-privacy",
  "/refund-policy": "footer-link-refund",
};

test.describe("Landing footer legal links", () => {
  for (const { name, path } of legalPages) {
    test(`clicking "${name}" in the footer legal column navigates to ${path}`, async ({
      page,
    }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      const link = page.getByTestId(footerLinkIds[path]);
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeVisible();

      await link.click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
    });
  }
});

// ─── Landing-page footer bottom row ──────────────────────────────────────────

const footerBottomIds: Record<string, string> = {
  "/income-disclosure": "footer-bottom-income-disclosure",
  "/terms": "footer-bottom-terms",
  "/privacy": "footer-bottom-privacy",
  "/refund-policy": "footer-bottom-refund",
};

test.describe("Landing footer bottom-row legal links", () => {
  for (const { name, path } of legalPages) {
    test(`clicking "${name}" in the footer bottom row navigates to ${path}`, async ({
      page,
    }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      const link = page.getByTestId(footerBottomIds[path]);
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeVisible();

      await link.click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
    });
  }
});

// ─── Agent sidebar footer legal links ────────────────────────────────────────

const sidebarLinkIds: Record<string, string> = {
  "/income-disclosure": "link-income-disclosure-sidebar",
  "/terms": "link-terms-sidebar",
  "/privacy": "link-privacy-sidebar",
  "/refund-policy": "link-refund-policy-sidebar",
};

async function registerAndLoginAgent(
  page: import("@playwright/test").Page
): Promise<void> {
  await page.context().request.post("/api/register", {
    data: {
      firstName: "LegalLinks",
      lastName: `E2E${TS}`,
      email: AGENT_EMAIL,
      password: AGENT_PASSWORD,
      referralCode: "",
    },
    failOnStatusCode: false,
  });
  const res = await page.context().request.post("/api/login", {
    data: { username: AGENT_EMAIL, password: AGENT_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
}

test.describe("Agent sidebar footer legal links", () => {
  for (const { name, path } of legalPages) {
    test(`clicking "${name}" in the agent sidebar navigates to ${path}`, async ({
      page,
    }) => {
      await registerAndLoginAgent(page);

      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // The sidebar renders in both a desktop and a (hidden) mobile drawer,
      // so scope to the visible instance on the desktop viewport.
      const link = page.locator(
        `[data-testid="${sidebarLinkIds[path]}"]:visible`
      );
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeVisible();

      await link.click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
    });
  }
});
