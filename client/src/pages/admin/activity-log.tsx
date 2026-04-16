import { AdminSidebar } from "@/components/AdminSidebar";
import { useQuery } from "@tanstack/react-query";
import { api, buildUrlWithQuery } from "@shared/routes";
import {
  Activity,
  Loader2,
  ChevronLeft,
  ChevronRight,
  User,
  Settings,
  Briefcase,
  DollarSign,
  CreditCard,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useState } from "react";

type ActivityEntry = {
  id: number;
  actorId: number;
  actorType: string;
  action: string;
  entityType: string;
  entityId: number;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

const ENTITY_ICONS: Record<string, React.ElementType> = {
  agent: User,
  deal: Briefcase,
  commission: DollarSign,
  payout: CreditCard,
  settings: Settings,
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-700",
  update: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
  approve: "bg-emerald-100 text-emerald-700",
  reject: "bg-red-100 text-red-700",
  suspend: "bg-orange-100 text-orange-700",
  activate: "bg-green-100 text-green-700",
  void: "bg-red-100 text-red-700",
  release: "bg-cyan-100 text-cyan-700",
  clawback: "bg-red-100 text-red-700",
};

export default function AdminActivityLog() {
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data, isLoading } = useQuery<{
    logs: ActivityEntry[];
    total: number;
    page: number;
    pageSize: number;
  }>({
    queryKey: [api.admin.activityLog.list.path, page],
    queryFn: () =>
      fetch(buildUrlWithQuery(api.admin.activityLog.list.path, undefined, { page, pageSize }))
        .then((r) => r.json()),
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-6 h-6 text-amber-500" />
              Activity Log
            </h1>
            <p className="text-gray-500 mt-1">
              Audit trail of all admin and system actions
              {total > 0 && ` — ${total.toLocaleString()} entries`}
            </p>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          ) : logs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                No activity logged yet.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const Icon = ENTITY_ICONS[log.entityType] ?? Activity;
                      return (
                        <TableRow key={log.id} data-testid={`row-activity-${log.id}`}>
                          <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                            {format(new Date(log.createdAt), "MMM d, HH:mm:ss")}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">#{log.actorId}</span>
                              <Badge
                                variant="outline"
                                className={`text-xs w-fit ${log.actorType === "admin" ? "border-amber-300 text-amber-700" : log.actorType === "system" ? "border-gray-300 text-gray-600" : "border-blue-300 text-blue-700"}`}
                              >
                                {log.actorType}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-700"} capitalize`}>
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-sm">
                              <Icon className="w-4 h-4 text-gray-400" />
                              <span className="capitalize">{log.entityType}</span>
                              <span className="text-gray-400">#{log.entityId}</span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            {log.details ? (
                              <pre className="text-xs text-gray-500 bg-gray-50 rounded p-1 overflow-hidden text-ellipsis max-h-16">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-gray-400 font-mono">
                            {log.ipAddress ?? "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
                    Page {page} of {totalPages} ({total.toLocaleString()} entries)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid="button-prev-page"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid="button-next-page"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
