import { AdminSidebar } from "@/components/AdminSidebar";
import { SchemaDriftBanner } from "@/components/SchemaDriftBanner";
import { StatsCard } from "@/components/StatsCard";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { 
  Users, 
  Briefcase, 
  DollarSign, 
  TrendingUp, 
  Clock,
  UserPlus,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const res = await fetch(api.admin.stats.path, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });

  const { data: pendingCommissions } = useQuery({
    queryKey: ['admin', 'commissions', 'pending'],
    queryFn: async () => {
      const res = await fetch(api.admin.commissions.pending.path, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <AdminSidebar />
        <main className="flex-1 lg:ml-64 p-4 pt-20 lg:pt-8 lg:p-8 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      
      <main className="flex-1 lg:ml-64 p-4 pt-20 lg:pt-8 lg:p-8">
        <SchemaDriftBanner />

        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Overview of your network's performance and activity.
          </p>
        </header>

        {/* Key Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard 
            title="Total Agents" 
            value={stats?.totalAgents?.toLocaleString() || "0"}
            icon={<Users className="w-6 h-6" />}
            trend={`${stats?.activeAgents || 0} active`}
          />
          <StatsCard 
            title="New This Week" 
            value={stats?.newAgentsThisWeek?.toLocaleString() || "0"}
            icon={<UserPlus className="w-6 h-6" />}
            className="border-emerald-100 bg-emerald-50/30"
            trendUp={true}
          />
          <StatsCard 
            title="Total Volume" 
            value={`$${(stats?.totalVolume || 0).toLocaleString()}`}
            icon={<DollarSign className="w-6 h-6" />}
          />
          <StatsCard 
            title="Volume This Week" 
            value={`$${(stats?.volumeThisWeek || 0).toLocaleString()}`}
            icon={<TrendingUp className="w-6 h-6" />}
            className="border-blue-100 bg-blue-50/30"
          />
        </div>

        {/* Commission & Payout Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatsCard 
            title="Total Commissions" 
            value={`$${(stats?.totalCommissions || 0).toLocaleString()}`}
            icon={<DollarSign className="w-6 h-6" />}
          />
          <StatsCard 
            title="Pending Commissions" 
            value={`$${(stats?.pendingCommissions || 0).toLocaleString()}`}
            icon={<Clock className="w-6 h-6" />}
            className="border-secondary/40 bg-secondary/10"
          />
          <StatsCard 
            title="Pending Payouts" 
            value={`$${(stats?.pendingPayouts || 0).toLocaleString()}`}
            icon={<AlertCircle className="w-6 h-6" />}
            className="border-orange-100 bg-orange-50/30"
          />
        </div>

        {/* Quick Actions & Pending Items */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common administrative tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/admin/commissions">
                <Button variant="outline" className="w-full justify-start">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Approve Pending Commissions ({pendingCommissions?.length || 0})
                </Button>
              </Link>
              <Link href="/admin/payouts">
                <Button variant="outline" className="w-full justify-start">
                  <Clock className="w-4 h-4 mr-2" />
                  Process Payouts
                </Button>
              </Link>
              <Link href="/admin/agents">
                <Button variant="outline" className="w-full justify-start">
                  <Users className="w-4 h-4 mr-2" />
                  Manage Agents
                </Button>
              </Link>
              <Link href="/admin/announcements">
                <Button variant="outline" className="w-full justify-start">
                  <Briefcase className="w-4 h-4 mr-2" />
                  Create Announcement
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Pending Commissions</CardTitle>
              <CardDescription>Commissions awaiting approval</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingCommissions && pendingCommissions.length > 0 ? (
                <div className="space-y-3">
                  {pendingCommissions.slice(0, 5).map((comm: any) => (
                    <div key={comm.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{comm.agent?.firstName} {comm.agent?.lastName}</p>
                        <p className="text-xs text-muted-foreground capitalize">{comm.type.replace('_', ' ')}</p>
                      </div>
                      <span className="font-bold text-emerald-600">${Number(comm.amount).toFixed(2)}</span>
                    </div>
                  ))}
                  {pendingCommissions.length > 5 && (
                    <Link href="/admin/commissions">
                      <Button variant="ghost" size="sm" className="w-full">
                        View all {pendingCommissions.length} pending
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No pending commissions</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
