import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useDeals, useCreateDeal } from "@/hooks/use-deals";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const { data: deals, isLoading } = useDeals();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar />
      
      <main className="flex-1 lg:ml-64 p-4 pt-20 lg:pt-8 lg:p-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-primary">Deals Management</h1>
            <p className="text-muted-foreground mt-2">
              Track your loan origination and company revenue.
            </p>
          </div>
          
          <CreateDealDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
        </header>

        {/* Filters Bar */}
        <div className="flex items-center gap-4 mb-6 bg-white p-4 rounded-xl border border-border shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search merchants..." className="pl-9 bg-gray-50 border-transparent focus:bg-white" />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-gray-50/50 text-left">
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground uppercase tracking-wider">Merchant</th>
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground uppercase tracking-wider">Loan Amount</th>
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground uppercase tracking-wider">Revenue (10%)</th>
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading deals...
                    </td>
                  </tr>
                ) : deals && deals.length > 0 ? (
                  deals.map((deal) => (
                    <tr key={deal.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {format(new Date(deal.fundedAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary">
                        {deal.merchantName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        ${Number(deal.loanAmount).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-emerald-600">
                        +${Number(deal.companyRevenue).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200 capitalize">
                          {deal.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
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
    }
  });

  const onSubmit = async (data: any) => {
    try {
      await createDeal(data);
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
  const estimatedRevenue = loanAmount ? (Number(loanAmount) * 0.1) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/25">
          <Plus className="w-4 h-4" />
          Log New Deal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log New Funded Deal</DialogTitle>
          <DialogDescription>
            Enter the details of the funded loan. Revenue is calculated automatically at 10%.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Merchant Name</Label>
            <Input placeholder="e.g. Acme Corp" {...form.register("merchantName")} />
            {form.formState.errors.merchantName && (
              <p className="text-xs text-destructive">{form.formState.errors.merchantName.message as string}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Loan Amount ($)</Label>
            <Input 
              type="number" 
              placeholder="0.00" 
              {...form.register("loanAmount")} 
            />
            {form.formState.errors.loanAmount && (
              <p className="text-xs text-destructive">{form.formState.errors.loanAmount.message as string}</p>
            )}
          </div>

          <div className="bg-gray-50 p-4 rounded-lg flex justify-between items-center border border-dashed border-gray-200">
            <span className="text-sm font-medium text-gray-500">Estimated Revenue (10%)</span>
            <span className="text-lg font-bold text-emerald-600">
              ${estimatedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Submit Deal
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
