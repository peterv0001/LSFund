import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Loader2, Search, Phone, Mail, Building2, MapPin, Bot, Send, Plus, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import type { Lead, LeadRequest } from "@shared/schema";

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 border-blue-200",
  contacted: "bg-purple-100 text-purple-800 border-purple-200",
  warm: "bg-orange-100 text-orange-800 border-orange-200",
  hot: "bg-red-100 text-red-800 border-red-200",
  qualified: "bg-emerald-100 text-emerald-800 border-emerald-200",
  submitted: "bg-indigo-100 text-indigo-800 border-indigo-200",
  closed_won: "bg-green-100 text-green-800 border-green-200",
  closed_lost: "bg-gray-100 text-gray-800 border-gray-200",
  ai_followup: "bg-cyan-100 text-cyan-800 border-cyan-200",
};

const statusLabels: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  warm: "Warm",
  hot: "Hot",
  qualified: "Qualified",
  submitted: "Submitted",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
  ai_followup: "AI Follow-up",
};

// Friendly names for the Merchant Growth Platform shared landing pages. The
// `campaign` value stored in `source` (as `landing:<campaign>`) maps to a page.
const campaignLabels: Record<string, string> = {
  "lp-platform-overview": "Platform",
  "lp-platform-leaks": "Leaks",
  "lp-platform-scale": "Scale",
};

// Captured enrichment fields worth surfacing to the agent, in display order.
const enrichmentFieldLabels: Array<{ key: string; label: string }> = [
  { key: "tier_interest", label: "Tier interest" },
  { key: "bottleneck", label: "Bottleneck" },
  { key: "leak", label: "Biggest leak" },
  { key: "growth_goal", label: "Growth goal" },
];

type LeadSource = {
  isShared: boolean;
  pageLabel: string;
  campaign: string | null;
};

function getLeadSource(lead: Lead): LeadSource {
  const source = lead.source ?? "";
  if (source.startsWith("landing:")) {
    const campaign = source.slice("landing:".length);
    return {
      isShared: true,
      pageLabel: campaignLabels[campaign] ?? "Shared Link",
      campaign,
    };
  }
  return { isShared: false, pageLabel: "", campaign: null };
}

function getCapturedFields(lead: Lead): Array<{ label: string; value: string }> {
  const data = (lead.enrichmentData ?? {}) as Record<string, unknown>;
  return enrichmentFieldLabels
    .map(({ key, label }) => ({ label, value: data[key] }))
    .filter((f) => typeof f.value === "string" && f.value.trim() !== "")
    .map((f) => ({ label: f.label, value: String(f.value) }));
}

export default function LeadsPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestCount, setRequestCount] = useState("10");
  const [requestIndustry, setRequestIndustry] = useState("");
  const [requestLocation, setRequestLocation] = useState("");
  const [requestNotes, setRequestNotes] = useState("");

  const { data: leads, isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  const { data: myRequests } = useQuery<LeadRequest[]>({
    queryKey: ["/api/leads/requests"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: string; notes?: string }) => {
      const res = await apiRequest("PATCH", `/api/leads/${id}/status`, { status, notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setSelectedLead(null);
      toast({ title: "Lead status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });

  const requestAIFollowupMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/leads/${id}/ai-followup`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Lead submitted for AI follow-up" });
    },
    onError: () => {
      toast({ title: "Failed to submit for AI follow-up", variant: "destructive" });
    },
  });

  const requestMoreLeadsMutation = useMutation({
    mutationFn: async (data: { requestedCount: number; preferredIndustry?: string; preferredLocation?: string; notes?: string }) => {
      const res = await apiRequest("POST", "/api/leads/request", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/requests"] });
      setRequestDialogOpen(false);
      setRequestCount("10");
      setRequestIndustry("");
      setRequestLocation("");
      setRequestNotes("");
      toast({ title: "Lead request submitted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to submit request", variant: "destructive" });
    },
  });

  const filteredLeads = leads?.filter(lead => {
    const matchesSearch = searchTerm === "" || 
      lead.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.contactEmail?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleUpdateStatus = () => {
    if (!selectedLead || !newStatus) return;
    updateStatusMutation.mutate({ id: selectedLead.id, status: newStatus, notes: notes || undefined });
  };

  const handleRequestMoreLeads = () => {
    requestMoreLeadsMutation.mutate({
      requestedCount: parseInt(requestCount),
      preferredIndustry: requestIndustry || undefined,
      preferredLocation: requestLocation || undefined,
      notes: requestNotes || undefined,
    });
  };

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar />
      
      <main className="flex-1 lg:ml-64 p-4 pt-20 lg:pt-8 lg:p-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-primary">My Leads</h1>
            <p className="text-muted-foreground mt-2">
              Manage your assigned leads and track their progress.
            </p>
          </div>
          
          <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-request-leads">
                <Plus className="w-4 h-4 mr-2" />
                Request More Leads
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request More Leads</DialogTitle>
                <DialogDescription>
                  Submit a request to the admin for additional leads.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="count">Number of Leads</Label>
                  <Input
                    id="count"
                    type="number"
                    value={requestCount}
                    onChange={(e) => setRequestCount(e.target.value)}
                    min="1"
                    max="100"
                    data-testid="input-lead-count"
                  />
                </div>
                <div>
                  <Label htmlFor="industry">Preferred Industry (optional)</Label>
                  <Input
                    id="industry"
                    value={requestIndustry}
                    onChange={(e) => setRequestIndustry(e.target.value)}
                    placeholder="e.g., Retail, Restaurant, Healthcare"
                    data-testid="input-industry"
                  />
                </div>
                <div>
                  <Label htmlFor="location">Preferred Location (optional)</Label>
                  <Input
                    id="location"
                    value={requestLocation}
                    onChange={(e) => setRequestLocation(e.target.value)}
                    placeholder="e.g., California, New York"
                    data-testid="input-location"
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    value={requestNotes}
                    onChange={(e) => setRequestNotes(e.target.value)}
                    placeholder="Any specific requirements..."
                    data-testid="input-request-notes"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleRequestMoreLeads}
                  disabled={requestMoreLeadsMutation.isPending}
                  data-testid="button-submit-request"
                >
                  {requestMoreLeadsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Submit Request
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </header>

        {myRequests && myRequests.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">My Lead Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {myRequests.slice(0, 3).map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{request.requestedCount} leads requested</span>
                      {request.preferredIndustry && (
                        <span className="text-xs text-muted-foreground">• {request.preferredIndustry}</span>
                      )}
                    </div>
                    <Badge className={
                      request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      request.status === 'approved' ? 'bg-green-100 text-green-800' :
                      request.status === 'fulfilled' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }>
                      {request.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center gap-4 mb-6 bg-white p-4 rounded-xl border border-border shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search leads..." 
              className="pl-9 bg-gray-50 border-transparent focus:bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search-leads"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="select-status-filter">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(statusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-gray-50/50 text-left">
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground uppercase tracking-wider">Company</th>
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground uppercase tracking-wider">Source</th>
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground uppercase tracking-wider">Location</th>
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading leads...
                    </td>
                  </tr>
                ) : filteredLeads && filteredLeads.length > 0 ? (
                  filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50/50 transition-colors" data-testid={`row-lead-${lead.id}`}>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-primary">{lead.contactName}</span>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {lead.contactEmail && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {lead.contactEmail}
                              </span>
                            )}
                            {lead.contactPhone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {lead.contactPhone}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{lead.companyName || "-"}</span>
                        </div>
                        {lead.industry && (
                          <span className="text-xs text-muted-foreground">{lead.industry}</span>
                        )}
                      </td>
                      <td className="px-6 py-4" data-testid={`cell-source-${lead.id}`}>
                        {(() => {
                          const src = getLeadSource(lead);
                          const captured = getCapturedFields(lead);
                          if (!src.isShared) {
                            return <span className="text-sm text-muted-foreground">-</span>;
                          }
                          return (
                            <div className="flex flex-col gap-1.5">
                              <span
                                className="inline-flex w-fit items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-amber-100 text-amber-800 border-amber-200"
                                data-testid={`badge-source-${lead.id}`}
                              >
                                <Share2 className="w-3 h-3" />
                                {src.pageLabel}
                              </span>
                              {captured.length > 0 && (
                                <div className="flex flex-col gap-0.5">
                                  {captured.map((field) => (
                                    <span
                                      key={field.label}
                                      className="text-xs text-muted-foreground"
                                      data-testid={`text-captured-${lead.id}-${field.label.toLowerCase().replace(/\s+/g, '-')}`}
                                    >
                                      <span className="font-medium text-foreground">{field.label}:</span>{" "}
                                      {field.value}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {lead.city && lead.state ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {lead.city}, {lead.state}
                          </span>
                        ) : "-"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[lead.status] || statusColors.new}`}>
                          {statusLabels[lead.status] || lead.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedLead(lead);
                              setNewStatus(lead.status);
                              setNotes(lead.notes || "");
                            }}
                            data-testid={`button-update-lead-${lead.id}`}
                          >
                            Update
                          </Button>
                          {lead.status !== 'ai_followup' && lead.status !== 'closed_won' && lead.status !== 'closed_lost' && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => requestAIFollowupMutation.mutate(lead.id)}
                              disabled={requestAIFollowupMutation.isPending}
                              title="Submit for AI Follow-up"
                              data-testid={`button-ai-followup-${lead.id}`}
                            >
                              <Bot className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      <UserPlus className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p className="font-medium">No leads assigned</p>
                      <p className="text-sm">Request leads from admin to get started.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Lead Status</DialogTitle>
              <DialogDescription>
                Update the status for {selectedLead?.contactName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger data-testid="select-new-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this lead..."
                  data-testid="input-lead-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedLead(null)}>Cancel</Button>
              <Button 
                onClick={handleUpdateStatus}
                disabled={updateStatusMutation.isPending}
                data-testid="button-save-status"
              >
                {updateStatusMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
