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

type Subscription = {
  id: number;
  agentId: number;
  merchantName: string;
  merchantEmail: string | null;
  tier: "tier_1" | "tier_2" | "tier_3";
  monthlyAmount: string;
  status: "active" | "paused" | "cancelled" | "expired";
  mcaPairedDealId: number | null;
  startDate: string;
  cancelledAt: string | null;
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

export default function AdminSubscriptions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <RefreshCw className="w-6 h-6 text-amber-500" />
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
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-amber-600" />
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

          {/* Table */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          ) : subscriptions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                No subscriptions found.
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
                      <TableHead>Agent ID</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Monthly</TableHead>
                      <TableHead>Paired Deal</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscriptions.map((sub) => (
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
                        <TableCell>#{sub.agentId}</TableCell>
                        <TableCell className="text-sm">
                          {TIER_LABELS[sub.tier] ?? sub.tier}
                        </TableCell>
                        <TableCell className="font-medium">
                          ${Number(sub.monthlyAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          {sub.mcaPairedDealId ? (
                            <span className="text-amber-600">#{sub.mcaPairedDealId}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {format(new Date(sub.startDate), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[sub.status] ?? ""}>
                            {sub.status}
                          </Badge>
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
