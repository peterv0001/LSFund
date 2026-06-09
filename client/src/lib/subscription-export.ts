export interface SubscriptionExportRow {
  status: string;
  monthlyAmount: string;
}

const STATUS_ORDER = ["active", "paused", "cancelled", "expired"];

function formatDollars(amount: number): string {
  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function buildSubscriptionExportCsv<
  S extends SubscriptionExportRow,
  K extends string,
>(opts: {
  cols: { key: K; label: string }[];
  subscriptions: S[];
  getCellValue: (key: K, s: S) => string;
  metaLines: string[];
}): string {
  const { cols, subscriptions, getCellValue, metaLines } = opts;

  const headers = cols.map((c) => c.label);
  const rows = subscriptions.map((s) =>
    cols.map((c) => `"${getCellValue(c.key, s).replace(/"/g, '""')}"`).join(","),
  );

  const totalAmount = subscriptions.reduce(
    (sum, s) => sum + Number(s.monthlyAmount),
    0,
  );
  const formattedTotal = formatDollars(totalAmount);

  const statusCounts: Record<string, number> = {};
  const statusMrr: Record<string, number> = {};
  for (const s of subscriptions) {
    statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1;
    statusMrr[s.status] = (statusMrr[s.status] ?? 0) + Number(s.monthlyAmount);
  }
  const orderedStatuses = [
    ...STATUS_ORDER.filter((st) => statusCounts[st]),
    ...Object.keys(statusCounts).filter((st) => !STATUS_ORDER.includes(st)),
  ];
  const statusBreakdown = orderedStatuses
    .map((st) => `${statusCounts[st]} ${st}`)
    .join(", ");
  const mrrBreakdown = orderedStatuses
    .map((st) => `${formatDollars(statusMrr[st] ?? 0)} ${st}`)
    .join(", ");

  const totalLabel = `${subscriptions.length} total`;
  const countLabel = statusBreakdown
    ? `${totalLabel} (${statusBreakdown})`
    : totalLabel;

  const summaryValues = cols.map((c, i) => {
    if (i === 0) return "Total";
    if (c.key === "monthlyAmount") return formattedTotal;
    if (c.key === "status") return countLabel;
    return "";
  });
  const summaryRow = summaryValues
    .map((v) => `"${v.replace(/"/g, '""')}"`)
    .join(",");

  const mrrBreakdownValues = cols.map((c, i) => {
    if (i === 0) return "MRR by Status";
    if (c.key === "monthlyAmount") return mrrBreakdown;
    return "";
  });
  const mrrBreakdownRow = mrrBreakdownValues
    .map((v) => `"${v.replace(/"/g, '""')}"`)
    .join(",");

  return [
    ...metaLines,
    headers.join(","),
    ...rows,
    summaryRow,
    mrrBreakdownRow,
  ].join("\n");
}
