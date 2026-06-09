import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminSidebar } from "@/components/AdminSidebar";
import { SchemaDriftBanner } from "@/components/SchemaDriftBanner";
import { api } from "@shared/routes";
import { 
  DollarSign, 
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  Loader2,
  Send,
  Eye,
  CreditCard,
  AlertCircle,
  X
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type Payout = {
  id: number;
  agentId: number;
  amount: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  periodStart: string;
  periodEnd: string;
  externalId: string | null;
  notes: string | null;
  processedAt: string | null;
  processedById: number | null;
  createdAt: string;
  agent?: {
    firstName: string;
    lastName: string;
    email: string;
    payoutMethod: string;
    payoutEmail: string | null;
  };
};

type PayoutPreview = {
  agentId: number;
  firstName: string;
  lastName: string;
  email: string;
  payoutMethod: string;
  payoutEmail: string | null;
  totalAmount: number;
  commissionCount: number;
};

export default function AdminPayoutsPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showMarkPaidDialog, setShowMarkPaidDialog] = useState<Payout | null>(null);
  const [periodStart, setPeriodStart] = useState(() => 
    format(startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  );
  const [periodEnd, setPeriodEnd] = useState(() => 
    format(endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  );
  const [externalId, setExternalId] = useState('');
  const [notes, setNotes] = useState('');
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch existing payouts
  const { data: payoutsData, isLoading } = useQuery({
    queryKey: ['admin-payouts'],
    queryFn: async () => {
      const res = await fetch(api.admin.payouts.list.path, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  // Fetch payout preview
  const { data: preview, isLoading: loadingPreview, refetch: refetchPreview } = useQuery({
    queryKey: ['admin-payouts-preview', periodStart, periodEnd],
    queryFn: async () => {
      const params = new URLSearchParams({ periodStart, periodEnd });
      const res = await fetch(`${api.admin.payouts.preview.path}?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json() as Promise<PayoutPreview[]>;
    },
    enabled: showCreateDialog,
  });

  // Create payout mutation
  const createPayoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(api.admin.payouts.create.path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          periodStart, 
          periodEnd,
          agentIds: preview?.map(p => p.agentId) || [],
        }),
      });
      if (!res.ok) throw new Error('Failed to create payouts');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payouts'] });
      setShowCreateDialog(false);
      toast({ title: 'Payouts Created', description: 'Payout batch has been created successfully.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create payouts.', variant: 'destructive' });
    },
  });

  // Mark as paid mutation
  const markPaidMutation = useMutation({
    mutationFn: async (payoutId: number) => {
      const res = await fetch(api.admin.payouts.markPaid.path.replace(':id', String(payoutId)), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ externalId, notes }),
      });
      if (!res.ok) throw new Error('Failed to mark as paid');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payouts'] });
      setShowMarkPaidDialog(null);
      setExternalId('');
      setNotes('');
      toast({ title: 'Payout Marked as Paid', description: 'The payout has been marked as completed.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to mark payout as paid.', variant: 'destructive' });
    },
  });

  const payouts: Payout[] = payoutsData?.payouts || [];
  const pendingPayouts = payouts.filter(p => p.status === 'pending');
  const completedPayouts = payouts.filter(p => p.status === 'completed');
  const totalPending = pendingPayouts.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPaid = completedPayouts.reduce((sum, p) => sum + Number(p.amount), 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-emerald-100 text-emerald-700">Paid</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-700">Processing</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700">Failed</Badge>;
      default:
        return <Badge className="bg-amber-100 text-amber-700">Pending</Badge>;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <AdminSidebar />
      
      <main className="flex-1 lg:ml-64 p-4 pt-20 lg:pt-8 lg:p-8">
        <SchemaDriftBanner />
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-primary flex items-center gap-3">
              <CreditCard className="w-8 h-8" />
              Payout Management
            </h1>
            <p className="text-muted-foreground mt-2">
              Process and track agent commission payouts.
            </p>
          </div>
          
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Send className="w-4 h-4" />
            Create Payout Batch
          </Button>
        </header>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Payouts</CardDescription>
              <CardTitle className="text-2xl text-primary">
                ${totalPending.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {pendingPayouts.length} payout{pendingPayouts.length !== 1 ? 's' : ''} waiting
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Paid (All Time)</CardDescription>
              <CardTitle className="text-2xl text-emerald-600">
                ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {completedPayouts.length} payout{completedPayouts.length !== 1 ? 's' : ''} completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>This Week</CardDescription>
              <CardTitle className="text-2xl">
                {payouts.filter(p => {
                  const created = new Date(p.createdAt);
                  const weekAgo = subWeeks(new Date(), 1);
                  return created >= weekAgo;
                }).length}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Payouts created</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Agents with Pending</CardDescription>
              <CardTitle className="text-2xl">
                {new Set(pendingPayouts.map(p => p.agentId)).size}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Unique agents</p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="pending" className="space-y-6">
            <TabsList>
              <TabsTrigger value="pending" className="gap-2">
                <Clock className="w-4 h-4" />
                Pending ({pendingPayouts.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Completed ({completedPayouts.length})
              </TabsTrigger>
              <TabsTrigger value="all" className="gap-2">
                All ({payouts.length})
              </TabsTrigger>
            </TabsList>

            {['pending', 'completed', 'all'].map(tab => (
              <TabsContent key={tab} value={tab}>
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {tab === 'pending' ? 'Pending Payouts' : 
                       tab === 'completed' ? 'Completed Payouts' : 'All Payouts'}
                    </CardTitle>
                    <CardDescription>
                      {tab === 'pending' ? 'Payouts awaiting processing' : 
                       tab === 'completed' ? 'Successfully processed payouts' : 'Complete payout history'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Agent</TableHead>
                            <TableHead>Period</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(tab === 'pending' ? pendingPayouts : 
                            tab === 'completed' ? completedPayouts : payouts
                          ).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                No payouts found
                              </TableCell>
                            </TableRow>
                          ) : (
                            (tab === 'pending' ? pendingPayouts : 
                             tab === 'completed' ? completedPayouts : payouts
                            ).map(payout => (
                              <TableRow key={payout.id}>
                                <TableCell>
                                  <div className="font-medium">
                                    {payout.agent?.firstName} {payout.agent?.lastName}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {payout.agent?.email}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm">
                                    {format(new Date(payout.periodStart), 'MMM d')} - {format(new Date(payout.periodEnd), 'MMM d, yyyy')}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="capitalize">
                                    {payout.agent?.payoutMethod || 'Not set'}
                                  </Badge>
                                </TableCell>
                                <TableCell>{getStatusBadge(payout.status)}</TableCell>
                                <TableCell className="text-right font-semibold">
                                  ${Number(payout.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-right">
                                  {payout.status === 'pending' && (
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => setShowMarkPaidDialog(payout)}
                                    >
                                      <CheckCircle2 className="w-4 h-4 mr-1" />
                                      Mark Paid
                                    </Button>
                                  )}
                                  {payout.status === 'completed' && payout.externalId && (
                                    <span className="text-xs text-muted-foreground">
                                      Ref: {payout.externalId}
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* Create Payout Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Payout Batch</DialogTitle>
              <DialogDescription>
                Select a period to calculate and create payouts for all agents with approved commissions.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Period Start</Label>
                  <Input 
                    type="date" 
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Period End</Label>
                  <Input 
                    type="date" 
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </div>
              </div>

              <Button variant="outline" onClick={() => refetchPreview()} disabled={loadingPreview}>
                {loadingPreview && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Eye className="w-4 h-4 mr-2" />
                Preview Payouts
              </Button>

              {preview && preview.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 font-medium text-sm">
                    {preview.length} agent{preview.length !== 1 ? 's' : ''} with payable commissions
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Agent</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead className="text-center"># Commissions</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.map(p => (
                          <TableRow key={p.agentId}>
                            <TableCell>
                              <div className="font-medium">{p.firstName} {p.lastName}</div>
                              <div className="text-xs text-muted-foreground">{p.email}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {p.payoutMethod || 'Not set'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">{p.commissionCount}</TableCell>
                            <TableCell className="text-right font-semibold text-emerald-600">
                              ${p.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="bg-gray-50 px-4 py-3 flex justify-between font-medium">
                    <span>Total</span>
                    <span className="text-emerald-600">
                      ${preview.reduce((sum, p) => sum + p.totalAmount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}

              {preview && preview.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                  <p>No approved commissions found for this period.</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => createPayoutMutation.mutate()}
                disabled={!preview?.length || createPayoutMutation.isPending}
              >
                {createPayoutMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create {preview?.length || 0} Payout{preview?.length !== 1 ? 's' : ''}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Mark Paid Dialog */}
        <Dialog open={!!showMarkPaidDialog} onOpenChange={() => setShowMarkPaidDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark Payout as Paid</DialogTitle>
              <DialogDescription>
                Confirm that this payout has been processed externally.
              </DialogDescription>
            </DialogHeader>

            {showMarkPaidDialog && (
              <div className="space-y-4 py-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-muted-foreground">Agent</span>
                    <span className="font-medium">
                      {showMarkPaidDialog.agent?.firstName} {showMarkPaidDialog.agent?.lastName}
                    </span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-semibold text-emerald-600">
                      ${Number(showMarkPaidDialog.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pay to</span>
                    <span className="font-medium">
                      {showMarkPaidDialog.agent?.payoutEmail || showMarkPaidDialog.agent?.email}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>External Reference ID (optional)</Label>
                  <Input 
                    placeholder="e.g. PayPal Transaction ID"
                    value={externalId}
                    onChange={(e) => setExternalId(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Input 
                    placeholder="Any additional notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowMarkPaidDialog(null)}>
                Cancel
              </Button>
              <Button 
                onClick={() => showMarkPaidDialog && markPaidMutation.mutate(showMarkPaidDialog.id)}
                disabled={markPaidMutation.isPending}
              >
                {markPaidMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Confirm Paid
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
