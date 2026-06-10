import { test, expect } from "@playwright/test";

const TS = Date.now();
const AGENT_EMAIL = `e2e-actorbadge-${TS}@example.com`;
const AGENT_PASSWORD = "E2eTestPass1!";
const AGENT_FIRST = "E2E";
const AGENT_LAST = "Tester";

/**
 * Register and log in using the browser context's own request object so that
 * the session cookie is stored in the same cookie jar the page uses.
 */
async function setupAgent(page: import("@playwright/test").Page): Promise<void> {
  const ctx = page.context();

  await ctx.request.post("/api/register", {
    data: {
      firstName: AGENT_FIRST,
      lastName: AGENT_LAST,
      email: AGENT_EMAIL,
      password: AGENT_PASSWORD,
      referralCode: "",
    },
    failOnStatusCode: false,
  });

  const loginRes = await ctx.request.post("/api/login", {
    data: { username: AGENT_EMAIL, password: AGENT_PASSWORD },
  });
  expect(loginRes.ok()).toBeTruthy();
}

test.describe("Subscription history timeline – actor badges", () => {
  test.beforeEach(async ({ page }) => {
    await setupAgent(page);
  });

  test("shows the blue 'Agent' badge for the agent's own subscription action", async ({
    page,
  }) => {
    // A real agent action: logging a new subscription writes an agent-actor
    // history row. No stubbing — we drive the live endpoint end to end.
    const subRes = await page.context().request.post("/api/subscriptions", {
      data: { merchantName: `Actor Badge Merchant ${TS}`, tier: "tier_1" },
    });
    expect(subRes.ok()).toBeTruthy();
    const sub = await subRes.json();
    const subId = sub.id as number;
    expect(typeof subId).toBe("number");

    // Fetch the real history so we can target the agent-actor entry by its id.
    const historyRes = await page
      .context()
      .request.get(`/api/subscriptions/${subId}/history`);
    expect(historyRes.ok()).toBeTruthy();
    const history = (await historyRes.json()) as Array<{
      id: number;
      actorType: string | null;
      actorName: string | null;
    }>;

    const agentEntry = history.find((h) => h.actorType === "agent");
    expect(agentEntry, "expected an agent-actor history entry").toBeTruthy();
    // The endpoint must now populate the agent's own name (no longer null).
    expect(agentEntry!.actorName).toBe(`${AGENT_FIRST} ${AGENT_LAST}`);

    await page.goto("/subscriptions");

    // Expand this subscription's history panel.
    const toggleBtn = page.getByTestId(`button-toggle-history-${subId}`);
    await expect(toggleBtn).toBeVisible({ timeout: 8000 });
    await toggleBtn.click();

    await expect(page.getByTestId(`history-list-${subId}`)).toBeVisible({
      timeout: 8000,
    });

    // Agent-actor entry → blue "Agent" badge with the agent's own name.
    const entry = page.getByTestId(`history-entry-${agentEntry!.id}`);
    await expect(entry).toBeVisible();
    await expect(entry).toContainText(`by ${AGENT_FIRST} ${AGENT_LAST}`);

    const agentBadge = page.getByTestId(
      `badge-history-actortype-${agentEntry!.id}`
    );
    await expect(agentBadge).toBeVisible();
    await expect(agentBadge).toHaveText("Agent");
    await expect(agentBadge).toHaveClass(/text-blue-700/);
  });
});
