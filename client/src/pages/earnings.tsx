import { useCommissions } from "@/hooks/use-commissions";
import { Sidebar } from "@/components/Sidebar";
import { Loader2, DollarSign, Wallet } from "lucide-react";
import { format } from "date-fns";

export default function EarningsPage() {
  const { data: commissions, isLoading } = useCommissions();

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar />
      
      <main className="flex-1 lg:ml-64 p-4 pt-20 lg:pt-8 lg:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-display font-bold text-primary">Commissions</h1>
          <p className="text-muted-foreground mt-2">
            Track your weekly payouts and bonuses.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-8 text-white shadow-xl">
            <div className="flex items-center gap-3 mb-4 opacity-80">
              <Wallet className="w-5 h-5" />
              <span className="text-sm font-medium uppercase tracking-wider">Total Earned</span>
            </div>
            <div className="text-4xl font-bold mb-1">$0.00</div>
            <div className="text-white/60 text-sm">Lifetime earnings across all streams</div>
          </div>
          
          <div className="bg-white rounded-2xl p-8 border border-border shadow-sm">
             <div className="flex items-center gap-3 mb-4 text-muted-foreground">
              <DollarSign className="w-5 h-5" />
              <span className="text-sm font-medium uppercase tracking-wider">Pending Payout</span>
            </div>
            <div className="text-4xl font-bold text-primary mb-1">$0.00</div>
            <div className="text-muted-foreground text-sm">Scheduled for next Friday</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-gray-50/50">
            <h3 className="font-semibold text-primary">Commission History</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground">Date</th>
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground">Type</th>
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground">Description</th>
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground text-right">Amount</th>
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading earnings...
                    </td>
                  </tr>
                ) : commissions && commissions.length > 0 ? (
                  commissions.map((comm) => (
                    <tr key={comm.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {format(new Date(comm.createdAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-primary capitalize">
                        {comm.type.replace('_', ' ')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {comm.dealId ? `Deal Commission` : 'Team Override'}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-emerald-600 text-right">
                        +${Number(comm.amount).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200 capitalize">
                          {comm.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      No commissions found yet. Start closing deals!
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
