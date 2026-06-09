import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@psl.capital";
const ADMIN_PASSWORD = "password123";

const RANK_LEVEL: Record<string, number> = {
  agent: 1,
  builder: 2,
  leader: 3,
  director: 4,
  partner: 5,
};

async function loginAsAdmin(page: import("@playwright/test").Page): Promise<void> {
  const res = await page.context().request.post("/api/login", {
    data: { username: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
}

test.describe("Agents page – name and rank column sorting", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("clicking the Agent header sorts agents A–Z by name", async ({ page }) => {
    await page.goto("/admin/agents");

    const sortBtn = page.getByTestId("sort-name");
    await expect(sortBtn).toBeVisible();

    // First click on name sorts ascending (A–Z).
    const [response] = await Promise.all([
      page.waitForResponse((res) =>
        res.url().includes("/api/admin/agents") &&
        res.url().includes("sortBy=name") &&
        res.url().includes("sortOrder=asc") &&
        res.status() === 200
      ),
      sortBtn.click(),
    ]);

    const body = await response.json();
    const agents: Array<{ firstName: string; lastName: string }> = body.agents ?? [];

    expect(agents.length).toBeGreaterThan(0);

    // Backend order must be ascending by (firstName, lastName), case-insensitive.
    const keyOf = (a: { firstName: string; lastName: string }) =>
      `${a.firstName} ${a.lastName}`.toLowerCase();
    if (agents.length >= 2) {
      for (let i = 0; i < agents.length - 1; i++) {
        expect(keyOf(agents[i]).localeCompare(keyOf(agents[i + 1]))).toBeLessThanOrEqual(0);
      }
    }

    // The first rendered row should show the alphabetically-first agent.
    const firstAgentName = `${agents[0].firstName} ${agents[0].lastName}`;
    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow).toContainText(firstAgentName);
  });

  test("clicking the Rank header sorts agents by rank level (agent → partner)", async ({ page }) => {
    await page.goto("/admin/agents");

    const sortBtn = page.getByTestId("sort-rank");
    await expect(sortBtn).toBeVisible();

    // First click on rank sorts ascending (lowest rank first).
    const [response] = await Promise.all([
      page.waitForResponse((res) =>
        res.url().includes("/api/admin/agents") &&
        res.url().includes("sortBy=rank") &&
        res.url().includes("sortOrder=asc") &&
        res.status() === 200
      ),
      sortBtn.click(),
    ]);

    const body = await response.json();
    const agents: Array<{ currentRank: string }> = body.agents ?? [];

    expect(agents.length).toBeGreaterThan(0);

    // Backend order must be ascending by rank level.
    if (agents.length >= 2) {
      for (let i = 0; i < agents.length - 1; i++) {
        const a = RANK_LEVEL[agents[i].currentRank] ?? 0;
        const b = RANK_LEVEL[agents[i + 1].currentRank] ?? 0;
        expect(a).toBeLessThanOrEqual(b);
      }
    }
  });

  test("toggling the Rank header reverses to partner → agent", async ({ page }) => {
    await page.goto("/admin/agents");

    const sortBtn = page.getByTestId("sort-rank");
    await expect(sortBtn).toBeVisible();

    // First click → ascending.
    await Promise.all([
      page.waitForResponse((res) =>
        res.url().includes("/api/admin/agents") &&
        res.url().includes("sortBy=rank") &&
        res.url().includes("sortOrder=asc") &&
        res.status() === 200
      ),
      sortBtn.click(),
    ]);

    // Second click → descending.
    const [response] = await Promise.all([
      page.waitForResponse((res) =>
        res.url().includes("/api/admin/agents") &&
        res.url().includes("sortBy=rank") &&
        res.url().includes("sortOrder=desc") &&
        res.status() === 200
      ),
      sortBtn.click(),
    ]);

    const body = await response.json();
    const agents: Array<{ currentRank: string }> = body.agents ?? [];

    expect(agents.length).toBeGreaterThan(0);

    if (agents.length >= 2) {
      for (let i = 0; i < agents.length - 1; i++) {
        const a = RANK_LEVEL[agents[i].currentRank] ?? 0;
        const b = RANK_LEVEL[agents[i + 1].currentRank] ?? 0;
        expect(a).toBeGreaterThanOrEqual(b);
      }
    }
  });
});
