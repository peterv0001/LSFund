import { useAuth } from "@/hooks/use-auth";
import { useCommissionStats } from "@/hooks/use-commissions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Repeat,
  Info,
  AlertTriangle,
  X,
  Award,
  Layers,
  Mail,
  CheckCircle2,
  Circle,
  Loader2,
  Rocket
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { COMP_V2026 } from "@shared/compensation";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

function ViewsSparkline({ data, testId }: { data: number[]; testId: string }) {
  const series = data && data.length > 0 ? data : [];
  const hasViews = series.some((v) => v > 0);
  const chartData = series.map((value, index) => ({ index, value }));

  if (!hasViews) {
    return (
      <div
        className="h-9 flex items-center justify-center rounded-md bg-gray-50 text-[10px] uppercase tracking-wide text-gray-300"
        data-testid={testId}
      >
        No views yet
      </div>
    );
  }

  return (
    <div className="h-9 w-full" data-testid={testId}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
          <YAxis hide domain={[0, "dataMax"]} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const DISMISSED_EXPIRING_SOON_KEY = "dismissed-expiring-soon-subscriptions";

const TIER_LABELS: Record<string, string> = { standard: "Standard", enhanced: "Enhanced", elite: "Elite" };
const MEMBERSHIP_LABELS: Record<string, string> = { individual: "Individual", small_agency: "Small Agency", growth_agency: "Growth Agency", enterprise_agency: "Enterprise Agency" };
const RESIDUAL_LABELS: Record<string, string> = { good_standing: "Good Standing", reduced: "Reduced", suspended: "Suspended" };
const RESIDUAL_STYLES: Record<string, string> = {
  good_standing: "text-[#1C8A5B] bg-emerald-50 border-emerald-100",
  reduced: "text-amber-600 bg-amber-50 border-amber-100",
  suspended: "text-destructive bg-destructive/5 border-destructive/20",
};

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useCommissionStats();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  type ShareStat = { views: number; leads: number; views7d: number; views30d: number; dailyViews: number[] };
  const { data: shareStats } = useQuery<Record<'platform' | 'leaks' | 'scale', ShareStat>>({
    queryKey: ['share-stats'],
    queryFn: async () => {
      const res = await fetch(api.agents.shareStats.path, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch share stats');
      return res.json();
    },
  });

  const { data: subscriptions = [] } = useQuery<{ id: number; status: string; endDate: string | null }[]>({
    queryKey: ["/api/subscriptions"],
  });

  type OnboardingState = {
    profileComplete: boolean;
    emailVerified: boolean;
    module1Complete: boolean;
    firstDealLogged: boolean;
    firstInviteSent: boolean;
    completedCount: number;
    totalCount: number;
    dismissed: boolean;
    allComplete: boolean;
  };
  const { data: onboarding } = useQuery<OnboardingState>({
    queryKey: [api.agents.onboarding.path],
  });

  const [resendingVerification, setResendingVerification] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const resendVerification = async () => {
    setResendingVerification(true);
    try {
      const res = await fetch(api.auth.resendVerification.path, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Could not resend the verification email.");
      }
      setVerificationSent(true);
      toast({
        title: "Verification email sent",
        description: "Check your inbox for the confirmation link.",
      });
    } catch (err: any) {
      toast({
        title: "Couldn't resend email",
        description: err?.message || "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setResendingVerification(false);
    }
  };

  const dismissOnboarding = async () => {
    try {
      await fetch(api.agents.dismissOnboarding.path, {
        method: "POST",
        credentials: "include",
      });
      queryClient.invalidateQueries({ queryKey: [api.agents.onboarding.path] });
    } catch {
      // non-critical
    }
  };

  const expiredSubscriptionCount = subscriptions.filter((s) => s.status === "expired").length;

  const now = new Date();
  const endOfDayInSevenDays = new Date(now);
  endOfDayInSevenDays.setDate(endOfDayInSevenDays.getDate() + 7);
  endOfDayInSevenDays.setHours(23, 59, 59, 999);
  const expiringSoonSubscriptions = subscriptions.filter((s) => {
    if (s.status === "cancelled" || s.status === "expired" || !s.endDate) return false;
    const end = new Date(s.endDate);
    return end >= now && end <= endOfDayInSevenDays;
  });

  const [dismissedExpiringSoonIds, setDismissedExpiringSoonIds] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem(DISMISSED_EXPIRING_SOON_KEY);
      return stored ? (JSON.parse(stored) as number[]) : [];
    } catch {
      return [];
    }
  });

  const expiringSoonIds = expiringSoonSubscriptions.map((s) => s.id);

  useEffect(() => {
    const stillExpiring = dismissedExpiringSoonIds.filter((id) => expiringSoonIds.includes(id));
    if (stillExpiring.length !== dismissedExpiringSoonIds.length) {
      setDismissedExpiringSoonIds(stillExpiring);
      try {
        localStorage.setItem(DISMISSED_EXPIRING_SOON_KEY, JSON.stringify(stillExpiring));
      } catch {
        // ignore storage errors
      }
    }
  }, [expiringSoonIds.join(","), dismissedExpiringSoonIds]);

  const hasNewExpiringSoon = expiringSoonIds.some((id) => !dismissedExpiringSoonIds.includes(id));

  const dismissExpiringSoonBanner = () => {
    setDismissedExpiringSoonIds(expiringSoonIds);
    try {
      localStorage.setItem(DISMISSED_EXPIRING_SOON_KEY, JSON.stringify(expiringSoonIds));
    } catch {
      // ignore storage errors
    }
  };

  const copyReferralLink = () => {
    const link = referralData?.referralUrl || `${window.location.origin}/join/${user?.referralCode || user?.id}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link Copied!",
      description: "Share this link to grow your team",
    });
  };

  const shareCode = referralData?.referralCode || user?.referralCode || "";

  const platformShareLinks = [
    {
      key: "platform",
      path: "/lp/platform",
      title: "Platform Overview",
      blurb: "The full AI marketing department, with all four plans and pricing.",
    },
    {
      key: "leaks",
      path: "/lp/leaks",
      title: "The Leaks Page",
      blurb: "For businesses already getting inquiries that slip through the cracks.",
    },
    {
      key: "scale",
      path: "/lp/scale",
      title: "The Scale Page",
      blurb: "Revenue Scale AI — pitch growth without adding headcount.",
    },
  ];

  const buildShareLink = (path: string) => {
    const base = `${window.location.origin}${path}`;
    return shareCode ? `${base}?ref=${encodeURIComponent(shareCode)}` : base;
  };

  const copyShareLink = (path: string, title: string) => {
    navigator.clipboard.writeText(buildShareLink(path));
    toast({
      title: "Link Copied!",
      description: `${title} link is ready to share — it credits your account automatically.`,
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

        {onboarding && !onboarding.emailVerified && (
          <div
            className="flex flex-col sm:flex-row sm:items-center gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-4 mb-4"
            data-testid="banner-email-verification"
          >
            <div className="flex items-start gap-3 flex-1">
              <Mail className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  Verify your email address
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  Confirm your email to unlock logging deals and adding subscriptions. Check your inbox for the link
                  {user?.email ? <> we sent to <span className="font-medium">{user.email}</span></> : null}.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-amber-300 dark:border-amber-700/50 hover:bg-amber-100 dark:hover:bg-amber-900/30 shrink-0"
              onClick={resendVerification}
              disabled={resendingVerification || verificationSent}
              data-testid="button-resend-verification"
            >
              {resendingVerification ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {verificationSent ? "Email sent" : "Resend email"}
            </Button>
          </div>
        )}

        {onboarding && !onboarding.allComplete && !onboarding.dismissed && (
          <div
            className="bg-white rounded-2xl border border-border shadow-sm p-6 mb-6"
            data-testid="card-getting-started"
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Rocket className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-primary">Getting Started</h3>
                  <p className="text-sm text-muted-foreground" data-testid="text-onboarding-progress">
                    {onboarding.completedCount} of {onboarding.totalCount} steps complete
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={dismissOnboarding}
                className="text-muted-foreground hover:text-foreground flex-shrink-0"
                aria-label="Dismiss getting started checklist"
                data-testid="button-dismiss-onboarding"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-5">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all"
                style={{ width: `${onboarding.totalCount ? (onboarding.completedCount / onboarding.totalCount) * 100 : 0}%` }}
              />
            </div>

            <div className="space-y-2">
              {[
                { key: "profileComplete", done: onboarding.profileComplete, label: "Complete your profile", href: "/settings", cta: "Update profile" },
                { key: "emailVerified", done: onboarding.emailVerified, label: "Verify your email address", action: "resend" as const },
                { key: "module1Complete", done: onboarding.module1Complete, label: "Finish Academy Module 1", href: "/training", cta: "Start training" },
                { key: "firstDealLogged", done: onboarding.firstDealLogged, label: "Log your first deal", href: "/deals", cta: "Log a deal" },
                { key: "firstInviteSent", done: onboarding.firstInviteSent, label: "Invite your first teammate", href: "/team", cta: "Invite someone" },
              ].map((step) => (
                <div
                  key={step.key}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-50"
                  data-testid={`onboarding-step-${step.key}`}
                >
                  {step.done ? (
                    <CheckCircle2 className="w-5 h-5 text-[#1C8A5B] flex-shrink-0" data-testid={`icon-done-${step.key}`} />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />
                  )}
                  <span className={`text-sm flex-1 ${step.done ? "text-muted-foreground line-through" : "text-foreground font-medium"}`}>
                    {step.label}
                  </span>
                  {!step.done && step.action === "resend" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-primary"
                      onClick={resendVerification}
                      disabled={resendingVerification || verificationSent}
                      data-testid={`button-step-${step.key}`}
                    >
                      {resendingVerification ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                      {verificationSent ? "Sent" : "Resend"}
                    </Button>
                  )}
                  {!step.done && step.href && (
                    <Link href={step.href}>
                      <Button variant="ghost" size="sm" className="h-8 text-primary gap-1" data-testid={`button-step-${step.key}`}>
                        {step.cta}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {expiringSoonSubscriptions.length > 0 && hasNewExpiringSoon && (
          <div
            className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-md p-3 mb-4"
            data-testid="banner-expiring-soon-subscriptions-dashboard"
          >
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-800 flex-1">
              <span className="font-semibold">
                {expiringSoonSubscriptions.length === 1
                  ? "1 subscription is expiring within 7 days"
                  : `${expiringSoonSubscriptions.length} subscriptions are expiring within 7 days`}
              </span>{" "}
              — contact your admin if you'd like to extend or renew.{" "}
              <Link href="/subscriptions" className="underline font-medium" data-testid="link-view-expiring-soon-subscriptions">
                View subscriptions
              </Link>
            </p>
            <button
              type="button"
              onClick={dismissExpiringSoonBanner}
              className="text-amber-500 hover:text-amber-700 flex-shrink-0"
              aria-label="Dismiss expiring soon warning"
              data-testid="button-dismiss-expiring-soon-subscriptions"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {expiredSubscriptionCount > 0 && (
          <div
            className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-md p-3 mb-4"
            data-testid="banner-expired-subscriptions-dashboard"
          >
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-700">
              <span className="font-semibold">
                {expiredSubscriptionCount === 1
                  ? "1 subscription has expired"
                  : `${expiredSubscriptionCount} subscriptions have expired`}
              </span>{" "}
              — these are no longer generating commissions.{" "}
              <Link href="/subscriptions" className="underline font-medium" data-testid="link-view-expired-subscriptions">
                View subscriptions
              </Link>
            </p>
          </div>
        )}

        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3 mb-6" data-testid="banner-earnings-disclaimer">
          <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Income shown reflects your personal results. Individual results vary and are not guaranteed. Most participants earn little to no income.{" "}
            <Link href="/income-disclosure" className="underline font-medium" data-testid="link-income-disclosure-dashboard">
              See Income Disclosure Statement
            </Link>.
          </p>
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

        {(() => {
          const tier = user?.distributorTier ?? "standard";
          const membership = user?.membershipType ?? "individual";
          const residual = user?.residualStatus ?? "good_standing";
          const plan = COMP_V2026.membership[membership];
          return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10" data-testid="grid-distributor-status">
              <div className="rounded-2xl border border-border bg-card p-6" data-testid="card-distributor-tier">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Award className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Distributor Tier</p>
                </div>
                <p className="text-2xl font-bold text-primary" data-testid="text-distributor-tier">{TIER_LABELS[tier] ?? tier}</p>
                <p className="text-xs text-muted-foreground mt-1">Recalculated monthly from your production</p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6" data-testid="card-membership-type">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Layers className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Membership</p>
                </div>
                <p className="text-2xl font-bold text-primary" data-testid="text-membership-type">{MEMBERSHIP_LABELS[membership] ?? membership}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  ${plan.fee}/mo · waived at ${plan.waiverThreshold.toLocaleString()} collected
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6" data-testid="card-residual-status">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Repeat className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Residual Standing</p>
                </div>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold border ${RESIDUAL_STYLES[residual] ?? ""}`} data-testid="text-residual-status">
                  {RESIDUAL_LABELS[residual] ?? residual}
                </span>
                <p className="text-xs text-muted-foreground mt-2">Eligibility for ongoing subscription residuals</p>
              </div>
            </div>
          );
        })()}

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
              <div className="text-4xl font-display font-bold text-white mb-2 relative z-10 capitalize" data-testid="text-current-rank">
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
                  <div className="h-full w-[65%] bg-white/80 rounded-full" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
              <h3 className="font-bold text-primary mb-4">Team Performance</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">Left Leg Volume</span>
                  <span className="font-mono font-bold text-primary">$0</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">Right Leg Volume</span>
                  <span className="font-mono font-bold text-primary">$0</span>
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
                        title: 'Join LeaderShield Funding',
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

          <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm p-6" data-testid="section-platform-share-links">
            <div className="flex items-center gap-2 mb-1">
              <Share2 className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-lg">Merchant Growth Platform Pages</h3>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              Share these landing pages with business owners. Every link is tagged with your referral
              code, so leads who sign up are credited to you automatically. Views and leads below show
              how each page is performing.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {platformShareLinks.map((lp) => (
                <div
                  key={lp.key}
                  className="border border-gray-100 rounded-xl p-4 flex flex-col"
                  data-testid={`card-share-${lp.key}`}
                >
                  <h4 className="font-semibold text-sm mb-1">{lp.title}</h4>
                  <p className="text-xs text-gray-500 mb-3 flex-1">{lp.blurb}</p>
                  <div className="flex items-center gap-4 mb-3" data-testid={`stats-share-${lp.key}`}>
                    <div className="flex flex-col">
                      <span className="font-mono text-lg font-bold leading-none" data-testid={`text-views-${lp.key}`}>
                        {shareStats?.[lp.key as 'platform' | 'leaks' | 'scale']?.views ?? 0}
                      </span>
                      <span className="text-[11px] uppercase tracking-wide text-gray-400 mt-1">Views</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-mono text-lg font-bold leading-none" data-testid={`text-leads-${lp.key}`}>
                        {shareStats?.[lp.key as 'platform' | 'leaks' | 'scale']?.leads ?? 0}
                      </span>
                      <span className="text-[11px] uppercase tracking-wide text-gray-400 mt-1">Leads</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-3" data-testid={`trend-share-${lp.key}`}>
                    <div className="flex-1 flex flex-col items-center bg-gray-50 rounded-lg py-2">
                      <span className="font-mono text-sm font-bold leading-none" data-testid={`text-views7d-${lp.key}`}>
                        {shareStats?.[lp.key as 'platform' | 'leaks' | 'scale']?.views7d ?? 0}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-gray-400 mt-1">Last 7d</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center bg-gray-50 rounded-lg py-2">
                      <span className="font-mono text-sm font-bold leading-none" data-testid={`text-views30d-${lp.key}`}>
                        {shareStats?.[lp.key as 'platform' | 'leaks' | 'scale']?.views30d ?? 0}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-gray-400 mt-1">Last 30d</span>
                    </div>
                  </div>
                  <div className="mb-3">
                    <span className="text-[10px] uppercase tracking-wide text-gray-400">Daily views · 30d</span>
                    <ViewsSparkline
                      data={shareStats?.[lp.key as 'platform' | 'leaks' | 'scale']?.dailyViews ?? []}
                      testId={`sparkline-views-${lp.key}`}
                    />
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3">
                    <div className="font-mono text-xs text-gray-600 truncate" data-testid={`text-share-url-${lp.key}`}>
                      {buildShareLink(lp.path)}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="gap-2 w-full"
                    onClick={() => copyShareLink(lp.path, lp.title)}
                    data-testid={`button-copy-share-${lp.key}`}
                  >
                    <Copy className="w-4 h-4" />
                    Copy Link
                  </Button>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
