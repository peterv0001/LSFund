import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useDeals, useCreateDeal } from "@/hooks/use-deals";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2, Briefcase, Search, Filter } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function DealsPage() {
  const { user } = useAuth();
  const { data: deals, isLoading } = useDeals();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredDeals = deals?.filter(deal =>
    deal.merchantName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar />
      
      <main className="flex-1 lg:ml-64 p-4 pt-20 lg:pt-8 lg:p-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 data-testid="text-deals-title" className="text-3xl font-display font-bold text-primary">Deals Management</h1>
            <p className="text-muted-foreground mt-2">
              Track your loan origination, GBR, and commission waterfall.
            </p>
          </div>
          
          <CreateDealDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
        </header>

        <div className="flex items-center gap-4 mb-6 bg-white p-4 rounded-xl border border-border shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              data-testid="input-search-merchants"
              placeholder="Search merchants..." 
              className="pl-9 bg-gray-50 border-transparent focus:bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon" data-testid="button-filter">
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-gray-50/50 text-left">
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground uppercase tracking-wider">Merchant</th>
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground uppercase tracking-wider">Loan Amount</th>
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground uppercase tracking-wider">GBR</th>
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground uppercase tracking-wider">Revenue (10%)</th>
                  {user?.isAdmin && (
                    <th className="px-6 py-4 font-medium text-sm text-muted-foreground uppercase tracking-wider">Fulfillment Agent</th>
                  )}
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={user?.isAdmin ? 7 : 6} className="px-6 py-12 text-center text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading deals...
                    </td>
                  </tr>
                ) : filteredDeals && filteredDeals.length > 0 ? (
                  filteredDeals.map((deal) => (
                    <tr key={deal.id} data-testid={`row-deal-${deal.id}`} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {format(new Date(deal.fundedAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary" data-testid={`text-merchant-${deal.id}`}>
                        {deal.merchantName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        ${Number(deal.loanAmount).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600" data-testid={`text-gbr-${deal.id}`}>
                        {deal.gbrAmount ? `$${Number(deal.gbrAmount).toLocaleString()}` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-emerald-600">
                        +${Number(deal.companyRevenue).toLocaleString()}
                      </td>
                      {user?.isAdmin && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600" data-testid={`text-fulfillment-agent-${deal.id}`}>
                          {deal.fulfillmentAgentId ? `Agent #${deal.fulfillmentAgentId}` : 'Self'}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={deal.status === 'funded' ? 'default' : deal.status === 'rejected' ? 'destructive' : 'secondary'} data-testid={`badge-status-${deal.id}`}>
                          {deal.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={user?.isAdmin ? 7 : 6} className="px-6 py-12 text-center text-muted-foreground">
                      <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Briefcase className="w-6 h-6 text-gray-300" />
                      </div>
                      <p>No deals found yet.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function CreateDealDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { mutateAsync: createDeal, isPending } = useCreateDeal();
  const { toast } = useToast();
  
  const form = useForm({
    resolver: zodResolver(api.deals.create.input),
    defaultValues: {
      merchantName: "",
      loanAmount: "" as any,
      gbrAmount: "" as any,
    }
  });

  const onSubmit = async (data: any) => {
    try {
      const submitData = { ...data };
      if (!submitData.gbrAmount || submitData.gbrAmount === "") {
        delete submitData.gbrAmount;
      }
      await createDeal(submitData);
      toast({ title: "Success", description: "Deal logged successfully" });
      form.reset();
      onOpenChange(false);
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  };

  const loanAmount = form.watch("loanAmount");
  const gbrAmountInput = form.watch("gbrAmount");
  const estimatedRevenue = loanAmount ? (Number(loanAmount) * 0.1) : 0;
  const gbrValue = gbrAmountInput ? Number(gbrAmountInput) : estimatedRevenue;
  const macEstimate = gbrValue * 0.22;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="button-log-deal" className="gap-2 bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/25">
          <Plus className="w-4 h-4" />
          Log New Deal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log New Funded Deal</DialogTitle>
          <DialogDescription>
            Enter the details of the funded loan. GBR drives the commission waterfall (MAC, TFC, PICF).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Merchant Name</Label>
            <Input data-testid="input-merchant-name" placeholder="e.g. Acme Corp" {...form.register("merchantName")} />
            {form.formState.errors.merchantName && (
              <p className="text-xs text-destructive">{form.formState.errors.merchantName.message as string}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Loan Amount ($)</Label>
            <Input 
              data-testid="input-loan-amount"
              type="number" 
              placeholder="0.00" 
              {...form.register("loanAmount")} 
            />
            {form.formState.errors.loanAmount && (
              <p className="text-xs text-destructive">{form.formState.errors.loanAmount.message as string}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>GBR Amount ($) <span className="text-muted-foreground text-xs">(optional, defaults to 10% of loan)</span></Label>
            <Input 
              data-testid="input-gbr-amount"
              type="number" 
              placeholder={estimatedRevenue ? estimatedRevenue.toFixed(2) : "0.00"}
              {...form.register("gbrAmount")} 
            />
            {form.formState.errors.gbrAmount && (
              <p className="text-xs text-destructive">{(form.formState.errors.gbrAmount as any).message as string}</p>
            )}
          </div>

          <div className="bg-gray-50 p-4 rounded-lg space-y-2 border border-dashed border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-500">Estimated Revenue (10%)</span>
              <span className="text-lg font-bold text-emerald-600" data-testid="text-estimated-revenue">
                ${estimatedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-500">GBR (Gross Brokerage Revenue)</span>
              <span className="text-lg font-bold text-blue-600" data-testid="text-gbr-value">
                ${gbrValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center border-t border-gray-200 pt-2">
              <span className="text-sm font-medium text-gray-500">Est. MAC Commission (22%)</span>
              <span className="text-sm font-bold text-primary" data-testid="text-mac-estimate">
                ${macEstimate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">Cancel</Button>
            <Button type="submit" disabled={isPending} data-testid="button-submit-deal">
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Submit Deal
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
