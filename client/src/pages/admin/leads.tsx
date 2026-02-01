import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Loader2, Search, Upload, Users, FileSpreadsheet, Check, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Lead, Agent } from "@shared/schema";

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-purple-100 text-purple-800",
  warm: "bg-orange-100 text-orange-800",
  hot: "bg-red-100 text-red-800",
  qualified: "bg-emerald-100 text-emerald-800",
  submitted: "bg-indigo-100 text-indigo-800",
  closed_won: "bg-green-100 text-green-800",
  closed_lost: "bg-gray-100 text-gray-800",
  ai_followup: "bg-cyan-100 text-cyan-800",
};

export default function AdminLeadsPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<number[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadData, setUploadData] = useState<any[]>([]);

  const { data: leadsData, isLoading } = useQuery<{ leads: Lead[]; total: number }>({
    queryKey: ["/api/admin/leads", showUnassigned ? "?unassigned=true" : ""],
  });

  const { data: stats } = useQuery<{ total: number; unassigned: number; byStatus: Record<string, number>; aiFollowupPending: number }>({
    queryKey: ["/api/admin/leads/stats"],
  });

  const { data: agentsData } = useQuery<{ agents: Agent[] }>({
    queryKey: ["/api/admin/agents"],
  });

  const { data: pendingRequests } = useQuery<any[]>({
    queryKey: ["/api/admin/lead-requests/pending"],
  });

  const assignMutation = useMutation({
    mutationFn: async ({ leadIds, agentId }: { leadIds: number[]; agentId: number }) => {
      const res = await apiRequest("POST", "/api/admin/leads/assign", { leadIds, agentId });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/leads/stats"] });
      setSelectedLeads([]);
      setAssignDialogOpen(false);
      setSelectedAgentId("");
      toast({ title: `${data.assigned} leads assigned successfully` });
    },
    onError: () => {
      toast({ title: "Failed to assign leads", variant: "destructive" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (leads: any[]) => {
      const res = await apiRequest("POST", "/api/admin/leads/upload", { leads });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/leads/stats"] });
      setUploadDialogOpen(false);
      setUploadData([]);
      toast({ title: `${data.created} leads imported successfully` });
    },
    onError: () => {
      toast({ title: "Failed to upload leads", variant: "destructive" });
    },
  });

  const respondToRequestMutation = useMutation({
    mutationFn: async ({ id, status, leadsAssigned }: { id: number; status: string; leadsAssigned?: number }) => {
      const res = await apiRequest("POST", `/api/admin/lead-requests/${id}/respond`, { status, leadsAssigned });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lead-requests/pending"] });
      toast({ title: "Request updated" });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        const leads = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const lead: any = {};
          
          headers.forEach((header, idx) => {
            const value = values[idx] || '';
            if (header.includes('name') && !header.includes('company')) lead.contactName = value;
            else if (header.includes('email')) lead.contactEmail = value;
            else if (header.includes('phone')) lead.contactPhone = value;
            else if (header.includes('company')) lead.companyName = value;
            else if (header.includes('industry')) lead.industry = value;
            else if (header.includes('city')) lead.city = value;
            else if (header.includes('state')) lead.state = value;
            else if (header.includes('zip')) lead.zip = value;
          });
          
          return lead;
        }).filter(lead => lead.contactName);

        setUploadData(leads);
        setUploadDialogOpen(true);
      } catch (error) {
        toast({ title: "Failed to parse file", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filteredLeads = leadsData?.leads.filter(lead => {
    if (searchTerm === "") return true;
    return lead.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.contactEmail?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const toggleLeadSelection = (id: number) => {
    setSelectedLeads(prev => 
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (!filteredLeads) return;
    const unassignedIds = filteredLeads.filter(l => !l.assignedAgentId).map(l => l.id);
    if (selectedLeads.length === unassignedIds.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(unassignedIds);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      
      <main className="flex-1 ml-64 p-8">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Lead Management</h1>
            <p className="text-muted-foreground mt-1">Upload, distribute, and track leads</p>
          </div>
          
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button 
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-upload-csv"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload CSV
            </Button>
            {selectedLeads.length > 0 && (
              <Button onClick={() => setAssignDialogOpen(true)} data-testid="button-assign-leads">
                <UserPlus className="w-4 h-4 mr-2" />
                Assign {selectedLeads.length} Leads
              </Button>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Leads</CardDescription>
              <CardTitle className="text-2xl">{stats?.total || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Unassigned</CardDescription>
              <CardTitle className="text-2xl text-orange-600">{stats?.unassigned || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>AI Queue</CardDescription>
              <CardTitle className="text-2xl text-cyan-600">{stats?.aiFollowupPending || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Requests</CardDescription>
              <CardTitle className="text-2xl text-purple-600">{pendingRequests?.length || 0}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {pendingRequests && pendingRequests.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Pending Lead Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingRequests.map((request: any) => (
                  <div key={request.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{request.agent?.firstName} {request.agent?.lastName}</p>
                      <p className="text-sm text-muted-foreground">
                        Requesting {request.requestedCount} leads
                        {request.preferredIndustry && ` • ${request.preferredIndustry}`}
                        {request.preferredLocation && ` • ${request.preferredLocation}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => respondToRequestMutation.mutate({ id: request.id, status: 'denied' })}
                      >
                        Deny
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => respondToRequestMutation.mutate({ id: request.id, status: 'approved' })}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center gap-4 mb-6 bg-white p-4 rounded-xl border shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search leads..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-admin-search-leads"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox 
              checked={showUnassigned} 
              onCheckedChange={(checked) => setShowUnassigned(!!checked)}
              data-testid="checkbox-unassigned"
            />
            <span className="text-sm">Unassigned only</span>
          </label>
        </div>

        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-4 py-3">
                  <Checkbox 
                    checked={selectedLeads.length > 0 && selectedLeads.length === filteredLeads?.filter(l => !l.assignedAgentId).length}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-3 font-medium text-sm text-muted-foreground">Contact</th>
                <th className="px-4 py-3 font-medium text-sm text-muted-foreground">Company</th>
                <th className="px-4 py-3 font-medium text-sm text-muted-foreground">Location</th>
                <th className="px-4 py-3 font-medium text-sm text-muted-foreground">Status</th>
                <th className="px-4 py-3 font-medium text-sm text-muted-foreground">Assigned To</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading leads...
                  </td>
                </tr>
              ) : filteredLeads && filteredLeads.length > 0 ? (
                filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50" data-testid={`row-admin-lead-${lead.id}`}>
                    <td className="px-4 py-3">
                      {!lead.assignedAgentId && (
                        <Checkbox 
                          checked={selectedLeads.includes(lead.id)}
                          onCheckedChange={() => toggleLeadSelection(lead.id)}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{lead.contactName}</p>
                      <p className="text-xs text-muted-foreground">{lead.contactEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">{lead.companyName || "-"}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {lead.city && lead.state ? `${lead.city}, ${lead.state}` : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={statusColors[lead.status]}>{lead.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {lead.assignedAgentId ? (
                        <span className="text-green-600">Agent #{lead.assignedAgentId}</span>
                      ) : (
                        <span className="text-orange-600">Unassigned</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>No leads found. Upload a CSV to get started.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Leads to Agent</DialogTitle>
              <DialogDescription>
                Select an agent to assign {selectedLeads.length} leads to.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger data-testid="select-agent">
                  <SelectValue placeholder="Select an agent..." />
                </SelectTrigger>
                <SelectContent>
                  {agentsData?.agents.filter(a => !a.isAdmin).map((agent) => (
                    <SelectItem key={agent.id} value={agent.id.toString()}>
                      {agent.firstName} {agent.lastName} ({agent.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => assignMutation.mutate({ leadIds: selectedLeads, agentId: parseInt(selectedAgentId) })}
                disabled={!selectedAgentId || assignMutation.isPending}
                data-testid="button-confirm-assign"
              >
                {assignMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Assign Leads
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Preview Import</DialogTitle>
              <DialogDescription>
                {uploadData.length} leads ready to import
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[400px] overflow-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Company</th>
                    <th className="px-3 py-2 text-left">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {uploadData.slice(0, 20).map((lead, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{lead.contactName}</td>
                      <td className="px-3 py-2">{lead.contactEmail || "-"}</td>
                      <td className="px-3 py-2">{lead.companyName || "-"}</td>
                      <td className="px-3 py-2">{lead.city && lead.state ? `${lead.city}, ${lead.state}` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {uploadData.length > 20 && (
                <p className="text-center py-2 text-muted-foreground">
                  ...and {uploadData.length - 20} more
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => uploadMutation.mutate(uploadData)}
                disabled={uploadMutation.isPending}
                data-testid="button-confirm-upload"
              >
                {uploadMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Import {uploadData.length} Leads
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
