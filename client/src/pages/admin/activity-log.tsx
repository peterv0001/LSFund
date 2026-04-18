import { AdminSidebar } from "@/components/AdminSidebar";
import { useQuery } from "@tanstack/react-query";
import { buildUrlWithQuery } from "@shared/routes";
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
  Search,
  X,
  RefreshCw,
  Filter,
  Database,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { useState, useCallback } from "react";

type ActivityEntry = {
  id: number;
  actorId: number;
  actorType: string;
  action: string;
  entityType: string;
  entityId: number;
  description: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

type ActivityLogResponse = {
  logs: ActivityEntry[];
  total: number;
  page: number;
  pageSize: number;
};

type Filters = {
  search: string;
  startDate: string;
  endDate: string;
  entityType: string;
  action: string;
};

const ACTION_OPTIONS = [
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
  { value: "approve", label: "Approve" },
  { value: "reject", label: "Reject" },
  { value: "suspend", label: "Suspend" },
  { value: "activate", label: "Activate" },
  { value: "pause", label: "Pause" },
  { value: "cancel", label: "Cancel" },
  { value: "void", label: "Void" },
  { value: "release", label: "Release" },
  { value: "clawback", label: "Clawback" },
  { value: "apply_migration", label: "Apply Migration" },
  { value: "revert_migration", label: "Revert Migration" },
];

const ENTITY_TYPE_OPTIONS = [
  { value: "agent", label: "Agent" },
  { value: "subscription", label: "Subscription" },
  { value: "deal", label: "Deal" },
  { value: "commission", label: "Commission" },
  { value: "payout", label: "Payout" },
  { value: "holdback", label: "Holdback" },
  { value: "settings", label: "Settings" },
  { value: "announcement", label: "Announcement" },
  { value: "resource", label: "Resource" },
  { value: "migration", label: "Migration" },
];

const ENTITY_ICONS: Record<string, React.ElementType> = {
  agent: User,
  deal: Briefcase,
  commission: DollarSign,
  payout: CreditCard,
  settings: Settings,
  subscription: RefreshCw,
  migration: Database,
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
  pause: "bg-amber-100 text-amber-700",
  cancel: "bg-red-100 text-red-700",
  reactivate: "bg-green-100 text-green-700",
  apply_migration: "bg-purple-100 text-purple-700",
  revert_migration: "bg-orange-100 text-orange-700",
};

function formatAction(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const ACTIVITY_LOG_PATH = "/api/admin/activity-log";

export default function AdminActivityLog() {
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [filters, setFilters] = useState<Filters>({ search: "", startDate: "", endDate: "", entityType: "", action: "" });
  const [appliedFilters, setAppliedFilters] = useState<Filters>({ search: "", startDate: "", endDate: "", entityType: "", action: "" });

  function buildQuery() {
    const q: Record<string, string | number> = { page, pageSize };
    if (appliedFilters.search) q.search = appliedFilters.search;
    if (appliedFilters.startDate) q.startDate = appliedFilters.startDate;
    if (appliedFilters.endDate) q.endDate = appliedFilters.endDate;
    if (appliedFilters.entityType) q.entityType = appliedFilters.entityType;
    if (appliedFilters.action) q.action = appliedFilters.action;
    return q;
  }

  const queryKey = [ACTIVITY_LOG_PATH, page, appliedFilters.search, appliedFilters.startDate, appliedFilters.endDate, appliedFilters.entityType, appliedFilters.action];

  const { data, isLoading } = useQuery<ActivityLogResponse>({
    queryKey,
    queryFn: () =>
      fetch(buildUrlWithQuery(ACTIVITY_LOG_PATH, undefined, buildQuery()), { credentials: "include" })
        .then((r) => {
          if (!r.ok) throw new Error(`${r.status}: ${r.statusText}`);
          return r.json() as Promise<ActivityLogResponse>;
        }),
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const applyFilters = useCallback(() => {
    setPage(1);
    setAppliedFilters({ ...filters });
  }, [filters]);

  function clearFilters() {
    const blank: Filters = { search: "", startDate: "", endDate: "", entityType: "", action: "" };
    setFilters(blank);
    setAppliedFilters(blank);
    setPage(1);
  }

  const hasActiveFilters = appliedFilters.search || appliedFilters.startDate || appliedFilters.endDate || appliedFilters.entityType || appliedFilters.action;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-6 h-6 text-primary" />
              Activity Log
            </h1>
            <p className="text-gray-500 mt-1">
              Audit trail of all admin and system actions
              {total > 0 && ` — ${total.toLocaleString()} entries`}
            </p>
          </div>

          {/* Filters */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-48 space-y-1">
                  <Label htmlFor="log-search">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                    <Input
                      id="log-search"
                      data-testid="input-log-search"
                      placeholder="Search action, entity, description..."
                      className="pl-8"
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="log-entity-type">Entity Type</Label>
                  <Select
                    value={filters.entityType}
                    onValueChange={(val) => setFilters({ ...filters, entityType: val === "all" ? "" : val })}
                  >
                    <SelectTrigger id="log-entity-type" data-testid="select-entity-type" className="w-44">
                      <Filter className="w-4 h-4 mr-1 text-gray-400 shrink-0" />
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {ENTITY_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="log-action">Action</Label>
                  <Select
                    value={filters.action}
                    onValueChange={(val) => setFilters({ ...filters, action: val === "all" ? "" : val })}
                  >
                    <SelectTrigger id="log-action" data-testid="select-action" className="w-40">
                      <SelectValue placeholder="All actions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All actions</SelectItem>
                      {ACTION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="log-start-date">From</Label>
                  <Input
                    id="log-start-date"
                    data-testid="input-log-start-date"
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="log-end-date">To</Label>
                  <Input
                    id="log-end-date"
                    data-testid="input-log-end-date"
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button data-testid="button-apply-filters" onClick={applyFilters}>
                    <Search className="w-4 h-4 mr-1" />
                    Filter
                  </Button>
                  {hasActiveFilters && (
                    <Button variant="outline" data-testid="button-clear-filters" onClick={clearFilters}>
                      <X className="w-4 h-4 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : logs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                {hasActiveFilters ? "No activity matches your filters." : "No activity logged yet."}
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
                                className={`text-xs w-fit ${log.actorType === "admin" ? "border-primary/30 text-primary" : log.actorType === "system" ? "border-gray-300 text-gray-600" : "border-blue-300 text-blue-700"}`}
                              >
                                {log.actorType}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-700"}`}>
                              {formatAction(log.action)}
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
                            {log.description ? (
                              <span className="text-sm text-gray-600">{log.description}</span>
                            ) : log.details ? (
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
