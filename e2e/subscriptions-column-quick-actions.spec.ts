import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = "admin@psl.capital";
const ADMIN_PASSWORD = "password123";

const ALL_COLUMNS = [
  "id",
  "merchantName",
  "merchantEmail",
  "agentName",
  "agentEmail",
  "tier",
  "monthlyAmount",
  "status",
  "changeDate",
  "startDate",
  "endDate",
  "reactivatedAt",
  "reactivatedBy",
  "billingStatus",
  "cardLast4",
  "cardBrand",
  "lastChargedAt",
];

const DEFAULT_COLUMNS = [
  "id",
  "merchantName",
  "agentName",
  "tier",
  "monthlyAmount",
  "status",
  "changeDate",
];

async function loginAsAdmin(page: Page): Promise<void> {
  const res = await page.context().request.post("/api/login", {
    data: { username: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
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

/** Return the keys of all currently checked column checkboxes. */
async function getCheckedColumns(page: Page): Promise<string[]> {
  const checked: string[] = [];
  for (const key of ALL_COLUMNS) {
    if (await page.getByTestId(`checkbox-col-${key}`).isChecked()) {
      checked.push(key);
    }
  }
  return checked;
}

/**
 * Simulate the native HTML5 drag-and-drop reorder (see
 * subscriptions-column-reorder.spec.ts for details).
 */
async function dragColumn(page: Page, fromKey: string, toKey: string): Promise<void> {
  const from = page.getByTestId(`column-row-${fromKey}`);
  const to = page.getByTestId(`column-row-${toKey}`);
  await from.dispatchEvent("dragstart");
  await to.dispatchEvent("dragover");
  await from.dispatchEvent("dragend");
}

test.describe("Subscriptions export – column quick actions", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("'Select all' checks every column", async ({ page }) => {
    await openColumnPicker(page);

    // Fresh context => defaults selected, so non-default columns start unchecked.
    await expect(page.getByTestId("checkbox-col-merchantEmail")).not.toBeChecked();

    await page.getByTestId("button-col-select-all").click();

    for (const key of ALL_COLUMNS) {
      await expect(page.getByTestId(`checkbox-col-${key}`)).toBeChecked();
    }
  });

  test("'Clear all' unchecks every column and disables Export CSV", async ({ page }) => {
    await openColumnPicker(page);

    await page.getByTestId("button-col-clear-all").click();

    for (const key of ALL_COLUMNS) {
      await expect(page.getByTestId(`checkbox-col-${key}`)).not.toBeChecked();
    }
    await expect(page.getByTestId("button-export-csv")).toBeDisabled();
  });

  test("'Reset to defaults' restores default selection and order", async ({ page }) => {
    await openColumnPicker(page);

    // Perturb both the selection and the order.
    await page.getByTestId("button-col-select-all").click();
    await expect(page.getByTestId("checkbox-col-merchantEmail")).toBeChecked();
    await dragColumn(page, "merchantName", "id");
    await expect
      .poll(async () => (await getColumnOrder(page)).slice(0, 2).join(","))
      .toBe("merchantName,id");

    await page.getByTestId("button-col-reset-defaults").click();

    // Default columns are checked, everything else is unchecked.
    for (const key of ALL_COLUMNS) {
      const checkbox = page.getByTestId(`checkbox-col-${key}`);
      if (DEFAULT_COLUMNS.includes(key)) {
        await expect(checkbox).toBeChecked();
      } else {
        await expect(checkbox).not.toBeChecked();
      }
    }

    // Order starts with the defaults in order, followed by the remaining columns.
    const order = await getColumnOrder(page);
    const rest = ALL_COLUMNS.filter((k) => !DEFAULT_COLUMNS.includes(k));
    expect(order).toEqual([...DEFAULT_COLUMNS, ...rest]);
  });

  test("selected columns persist across a page reload", async ({ page }) => {
    await openColumnPicker(page);

    // Create a custom selection: clear everything, then pick a few columns.
    await page.getByTestId("button-col-clear-all").click();
    const custom = ["merchantName", "status", "cardBrand"];
    for (const key of custom) {
      await page.getByTestId(`checkbox-col-${key}`).click();
      await expect(page.getByTestId(`checkbox-col-${key}`)).toBeChecked();
    }

    await page.reload();
    await page.getByTestId("button-csv-columns").click();
    await expect(page.getByTestId("column-order-list")).toBeVisible();

    const checked = await getCheckedColumns(page);
    expect(checked.sort()).toEqual([...custom].sort());
  });
});
