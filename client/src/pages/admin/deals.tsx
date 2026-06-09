import { AdminSidebar } from "@/components/AdminSidebar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, buildUrlWithQuery } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import {
  Briefcase,
  Loader2,
  DollarSign,
  Users,
  TrendingUp,
  ChevronDown,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useState, useCallback, useEffect } from "react";
import { useSearch, useLocation } from "wouter";

const COMMISSION_TYPE_LABELS: Record<string, string> = {
  mac_primary: "MAC Primary",
  mac_sponsor_l1: "MAC Sponsor L1",
  mac_sponsor_l2: "MAC Sponsor L2",
  tfc: "TFC",
  personal_deal: "Personal Deal",
  binary_bonus: "Binary Bonus",
  generation_override: "Generation Override",
  subscription_commission: "Subscription",
  subscription_residual: "Sub. Residual",
};

function WaterfallBreakdown({ deal }: { deal: any }) {
  const gbrAmount = Number(deal.gbrAmount || 0);
  const macTotal = gbrAmount * 0.30;
  const macPrimary = gbrAmount * 0.22;
  const macL1 = gbrAmount * 0.05;
  const macL2 = gbrAmount * 0.03;
  const tfcMin = gbrAmount * 0.30;
  const tfcMax = gbrAmount * 0.40;
  const rsr = gbrAmount * 0.05;
  const picfMin = gbrAmount * 0.25;
  const picfMax = gbrAmount * 0.35;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">GBR Amount</span>
        <span className="text-lg font-bold">${gbrAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
      </div>
      <div className="space-y-2">
        <div className="text-sm font-semibold">MAC (30% of GBR = ${macTotal.toFixed(2)})</div>
        <div className="ml-4 space-y-1">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Primary Agent (22%)</span>
            <span className="font-medium">${macPrimary.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Senior Sponsor L1 (5%)</span>
            <span className="font-medium">${macL1.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Executive Sponsor L2 (3%)</span>
            <span className="font-medium">${macL2.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-semibold">TFC (30-40% of GBR)</span>
        <span className="font-medium">${tfcMin.toFixed(2)} - ${tfcMax.toFixed(2)}</span>
      </div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-semibold">PICF (25-35% of GBR)</span>
        <span className="font-medium">${picfMin.toFixed(2)} - ${picfMax.toFixed(2)}</span>
      </div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-semibold">RSR (5% of GBR)</span>
        <span className="font-medium">${rsr.toFixed(2)}</span>
      </div>
    </div>
  );
}

const STATUS_LS_KEY = "admin:deals:statusFilter";

export default function AdminDeals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const search = useSearch();
  const [, setLocation] = useLocation();

  const [statusFilter, setStatusFilter] = useState<string>(() => {
    const params = new URLSearchParams(search);
    const s = params.get("status");
    if (s && s !== "all") return s;
    try {
      const stored = localStorage.getItem(STATUS_LS_KEY);
      if (stored && stored !== "all") return stored;
    } catch {}
    return "all";
  });

  const updateStatusInUrl = useCallback((status: string) => {
    try {
      if (status === "all") {
        localStorage.removeItem(STATUS_LS_KEY);
      } else {
        localStorage.setItem(STATUS_LS_KEY, status);
      }
    } catch {}
    const params = new URLSearchParams(window.location.search);
    if (status === "all") {
      params.delete("status");
    } else {
      params.set("status", status);
    }
    const qs = params.toString();
    setLocation(qs ? `${window.location.pathname}?${qs}` : window.location.pathname, { replace: true });
  }, [setLocation]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (statusFilter !== "all" && params.get("status") !== statusFilter) {
      updateStatusInUrl(statusFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [selectedDeal, setSelectedDeal] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'deals'],
    queryFn: async () => {
      const res = await fetch(api.admin.deals.list.path, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const { data: agentsList } = useQuery({
    queryKey: ['admin', 'agents', 'list'],
    queryFn: async () => {
      const res = await fetch(buildUrlWithQuery(api.admin.agents.list.path, undefined, { pageSize: 200 }), { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch agents');
      return res.json();
    },
  });

  const { data: holdbacksData } = useQuery({
    queryKey: ['admin', 'holdbacks'],
    queryFn: async () => {
      const res = await fetch("/api/admin/holdbacks", { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const updateDealMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest('PATCH', buildUrl(api.admin.deals.update.path, { id }), data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'deals'] });
      toast({ title: "Success", description: "Deal updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update deal", variant: "destructive" });
    },
  });

  const deals = data?.deals || [];
  const filteredDeals = statusFilter === "all" ? deals : deals.filter((d: any) => d.status === statusFilter);

  const totalVolume = deals.reduce((sum: number, d: any) => sum + Number(d.loanAmount || 0), 0);
  const totalGbr = deals.reduce((sum: number, d: any) => sum + Number(d.gbrAmount || 0), 0);
  const fundedDeals = deals.filter((d: any) => d.status === 'funded').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'funded': return <Badge data-testid={`badge-status-${status}`}>Funded</Badge>;
      case 'pending': return <Badge variant="secondary" data-testid={`badge-status-${status}`}>Pending</Badge>;
      case 'rejected': return <Badge variant="destructive" data-testid={`badge-status-${status}`}>Rejected</Badge>;
      default: return <Badge variant="outline" data-testid={`badge-status-${status}`}>{status}</Badge>;
    }
  };

  const getDealHoldbacks = (dealId: number) => {
    if (!holdbacksData) return [];
    return (holdbacksData as any[]).filter((h: any) => h.dealId === dealId);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />

      <main className="flex-1 lg:ml-64 p-4 pt-20 lg:pt-8 lg:p-8">
        <header className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900" data-testid="text-page-title">Deal Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage deals, GBR waterfall breakdown, and fulfillment agent assignments.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Deals</CardDescription>
              <CardTitle className="text-3xl" data-testid="text-total-deals">{deals.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{fundedDeals} funded</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Loan Volume</CardDescription>
              <CardTitle className="text-3xl text-emerald-600" data-testid="text-total-volume">${totalVolume.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total GBR</CardDescription>
              <CardTitle className="text-3xl text-blue-600" data-testid="text-total-gbr">${totalGbr.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>All Deals</CardTitle>
              <CardDescription>View and manage deal details with GBR waterfall</CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); updateStatusInUrl(v); }}>
              <SelectTrigger className="w-36" data-testid="select-status-filter">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="funded">Funded</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deal</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Loan Amount</TableHead>
                  <TableHead>GBR</TableHead>
                  <TableHead>Fulfillment Agent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading deals...
                    </TableCell>
                  </TableRow>
                ) : filteredDeals.length > 0 ? (
                  filteredDeals.map((deal: any) => {
                    const dealHoldbacks = getDealHoldbacks(deal.id);
                    const heldAmount = dealHoldbacks.reduce((s: number, h: any) => s + Number(h.totalAmount || 0), 0);
                    return (
                      <TableRow key={deal.id} data-testid={`row-deal-${deal.id}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium" data-testid={`text-merchant-${deal.id}`}>{deal.merchantName}</p>
                            <p className="text-xs text-muted-foreground">#{deal.id}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                              {deal.agent?.firstName?.[0]}{deal.agent?.lastName?.[0]}
                            </div>
                            <span className="text-sm">{deal.agent?.firstName} {deal.agent?.lastName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium" data-testid={`text-loan-${deal.id}`}>
                          ${Number(deal.loanAmount).toLocaleString()}
                        </TableCell>
                        <TableCell data-testid={`text-gbr-${deal.id}`}>
                          {deal.gbrAmount ? (
                            <span className="font-medium text-blue-600">${Number(deal.gbrAmount).toLocaleString()}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {deal.fulfillmentAgent ? (
                            <span className="text-sm">{deal.fulfillmentAgent.firstName} {deal.fulfillmentAgent.lastName}</span>
                          ) : deal.fulfillmentAgentId ? (
                            <span className="text-sm text-muted-foreground">Agent #{deal.fulfillmentAgentId}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">Same as agent</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(deal.status)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(deal.fundedAt || deal.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                data-testid={`button-view-deal-${deal.id}`}
                                onClick={() => setSelectedDeal(deal)}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Details
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg">
                              <DialogHeader>
                                <DialogTitle data-testid="text-deal-detail-title">Deal #{deal.id} - {deal.merchantName}</DialogTitle>
                                <DialogDescription>GBR waterfall breakdown and holdback details</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Loan Amount</span>
                                    <p className="font-medium">${Number(deal.loanAmount).toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Status</span>
                                    <div className="mt-1">{getStatusBadge(deal.status)}</div>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Agent</span>
                                    <p className="font-medium">{deal.agent?.firstName} {deal.agent?.lastName}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Funded Date</span>
                                    <p className="font-medium">{format(new Date(deal.fundedAt || deal.createdAt), "MMM d, yyyy")}</p>
                                  </div>
                                </div>

                                <div className="border-t pt-4">
                                  <h4 className="font-semibold mb-3">GBR Waterfall Breakdown</h4>
                                  <WaterfallBreakdown deal={deal} />
                                </div>

                                {dealHoldbacks.length > 0 && (
                                  <div className="border-t pt-4">
                                    <h4 className="font-semibold mb-3">Holdbacks ({dealHoldbacks.length})</h4>
                                    <div className="space-y-2">
                                      {dealHoldbacks.map((h: any) => (
                                        <div key={h.id} className="flex items-center justify-between gap-2 text-sm p-2 rounded-md bg-muted/50">
                                          <div>
                                            <span className="font-medium">${Number(h.totalAmount).toFixed(2)} held</span>
                                            <span className="text-muted-foreground ml-2">
                                              ({h.status})
                                            </span>
                                          </div>
                                          {h.releaseDate && (
                                            <span className="text-xs text-muted-foreground">
                                              Release: {format(new Date(h.releaseDate), "MMM d, yyyy")}
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="border-t pt-4">
                                  <h4 className="font-semibold mb-3">Assign Fulfillment Agent</h4>
                                  <Select
                                    value={deal.fulfillmentAgentId?.toString() || ""}
                                    onValueChange={(val) => {
                                      updateDealMutation.mutate({
                                        id: deal.id,
                                        data: { fulfillmentAgentId: Number(val) },
                                      });
                                    }}
                                  >
                                    <SelectTrigger data-testid="select-fulfillment-agent">
                                      <SelectValue placeholder="Select fulfillment agent" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {agentsList?.agents?.map((agent: any) => (
                                        <SelectItem key={agent.id} value={agent.id.toString()}>
                                          {agent.firstName} {agent.lastName}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      No deals found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
