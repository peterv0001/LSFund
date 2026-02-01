import { AdminSidebar } from "@/components/AdminSidebar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { 
  DollarSign, 
  CheckCircle,
  XCircle,
  Loader2,
  Calculator,
  CheckCheck
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
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function AdminCommissions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pendingCommissions, isLoading } = useQuery({
    queryKey: ['admin', 'commissions', 'pending'],
    queryFn: async () => {
      const res = await fetch(api.admin.commissions.pending.path, { credentials: 'include' });
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

  const totalPending = pendingCommissions?.reduce((sum: number, c: any) => sum + Number(c.amount), 0) || 0;

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'personal_deal': return 'bg-emerald-100 text-emerald-800';
      case 'binary_bonus': return 'bg-blue-100 text-blue-800';
      case 'generation_override': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      
      <main className="flex-1 ml-64 p-8">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Commission Management</h1>
            <p className="text-muted-foreground mt-1">
              Review and approve agent commissions.
            </p>
          </div>
        </header>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Commissions</CardDescription>
              <CardTitle className="text-3xl">{pendingCommissions?.length || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Pending Amount</CardDescription>
              <CardTitle className="text-3xl text-emerald-600">${totalPending.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="flex flex-col justify-center">
            <CardContent className="pt-6 space-y-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="w-full" disabled={calculateMutation.isPending}>
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
                    <AlertDialogAction onClick={() => calculateMutation.mutate()}>
                      Run Calculation
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full" disabled={approveAllMutation.isPending || !pendingCommissions?.length}>
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
                    <AlertDialogAction onClick={() => approveAllMutation.mutate()}>
                      Approve All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>

        {/* Pending Commissions Table */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50/50">
            <h3 className="font-semibold">Pending Commissions</h3>
          </div>
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
                  <TableRow key={comm.id} className="hover:bg-gray-50/50">
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
                      <Badge variant="secondary" className={getTypeBadgeColor(comm.type)}>
                        {comm.type.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {comm.dealId ? `Deal #${comm.dealId}` : 'Team Volume'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(comm.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-600">
                      ${Number(comm.amount).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          onClick={() => approveMutation.mutate(comm.id)}
                          disabled={approveMutation.isPending}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      </div>
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
        </div>
      </main>
    </div>
  );
}
