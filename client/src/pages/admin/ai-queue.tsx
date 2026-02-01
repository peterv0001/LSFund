import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Loader2, Check, Mail, Phone, Building2, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import type { Lead, Agent } from "@shared/schema";

type LeadWithAgent = Lead & { agent?: Agent };

export default function AIQueuePage() {
  const { toast } = useToast();

  const { data: queue, isLoading } = useQuery<LeadWithAgent[]>({
    queryKey: ["/api/admin/leads/ai-queue"],
  });

  const markProcessedMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/leads/${id}/ai-processed`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/leads/ai-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/leads/stats"] });
      toast({ title: "Lead marked as processed" });
    },
    onError: () => {
      toast({ title: "Failed to update lead", variant: "destructive" });
    },
  });

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      
      <main className="flex-1 ml-64 p-8">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center">
              <Bot className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">AI Follow-up Queue</h1>
              <p className="text-muted-foreground">Leads flagged for AI-powered follow-up</p>
            </div>
          </div>
        </header>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">How it Works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ol className="list-decimal list-inside space-y-1">
              <li>Agents flag leads that need automated follow-up</li>
              <li>Leads appear in this queue for processing</li>
              <li>Export leads to your AI follow-up system</li>
              <li>Mark leads as processed once complete</li>
            </ol>
          </CardContent>
        </Card>

        <div className="bg-white rounded-xl border shadow-sm">
          {isLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-cyan-600" />
              <p className="text-muted-foreground">Loading queue...</p>
            </div>
          ) : queue && queue.length > 0 ? (
            <div className="divide-y">
              {queue.map((lead) => (
                <div key={lead.id} className="p-6 hover:bg-gray-50" data-testid={`row-ai-lead-${lead.id}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{lead.contactName}</h3>
                        <Badge className="bg-cyan-100 text-cyan-800">AI Follow-up</Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        {lead.contactEmail && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="w-4 h-4" />
                            {lead.contactEmail}
                          </div>
                        )}
                        {lead.contactPhone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="w-4 h-4" />
                            {lead.contactPhone}
                          </div>
                        )}
                        {lead.companyName && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Building2 className="w-4 h-4" />
                            {lead.companyName}
                          </div>
                        )}
                        {lead.agent && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="w-4 h-4" />
                            {lead.agent.firstName} {lead.agent.lastName}
                          </div>
                        )}
                      </div>

                      {lead.notes && (
                        <p className="mt-3 text-sm text-muted-foreground bg-gray-50 p-3 rounded-lg">
                          <strong>Notes:</strong> {lead.notes}
                        </p>
                      )}

                      <p className="mt-2 text-xs text-muted-foreground">
                        Submitted {lead.aiFollowupRequestedAt ? format(new Date(lead.aiFollowupRequestedAt), "MMM d, yyyy 'at' h:mm a") : "recently"}
                      </p>
                    </div>

                    <Button 
                      onClick={() => markProcessedMutation.mutate(lead.id)}
                      disabled={markProcessedMutation.isPending}
                      data-testid={`button-mark-processed-${lead.id}`}
                    >
                      {markProcessedMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 mr-2" />
                      )}
                      Mark Processed
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <Bot className="w-16 h-16 mx-auto mb-4 text-gray-200" />
              <h3 className="font-medium text-lg mb-1">Queue Empty</h3>
              <p className="text-muted-foreground">No leads are currently awaiting AI follow-up.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
