import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@psl.capital";
const ADMIN_PASSWORD = "password123";

async function loginAsAdmin(page: import("@playwright/test").Page): Promise<void> {
  const res = await page.context().request.post("/api/login", {
    data: { username: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
}

test.describe("Agents page – subscription count column sorting", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("Subscriptions header shows neutral icon before any sort is applied", async ({ page }) => {
    await page.goto("/admin/agents");

    const sortBtn = page.getByTestId("sort-subscriptions");
    await expect(sortBtn).toBeVisible();

    await expect(page.getByTestId("icon-sort-neutral")).toBeVisible();
    await expect(page.getByTestId("icon-sort-desc")).not.toBeVisible();
    await expect(page.getByTestId("icon-sort-asc")).not.toBeVisible();
  });

  test("first click sorts descending, icon switches to ArrowDown, API receives correct params", async ({ page }) => {
    await page.goto("/admin/agents");

    const sortBtn = page.getByTestId("sort-subscriptions");
    await expect(sortBtn).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse((res) =>
        res.url().includes("/api/admin/agents") &&
        res.url().includes("sortBy=subscriptionCount") &&
        res.url().includes("sortOrder=desc") &&
        res.status() === 200
      ),
      sortBtn.click(),
    ]);

    const body = await response.json();
    const agents: Array<{ totalSubscriptionCount: number }> = body.agents ?? [];

    await expect(page.getByTestId("icon-sort-desc")).toBeVisible();
    await expect(page.getByTestId("icon-sort-neutral")).not.toBeVisible();
    await expect(page.getByTestId("icon-sort-asc")).not.toBeVisible();

    expect(agents.length).toBeGreaterThan(0);

    if (agents.length >= 2) {
      for (let i = 0; i < agents.length - 1; i++) {
        expect(agents[i].totalSubscriptionCount).toBeGreaterThanOrEqual(
          agents[i + 1].totalSubscriptionCount
        );
      }
    }
  });

  test("second click toggles to ascending, icon switches to ArrowUp, API receives correct params", async ({ page }) => {
    await page.goto("/admin/agents");

    const sortBtn = page.getByTestId("sort-subscriptions");
    await expect(sortBtn).toBeVisible();

    await Promise.all([
      page.waitForResponse((res) =>
        res.url().includes("/api/admin/agents") &&
        res.url().includes("sortOrder=desc") &&
        res.status() === 200
      ),
      sortBtn.click(),
    ]);

    await expect(page.getByTestId("icon-sort-desc")).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse((res) =>
        res.url().includes("/api/admin/agents") &&
        res.url().includes("sortBy=subscriptionCount") &&
        res.url().includes("sortOrder=asc") &&
        res.status() === 200
      ),
      sortBtn.click(),
    ]);

    const body = await response.json();
    const agents: Array<{ totalSubscriptionCount: number }> = body.agents ?? [];

    await expect(page.getByTestId("icon-sort-asc")).toBeVisible();
    await expect(page.getByTestId("icon-sort-neutral")).not.toBeVisible();
    await expect(page.getByTestId("icon-sort-desc")).not.toBeVisible();

    expect(agents.length).toBeGreaterThan(0);

    if (agents.length >= 2) {
      for (let i = 0; i < agents.length - 1; i++) {
        expect(agents[i].totalSubscriptionCount).toBeLessThanOrEqual(
          agents[i + 1].totalSubscriptionCount
        );
      }
    }
  });
});
