import { AdminSidebar } from "@/components/AdminSidebar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import {
  Lock,
  Loader2,
  Unlock,
  AlertTriangle,
  RefreshCw,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useState, useCallback } from "react";
import { useSearch, useLocation } from "wouter";

type HoldbackAgent = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
};

type HoldbackEntry = {
  id: number;
  dealId: number;
  agentId: number;
  commissionId: number | null;
  totalAmount: string;
  releasedAmount: string;
  clawbackAmount: string;
  status: "held" | "partially_released" | "released" | "clawed_back";
  releaseDate: string | null;
  clawbackDate: string | null;
  clawbackReason: string | null;
  createdAt: string;
  updatedAt: string;
  agent: HoldbackAgent;
  dealName: string | null;
};

type ReleaseEligibleResponse = {
  released: number;
  processed: number;
};

const STATUS_COLORS: Record<string, string> = {
  held: "bg-yellow-100 text-yellow-700",
  partially_released: "bg-blue-100 text-blue-700",
  released: "bg-green-100 text-green-700",
  clawed_back: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  held: "Held",
  partially_released: "Partial",
  released: "Released",
  clawed_back: "Clawed Back",
};

export default function AdminHoldbacks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const search = useSearch();
  const [, setLocation] = useLocation();

  const [statusFilter, setStatusFilter] = useState<string>(() => {
    const params = new URLSearchParams(search);
    const s = params.get("status");
    return s && s !== "all" ? s : "all";
  });

  const updateStatusInUrl = useCallback((status: string) => {
    const params = new URLSearchParams(window.location.search);
    if (status === "all") {
      params.delete("status");
    } else {
      params.set("status", status);
    }
    const qs = params.toString();
    setLocation(qs ? `${window.location.pathname}?${qs}` : window.location.pathname, { replace: true });
  }, [setLocation]);
  const [clawbackDialog, setClawbackDialog] = useState<HoldbackEntry | null>(null);
  const [clawbackReason, setClawbackReason] = useState("");
  const [clawbackPct, setClawbackPct] = useState("100");

  const { data: holdbacks = [], isLoading } = useQuery<HoldbackEntry[]>({
    queryKey: [api.admin.holdbacks.list.path],
  });

  const releaseMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("POST", buildUrl(api.admin.holdbacks.release.path, { id })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.holdbacks.list.path] });
      toast({ title: "Holdback released successfully" });
    },
    onError: () => toast({ title: "Failed to release holdback", variant: "destructive" }),
  });

  const releaseEligibleMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", api.admin.holdbacks.releaseEligible.path).then(
        (res): Promise<ReleaseEligibleResponse> => res.json()
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.admin.holdbacks.list.path] });
      toast({ title: `Released ${data.released} eligible holdbacks` });
    },
    onError: () => toast({ title: "Failed to release eligible holdbacks", variant: "destructive" }),
  });

  const clawbackMutation = useMutation({
    mutationFn: ({ id, reason, percentage }: { id: number; reason: string; percentage: number }) =>
      apiRequest("POST", buildUrl(api.admin.holdbacks.clawback.path, { id }), { reason, percentage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.holdbacks.list.path] });
      toast({ title: "Clawback applied" });
      setClawbackDialog(null);
      setClawbackReason("");
      setClawbackPct("100");
    },
    onError: () => toast({ title: "Failed to apply clawback", variant: "destructive" }),
  });

  const filtered = statusFilter === "all"
    ? holdbacks
    : holdbacks.filter((h) => h.status === statusFilter);

  const totalHeld = holdbacks
    .filter((h) => h.status === "held" || h.status === "partially_released")
    .reduce((sum, h) => sum + (Number(h.totalAmount) - Number(h.releasedAmount)), 0);

  const totalClawbacks = holdbacks
    .filter((h) => h.status === "clawed_back")
    .reduce((sum, h) => sum + Number(h.clawbackAmount), 0);

  const eligibleCount = holdbacks.filter(
    (h) => (h.status === "held" || h.status === "partially_released") && h.releaseDate && new Date(h.releaseDate) <= new Date()
  ).length;

  function releasePercent(h: HoldbackEntry): string {
    const total = Number(h.totalAmount);
    if (total === 0) return "0%";
    return `${((Number(h.releasedAmount) / total) * 100).toFixed(0)}%`;
  }

  function agentName(h: HoldbackEntry): string {
    if (!h.agent) return `Agent #${h.agentId}`;
    return `${h.agent.firstName} ${h.agent.lastName}`;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Lock className="w-6 h-6 text-primary" />
                Holdbacks & Clawbacks
              </h1>
              <p className="text-gray-500 mt-1">Manage deferred commissions and clawback enforcement</p>
            </div>
            <Button
              data-testid="button-release-eligible"
              onClick={() => releaseEligibleMutation.mutate()}
              disabled={releaseEligibleMutation.isPending || eligibleCount === 0}
            >
              {releaseEligibleMutation.isPending
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <RefreshCw className="w-4 h-4 mr-2" />
              }
              Release Eligible ({eligibleCount})
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-gray-500 mb-1">Total Held</p>
                <p className="text-2xl font-bold text-gray-900" data-testid="text-total-held">
                  ${totalHeld.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-gray-500 mb-1">Total Clawbacks</p>
                <p className="text-2xl font-bold text-red-600" data-testid="text-total-clawbacks">
                  ${totalClawbacks.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-gray-500 mb-1">Eligible for Release</p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-eligible-count">
                  {eligibleCount}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2 mb-4">
            {["all", "held", "partially_released", "released", "clawed_back"].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                data-testid={`button-filter-${s}`}
                onClick={() => { setStatusFilter(s); updateStatusInUrl(s); }}
                className="capitalize"
              >
                {s === "all" ? "All" : STATUS_LABELS[s] ?? s}
              </Button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>Deal / Merchant</TableHead>
                      <TableHead>Total Held</TableHead>
                      <TableHead>Released</TableHead>
                      <TableHead>Release %</TableHead>
                      <TableHead>Clawback</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Release Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-12 text-center text-gray-500">
                          No holdbacks found matching the selected filter.
                        </TableCell>
                      </TableRow>
                    ) : filtered.map((h) => (
                      <TableRow key={h.id} data-testid={`row-holdback-${h.id}`}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{agentName(h)}</span>
                            <span className="text-xs text-gray-400">{h.agent?.email ?? ""}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">{h.dealName ?? "—"}</span>
                            <span className="text-xs text-gray-400">Deal #{h.dealId}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          ${Number(h.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-green-600">
                          ${Number(h.releasedAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {releasePercent(h)}
                        </TableCell>
                        <TableCell className="text-red-600">
                          ${Number(h.clawbackAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[h.status] ?? ""}>
                            {STATUS_LABELS[h.status] ?? h.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {h.releaseDate ? format(new Date(h.releaseDate), "MMM d, yyyy") : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {(h.status === "held" || h.status === "partially_released") && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-700 border-green-300 hover:bg-green-50"
                                  data-testid={`button-release-${h.id}`}
                                  onClick={() => releaseMutation.mutate(h.id)}
                                  disabled={releaseMutation.isPending}
                                >
                                  <Unlock className="w-3 h-3 mr-1" />
                                  Release
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-700 border-red-300 hover:bg-red-50"
                                  data-testid={`button-clawback-${h.id}`}
                                  onClick={() => setClawbackDialog(h)}
                                >
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Clawback
                                </Button>
                              </>
                            )}
                            {h.clawbackReason && (
                              <span className="text-xs text-red-500 italic">{h.clawbackReason}</span>
                            )}
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

      <Dialog open={clawbackDialog !== null} onOpenChange={() => setClawbackDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Clawback</DialogTitle>
          </DialogHeader>
          {clawbackDialog && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-gray-600">
                {agentName(clawbackDialog)} — {clawbackDialog.dealName ?? `Deal #${clawbackDialog.dealId}`}
                <br />
                Total: ${Number(clawbackDialog.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <div className="space-y-1">
                <Label>Clawback Percentage</Label>
                <Select value={clawbackPct} onValueChange={setClawbackPct}>
                  <SelectTrigger data-testid="select-clawback-pct">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25%</SelectItem>
                    <SelectItem value="50">50%</SelectItem>
                    <SelectItem value="75">75%</SelectItem>
                    <SelectItem value="100">100%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Reason</Label>
                <Input
                  data-testid="input-clawback-reason"
                  placeholder="Reason for clawback..."
                  value={clawbackReason}
                  onChange={(e) => setClawbackReason(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setClawbackDialog(null)}>Cancel</Button>
            <Button
              variant="destructive"
              data-testid="button-confirm-clawback"
              disabled={clawbackMutation.isPending || !clawbackReason.trim()}
              onClick={() => {
                if (clawbackDialog) {
                  clawbackMutation.mutate({
                    id: clawbackDialog.id,
                    reason: clawbackReason,
                    percentage: parseInt(clawbackPct),
                  });
                }
              }}
            >
              {clawbackMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Apply Clawback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
