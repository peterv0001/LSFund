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
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export default function AdminSubscriptions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>("all");

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

  const dateThreshold = dateRangeFilter === "all"
    ? null
    : new Date(Date.now() - (dateRangeFilter === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000);

  const filteredSubscriptions = subscriptions.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (dateThreshold && getChangedAt(s) < dateThreshold) return false;
    return true;
  });

  const showAgentSummary =
    (statusFilter === "paused" || statusFilter === "cancelled") &&
    dateRangeFilter !== "all";

  const agentSummary: { agentId: number; name: string; count: number }[] = showAgentSummary
    ? Object.values(
        filteredSubscriptions.reduce<Record<number, { agentId: number; name: string; count: number }>>(
          (acc, sub) => {
            const id = sub.agentId;
            const name = sub.agent?.firstName
              ? `${sub.agent.firstName} ${sub.agent.lastName}`
              : `Agent #${id}`;
            if (!acc[id]) acc[id] = { agentId: id, name, count: 0 };
            acc[id].count += 1;
            return acc;
          },
          {}
        )
      ).sort((a, b) => b.count - a.count)
    : [];

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

            {(statusFilter !== "all" || dateRangeFilter !== "all") && (
              <span className="text-sm text-gray-500" data-testid="text-filter-count">
                {filteredSubscriptions.length} result{filteredSubscriptions.length !== 1 ? "s" : ""}
              </span>
            )}
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
                {statusFilter === "all" && dateRangeFilter === "all"
                  ? "No subscriptions found."
                  : `No ${statusFilter === "all" ? "" : statusFilter + " "}subscriptions found${dateRangeFilter !== "all" ? ` in the last ${dateRangeFilter === "7d" ? "7" : "30"} days` : ""}.`}
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
                              <p className="text-xs text-gray-400 mt-1" data-testid={`text-paused-at-${sub.id}`}>
                                {format(new Date(sub.pausedAt), "MMM d, yyyy")}
                                {sub.pausedBy && (
                                  <span className="block text-gray-400" data-testid={`text-paused-by-${sub.id}`}>
                                    by {sub.pausedBy.firstName} {sub.pausedBy.lastName}
                                  </span>
                                )}
                              </p>
                            )}
                            {sub.status === "active" && sub.reactivatedAt && (
                              <p className="text-xs text-gray-400 mt-1" data-testid={`text-reactivated-at-${sub.id}`}>
                                Reactivated {format(new Date(sub.reactivatedAt), "MMM d, yyyy")}
                                {sub.reactivatedBy && (
                                  <span className="block text-gray-400" data-testid={`text-reactivated-by-${sub.id}`}>
                                    by {sub.reactivatedBy.firstName} {sub.reactivatedBy.lastName}
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
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
    </div>
  );
}
