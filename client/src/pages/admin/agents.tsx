import { useState } from "react";
import { AdminSidebar } from "@/components/AdminSidebar";
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
  CreditCard
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
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Agent } from "@shared/schema";
import { useLocation, Link } from "wouter";

type AgentWithCount = Agent & { totalSubscriptionCount: number; activeSubscriptionCount: number };

export default function AdminAgents() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [rankFilter, setRankFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'agents', search, statusFilter, rankFilter, page],
    queryFn: async () => {
      const url = buildUrlWithQuery(api.admin.agents.list.path, {}, {
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        rank: rankFilter !== 'all' ? rankFilter : undefined,
        page,
        pageSize: 20,
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
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Agent Management</h1>
            <p className="text-muted-foreground mt-1">
              View and manage all agents in the network.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            {data?.total || 0} total agents
          </div>
        </header>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6 bg-white p-4 rounded-xl border shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name or email..." 
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
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
                <TableHead>Agent</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rank</TableHead>
                <TableHead>Status</TableHead>
                <TableHead title="Active / Total subscriptions">Subscriptions</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
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
                      <Badge variant="secondary" className={getStatusBadgeColor(agent.status)}>
                        {agent.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/subscriptions?agentId=${agent.id}`}
                        data-testid={`link-subscription-count-${agent.id}`}
                        title="Active subscriptions / Total subscriptions"
                        className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span data-testid={`text-active-count-${agent.id}`}>{agent.activeSubscriptionCount}</span>
                        <span className="text-muted-foreground font-normal">/</span>
                        <span data-testid={`text-total-count-${agent.id}`}>{agent.totalSubscriptionCount}</span>
                      </Link>
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
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
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
      </main>
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
      <DialogFooter className="pt-4">
        <Button onClick={() => onSave(formData)} disabled={isLoading}>
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Changes
        </Button>
      </DialogFooter>
    </div>
  );
}
