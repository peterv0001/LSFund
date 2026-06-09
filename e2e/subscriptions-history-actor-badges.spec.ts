import { test, expect } from "@playwright/test";

const TS = Date.now();
const AGENT_EMAIL = `e2e-actorbadge-${TS}@example.com`;
const AGENT_PASSWORD = "E2eTestPass1!";

/**
 * Register and log in using the browser context's own request object so that
 * the session cookie is stored in the same cookie jar the page uses.
 */
async function setupAgent(page: import("@playwright/test").Page): Promise<void> {
  const ctx = page.context();

  await ctx.request.post("/api/register", {
    data: {
      firstName: "E2E",
      lastName: "Tester",
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

/**
 * Crafted history entries covering all three badge cases:
 *  - an admin-actor entry (purple "Admin" badge)
 *  - an agent-actor entry (blue "Agent" badge)
 *  - an entry with no actorType/actorName (no badge at all)
 *
 * The /api/subscriptions/:id/history endpoint normally never populates an
 * actorName for agent-actor rows, so we stub the response to exercise the
 * full badge-wiring inside SubscriptionHistoryTimeline deterministically.
 */
const ADMIN_ENTRY_ID = 990001;
const AGENT_ENTRY_ID = 990002;
const NOACTOR_ENTRY_ID = 990003;

const MOCK_HISTORY = [
  {
    id: ADMIN_ENTRY_ID,
    action: "cancel",
    description: "Cancelled subscription",
    createdAt: new Date("2026-01-02T10:00:00Z").toISOString(),
    actorType: "admin",
    actorName: "Admin Casey Reviewer",
  },
  {
    id: AGENT_ENTRY_ID,
    action: "pause",
    description: "Paused subscription",
    createdAt: new Date("2026-01-03T10:00:00Z").toISOString(),
    actorType: "agent",
    actorName: "Jordan Agent",
  },
  {
    id: NOACTOR_ENTRY_ID,
    action: "create",
    description: "Created subscription",
    createdAt: new Date("2026-01-01T10:00:00Z").toISOString(),
    actorType: null,
    actorName: null,
  },
];

test.describe("Subscription history timeline – actor badges", () => {
  test.beforeEach(async ({ page }) => {
    await setupAgent(page);
  });

  test("renders the Admin and Agent badges and omits the badge for actor-less entries", async ({
    page,
  }) => {
    // Create a real subscription so its row + history toggle render.
    const subRes = await page.context().request.post("/api/subscriptions", {
      data: { merchantName: `Actor Badge Merchant ${TS}`, tier: "tier_1" },
    });
    expect(subRes.ok()).toBeTruthy();
    const sub = await subRes.json();
    const subId = sub.id as number;
    expect(typeof subId).toBe("number");

    // Stub this subscription's history with our crafted entries.
    await page.route(`**/api/subscriptions/${subId}/history`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_HISTORY),
      });
    });

    await page.goto("/subscriptions");

    // Expand this subscription's history panel.
    const toggleBtn = page.getByTestId(`button-toggle-history-${subId}`);
    await expect(toggleBtn).toBeVisible({ timeout: 8000 });
    await toggleBtn.click();

    // The history list should render once the (stubbed) entries load.
    await expect(page.getByTestId(`history-list-${subId}`)).toBeVisible({
      timeout: 8000,
    });

    // Admin-actor entry → purple "Admin" badge.
    const adminBadge = page.getByTestId(`badge-history-actortype-${ADMIN_ENTRY_ID}`);
    await expect(adminBadge).toBeVisible();
    await expect(adminBadge).toHaveText("Admin");
    await expect(adminBadge).toHaveClass(/text-purple-700/);

    // Agent-actor entry → blue "Agent" badge.
    const agentBadge = page.getByTestId(`badge-history-actortype-${AGENT_ENTRY_ID}`);
    await expect(agentBadge).toBeVisible();
    await expect(agentBadge).toHaveText("Agent");
    await expect(agentBadge).toHaveClass(/text-blue-700/);

    // Entry with no actorType/actorName → the entry renders but no badge does.
    await expect(
      page.getByTestId(`history-entry-${NOACTOR_ENTRY_ID}`)
    ).toBeVisible();
    await expect(
      page.getByTestId(`badge-history-actortype-${NOACTOR_ENTRY_ID}`)
    ).toHaveCount(0);
  });
});
