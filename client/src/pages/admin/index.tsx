import { AdminLayout } from "@/components/AdminLayout";
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
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, AlertTriangle, X, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

export default function AdminDashboard() {
  const [expiryAlertDismissed, setExpiryAlertDismissed] = useState(false);
  const [webhookAlertDismissed, setWebhookAlertDismissed] = useState(false);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const res = await fetch(api.admin.stats.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const { data: pendingCommissions } = useQuery({
    queryKey: ["admin", "commissions", "pending"],
    queryFn: async () => {
      const res = await fetch(api.admin.commissions.pending.path, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: expiryFailures } = useQuery<{
    count: number;
    sinceDays: number;
  }>({
    queryKey: ["admin", "activity-log", "expiry-failures"],
    queryFn: async () => {
      const res = await fetch(api.admin.activityLog.expiryFailures.path, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch expiry failures");
      return res.json();
    },
  });

  const { data: webhookStatus } = useQuery<{
    secretStored: boolean;
    secretConfigured: boolean;
    endpointId: string | null;
    endpointUrl: string | null;
    endpointActive: boolean | null;
  }>({
    queryKey: ["admin", "webhook-status"],
    queryFn: async () => {
      const res = await fetch(api.admin.webhookStatus.get.path, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch webhook status");
      return res.json();
    },
  });

  // secretConfigured accounts for both the env-var and DB-stored secret, matching
  // the resolution logic in the webhook handler — so the banner only fires when
  // neither source is present and billing events would actually be dropped.
  const showWebhookAlert =
    webhookStatus !== undefined &&
    !webhookStatus.secretConfigured &&
    !webhookAlertDismissed;

  const expiryFailureCount = expiryFailures?.count ?? 0;
  const showExpiryAlert = expiryFailureCount > 0 && !expiryAlertDismissed;

  if (isLoading) {
    return (
      <AdminLayout mainClassName="flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your network's performance and activity.
        </p>
      </header>

      {showWebhookAlert && (
        <div
          className="mb-6 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4"
          data-testid="banner-webhook-secret-missing"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <Link
            href="/admin/settings"
            className="flex flex-1 items-center gap-1 text-sm font-medium text-amber-800 hover:text-amber-900"
            data-testid="link-webhook-secret-missing"
          >
            <span>
              Stripe webhook secret is not configured — billing events (payments,
              failures, cancellations) will be silently dropped. Configure it in
              Settings.
            </span>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-amber-600 hover:bg-amber-100 hover:text-amber-800"
            onClick={() => setWebhookAlertDismissed(true)}
            data-testid="button-dismiss-webhook-secret-missing"
            aria-label="Dismiss webhook warning"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {showExpiryAlert && (
        <div
          className="mb-8 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4"
          data-testid="banner-expiry-failures"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
          <Link
            href="/admin/activity?entityType=subscription&action=error"
            className="flex flex-1 items-center gap-1 text-sm font-medium text-rose-800 hover:text-rose-900"
            data-testid="link-expiry-failures"
          >
            <span>
              {expiryFailureCount === 1
                ? "1 subscription failed to auto-expire"
                : `${expiryFailureCount} subscriptions failed to auto-expire`}
              {expiryFailures?.sinceDays
                ? ` in the last ${expiryFailures.sinceDays} days`
                : ""}{" "}
              — view details
            </span>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-rose-600 hover:bg-rose-100 hover:text-rose-800"
            onClick={() => setExpiryAlertDismissed(true)}
            data-testid="button-dismiss-expiry-failures"
            aria-label="Dismiss alert"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

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
                  <div
                    key={comm.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {comm.agent?.firstName} {comm.agent?.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {comm.type.replace("_", " ")}
                      </p>
                    </div>
                    <span className="font-bold text-emerald-600">
                      ${Number(comm.amount).toFixed(2)}
                    </span>
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
    </AdminLayout>
  );
}
