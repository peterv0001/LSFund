import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Database } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type ColumnDrift = {
  table: string;
  missingColumns: string[];
};

type SchemaHealthResult = {
  healthy: boolean;
  drift: ColumnDrift[];
  checkedAt: string;
};

async function fetchSchemaHealth(): Promise<SchemaHealthResult> {
  const res = await fetch("/api/admin/health/schema", { credentials: "include" });
  if (res.status === 200 || res.status === 503) {
    return res.json();
  }
  throw new Error(`Unexpected response: ${res.status}`);
}

export function SchemaDriftBanner() {
  const { data } = useQuery<SchemaHealthResult>({
    queryKey: ["/api/admin/health/schema"],
    queryFn: fetchSchemaHealth,
    refetchInterval: 30_000,
    retry: false,
  });

  if (!data || data.healthy) return null;

  return (
    <Alert
      variant="destructive"
      className="mb-6 border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
      data-testid="schema-drift-banner"
    >
      <AlertTriangle className="h-4 w-4 !text-amber-600" />
      <AlertTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-semibold">
        <Database className="h-4 w-4" />
        Schema Drift Detected
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-2 text-amber-800 dark:text-amber-200">
        <p>
          The database schema is out of sync with the application code.{" "}
          <span className="font-medium">
            Run{" "}
            <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded text-xs">
              npm run db:push
            </code>{" "}
            to fix this.
          </span>
        </p>
        <ul className="mt-2 space-y-1 text-sm" data-testid="schema-drift-list">
          {data.drift.map((item) => (
            <li key={item.table} className="flex flex-wrap gap-x-2">
              <span
                className="font-mono font-semibold"
                data-testid={`drift-table-${item.table}`}
              >
                {item.table}
              </span>
              <span className="text-amber-700 dark:text-amber-300">
                missing:{" "}
                {item.missingColumns.map((col, i) => (
                  <span key={col}>
                    <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded text-xs">
                      {col}
                    </code>
                    {i < item.missingColumns.length - 1 ? ", " : ""}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
          Last checked:{" "}
          {new Date(data.checkedAt).toLocaleTimeString()}. This banner will
          dismiss automatically once the schema is healthy.
        </p>
      </AlertDescription>
    </Alert>
  );
}
