import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = "admin@psl.capital";
const ADMIN_PASSWORD = "password123";

async function loginAsAdmin(page: Page): Promise<void> {
  const res = await page.context().request.post("/api/login", {
    data: { username: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
}

/**
 * Register a throwaway agent and log a subscription so that the admin
 * subscriptions list (and therefore the CSV export) has at least one row.
 * Logging in as admin afterwards replaces the session cookie, but the
 * subscription persists in the database and is visible to the admin.
 */
async function seedSubscription(page: Page): Promise<void> {
  const ctx = page.context();
  const email = `e2e-colorder-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await ctx.request.post("/api/register", {
    data: {
      firstName: "ColOrder",
      lastName: "Seed",
      email,
      password: "E2eTestPass1!",
      referralCode: "",
    },
    failOnStatusCode: false,
  });
  await ctx.request.post("/api/login", {
    data: { username: email, password: "E2eTestPass1!" },
  });
  const subRes = await ctx.request.post("/api/subscriptions", {
    data: { merchantName: `ColOrder Merchant ${Date.now()}`, tier: "tier_1" },
  });
  expect(subRes.ok()).toBeTruthy();
}

/** Read the current visible column order from the picker as an array of keys. */
async function getColumnOrder(page: Page): Promise<string[]> {
  return page
    .locator('[data-testid^="column-row-"]')
    .evaluateAll((els) =>
      els.map((el) => (el.getAttribute("data-testid") || "").replace("column-row-", "")),
    );
}

/**
 * Simulate the native HTML5 drag-and-drop reorder. The component reorders on
 * `dragover` using a ref set in `dragstart`, and ignores dataTransfer, so
 * dispatching synthetic drag events on the rows triggers the React handlers.
 */
async function dragColumn(page: Page, fromKey: string, toKey: string): Promise<void> {
  const from = page.getByTestId(`column-row-${fromKey}`);
  const to = page.getByTestId(`column-row-${toKey}`);
  await from.dispatchEvent("dragstart");
  await to.dispatchEvent("dragover");
  await from.dispatchEvent("dragend");
}

async function openColumnPicker(page: Page): Promise<void> {
  await page.goto("/admin/subscriptions");
  await page.getByTestId("button-csv-columns").click();
  await expect(page.getByTestId("column-order-list")).toBeVisible();
}

test.describe("Subscriptions export – column reordering", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("dragging a column in the picker changes its order", async ({ page }) => {
    await openColumnPicker(page);

    const before = await getColumnOrder(page);
    expect(before.length).toBeGreaterThan(1);
    // Fresh browser context => default order with "id" first, "merchantName" second.
    expect(before[0]).toBe("id");
    expect(before[1]).toBe("merchantName");

    // Drag "merchantName" onto "id" — they should swap positions.
    await dragColumn(page, "merchantName", "id");

    await expect
      .poll(async () => (await getColumnOrder(page)).slice(0, 2).join(","))
      .toBe("merchantName,id");

    const after = await getColumnOrder(page);
    // All columns are still present, just reordered.
    expect([...after].sort()).toEqual([...before].sort());
  });

  test("saving a template preserves the reordered column order", async ({ page }) => {
    await openColumnPicker(page);

    // Reorder: move merchantName ahead of id.
    await dragColumn(page, "merchantName", "id");
    await expect
      .poll(async () => (await getColumnOrder(page)).slice(0, 2).join(","))
      .toBe("merchantName,id");

    const templateName = `e2e-save-order-${Date.now()}`;
    const slug = templateName.replace(/\s+/g, "-").toLowerCase();

    await page.getByTestId("button-save-as-template").click();
    await page.getByTestId("input-template-name").fill(templateName);
    await page.getByTestId("button-save-template-confirm").click();

    // The saved template should appear in the list.
    await expect(page.getByTestId(`export-template-${slug}`)).toBeVisible();

    // Verify the persisted column order via the API.
    const res = await page.context().request.get("/api/admin/export-templates");
    expect(res.ok()).toBeTruthy();
    const templates: Array<{ name: string; columns: string[] }> = await res.json();
    const saved = templates.find((t) => t.name === templateName);
    expect(saved).toBeTruthy();
    // Default selected columns, but with merchantName moved ahead of id.
    expect(saved!.columns).toEqual([
      "merchantName",
      "id",
      "agentName",
      "tier",
      "monthlyAmount",
      "status",
      "changeDate",
    ]);
  });

  test("applying a saved template restores its column order", async ({ page }) => {
    // Create a template with a deliberately custom order via the API.
    const templateName = `e2e-apply-order-${Date.now()}`;
    const slug = templateName.replace(/\s+/g, "-").toLowerCase();
    const customOrder = ["status", "tier", "merchantName", "id"];
    const createRes = await page.context().request.post("/api/admin/export-templates", {
      data: { name: templateName, columns: customOrder, isShared: false },
    });
    expect(createRes.ok()).toBeTruthy();

    await openColumnPicker(page);

    // Apply the template.
    await page.getByTestId(`button-apply-template-${slug}`).click();

    // The picker order should now start with the template's columns, in order.
    await expect
      .poll(async () => (await getColumnOrder(page)).slice(0, customOrder.length).join(","))
      .toBe(customOrder.join(","));

    // The template's columns should be the selected (checked) ones.
    for (const key of customOrder) {
      await expect(page.getByTestId(`checkbox-col-${key}`)).toBeChecked();
    }
    // A column not in the template should be unchecked.
    await expect(page.getByTestId("checkbox-col-agentName")).not.toBeChecked();
  });

  test("CSV export follows the saved column order", async ({ page }) => {
    await seedSubscription(page);
    await loginAsAdmin(page);

    await openColumnPicker(page);

    // Reorder so merchantName comes before id.
    await dragColumn(page, "merchantName", "id");
    await expect
      .poll(async () => (await getColumnOrder(page)).slice(0, 2).join(","))
      .toBe("merchantName,id");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("button-export-csv").click(),
    ]);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const content = Buffer.concat(chunks).toString("utf-8");
    const lines = content.split("\n");

    // The header row is the first line containing the column labels (not the
    // quoted metadata lines). It reflects the reordered selection.
    const expectedHeader =
      "Merchant Name,ID,Agent Name,Tier,Monthly Amount,Status,Change Date";
    const headerLine = lines.find((l) => l === expectedHeader);
    expect(headerLine).toBe(expectedHeader);
  });
});
