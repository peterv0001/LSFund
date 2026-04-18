import { AdminSidebar } from "@/components/AdminSidebar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import {
  RefreshCw,
  Loader2,
  DollarSign,
  Users,
  TrendingUp,
  Zap,
  Filter,
  Clock,
  X,
  Download,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useState } from "react";

type Agent = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
};

type Subscription = {
  id: number;
  agentId: number;
  agent?: Agent;
  merchantName: string;
  merchantEmail: string | null;
  tier: "tier_1" | "tier_2" | "tier_3";
  monthlyAmount: string;
  status: "active" | "paused" | "cancelled" | "expired";
  mcaPairedDealId: number | null;
  startDate: string;
  cancelledAt: string | null;
  pausedAt: string | null;
  reactivatedAt: string | null;
  cancelledById: number | null;
  pausedById: number | null;
  reactivatedById: number | null;
  pausedBy: Agent | null;
  cancelledBy: Agent | null;
  reactivatedBy: Agent | null;
  createdAt: string;
  updatedAt: string;
};

type ActivityEntry = {
  id: number;
  actorId: number;
  actorType: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: number;
  description: string | null;
  createdAt: string;
};

const ACTION_LABELS: Record<string, string> = {
  pause: "Paused",
  cancel: "Cancelled",
  reactivate: "Reactivated",
};

const ACTION_COLORS: Record<string, string> = {
  pause: "bg-yellow-100 text-yellow-700",
  cancel: "bg-red-100 text-red-700",
  reactivate: "bg-green-100 text-green-700",
};

const TIER_LABELS: Record<string, string> = {
  tier_1: "Tier 1 — $199/mo",
  tier_2: "Tier 2 — $399/mo",
  tier_3: "Tier 3 — $799/mo",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-700",
  expired: "bg-gray-100 text-gray-500",
};

type StatusFilter = "all" | "active" | "paused" | "cancelled" | "expired";
type DateRangeFilter = "all" | "7d" | "30d";

function getChangedAt(sub: Subscription): Date {
  if (sub.status === "cancelled" && sub.cancelledAt) return new Date(sub.cancelledAt);
  return new Date(sub.updatedAt);
}

type AgentSummary = {
  agentId: number;
  agentName: string;
  cancelledCount: number;
  pausedCount: number;
};

function buildAgentSummary(subscriptions: Subscription[]): AgentSummary[] {
  const map = new Map<number, AgentSummary>();
  for (const sub of subscriptions) {
    if (sub.status !== "cancelled" && sub.status !== "paused") continue;
    const agentId = sub.agentId;
    if (!map.has(agentId)) {
      const name = sub.agent
        ? `${sub.agent.firstName} ${sub.agent.lastName}`
        : `Agent #${agentId}`;
      map.set(agentId, { agentId, agentName: name, cancelledCount: 0, pausedCount: 0 });
    }
    const entry = map.get(agentId)!;
    if (sub.status === "cancelled") entry.cancelledCount++;
    if (sub.status === "paused") entry.pausedCount++;
  }
  return Array.from(map.values()).sort((a, b) =>
    (b.cancelledCount + b.pausedCount) - (a.cancelledCount + a.pausedCount)
  );
}

export default function AdminSubscriptions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>("all");
  const [agentFilter, setAgentFilter] = useState<number | null>(null);
  const [historySubId, setHistorySubId] = useState<number | null>(null);

  const { data: historyEntries = [], isLoading: historyLoading } = useQuery<ActivityEntry[]>({
    queryKey: [api.admin.subscriptions.activity.path, historySubId],
    queryFn: historySubId != null
      ? () => fetch(buildUrl(api.admin.subscriptions.activity.path, { id: historySubId }), { credentials: "include" }).then(r => r.json())
      : undefined,
    enabled: historySubId != null,
  });

  const { data: subscriptions = [], isLoading } = useQuery<Subscription[]>({
    queryKey: [api.admin.subscriptions.list.path],
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", buildUrl(api.admin.subscriptions.updateStatus.path, { id }), { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.subscriptions.list.path] });
      toast({ title: "Subscription status updated" });
    },
    onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
  });

  const calcCommissionsMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", api.admin.subscriptions.calculateCommissions.path)
        .then((res): Promise<{ processed: number; totalActive: number }> => res.json()),
    onSuccess: (data) => {
      toast({ title: `Calculated commissions for ${data.processed} of ${data.totalActive} active subscriptions` });
    },
    onError: () => toast({ title: "Failed to calculate commissions", variant: "destructive" }),
  });

  const activeCount = subscriptions.filter((s) => s.status === "active").length;
  const mrr = subscriptions
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + Number(s.monthlyAmount), 0);
  const totalSubs = subscriptions.length;

  const agentSummary = buildAgentSummary(subscriptions);

  const dateThreshold = dateRangeFilter === "all"
    ? null
    : new Date(Date.now() - (dateRangeFilter === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000);

  const filteredSubscriptions = subscriptions.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (dateThreshold && getChangedAt(s) < dateThreshold) return false;
    if (agentFilter !== null && s.agentId !== agentFilter) return false;
    return true;
  });

  const selectedAgentSummary = agentFilter !== null
    ? agentSummary.find((a) => a.agentId === agentFilter) ?? null
    : null;

  const hasActiveFilters = statusFilter !== "all" || dateRangeFilter !== "all" || agentFilter !== null;

  function exportCsv() {
    const headers = ["ID", "Merchant Name", "Agent Name", "Tier", "Monthly Amount", "Status", "Change Date"];
    const rows = filteredSubscriptions.map((s) => {
      const agentName = s.agent?.firstName
        ? `${s.agent.firstName} ${s.agent.lastName}`
        : `#${s.agentId}`;
      const changeDate = s.status === "cancelled" && s.cancelledAt
        ? format(new Date(s.cancelledAt), "yyyy-MM-dd")
        : s.status === "paused" && s.pausedAt
          ? format(new Date(s.pausedAt), "yyyy-MM-dd")
          : format(new Date(s.updatedAt), "yyyy-MM-dd");
      return [
        s.id,
        s.merchantName,
        agentName,
        TIER_LABELS[s.tier] ?? s.tier,
        s.monthlyAmount,
        s.status,
        changeDate,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const totalAmount = filteredSubscriptions.reduce((sum, s) => sum + Number(s.monthlyAmount), 0);
    const formattedTotal = `$${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const countLabel = `${filteredSubscriptions.length} subscription${filteredSubscriptions.length !== 1 ? "s" : ""}`;
    const summaryRow = ["Total", "", "", "", formattedTotal, countLabel, ""]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    const csv = [headers.join(","), ...rows, summaryRow].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subscriptions-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <RefreshCw className="w-6 h-6 text-primary" />
                Subscriptions
              </h1>
              <p className="text-gray-500 mt-1">Manage merchant subscriptions and commission payouts</p>
            </div>
            <Button
              data-testid="button-calc-commissions"
              onClick={() => calcCommissionsMutation.mutate()}
              disabled={calcCommissionsMutation.isPending}
            >
              {calcCommissionsMutation.isPending
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Zap className="w-4 h-4 mr-2" />
              }
              Calculate Commissions
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <Users className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Active</p>
                    <p className="text-2xl font-bold text-gray-900" data-testid="text-active-count">{activeCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">MRR</p>
                    <p className="text-2xl font-bold text-gray-900" data-testid="text-mrr">
                      ${mrr.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Subscriptions</p>
                    <p className="text-2xl font-bold text-gray-900" data-testid="text-total-subs">{totalSubs}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Agent Summary Panel */}
          {agentSummary.length > 0 && (
            <Card className="mb-6">
              <CardHeader className="pb-3 pt-4 px-5">
                <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-500" />
                  Agent Activity — Cancellations &amp; Pauses
                  <span className="text-xs font-normal text-gray-400 ml-1">Click an agent to filter the table</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="flex flex-wrap gap-2" data-testid="agent-summary-panel">
                  {agentSummary.map((summary) => {
                    const isSelected = agentFilter === summary.agentId;
                    return (
                      <button
                        key={summary.agentId}
                        data-testid={`chip-agent-${summary.agentId}`}
                        onClick={() => setAgentFilter(isSelected ? null : summary.agentId)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-primary text-white border-primary shadow-sm"
                            : "bg-white text-gray-700 border-gray-200 hover:border-primary hover:text-primary"
                        }`}
                        aria-pressed={isSelected}
                      >
                        <span>{summary.agentName}</span>
                        {summary.cancelledCount > 0 && (
                          <span
                            data-testid={`chip-agent-cancelled-${summary.agentId}`}
                            className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full ${
                              isSelected
                                ? "bg-white/20 text-white"
                                : "bg-red-100 text-red-600"
                            }`}
                          >
                            {summary.cancelledCount} cancelled
                          </span>
                        )}
                        {summary.pausedCount > 0 && (
                          <span
                            data-testid={`chip-agent-paused-${summary.agentId}`}
                            className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full ${
                              isSelected
                                ? "bg-white/20 text-white"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {summary.pausedCount} paused
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Filter by status:</span>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger className="w-44 h-9 text-sm" data-testid="select-status-filter">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 ml-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-600">Recently changed:</span>
              <Select
                value={dateRangeFilter}
                onValueChange={(v) => setDateRangeFilter(v as DateRangeFilter)}
              >
                <SelectTrigger className="w-40 h-9 text-sm" data-testid="select-date-range-filter">
                  <SelectValue placeholder="All time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {agentFilter !== null && selectedAgentSummary && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium"
                data-testid="agent-filter-indicator"
              >
                <Users className="w-3.5 h-3.5" />
                <span>{selectedAgentSummary.agentName}</span>
                <button
                  data-testid="button-clear-agent-filter"
                  onClick={() => setAgentFilter(null)}
                  className="ml-0.5 hover:text-primary/70 transition-colors"
                  aria-label="Clear agent filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {hasActiveFilters && (
              <span className="text-sm text-gray-500" data-testid="text-filter-count">
                {filteredSubscriptions.length} result{filteredSubscriptions.length !== 1 ? "s" : ""}
              </span>
            )}

            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              data-testid="button-export-csv"
              onClick={exportCsv}
              disabled={filteredSubscriptions.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {/* Agent Summary Panel */}
          {showAgentSummary && !isLoading && agentSummary.length > 0 && (
            <Card className="mb-4 border-l-4 border-l-primary" data-testid="panel-agent-summary">
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  {statusFilter === "cancelled" ? "Cancellations" : "Pauses"} by agent
                  {" — "}
                  {dateRangeFilter === "7d" ? "last 7 days" : "last 30 days"}
                </p>
                <div className="flex flex-wrap gap-3">
                  {agentSummary.map((entry) => (
                    <div
                      key={entry.agentId}
                      className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2"
                      data-testid={`summary-agent-${entry.agentId}`}
                    >
                      <span className="text-sm font-medium text-gray-800">{entry.name}</span>
                      <Badge
                        className={
                          statusFilter === "cancelled"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }
                        data-testid={`summary-count-${entry.agentId}`}
                      >
                        {entry.count}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Table */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredSubscriptions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                {!hasActiveFilters
                  ? "No subscriptions found."
                  : `No ${statusFilter === "all" ? "" : statusFilter + " "}subscriptions found${agentFilter !== null && selectedAgentSummary ? ` for ${selectedAgentSummary.agentName}` : ""}${dateRangeFilter !== "all" ? ` in the last ${dateRangeFilter === "7d" ? "7" : "30"} days` : ""}.`}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Merchant</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Monthly</TableHead>
                      <TableHead>Paired Deal</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubscriptions.map((sub) => (
                      <TableRow key={sub.id} data-testid={`row-subscription-${sub.id}`}>
                        <TableCell className="font-mono text-sm">#{sub.id}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{sub.merchantName}</p>
                            {sub.merchantEmail && (
                              <p className="text-xs text-gray-400">{sub.merchantEmail}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            {sub.agent?.firstName ? (
                              <>
                                <p className="font-medium text-sm" data-testid={`text-agent-name-${sub.id}`}>{sub.agent.firstName} {sub.agent.lastName}</p>
                                <p className="text-xs text-gray-400">#{sub.agentId}</p>
                              </>
                            ) : (
                              <span className="text-sm text-gray-500">#{sub.agentId}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {TIER_LABELS[sub.tier] ?? sub.tier}
                        </TableCell>
                        <TableCell className="font-medium">
                          ${Number(sub.monthlyAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          {sub.mcaPairedDealId ? (
                            <span className="text-primary font-medium">#{sub.mcaPairedDealId}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {format(new Date(sub.startDate), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <div>
                            <Badge className={STATUS_COLORS[sub.status] ?? ""}>
                              {sub.status}
                            </Badge>
                            {sub.status === "cancelled" && sub.cancelledAt && (
                              <p className="text-xs text-red-500 font-medium mt-1" data-testid={`text-cancelled-at-${sub.id}`}>
                                Cancelled on {format(new Date(sub.cancelledAt), "MMM d, yyyy")}
                                {sub.cancelledBy && (
                                  <span className="block text-gray-400 font-normal" data-testid={`text-cancelled-by-${sub.id}`}>
                                    by {sub.cancelledBy.firstName} {sub.cancelledBy.lastName}
                                  </span>
                                )}
                              </p>
                            )}
                            {sub.status === "paused" && sub.pausedAt && (
                              <p className="text-xs text-yellow-600 font-medium mt-1" data-testid={`text-paused-at-${sub.id}`}>
                                Paused on {format(new Date(sub.pausedAt), "MMM d, yyyy")}
                                {sub.pausedBy && (
                                  <span className="block text-gray-400 font-normal" data-testid={`text-paused-by-${sub.id}`}>
                                    by {sub.pausedBy.firstName} {sub.pausedBy.lastName}
                                  </span>
                                )}
                              </p>
                            )}
                            {sub.status === "active" && sub.reactivatedAt && (
                              <p className="text-xs text-green-600 mt-1" data-testid={`text-reactivated-at-${sub.id}`}>
                                Reactivated on {format(new Date(sub.reactivatedAt), "MMM d, yyyy")}
                                {sub.reactivatedBy && (
                                  <span className="block text-gray-400 font-normal" data-testid={`text-reactivated-by-${sub.id}`}>
                                    by {sub.reactivatedBy.firstName} {sub.reactivatedBy.lastName}
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Select
                              value={sub.status}
                              onValueChange={(v) => updateStatusMutation.mutate({ id: sub.id, status: v })}
                            >
                              <SelectTrigger
                                className="w-36 h-8 text-sm"
                                data-testid={`select-status-${sub.id}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="paused">Paused</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                                <SelectItem value="expired">Expired</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-400 hover:text-primary"
                              title="View history"
                              data-testid={`button-history-${sub.id}`}
                              onClick={() => setHistorySubId(sub.id)}
                            >
                              <History className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </div>
      </main>

      {/* Subscription History Dialog */}
      <Dialog open={historySubId != null} onOpenChange={(open) => { if (!open) setHistorySubId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Subscription History
              {historySubId != null && (
                <span className="text-sm font-normal text-gray-500 ml-1">
                  — #{historySubId} {subscriptions.find(s => s.id === historySubId)?.merchantName ? `· ${subscriptions.find(s => s.id === historySubId)!.merchantName}` : ""}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-2" data-testid="subscription-history-panel">
            {historyLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : historyEntries.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No pause or cancel events recorded for this subscription.</p>
            ) : (
              <ol className="relative border-l border-gray-200 ml-3 space-y-4">
                {historyEntries.map((entry) => (
                  <li key={entry.id} className="ml-4" data-testid={`history-entry-${entry.id}`}>
                    <span className="absolute -left-1.5 mt-1 w-3 h-3 rounded-full bg-primary border-2 border-white" />
                    <div className="flex items-start gap-2 flex-wrap">
                      <Badge
                        className={`text-xs ${ACTION_COLORS[entry.action] ?? "bg-gray-100 text-gray-600"}`}
                        data-testid={`text-history-action-${entry.id}`}
                      >
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </Badge>
                      <span className="text-sm font-medium text-gray-800" data-testid={`text-history-actor-${entry.id}`}>
                        {entry.actorName}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5" data-testid={`text-history-date-${entry.id}`}>
                      {format(new Date(entry.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                    {entry.description && (
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{entry.description}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
