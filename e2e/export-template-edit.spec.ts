import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = "admin@psl.capital";
const ADMIN_PASSWORD = "password123";

async function loginAsAdmin(page: Page): Promise<void> {
  const res = await page.context().request.post("/api/login", {
    data: { username: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
}

function slugOf(name: string): string {
  return name.replace(/\s+/g, "-").toLowerCase();
}

/** Create a template via the API as the logged-in admin; returns its id. */
async function createTemplate(
  page: Page,
  name: string,
  columns: string[],
): Promise<number> {
  const res = await page.context().request.post("/api/admin/export-templates", {
    data: { name, columns, isShared: false },
  });
  expect(res.ok()).toBeTruthy();
  const created: { id: number } = await res.json();
  return created.id;
}

async function deleteTemplate(page: Page, id: number): Promise<void> {
  await page.context().request.delete(`/api/admin/export-templates/${id}`, {
    failOnStatusCode: false,
  });
}

async function openColumnPicker(page: Page): Promise<void> {
  await page.goto("/admin/subscriptions");
  await page.getByTestId("button-csv-columns").click();
  await expect(page.getByTestId("column-order-list")).toBeVisible();
}

/** Read the current visible column order from the picker as an array of keys. */
async function getColumnOrder(page: Page): Promise<string[]> {
  return page
    .locator('[data-testid^="column-row-"]')
    .evaluateAll((els) =>
      els.map((el) => (el.getAttribute("data-testid") || "").replace("column-row-", "")),
    );
}

/** Read the keys of the currently checked columns. */
async function getCheckedColumns(page: Page): Promise<string[]> {
  return page
    .locator('[data-testid^="checkbox-col-"][data-state="checked"]')
    .evaluateAll((els) =>
      els.map((el) => (el.getAttribute("data-testid") || "").replace("checkbox-col-", "")),
    );
}

test.describe("Export templates – inline edit", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("clicking edit on an owned template shows the name input and loads its columns", async ({ page }) => {
    const name = `e2e-edit-load-${Date.now()}`;
    const slug = slugOf(name);
    const columns = ["status", "tier", "merchantName"];
    const id = await createTemplate(page, name, columns);

    try {
      await openColumnPicker(page);

      await page.getByTestId(`button-edit-template-${slug}`).click();

      // Inline editor appears with the template's current name.
      const input = page.getByTestId(`input-edit-template-name-${slug}`);
      await expect(input).toBeVisible();
      await expect(input).toHaveValue(name);

      // The template's columns are loaded as the checked selection...
      await expect
        .poll(async () => (await getCheckedColumns(page)).sort().join(","))
        .toBe([...columns].sort().join(","));

      // ...and the picker order starts with the template's columns, in order.
      const order = await getColumnOrder(page);
      expect(order.slice(0, columns.length)).toEqual(columns);
    } finally {
      await deleteTemplate(page, id);
    }
  });

  test("saving sends PATCH with the new name and columns and the list updates", async ({ page }) => {
    const name = `e2e-edit-save-${Date.now()}`;
    const slug = slugOf(name);
    const id = await createTemplate(page, name, ["id", "merchantName", "tier"]);

    try {
      await openColumnPicker(page);
      await page.getByTestId(`button-edit-template-${slug}`).click();
      await expect(page.getByTestId(`input-edit-template-name-${slug}`)).toBeVisible();

      // Change the column selection: drop "tier", add "status".
      await page.getByTestId("checkbox-col-tier").click();
      await page.getByTestId("checkbox-col-status").click();

      // Rename the template.
      const newName = `${name}-renamed`;
      const newSlug = slugOf(newName);
      await page.getByTestId(`input-edit-template-name-${slug}`).fill(newName);

      const [request] = await Promise.all([
        page.waitForRequest(
          (req) =>
            req.method() === "PATCH" &&
            req.url().includes(`/api/admin/export-templates/${id}`),
        ),
        page.getByTestId(`button-save-edit-template-${slug}`).click(),
      ]);

      const payload = request.postDataJSON() as { name: string; columns: string[] };
      expect(payload.name).toBe(newName);
      expect(payload.columns).toEqual(["id", "merchantName", "status"]);

      // The list reflects the renamed template and the editor closes.
      await expect(page.getByTestId(`export-template-${newSlug}`)).toBeVisible();
      await expect(page.getByTestId(`input-edit-template-name-${slug}`)).not.toBeVisible();

      // The change persisted server-side.
      const res = await page.context().request.get("/api/admin/export-templates");
      expect(res.ok()).toBeTruthy();
      const templates: Array<{ id: number; name: string; columns: string[] }> =
        await res.json();
      const saved = templates.find((t) => t.id === id);
      expect(saved).toBeTruthy();
      expect(saved!.name).toBe(newName);
      expect(saved!.columns).toEqual(["id", "merchantName", "status"]);
    } finally {
      await deleteTemplate(page, id);
    }
  });

  test("cancel discards changes and restores the picker's previous selection and order", async ({ page }) => {
    const name = `e2e-edit-cancel-${Date.now()}`;
    const slug = slugOf(name);
    // Deliberately different order/selection from the picker defaults.
    const id = await createTemplate(page, name, ["changeDate", "status", "id"]);

    try {
      await openColumnPicker(page);

      const orderBefore = await getColumnOrder(page);
      const checkedBefore = await getCheckedColumns(page);
      expect(orderBefore.length).toBeGreaterThan(1);

      await page.getByTestId(`button-edit-template-${slug}`).click();
      await expect(page.getByTestId(`input-edit-template-name-${slug}`)).toBeVisible();

      // Entering edit mode changed the picker to the template's columns.
      await expect
        .poll(async () => (await getColumnOrder(page)).slice(0, 3).join(","))
        .toBe("changeDate,status,id");

      // Make additional dirty changes while editing.
      await page.getByTestId(`input-edit-template-name-${slug}`).fill("should-not-persist");
      await page.getByTestId("checkbox-col-agentName").click();

      await page.getByTestId(`button-cancel-edit-template-${slug}`).click();

      // Editor closes and the picker's previous selection/order are restored.
      await expect(page.getByTestId(`input-edit-template-name-${slug}`)).not.toBeVisible();
      await expect
        .poll(async () => (await getColumnOrder(page)).join(","))
        .toBe(orderBefore.join(","));
      await expect
        .poll(async () => (await getCheckedColumns(page)).sort().join(","))
        .toBe([...checkedBefore].sort().join(","));

      // The template itself is unchanged (name and columns).
      const res = await page.context().request.get("/api/admin/export-templates");
      const templates: Array<{ id: number; name: string; columns: string[] }> =
        await res.json();
      const tpl = templates.find((t) => t.id === id);
      expect(tpl!.name).toBe(name);
      expect(tpl!.columns).toEqual(["changeDate", "status", "id"]);
    } finally {
      await deleteTemplate(page, id);
    }
  });

  test("non-owners see an apply button but no edit button on shared templates", async ({ page }) => {
    // Determine the logged-in admin's id so we can fabricate a foreign owner.
    const userRes = await page.context().request.get("/api/user");
    expect(userRes.ok()).toBeTruthy();
    const user: { id: number } = await userRes.json();

    const name = `e2e-shared-foreign-${Date.now()}`;
    const slug = slugOf(name);

    // Stub the templates list with a template owned by a different admin.
    await page.route("**/api/admin/export-templates", async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: 999999,
            adminId: user.id + 1,
            name,
            columns: ["id", "merchantName"],
            isShared: true,
          },
        ]),
      });
    });

    await openColumnPicker(page);

    const row = page.getByTestId(`export-template-${slug}`);
    await expect(row).toBeVisible();

    // Non-owner: the row's main button applies the template instead of editing.
    await expect(page.getByTestId(`button-apply-template-${slug}`)).toBeVisible();
    await expect(page.getByTestId(`button-edit-template-${slug}`)).toHaveCount(0);
    // Owner-only controls are absent too.
    await expect(page.getByTestId(`button-delete-template-${slug}`)).toHaveCount(0);
    await expect(page.getByTestId(`button-toggle-share-template-${slug}`)).toHaveCount(0);
    // Shared badge is shown for foreign shared templates.
    await expect(page.getByTestId(`badge-shared-template-${slug}`)).toBeVisible();

    // Clicking the main button applies (loads columns) rather than opening the editor.
    await page.getByTestId(`button-apply-template-${slug}`).first().click();
    await expect(page.getByTestId(`input-edit-template-name-${slug}`)).toHaveCount(0);
    await expect
      .poll(async () => (await getColumnOrder(page)).slice(0, 2).join(","))
      .toBe("id,merchantName");
  });
});
