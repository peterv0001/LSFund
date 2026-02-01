import { useAuth } from "@/hooks/use-auth";
import { useCommissionStats } from "@/hooks/use-commissions";
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
  ArrowRight
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useCommissionStats();
  const { toast } = useToast();

  const copyReferralLink = () => {
    const link = `${window.location.origin}/signup?ref=${user?.id}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link Copied",
      description: "Referral link copied to clipboard",
    });
  };

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar />
      
      <main className="flex-1 ml-64 p-8">
        {/* Welcome Header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-primary">
              Welcome back, {user?.firstName}
            </h1>
            <p className="text-muted-foreground mt-1">
              Here's what's happening with your business today.
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2" onClick={copyReferralLink}>
              <Copy className="w-4 h-4" />
              Copy Referral Link
            </Button>
            <Link href="/deals">
              <Button className="gap-2 bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/25">
                <Plus className="w-4 h-4" />
                Log New Deal
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
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
          <StatsCard 
            title="Team Size" 
            value={user?.id ? "1" : "0"} // Placeholder until real team count
            icon={<Users className="w-6 h-6" />}
          />
        </div>

        {/* Content Section */}
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Recent Activity */}
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
                  <Button variant="ghost" className="mt-2">Log your first deal</Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Quick Stats / Right Column */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-primary to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              
              <h3 className="font-bold text-lg mb-1 relative z-10">Current Rank</h3>
              <div className="text-4xl font-display font-bold text-yellow-400 mb-2 relative z-10 capitalize">
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
          </div>

        </div>
      </main>
    </div>
  );
}
