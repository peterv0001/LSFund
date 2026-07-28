import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@psl.capital";
const ADMIN_PASSWORD = "password123";

async function loginAsAdmin(page: import("@playwright/test").Page): Promise<void> {
  const res = await page.context().request.post("/api/login", {
    data: { username: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
}

test.describe("Agents page – search and rank filters persist in the URL", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("typing in the search box writes ?search= to the URL", async ({ page }) => {
    await page.goto("/admin/agents");

    const searchInput = page.getByTestId("input-agent-search");
    await expect(searchInput).toBeVisible();

    await searchInput.fill("acme");

    await expect
      .poll(() => new URL(page.url()).searchParams.get("search"))
      .toBe("acme");
  });

  test("selecting a rank writes ?rank= to the URL", async ({ page }) => {
    await page.goto("/admin/agents");

    // Open the rank select and pick "builder"
    await page.getByRole("combobox").filter({ hasText: /All Ranks/i }).click();
    await page.getByRole("option", { name: "Builder" }).click();

    await expect
      .poll(() => new URL(page.url()).searchParams.get("rank"))
      .toBe("builder");
  });

  test("search and rank are initialised from URL params on load", async ({ page }) => {
    await page.goto("/admin/agents?search=acme&rank=builder");

    const searchInput = page.getByTestId("input-agent-search");
    await expect(searchInput).toHaveValue("acme");

    // Rank select should show "builder"
    await expect(
      page.getByRole("combobox").filter({ hasText: /builder/i }),
    ).toBeVisible();
  });

  test("search and rank survive a navigation round-trip via the browser Back button", async ({ page }) => {
    await page.goto("/admin/agents");

    // Set search value
    const searchInput = page.getByTestId("input-agent-search");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("test");
    await expect
      .poll(() => new URL(page.url()).searchParams.get("search"))
      .toBe("test");

    // Set rank filter
    await page.getByRole("combobox").filter({ hasText: /All Ranks/i }).click();
    await page.getByRole("option", { name: "Leader" }).click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("rank"))
      .toBe("leader");

    // Navigate away
    await page.goto("/admin/subscriptions");
    await expect(page).toHaveURL(/\/admin\/subscriptions/);

    // Press Back
    await page.goBack();
    await expect(page).toHaveURL(/search=test/);
    await expect(page).toHaveURL(/rank=leader/);

    // UI should reflect restored state
    await expect(page.getByTestId("input-agent-search")).toHaveValue("test");
    await expect(
      page.getByRole("combobox").filter({ hasText: /leader/i }),
    ).toBeVisible();
  });
});
