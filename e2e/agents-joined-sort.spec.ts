import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@psl.capital";
const ADMIN_PASSWORD = "password123";

async function loginAsAdmin(page: import("@playwright/test").Page): Promise<void> {
  const res = await page.context().request.post("/api/login", {
    data: { username: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
}

test.describe("Agents page – Joined column sorting", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("first click on Joined header sorts descending (newest first) and API receives correct params", async ({ page }) => {
    await page.goto("/admin/agents");

    const sortBtn = page.getByTestId("sort-joined");
    await expect(sortBtn).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse((res) =>
        res.url().includes("/api/admin/agents") &&
        res.url().includes("sortBy=createdAt") &&
        res.url().includes("sortOrder=desc") &&
        res.status() === 200
      ),
      sortBtn.click(),
    ]);

    const body = await response.json();
    const agents: Array<{ createdAt: string }> = body.agents ?? [];

    expect(agents.length).toBeGreaterThan(0);

    // Each agent's createdAt must be >= the next one (descending order).
    if (agents.length >= 2) {
      for (let i = 0; i < agents.length - 1; i++) {
        const a = new Date(agents[i].createdAt).getTime();
        const b = new Date(agents[i + 1].createdAt).getTime();
        expect(a).toBeGreaterThanOrEqual(b);
      }
    }
  });

  test("second click on Joined header toggles to ascending (oldest first) and API receives correct params", async ({ page }) => {
    await page.goto("/admin/agents");

    const sortBtn = page.getByTestId("sort-joined");
    await expect(sortBtn).toBeVisible();

    // First click → descending.
    await Promise.all([
      page.waitForResponse((res) =>
        res.url().includes("/api/admin/agents") &&
        res.url().includes("sortBy=createdAt") &&
        res.url().includes("sortOrder=desc") &&
        res.status() === 200
      ),
      sortBtn.click(),
    ]);

    // Second click → ascending.
    const [response] = await Promise.all([
      page.waitForResponse((res) =>
        res.url().includes("/api/admin/agents") &&
        res.url().includes("sortBy=createdAt") &&
        res.url().includes("sortOrder=asc") &&
        res.status() === 200
      ),
      sortBtn.click(),
    ]);

    const body = await response.json();
    const agents: Array<{ createdAt: string }> = body.agents ?? [];

    expect(agents.length).toBeGreaterThan(0);

    // Each agent's createdAt must be <= the next one (ascending order).
    if (agents.length >= 2) {
      for (let i = 0; i < agents.length - 1; i++) {
        const a = new Date(agents[i].createdAt).getTime();
        const b = new Date(agents[i + 1].createdAt).getTime();
        expect(a).toBeLessThanOrEqual(b);
      }
    }
  });
});
