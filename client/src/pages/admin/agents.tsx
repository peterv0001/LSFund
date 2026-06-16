import { useState, useCallback, useEffect } from "react";
import { AdminSidebar } from "@/components/AdminSidebar";
import { SchemaDriftBanner } from "@/components/SchemaDriftBanner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrlWithQuery, buildUrl } from "@shared/routes";
import { 
  Users, 
  Search, 
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Ban,
  CheckCircle,
  Loader2,
  CreditCard,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Agent } from "@shared/schema";
import { useSearch, useLocation, Link } from "wouter";

type AgentWithCount = Agent & { totalSubscriptionCount: number; activeSubscriptionCount: number };

const STATUS_LS_KEY = "admin:agents:statusFilter";

// Governance (Task #473) display maps — kept aligned with the agent dashboard.
const TIER_LABELS: Record<string, string> = { standard: "Standard", enhanced: "Enhanced", elite: "Elite" };
const MEMBERSHIP_LABELS: Record<string, string> = { individual: "Individual", small_agency: "Small Agency", growth_agency: "Growth Agency", enterprise_agency: "Enterprise Agency" };
const AGENCY_MODEL_LABELS: Record<string, string> = { independent: "Independent", small_agency: "Small Agency", leadership: "Leadership", recruiting: "Recruiting" };
const RESIDUAL_LABELS: Record<string, string> = { good_standing: "Good Standing", reduced: "Reduced", suspended: "Suspended" };

function getTierBadgeColor(tier: string) {
  switch (tier) {
    case 'elite': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'enhanced': return 'bg-blue-100 text-blue-800 border-blue-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getResidualBadgeColor(status: string) {
  switch (status) {
    case 'good_standing': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'reduced': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'suspended': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export default function AdminAgents() {
  const urlSearch = useSearch();
  const [, setLocation] = useLocation();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    const params = new URLSearchParams(urlSearch);
    const s = params.get("status");
    if (s && s !== "all") return s;
    try {
      const stored = localStorage.getItem(STATUS_LS_KEY);
      if (stored && stored !== "all") return stored;
    } catch {}
    return "all";
  });
  const [rankFilter, setRankFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string | null>(() => {
    const params = new URLSearchParams(urlSearch);
    return params.get("sortBy") || null;
  });
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => {
    const params = new URLSearchParams(urlSearch);
    return params.get("sortOrder") === "asc" ? "asc" : "desc";
  });
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [governanceAgent, setGovernanceAgent] = useState<Agent | null>(null);
  const [governanceDialogOpen, setGovernanceDialogOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const updateSortInUrl = useCallback((nextSortBy: string | null, nextSortOrder: 'asc' | 'desc') => {
    const params = new URLSearchParams(window.location.search);
    if (nextSortBy) {
      params.set("sortBy", nextSortBy);
      params.set("sortOrder", nextSortOrder);
    } else {
      params.delete("sortBy");
      params.delete("sortOrder");
    }
    const qs = params.toString();
    setLocation(qs ? `${window.location.pathname}?${qs}` : window.location.pathname, { replace: true });
  }, [setLocation]);

  const handleSort = (column: string) => {
    let nextSortBy = sortBy;
    let nextSortOrder = sortOrder;
    if (sortBy === column) {
      nextSortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
      setSortOrder(nextSortOrder);
    } else {
      nextSortBy = column;
      nextSortOrder = column === 'name' || column === 'rank' ? 'asc' : 'desc';
      setSortBy(nextSortBy);
      setSortOrder(nextSortOrder);
    }
    updateSortInUrl(nextSortBy, nextSortOrder);
    setPage(1);
  };

  const SortIcon = ({ column, testIdPrefix }: { column: string; testIdPrefix?: string }) => {
    if (sortBy !== column) return <ArrowUpDown data-testid={testIdPrefix ? `${testIdPrefix}-neutral` : undefined} className="w-3.5 h-3.5 text-muted-foreground" />;
    return sortOrder === 'desc'
      ? <ArrowDown data-testid={testIdPrefix ? `${testIdPrefix}-desc` : undefined} className="w-3.5 h-3.5" />
      : <ArrowUp data-testid={testIdPrefix ? `${testIdPrefix}-asc` : undefined} className="w-3.5 h-3.5" />;
  };

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'agents', search, statusFilter, rankFilter, page, sortBy, sortOrder],
    queryFn: async () => {
      const url = buildUrlWithQuery(api.admin.agents.list.path, {}, {
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        rank: rankFilter !== 'all' ? rankFilter : undefined,
        page,
        pageSize: 20,
        sortBy: sortBy || undefined,
        sortOrder: sortBy ? sortOrder : undefined,
      });
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch agents');
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(buildUrl(api.admin.agents.update.path, { id }), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to update agent');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] });
      setEditDialogOpen(false);
      toast({ title: "Success", description: "Agent updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update agent", variant: "destructive" });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildUrl(api.admin.agents.suspend.path, { id }), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Suspended by admin' }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to suspend agent');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] });
      toast({ title: "Success", description: "Agent suspended" });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildUrl(api.admin.agents.activate.path, { id }), {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to activate agent');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] });
      toast({ title: "Success", description: "Agent activated" });
    },
  });

  const recalcMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(api.admin.agents.recalculateGovernance.path, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to recalculate');
      return res.json();
    },
    onSuccess: (summary: { processed: number; changed: number }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] });
      toast({ title: "Tiers recalculated", description: `${summary.changed} of ${summary.processed} agents changed` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to recalculate tiers", variant: "destructive" });
    },
  });

  const residualMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: number; status: string; reason?: string }) => {
      const res = await fetch(buildUrl(api.admin.agents.setResidualStatus.path, { id }), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to update residual status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'agent-governance'] });
      toast({ title: "Success", description: "Residual standing updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update residual standing", variant: "destructive" });
    },
  });

  const getRankBadgeColor = (rank: string) => {
    switch (rank) {
      case 'partner': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'director': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'leader': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'builder': return 'bg-primary/10 text-primary border-primary/20';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      
      <main className="flex-1 lg:ml-64 p-4 pt-20 lg:pt-8 lg:p-8">
        <SchemaDriftBanner />
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Agent Management</h1>
            <p className="text-muted-foreground mt-1">
              View and manage all agents in the network.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              data-testid="button-recalculate-tiers"
              onClick={() => recalcMutation.mutate()}
              disabled={recalcMutation.isPending}
            >
              {recalcMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Recalculate Tiers
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              {data?.total || 0} total agents
            </div>
          </div>
        </header>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6 bg-white p-4 rounded-xl border shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              data-testid="input-agent-search"
              placeholder="Search by name or email..." 
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); updateStatusInUrl(v); setPage(1); }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <Select value={rankFilter} onValueChange={(v) => { setRankFilter(v); setPage(1); }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Rank" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ranks</SelectItem>
              <SelectItem value="agent">Agent</SelectItem>
              <SelectItem value="builder">Builder</SelectItem>
              <SelectItem value="leader">Leader</SelectItem>
              <SelectItem value="director">Director</SelectItem>
              <SelectItem value="partner">Partner</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50">
                <TableHead>
                  <button
                    data-testid="sort-name"
                    onClick={() => handleSort('name')}
                    className="inline-flex items-center gap-1 font-medium hover:text-foreground transition-colors"
                  >
                    Agent
                    <SortIcon column="name" />
                  </button>
                </TableHead>
                <TableHead>Email</TableHead>
                <TableHead>
                  <button
                    data-testid="sort-rank"
                    onClick={() => handleSort('rank')}
                    className="inline-flex items-center gap-1 font-medium hover:text-foreground transition-colors"
                  >
                    Rank
                    <SortIcon column="rank" />
                  </button>
                </TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Residual</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <button
                    data-testid="sort-subscriptions"
                    onClick={() => handleSort('subscriptionCount')}
                    title="Active / Total subscriptions"
                    className="inline-flex items-center gap-1 font-medium hover:text-foreground transition-colors"
                  >
                    Subscriptions
                    <SortIcon column="subscriptionCount" testIdPrefix="icon-sort" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    data-testid="sort-joined"
                    onClick={() => handleSort('createdAt')}
                    className="inline-flex items-center gap-1 font-medium hover:text-foreground transition-colors"
                  >
                    Joined
                    <SortIcon column="createdAt" />
                  </button>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading agents...
                  </TableCell>
                </TableRow>
              ) : data?.agents?.length > 0 ? (
                data.agents.map((agent: AgentWithCount) => (
                  <TableRow key={agent.id} className="hover:bg-gray-50/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {agent.firstName[0]}{agent.lastName[0]}
                        </div>
                        <div>
                          <p className="font-medium">{agent.firstName} {agent.lastName}</p>
                          <p className="text-xs text-muted-foreground">ID: {agent.id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{agent.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getRankBadgeColor(agent.currentRank)}>
                        {agent.currentRank}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getTierBadgeColor(agent.distributorTier)} data-testid={`badge-tier-${agent.id}`}>
                        {TIER_LABELS[agent.distributorTier] ?? agent.distributorTier}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getResidualBadgeColor(agent.residualStatus)} data-testid={`badge-residual-${agent.id}`}>
                        {RESIDUAL_LABELS[agent.residualStatus] ?? agent.residualStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getStatusBadgeColor(agent.status)}>
                        {agent.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const lostAllSubscriptions =
                          agent.activeSubscriptionCount === 0 &&
                          agent.totalSubscriptionCount > 0;
                        return (
                          <span
                            data-testid={`cell-subscriptions-${agent.id}`}
                            data-lost-all={lostAllSubscriptions ? "true" : "false"}
                            className={`inline-flex items-center gap-1.5 font-medium ${
                              lostAllSubscriptions
                                ? "text-amber-600 rounded-md bg-amber-50 px-2 py-0.5 ring-1 ring-amber-200"
                                : ""
                            }`}
                          >
                            {lostAllSubscriptions ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertTriangle
                                      data-testid={`icon-lost-subscriptions-${agent.id}`}
                                      className="w-3.5 h-3.5 text-amber-600"
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    All subscriptions are cancelled or paused
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <CreditCard className="w-3.5 h-3.5 text-primary" />
                            )}
                            <Link
                              href={`/admin/subscriptions?agentId=${agent.id}&status=active`}
                              data-testid={`link-active-count-${agent.id}`}
                              title="View active subscriptions only"
                              aria-label={`View ${agent.activeSubscriptionCount} active subscriptions for this agent`}
                              className={
                                lostAllSubscriptions
                                  ? "text-amber-700 hover:underline"
                                  : "text-primary hover:underline"
                              }
                            >
                              <span data-testid={`text-active-count-${agent.id}`}>{agent.activeSubscriptionCount}</span>
                            </Link>
                            <span className="text-muted-foreground font-normal">/</span>
                            <Link
                              href={`/admin/subscriptions?agentId=${agent.id}`}
                              data-testid={`link-total-count-${agent.id}`}
                              title="View all subscriptions"
                              aria-label={`View all ${agent.totalSubscriptionCount} subscriptions for this agent`}
                              className={
                                lostAllSubscriptions
                                  ? "text-amber-700 hover:underline"
                                  : "text-primary hover:underline"
                              }
                            >
                              <span data-testid={`text-total-count-${agent.id}`}>{agent.totalSubscriptionCount}</span>
                            </Link>
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(agent.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedAgent(agent); setEditDialogOpen(true); }}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Agent
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            data-testid={`menu-governance-${agent.id}`}
                            onClick={() => { setGovernanceAgent(agent); setGovernanceDialogOpen(true); }}
                          >
                            <ShieldCheck className="w-4 h-4 mr-2" />
                            Governance
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Eye className="w-4 h-4 mr-2" />
                            View Genealogy
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            data-testid={`link-view-subscriptions-${agent.id}`}
                            onClick={() => setLocation(`/admin/subscriptions?agentId=${agent.id}`)}
                          >
                            <CreditCard className="w-4 h-4 mr-2" />
                            View Subscriptions
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {agent.status === 'active' ? (
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={() => suspendMutation.mutate(agent.id)}
                            >
                              <Ban className="w-4 h-4 mr-2" />
                              Suspend Agent
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem 
                              className="text-green-600"
                              onClick={() => activateMutation.mutate(agent.id)}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Activate Agent
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    No agents found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {data?.total > 20 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, data.total)} of {data.total}
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page * 20 >= data.total}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Agent</DialogTitle>
              <DialogDescription>
                Update agent information and rank.
              </DialogDescription>
            </DialogHeader>
            {selectedAgent && (
              <EditAgentForm 
                agent={selectedAgent} 
                onSave={(data) => updateMutation.mutate({ id: selectedAgent.id, data })}
                isLoading={updateMutation.isPending}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Governance Dialog */}
        <Dialog open={governanceDialogOpen} onOpenChange={setGovernanceDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Governance</DialogTitle>
              <DialogDescription>
                {governanceAgent ? `${governanceAgent.firstName} ${governanceAgent.lastName}` : ''} — qualification, membership &amp; residual standing
              </DialogDescription>
            </DialogHeader>
            {governanceAgent && (
              <GovernancePanel
                agent={governanceAgent}
                onSetResidual={(status, reason) => residualMutation.mutate({ id: governanceAgent.id, status, reason })}
                isUpdating={residualMutation.isPending}
              />
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

function GovernancePanel({ agent, onSetResidual, isUpdating }: {
  agent: Agent;
  onSetResidual: (status: string, reason?: string) => void;
  isUpdating: boolean;
}) {
  const [residual, setResidual] = useState<string>(agent.residualStatus);
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'agent-governance', agent.id],
    queryFn: async () => {
      const res = await fetch(buildUrl(api.admin.agents.governance.path, { id: agent.id }), { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load governance');
      return res.json();
    },
  });

  const fmtMoney = (n: number) => `$${Math.round(Number(n || 0)).toLocaleString()}`;

  return (
    <div className="space-y-5 py-2">
      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading governance…
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Current Tier</p>
              <Badge variant="outline" className={getTierBadgeColor(data.distributorTier)} data-testid="text-current-tier">
                {TIER_LABELS[data.distributorTier] ?? data.distributorTier}
              </Badge>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Qualified Tier (trailing month)</p>
              <Badge variant="outline" className={getTierBadgeColor(data.qualifiedTier)} data-testid="text-qualified-tier">
                {TIER_LABELS[data.qualifiedTier] ?? data.qualifiedTier}
              </Badge>
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-1 text-sm">
            <p className="font-medium mb-1">Trailing-month production</p>
            <div className="flex justify-between"><span className="text-muted-foreground">Funded volume</span><span data-testid="text-funded-volume">{fmtMoney(data.metrics.fundedVolume)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Active subscriptions</span><span data-testid="text-active-subs">{data.metrics.activeSubscriptions}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Subscription MRR</span><span>{fmtMoney(data.metrics.subscriptionRevenue)}</span></div>
          </div>

          <div className="rounded-lg border p-3 space-y-1 text-sm">
            <p className="font-medium mb-1">Membership</p>
            <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{MEMBERSHIP_LABELS[data.membership.membershipType] ?? data.membership.membershipType}</span></div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monthly fee</span>
              <span data-testid="text-membership-fee">
                {data.membership.waived ? <span className="text-emerald-700 font-medium">Waived</span> : fmtMoney(data.membership.fee)}
              </span>
            </div>
            {data.membership.waived && (
              <p className="text-xs text-emerald-700">Production-based waiver active.</p>
            )}
          </div>

          {data.buyoutEligibleSubscriptions?.length > 0 && (
            <div className="rounded-lg border p-3 space-y-1 text-sm">
              <p className="font-medium mb-1">Buyout-eligible subscriptions</p>
              {data.buyoutEligibleSubscriptions.map((s: any) => (
                <div key={s.id} className="flex justify-between" data-testid={`buyout-sub-${s.id}`}>
                  <span className="text-muted-foreground">{s.merchantName} ({TIER_LABELS[s.tier] ?? s.tier})</span>
                  <span>{s.monthsActive} mo</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground py-4">Could not load governance details.</p>
      )}

      <div className="rounded-lg border p-3 space-y-3">
        <p className="font-medium text-sm">Residual standing</p>
        <Select value={residual} onValueChange={setResidual}>
          <SelectTrigger data-testid="select-residual-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="good_standing">Good Standing</SelectItem>
            <SelectItem value="reduced">Reduced (50%)</SelectItem>
            <SelectItem value="suspended">Suspended (0%)</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          data-testid="input-residual-reason"
        />
        <Button
          size="sm"
          data-testid="button-set-residual"
          disabled={isUpdating || residual === agent.residualStatus}
          onClick={() => onSetResidual(residual, reason || undefined)}
        >
          {isUpdating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Update Standing
        </Button>
      </div>
    </div>
  );
}

function EditAgentForm({ agent, onSave, isLoading }: { agent: Agent; onSave: (data: any) => void; isLoading: boolean }) {
  const [formData, setFormData] = useState({
    firstName: agent.firstName,
    lastName: agent.lastName,
    email: agent.email,
    phone: agent.phone || '',
    currentRank: agent.currentRank,
    status: agent.status,
    membershipType: agent.membershipType,
    agencyModel: agent.agencyModel,
  });

  return (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>First Name</Label>
          <Input 
            value={formData.firstName} 
            onChange={(e) => setFormData(f => ({ ...f, firstName: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Last Name</Label>
          <Input 
            value={formData.lastName} 
            onChange={(e) => setFormData(f => ({ ...f, lastName: e.target.value }))}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Email</Label>
        <Input 
          value={formData.email} 
          onChange={(e) => setFormData(f => ({ ...f, email: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label>Phone</Label>
        <Input 
          value={formData.phone} 
          onChange={(e) => setFormData(f => ({ ...f, phone: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Rank</Label>
          <Select value={formData.currentRank} onValueChange={(v) => setFormData(f => ({ ...f, currentRank: v as any }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="agent">Agent</SelectItem>
              <SelectItem value="builder">Builder</SelectItem>
              <SelectItem value="leader">Leader</SelectItem>
              <SelectItem value="director">Director</SelectItem>
              <SelectItem value="partner">Partner</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={(v) => setFormData(f => ({ ...f, status: v as any }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Membership Type</Label>
          <Select value={formData.membershipType} onValueChange={(v) => setFormData(f => ({ ...f, membershipType: v as any }))}>
            <SelectTrigger data-testid="select-membership-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">Individual</SelectItem>
              <SelectItem value="small_agency">Small Agency</SelectItem>
              <SelectItem value="growth_agency">Growth Agency</SelectItem>
              <SelectItem value="enterprise_agency">Enterprise Agency</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Agency Model</Label>
          <Select value={formData.agencyModel} onValueChange={(v) => setFormData(f => ({ ...f, agencyModel: v as any }))}>
            <SelectTrigger data-testid="select-agency-model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="independent">Independent</SelectItem>
              <SelectItem value="small_agency">Small Agency</SelectItem>
              <SelectItem value="leadership">Leadership</SelectItem>
              <SelectItem value="recruiting">Recruiting</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter className="pt-4">
        <Button onClick={() => onSave(formData)} disabled={isLoading}>
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Changes
        </Button>
      </DialogFooter>
    </div>
  );
}
