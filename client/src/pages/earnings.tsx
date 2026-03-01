import { useCommissions, useCommissionStats } from "@/hooks/use-commissions";
import { Sidebar } from "@/components/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, Wallet, AlertTriangle, Clock, Shield, Info } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

const COMMISSION_TYPE_LABELS: Record<string, string> = {
  personal_deal: "Personal Deal",
  binary_bonus: "Binary Bonus",
  generation_override: "Generation Override",
  course_sale: "Course Sale",
  fast_start: "Fast Start",
  leadership_pool: "Leadership Pool",
  mac_primary: "MAC Primary",
  mac_sponsor_l1: "MAC Sponsor L1",
  mac_sponsor_l2: "MAC Sponsor L2",
  tfc: "TFC (Fulfillment)",
  subscription_commission: "Subscription",
  subscription_residual: "Subscription Residual",
};

function getCommissionTypeLabel(type: string): string {
  return COMMISSION_TYPE_LABELS[type] || type.replace(/_/g, ' ');
}

function getCommissionDescription(comm: any): string {
  if (comm.type === 'mac_primary') return 'MCA Deal - Primary Agent Commission';
  if (comm.type === 'mac_sponsor_l1') return 'MCA Deal - Senior Sponsor Override';
  if (comm.type === 'mac_sponsor_l2') return 'MCA Deal - Executive Sponsor Override';
  if (comm.type === 'tfc') return 'Transaction Fulfillment Compensation';
  if (comm.type === 'subscription_commission') return 'Subscription Platform Commission';
  if (comm.type === 'subscription_residual') return 'Subscription Residual Income';
  if (comm.type === 'binary_bonus') return 'Binary Team Volume Bonus';
  if (comm.type === 'generation_override') return 'Generation Override';
  if (comm.dealId) return 'Deal Commission';
  return 'Team Override';
}

function getTypeBadgeVariant(type: string): "default" | "secondary" | "destructive" | "outline" {
  if (type.startsWith('mac_')) return 'default';
  if (type === 'tfc') return 'secondary';
  if (type.startsWith('subscription')) return 'outline';
  return 'secondary';
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'approved':
      return <Badge variant="default" data-testid="badge-status-approved">Approved</Badge>;
    case 'paid':
      return <Badge variant="default" data-testid="badge-status-paid">Paid</Badge>;
    case 'voided':
      return <Badge variant="destructive" data-testid="badge-status-voided">Voided</Badge>;
    default:
      return <Badge variant="secondary" data-testid="badge-status-pending">Pending</Badge>;
  }
}

export default function EarningsPage() {
  const { data: commissions, isLoading } = useCommissions();
  const { data: stats, isLoading: statsLoading } = useCommissionStats();

  const totalEarned = stats?.totalEarned ?? 0;
  const pendingAmount = stats?.pending ?? 0;

  const mcaEarnings = (stats?.byType?.['mac_primary'] || 0) +
    (stats?.byType?.['mac_sponsor_l1'] || 0) +
    (stats?.byType?.['mac_sponsor_l2'] || 0) +
    (stats?.byType?.['tfc'] || 0);

  const subscriptionEarnings = (stats?.byType?.['subscription_commission'] || 0) +
    (stats?.byType?.['subscription_residual'] || 0);

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar />
      
      <main className="flex-1 lg:ml-64 p-4 pt-20 lg:pt-8 lg:p-8">
        <header className="mb-8">
          <h1 data-testid="text-earnings-title" className="text-3xl font-display font-bold text-primary">Commissions</h1>
          <p className="text-muted-foreground mt-2">
            Track your MCA, subscription, and team payouts.
          </p>
        </header>

        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3 mb-6" data-testid="banner-earnings-disclaimer">
          <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Income shown reflects your personal results. Individual results vary and are not guaranteed. Most participants earn little to no income.{" "}
            <Link href="/income-disclosure" className="underline font-medium" data-testid="link-income-disclosure-earnings">
              See Income Disclosure Statement
            </Link>.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-6 text-white shadow-xl">
            <div className="flex items-center gap-3 mb-4 opacity-80">
              <Wallet className="w-5 h-5" />
              <span className="text-sm font-medium uppercase tracking-wider">Total Earned</span>
            </div>
            <div className="text-3xl font-bold mb-1" data-testid="text-total-earned">
              ${statsLoading ? '...' : totalEarned.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-white/60 text-sm">Lifetime earnings across all streams</div>
          </div>
          
          <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
            <div className="flex items-center gap-3 mb-4 text-muted-foreground">
              <DollarSign className="w-5 h-5" />
              <span className="text-sm font-medium uppercase tracking-wider">Pending Payout</span>
            </div>
            <div className="text-3xl font-bold text-primary mb-1" data-testid="text-pending-payout">
              ${statsLoading ? '...' : pendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-muted-foreground text-sm">Scheduled for next Friday</div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
            <div className="flex items-center gap-3 mb-4 text-muted-foreground">
              <Shield className="w-5 h-5" />
              <span className="text-sm font-medium uppercase tracking-wider">MCA Earnings</span>
            </div>
            <div className="text-3xl font-bold text-blue-600 mb-1" data-testid="text-mca-earnings">
              ${statsLoading ? '...' : mcaEarnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-muted-foreground text-sm">MAC + TFC commissions</div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
            <div className="flex items-center gap-3 mb-4 text-muted-foreground">
              <Clock className="w-5 h-5" />
              <span className="text-sm font-medium uppercase tracking-wider">Subscription</span>
            </div>
            <div className="text-3xl font-bold text-purple-600 mb-1" data-testid="text-subscription-earnings">
              ${statsLoading ? '...' : subscriptionEarnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-muted-foreground text-sm">Platform subscription income</div>
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
                    <tr key={comm.id} data-testid={`row-commission-${comm.id}`} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {format(new Date(comm.createdAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={getTypeBadgeVariant(comm.type)} data-testid={`badge-type-${comm.id}`}>
                          {getCommissionTypeLabel(comm.type)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600" data-testid={`text-description-${comm.id}`}>
                        {getCommissionDescription(comm)}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-emerald-600 text-right" data-testid={`text-amount-${comm.id}`}>
                        +${Number(comm.amount).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {getStatusBadge(comm.status)}
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

        {commissions && commissions.some(c => c.status === 'voided') && (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-800" data-testid="text-clawback-warning">Clawback Notice</p>
              <p className="text-sm text-yellow-700 mt-1">
                Some commissions have been voided due to clawback policies. Deals that default within 30 days are subject to 100% clawback, and 50% within 31-90 days.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
