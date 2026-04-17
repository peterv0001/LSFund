import { AdminSidebar } from "@/components/AdminSidebar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import {
  DollarSign,
  CheckCircle,
  XCircle,
  Loader2,
  Calculator,
  CheckCheck,
  ShieldAlert,
  Unlock,
  AlertTriangle,
  RefreshCw,
  Clock,
  TrendingDown,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useState } from "react";

const COMMISSION_TYPE_LABELS: Record<string, string> = {
  personal_deal: "Personal Deal",
  binary_bonus: "Binary Bonus",
  generation_override: "Gen Override",
  course_sale: "Course Sale",
  fast_start: "Fast Start",
  leadership_pool: "Leadership Pool",
  mac_primary: "MAC Primary",
  mac_sponsor_l1: "MAC Sponsor L1",
  mac_sponsor_l2: "MAC Sponsor L2",
  tfc: "TFC",
  subscription_commission: "Subscription",
  subscription_residual: "Sub. Residual",
};

const COMMISSION_TYPE_COLORS: Record<string, string> = {
  personal_deal: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  binary_bonus: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  generation_override: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  mac_primary: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  mac_sponsor_l1: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  mac_sponsor_l2: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  tfc: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  subscription_commission: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  subscription_residual: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
};

const HOLDBACK_STATUS_COLORS: Record<string, string> = {
  held: "bg-yellow-100 text-yellow-800",
  partially_released: "bg-blue-100 text-blue-800",
  released: "bg-emerald-100 text-emerald-800",
  clawed_back: "bg-red-100 text-red-800",
};

const DECAY_SCHEDULE = [
  { months: "1-3", rate: "100%", label: "Full Rate" },
  { months: "4-6", rate: "75%", label: "75% Decay" },
  { months: "7-9", rate: "50%", label: "50% Decay" },
  { months: "10-12", rate: "25%", label: "25% Decay" },
  { months: "12+", rate: "10%", label: "Residual" },
];

export default function AdminCommissions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [clawbackReason, setClawbackReason] = useState("");
  const [clawbackPercentage, setClawbackPercentage] = useState("100");

  const { data: pendingCommissions, isLoading } = useQuery({
    queryKey: ['admin', 'commissions', 'pending'],
    queryFn: async () => {
      const res = await fetch(api.admin.commissions.pending.path, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const { data: holdbacksData, isLoading: holdbacksLoading } = useQuery({
    queryKey: ['admin', 'holdbacks'],
    queryFn: async () => {
      const res = await fetch("/api/admin/holdbacks", { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const { data: subscriptionsData, isLoading: subsLoading } = useQuery({
    queryKey: ['admin', 'subscriptions'],
    queryFn: async () => {
      const res = await fetch("/api/admin/subscriptions", { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const { data: fulfillmentData } = useQuery({
    queryKey: ['admin', 'fulfillment-tiers'],
    queryFn: async () => {
      const res = await fetch("/api/commission-config", { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildUrl(api.admin.commissions.approve.path, { id }), {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to approve');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'commissions'] });
      toast({ title: "Success", description: "Commission approved" });
    },
  });

  const approveAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(api.admin.commissions.approveAll.path, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to approve all');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'commissions'] });
      toast({ title: "Success", description: `${data.approved} commissions approved` });
    },
  });

  const calculateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(api.admin.commissions.calculate.path, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to calculate');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'commissions'] });
      toast({ title: "Success", description: `Binary bonuses calculated for ${data.processed} agents` });
    },
  });

  const subCalcMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/subscriptions/calculate-commissions", {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to calculate');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'commissions'] });
      toast({ title: "Success", description: `Subscription commissions calculated for ${data.processed} subscriptions` });
    },
  });

  const releaseHoldbackMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/holdbacks/${id}/release`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to release');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'holdbacks'] });
      toast({ title: "Success", description: "Holdback released" });
    },
  });

  const releaseEligibleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/holdbacks/release-eligible", {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to release');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'holdbacks'] });
      toast({ title: "Success", description: `${data.released} holdbacks released` });
    },
  });

  const clawbackMutation = useMutation({
    mutationFn: async ({ id, reason, percentage }: { id: number; reason: string; percentage: number }) => {
      const res = await fetch(`/api/admin/holdbacks/${id}/clawback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason, percentage }),
      });
      if (!res.ok) throw new Error('Failed to clawback');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'holdbacks'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'commissions'] });
      toast({ title: "Success", description: "Clawback applied" });
      setClawbackReason("");
      setClawbackPercentage("100");
    },
  });

  const updateSubStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/admin/subscriptions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'subscriptions'] });
      toast({ title: "Success", description: "Subscription status updated" });
    },
  });

  const totalPending = pendingCommissions?.reduce((sum: number, c: any) => sum + Number(c.amount), 0) || 0;
  const heldHoldbacks = (holdbacksData as any[] || []).filter((h: any) => h.status === 'held' || h.status === 'partially_released');
  const totalHeld = heldHoldbacks.reduce((s: number, h: any) => s + Number(h.totalAmount || 0) - Number(h.releasedAmount || 0), 0);

  const getTypeBadgeColor = (type: string) => {
    return COMMISSION_TYPE_COLORS[type] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />

      <main className="flex-1 lg:ml-64 p-4 pt-20 lg:pt-8 lg:p-8">
        <header className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900" data-testid="text-page-title">Commission Management</h1>
            <p className="text-muted-foreground mt-1">
              Review commissions, manage holdbacks, and track subscriptions.
            </p>
          </div>
        </header>

        <Tabs defaultValue="commissions" className="space-y-6">
          <TabsList data-testid="tabs-commission-sections">
            <TabsTrigger value="commissions" data-testid="tab-commissions">Commissions</TabsTrigger>
            <TabsTrigger value="holdbacks" data-testid="tab-holdbacks">Holdbacks</TabsTrigger>
            <TabsTrigger value="subscriptions" data-testid="tab-subscriptions">Subscriptions</TabsTrigger>
          </TabsList>

          {/* === COMMISSIONS TAB === */}
          <TabsContent value="commissions" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Pending Commissions</CardDescription>
                  <CardTitle className="text-3xl" data-testid="text-pending-count">{pendingCommissions?.length || 0}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Pending Amount</CardDescription>
                  <CardTitle className="text-3xl text-emerald-600" data-testid="text-pending-amount">${totalPending.toLocaleString()}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="flex flex-col justify-center">
                <CardContent className="pt-6 space-y-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="w-full" disabled={calculateMutation.isPending} data-testid="button-run-binary">
                        {calculateMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Calculator className="w-4 h-4 mr-2" />
                        )}
                        Run Binary Calculation
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Run Binary Bonus Calculation?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will calculate binary bonuses for all qualifying agents based on their leg volumes this week.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => calculateMutation.mutate()} data-testid="button-confirm-binary">
                          Run Calculation
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="w-full" disabled={approveAllMutation.isPending || !pendingCommissions?.length} data-testid="button-approve-all">
                        {approveAllMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCheck className="w-4 h-4 mr-2" />
                        )}
                        Approve All Pending
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Approve All Pending Commissions?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will approve {pendingCommissions?.length || 0} commissions totaling ${totalPending.toLocaleString()}.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => approveAllMutation.mutate()} data-testid="button-confirm-approve-all">
                          Approve All
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </div>

            {fulfillmentData && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Fulfillment Tier Rates</CardTitle>
                  <CardDescription>TFC percentage by fulfillment agent tier</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4">
                    {Object.entries(fulfillmentData.fulfillmentTierRates || {}).map(([tier, rate]) => (
                      <div key={tier} className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" data-testid={`badge-tier-${tier}`}>
                          {tier.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <span className="font-medium">{((rate as number) * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Pending Commissions</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                          Loading commissions...
                        </TableCell>
                      </TableRow>
                    ) : pendingCommissions?.length > 0 ? (
                      pendingCommissions.map((comm: any) => (
                        <TableRow key={comm.id} data-testid={`row-commission-${comm.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                {comm.agent?.firstName?.[0]}{comm.agent?.lastName?.[0]}
                              </div>
                              <div>
                                <p className="font-medium">{comm.agent?.firstName} {comm.agent?.lastName}</p>
                                <p className="text-xs text-muted-foreground capitalize">{comm.agent?.currentRank}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={getTypeBadgeColor(comm.type)} data-testid={`badge-type-${comm.id}`}>
                              {COMMISSION_TYPE_LABELS[comm.type] || comm.type.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {comm.dealId ? `Deal #${comm.dealId}` : comm.sourceAgentId ? `From Agent #${comm.sourceAgentId}` : 'Team Volume'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(comm.createdAt), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right font-bold text-emerald-600" data-testid={`text-amount-${comm.id}`}>
                            ${Number(comm.amount).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => approveMutation.mutate(comm.id)}
                              disabled={approveMutation.isPending}
                              data-testid={`button-approve-${comm.id}`}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                          <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          No pending commissions
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === HOLDBACKS TAB === */}
          <TabsContent value="holdbacks" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Active Holdbacks</CardDescription>
                  <CardTitle className="text-3xl" data-testid="text-holdback-count">{heldHoldbacks.length}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Held Amount</CardDescription>
                  <CardTitle className="text-3xl text-primary" data-testid="text-held-amount">${totalHeld.toLocaleString(undefined, { minimumFractionDigits: 2 })}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="flex flex-col justify-center">
                <CardContent className="pt-6">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="w-full" disabled={releaseEligibleMutation.isPending} data-testid="button-release-eligible">
                        {releaseEligibleMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Unlock className="w-4 h-4 mr-2" />
                        )}
                        Release All Eligible
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Release Eligible Holdbacks?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will release all holdbacks that have passed their release date. Released funds will become available as commissions.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => releaseEligibleMutation.mutate()} data-testid="button-confirm-release-eligible">
                          Release Eligible
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>All Holdbacks</CardTitle>
                <CardDescription>70% released at funding, 30% deferred 60-90 days</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Deal</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Total Held</TableHead>
                      <TableHead>Released</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Release Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holdbacksLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                          Loading holdbacks...
                        </TableCell>
                      </TableRow>
                    ) : (holdbacksData as any[] || []).length > 0 ? (
                      (holdbacksData as any[]).map((h: any) => (
                        <TableRow key={h.id} data-testid={`row-holdback-${h.id}`}>
                          <TableCell className="font-medium">Deal #{h.dealId}</TableCell>
                          <TableCell>Agent #{h.agentId}</TableCell>
                          <TableCell className="font-medium">${Number(h.totalAmount).toFixed(2)}</TableCell>
                          <TableCell className="text-emerald-600">${Number(h.releasedAmount || 0).toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={HOLDBACK_STATUS_COLORS[h.status] || ""} data-testid={`badge-holdback-status-${h.id}`}>
                              {h.status.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {h.releaseDate ? format(new Date(h.releaseDate), "MMM d, yyyy") : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {(h.status === 'held' || h.status === 'partially_released') && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => releaseHoldbackMutation.mutate(h.id)}
                                    disabled={releaseHoldbackMutation.isPending}
                                    data-testid={`button-release-${h.id}`}
                                  >
                                    <Unlock className="w-4 h-4 mr-1" />
                                    Release
                                  </Button>

                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button size="sm" variant="ghost" data-testid={`button-clawback-${h.id}`}>
                                        <AlertTriangle className="w-4 h-4 mr-1" />
                                        Clawback
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Apply Clawback</DialogTitle>
                                        <DialogDescription>
                                          Clawback holdback #{h.id} (${Number(h.totalAmount).toFixed(2)}) for Deal #{h.dealId}
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="space-y-4">
                                        <div>
                                          <label className="text-sm font-medium">Clawback Percentage</label>
                                          <Input
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={clawbackPercentage}
                                            onChange={(e) => setClawbackPercentage(e.target.value)}
                                            data-testid="input-clawback-percentage"
                                          />
                                          <p className="text-xs text-muted-foreground mt-1">
                                            Schedule: 0-30 days = 100%, 31-90 days = 50%, after 90 = 0%
                                          </p>
                                        </div>
                                        <div>
                                          <label className="text-sm font-medium">Reason</label>
                                          <Textarea
                                            value={clawbackReason}
                                            onChange={(e) => setClawbackReason(e.target.value)}
                                            placeholder="Enter clawback reason..."
                                            data-testid="input-clawback-reason"
                                          />
                                        </div>
                                      </div>
                                      <DialogFooter>
                                        <DialogClose asChild>
                                          <Button variant="outline">Cancel</Button>
                                        </DialogClose>
                                        <Button
                                          variant="destructive"
                                          onClick={() => {
                                            clawbackMutation.mutate({
                                              id: h.id,
                                              reason: clawbackReason,
                                              percentage: Number(clawbackPercentage),
                                            });
                                          }}
                                          disabled={clawbackMutation.isPending || !clawbackReason}
                                          data-testid="button-confirm-clawback"
                                        >
                                          {clawbackMutation.isPending ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                          ) : (
                                            <AlertTriangle className="w-4 h-4 mr-2" />
                                          )}
                                          Apply Clawback
                                        </Button>
                                      </DialogFooter>
                                    </DialogContent>
                                  </Dialog>
                                </>
                              )}
                              {h.status === 'clawed_back' && h.clawbackReason && (
                                <span className="text-xs text-muted-foreground max-w-32 truncate" title={h.clawbackReason}>
                                  {h.clawbackReason}
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                          <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          No holdbacks found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === SUBSCRIPTIONS TAB === */}
          <TabsContent value="subscriptions" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Subscriptions</CardDescription>
                  <CardTitle className="text-3xl" data-testid="text-sub-count">{(subscriptionsData as any[] || []).length}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Active Subscriptions</CardDescription>
                  <CardTitle className="text-3xl text-emerald-600" data-testid="text-active-sub-count">
                    {(subscriptionsData as any[] || []).filter((s: any) => s.status === 'active').length}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="flex flex-col justify-center">
                <CardContent className="pt-6">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="w-full" disabled={subCalcMutation.isPending} data-testid="button-calc-sub-commissions">
                        {subCalcMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Calculator className="w-4 h-4 mr-2" />
                        )}
                        Calculate Sub. Commissions
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Calculate Subscription Commissions?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will calculate monthly subscription commissions for all active subscriptions, applying the decay schedule.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => subCalcMutation.mutate()} data-testid="button-confirm-calc-sub">
                          Calculate
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Commission Decay Schedule</CardTitle>
                <CardDescription>Subscription commission rates decrease over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  {DECAY_SCHEDULE.map((d) => (
                    <div key={d.months} className="flex items-center gap-2 text-sm">
                      <Badge variant="outline">
                        <Clock className="w-3 h-3 mr-1" />
                        Months {d.months}
                      </Badge>
                      <span className="font-medium">{d.rate}</span>
                      <span className="text-muted-foreground">({d.label})</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>All Subscriptions</CardTitle>
                <CardDescription>Manage merchant subscriptions and track production compliance</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Merchant</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Monthly</TableHead>
                      <TableHead>MCA Paired</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Months Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subsLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                          Loading subscriptions...
                        </TableCell>
                      </TableRow>
                    ) : (subscriptionsData as any[] || []).length > 0 ? (
                      (subscriptionsData as any[]).map((sub: any) => {
                        const months = Math.floor((Date.now() - new Date(sub.startDate).getTime()) / (30.44 * 24 * 60 * 60 * 1000));
                        let decayLabel = "Full";
                        if (months >= 12) decayLabel = "Residual (10%)";
                        else if (months >= 9) decayLabel = "25%";
                        else if (months >= 6) decayLabel = "50%";
                        else if (months >= 3) decayLabel = "75%";

                        return (
                          <TableRow key={sub.id} data-testid={`row-sub-${sub.id}`}>
                            <TableCell>
                              <div>
                                <p className="font-medium" data-testid={`text-sub-merchant-${sub.id}`}>{sub.merchantName}</p>
                                {sub.merchantEmail && <p className="text-xs text-muted-foreground">{sub.merchantEmail}</p>}
                              </div>
                            </TableCell>
                            <TableCell>Agent #{sub.agentId}</TableCell>
                            <TableCell>
                              <Badge variant="outline" data-testid={`badge-sub-tier-${sub.id}`}>
                                {sub.tier.replace('_', ' ').toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">${Number(sub.monthlyAmount).toFixed(2)}</TableCell>
                            <TableCell>
                              {sub.mcaPairedDealId ? (
                                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                                  Deal #{sub.mcaPairedDealId}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={sub.status === 'active' ? 'default' : 'secondary'}
                                data-testid={`badge-sub-status-${sub.id}`}
                              >
                                {sub.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {format(new Date(sub.startDate), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{months}</span>
                                <Badge variant="outline" className="text-xs">
                                  <TrendingDown className="w-3 h-3 mr-1" />
                                  {decayLabel}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {sub.status === 'active' ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => updateSubStatusMutation.mutate({ id: sub.id, status: 'paused' })}
                                  disabled={updateSubStatusMutation.isPending}
                                  data-testid={`button-pause-sub-${sub.id}`}
                                >
                                  Pause
                                </Button>
                              ) : sub.status === 'paused' ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => updateSubStatusMutation.mutate({ id: sub.id, status: 'active' })}
                                  disabled={updateSubStatusMutation.isPending}
                                  data-testid={`button-resume-sub-${sub.id}`}
                                >
                                  Resume
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">{sub.status}</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                          <RefreshCw className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          No subscriptions found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
