import { useAuth } from "@/hooks/use-auth";
import { useCommissionStats } from "@/hooks/use-commissions";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { Sidebar } from "@/components/Sidebar";
import { StatsCard } from "@/components/StatsCard";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  Clock, 
  Plus, 
  Copy, 
  ArrowRight,
  Share2,
  UserPlus,
  Shield,
  Repeat
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useCommissionStats();
  const { toast } = useToast();

  const { data: referralData } = useQuery({
    queryKey: ['referral-link'],
    queryFn: async () => {
      const res = await fetch(api.agents.referralLink.path, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch referral link');
      return res.json() as Promise<{ referralCode: string; referralUrl: string }>;
    },
  });

  const { data: referralStats } = useQuery({
    queryKey: ['referral-stats'],
    queryFn: async () => {
      const res = await fetch(api.agents.referralStats.path, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch referral stats');
      return res.json();
    },
  });

  const copyReferralLink = () => {
    const link = referralData?.referralUrl || `${window.location.origin}/join/${user?.referralCode || user?.id}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link Copied!",
      description: "Share this link to grow your team",
    });
  };

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
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 data-testid="text-welcome" className="text-3xl font-display font-bold text-primary">
              Welcome back, {user?.firstName}
            </h1>
            <p className="text-muted-foreground mt-1">
              Here's what's happening with your business today.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="gap-2 flex-1 sm:flex-none" onClick={copyReferralLink} data-testid="button-copy-referral">
              <Copy className="w-4 h-4" />
              <span className="hidden sm:inline">Copy </span>Referral Link
            </Button>
            <Link href="/deals" className="flex-1 sm:flex-none">
              <Button className="w-full gap-2 bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/25" data-testid="button-log-deal">
                <Plus className="w-4 h-4" />
                Log New Deal
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <StatsCard 
            title="Total Earnings" 
            value={isLoading ? "..." : `$${stats?.totalEarned.toLocaleString()}`} 
            icon={<DollarSign className="w-6 h-6" />}
            trend="12% vs last month"
            trendUp={true}
          />
          <StatsCard 
            title="This Week" 
            value={isLoading ? "..." : `$${stats?.thisWeek.toLocaleString()}`} 
            icon={<TrendingUp className="w-6 h-6" />}
            className="border-emerald-100 bg-emerald-50/30"
          />
          <StatsCard 
            title="Pending Payouts" 
            value={isLoading ? "..." : `$${stats?.pending.toLocaleString()}`} 
            icon={<Clock className="w-6 h-6" />}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <StatsCard 
            title="MCA Earnings" 
            value={isLoading ? "..." : `$${mcaEarnings.toLocaleString()}`} 
            icon={<Shield className="w-6 h-6" />}
          />
          <StatsCard 
            title="Subscription Earnings" 
            value={isLoading ? "..." : `$${subscriptionEarnings.toLocaleString()}`} 
            icon={<Repeat className="w-6 h-6" />}
          />
          <StatsCard 
            title="Team Size" 
            value={referralStats?.totalReferrals?.toString() ?? "0"}
            icon={<Users className="w-6 h-6" />}
            trend={referralStats?.thisMonthReferrals ? `+${referralStats.thisMonthReferrals} this month` : undefined}
            trendUp={referralStats?.thisMonthReferrals > 0}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-primary">Recent Deals</h3>
              <Link href="/deals" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
              <div className="p-8 text-center text-muted-foreground">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-gray-300" />
                </div>
                <p>No recent deals found.</p>
                <Link href="/deals">
                  <Button variant="ghost" className="mt-2" data-testid="button-log-first-deal">Log your first deal</Button>
                </Link>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-primary to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              
              <h3 className="font-bold text-lg mb-1 relative z-10">Current Rank</h3>
              <div className="text-4xl font-display font-bold text-yellow-400 mb-2 relative z-10 capitalize" data-testid="text-current-rank">
                {user?.currentRank}
              </div>
              <p className="text-white/60 text-sm relative z-10">
                Next Rank: <span className="text-white font-medium">Builder</span>
              </p>
              
              <div className="mt-6 relative z-10">
                <div className="flex justify-between text-xs mb-2">
                  <span>Progress</span>
                  <span>65%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full w-[65%] bg-yellow-400 rounded-full" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
              <h3 className="font-bold text-primary mb-4">Team Performance</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">Left Leg Volume</span>
                  <span className="font-bold text-primary">$0</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">Right Leg Volume</span>
                  <span className="font-bold text-primary">$0</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              
              <div className="flex items-center gap-2 mb-3">
                <UserPlus className="w-5 h-5" />
                <h3 className="font-bold text-lg">Grow Your Team</h3>
              </div>
              
              <p className="text-white/80 text-sm mb-4">
                Share your link and earn commissions when your recruits close deals.
              </p>
              
              <div className="bg-white/10 backdrop-blur rounded-lg p-3 mb-4">
                <div className="text-xs text-white/60 mb-1">Your Referral Link</div>
                <div className="font-mono text-sm truncate" data-testid="text-referral-url">
                  {referralData?.referralUrl || 'Loading...'}
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={copyReferralLink}
                  className="flex-1 bg-white text-emerald-600 hover:bg-white/90"
                  data-testid="button-copy-link"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Link
                </Button>
                <Button 
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10"
                  data-testid="button-share"
                  onClick={() => {
                    if (navigator.share && referralData?.referralUrl) {
                      navigator.share({
                        title: 'Join Leadershield Network',
                        text: 'Start earning with MCA deals and recurring subscription revenue!',
                        url: referralData.referralUrl,
                      });
                    }
                  }}
                >
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
              
              {referralStats?.totalReferrals > 0 && (
                <div className="mt-4 pt-4 border-t border-white/20">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/70">Total Referrals</span>
                    <span className="font-bold" data-testid="text-total-referrals">{referralStats.totalReferrals}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
