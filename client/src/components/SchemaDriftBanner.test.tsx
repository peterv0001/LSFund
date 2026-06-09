import { describe, it, expect, afterEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SchemaDriftBanner } from "./SchemaDriftBanner";

type ColumnDrift = {
  table: string;
  missingColumns: string[];
};

type SchemaHealthResult = {
  healthy: boolean;
  drift: ColumnDrift[];
  checkedAt: string;
};

const SCHEMA_HEALTH_KEY = ["/api/admin/health/schema"] as const;

function mockSchemaHealthFetch(status: number, body: SchemaHealthResult): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      status,
      json: async () => body,
    } as Response),
  );
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function renderBanner(queryClient: QueryClient): string {
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <SchemaDriftBanner />
    </QueryClientProvider>,
  );
}

const driftResult: SchemaHealthResult = {
  healthy: false,
  drift: [
    { table: "subscriptions", missingColumns: ["reactivated_by", "decay_rate"] },
    { table: "commissions", missingColumns: ["holdback_amount"] },
  ],
  checkedAt: new Date("2026-06-09T12:00:00Z").toISOString(),
};

const healthyResult: SchemaHealthResult = {
  healthy: true,
  drift: [],
  checkedAt: new Date("2026-06-09T12:00:00Z").toISOString(),
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("SchemaDriftBanner", () => {
  it("renders the banner with table/column names and the db:push suggestion when the endpoint reports drift (503)", async () => {
    mockSchemaHealthFetch(503, driftResult);

    const queryClient = makeQueryClient();
    await queryClient.prefetchQuery({
      queryKey: SCHEMA_HEALTH_KEY,
      queryFn: () =>
        fetch("/api/admin/health/schema", { credentials: "include" }).then(
          (res) => res.json(),
        ),
    });

    const html = renderBanner(queryClient);

    expect(html).toContain("schema-drift-banner");
    expect(html).toContain("Schema Drift Detected");
    expect(html).toContain("db:push");
    expect(html).toContain("subscriptions");
    expect(html).toContain("reactivated_by");
    expect(html).toContain("decay_rate");
    expect(html).toContain("commissions");
    expect(html).toContain("holdback_amount");
  });

  it("does not render the banner when the endpoint reports a healthy schema (200)", async () => {
    mockSchemaHealthFetch(200, healthyResult);

    const queryClient = makeQueryClient();
    await queryClient.prefetchQuery({
      queryKey: SCHEMA_HEALTH_KEY,
      queryFn: () =>
        fetch("/api/admin/health/schema", { credentials: "include" }).then(
          (res) => res.json(),
        ),
    });

    const html = renderBanner(queryClient);

    expect(html).toBe("");
    expect(html).not.toContain("schema-drift-banner");
  });

  it("auto-dismisses: the banner disappears once the schema becomes healthy after being drifted", async () => {
    const queryClient = makeQueryClient();

    mockSchemaHealthFetch(503, driftResult);
    await queryClient.prefetchQuery({
      queryKey: SCHEMA_HEALTH_KEY,
      queryFn: () =>
        fetch("/api/admin/health/schema", { credentials: "include" }).then(
          (res) => res.json(),
        ),
    });

    const driftedHtml = renderBanner(queryClient);
    expect(driftedHtml).toContain("schema-drift-banner");

    mockSchemaHealthFetch(200, healthyResult);
    await queryClient.refetchQueries({ queryKey: SCHEMA_HEALTH_KEY });

    const healthyHtml = renderBanner(queryClient);
    expect(healthyHtml).toBe("");
    expect(healthyHtml).not.toContain("schema-drift-banner");
  });
});
