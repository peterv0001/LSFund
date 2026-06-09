import { describe, it, expect } from "vitest";
import {
  buildSubscriptionExportCsv,
  type SubscriptionExportRow,
} from "./subscription-export";

type TestSub = SubscriptionExportRow & {
  id: number;
  merchantName: string;
};

const cols = [
  { key: "merchantName", label: "Merchant Name" },
  { key: "monthlyAmount", label: "Monthly Amount" },
  { key: "status", label: "Status" },
] as const;

const getCellValue = (key: (typeof cols)[number]["key"], s: TestSub): string => {
  switch (key) {
    case "merchantName":
      return s.merchantName;
    case "monthlyAmount":
      return s.monthlyAmount;
    case "status":
      return s.status;
  }
};

function build(subscriptions: TestSub[]): string {
  return buildSubscriptionExportCsv({
    cols: [...cols],
    subscriptions,
    getCellValue,
    metaLines: [],
  });
}

describe("buildSubscriptionExportCsv MRR breakdown", () => {
  const subscriptions: TestSub[] = [
    { id: 1, merchantName: "Acme", monthlyAmount: "199.00", status: "active" },
    { id: 2, merchantName: "Globex", monthlyAmount: "399.00", status: "active" },
    { id: 3, merchantName: "Initech", monthlyAmount: "199.00", status: "paused" },
    { id: 4, merchantName: "Umbrella", monthlyAmount: "799.00", status: "cancelled" },
  ];

  it("includes a Total summary row with the summed MRR", () => {
    const lines = build(subscriptions).split("\n");
    const totalRow = lines.find((l) => l.startsWith('"Total"'));
    expect(totalRow).toBeDefined();
    // 199 + 399 + 199 + 799 = 1596
    expect(totalRow).toContain('"$1,596.00"');
    // count breakdown by status
    expect(totalRow).toContain("4 total");
    expect(totalRow).toContain("2 active, 1 paused, 1 cancelled");
  });

  it("includes an 'MRR by Status' row with correct dollar amounts per status", () => {
    const lines = build(subscriptions).split("\n");
    const mrrRow = lines.find((l) => l.startsWith('"MRR by Status"'));
    expect(mrrRow).toBeDefined();
    // active: 199 + 399 = 598, paused: 199, cancelled: 799
    expect(mrrRow).toContain(
      '"$598.00 active, $199.00 paused, $799.00 cancelled"',
    );
  });

  it("orders statuses active, paused, cancelled, expired in the MRR row", () => {
    const withExpired: TestSub[] = [
      ...subscriptions,
      { id: 5, merchantName: "Soylent", monthlyAmount: "199.00", status: "expired" },
    ];
    const lines = build(withExpired).split("\n");
    const mrrRow = lines.find((l) => l.startsWith('"MRR by Status"'))!;
    const activeIdx = mrrRow.indexOf("active");
    const pausedIdx = mrrRow.indexOf("paused");
    const cancelledIdx = mrrRow.indexOf("cancelled");
    const expiredIdx = mrrRow.indexOf("expired");
    expect(activeIdx).toBeLessThan(pausedIdx);
    expect(pausedIdx).toBeLessThan(cancelledIdx);
    expect(cancelledIdx).toBeLessThan(expiredIdx);
    expect(mrrRow).toContain("$199.00 expired");
  });

  it("places the MRR by Status row immediately after the Total row", () => {
    const lines = build(subscriptions).split("\n");
    const totalIdx = lines.findIndex((l) => l.startsWith('"Total"'));
    const mrrIdx = lines.findIndex((l) => l.startsWith('"MRR by Status"'));
    expect(totalIdx).toBeGreaterThanOrEqual(0);
    expect(mrrIdx).toBe(totalIdx + 1);
  });

  it("renders only Total and MRR rows (no status counts) for a single active sub", () => {
    const single: TestSub[] = [
      { id: 9, merchantName: "Solo", monthlyAmount: "429.50", status: "active" },
    ];
    const lines = build(single).split("\n");
    const totalRow = lines.find((l) => l.startsWith('"Total"'))!;
    const mrrRow = lines.find((l) => l.startsWith('"MRR by Status"'))!;
    expect(totalRow).toContain('"$429.50"');
    expect(totalRow).toContain("1 total (1 active)");
    expect(mrrRow).toContain('"$429.50 active"');
  });
});
