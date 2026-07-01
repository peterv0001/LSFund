import { Switch, Route, Redirect } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

// Public Pages
const LandingPage = lazy(() => import("@/pages/landing"));
const FundingPage = lazy(() => import("@/pages/funding"));
const PlatformPage = lazy(() => import("@/pages/platform"));
const OpportunityPage = lazy(() => import("@/pages/opportunity"));
const CommissionsPage = lazy(() => import("@/pages/commissions"));
const PrivacyPolicyPage = lazy(() => import("@/pages/privacy"));
const TermsOfServicePage = lazy(() => import("@/pages/terms"));
const RefundPolicyPage = lazy(() => import("@/pages/refund-policy"));
const IncomeDisclosurePage = lazy(() => import("@/pages/income-disclosure"));

// Public ad landing pages
const LpDeclined = lazy(() => import("@/pages/lp/declined"));
const LpConsolidation = lazy(() => import("@/pages/lp/consolidation"));
const LpGrowth = lazy(() => import("@/pages/lp/growth"));
const LpSeasonal = lazy(() => import("@/pages/lp/seasonal"));
const LpCallCenterIso = lazy(() => import("@/pages/lp/callcenter-iso"));
const LpReferral = lazy(() => import("@/pages/lp/referral"));
const LpPlatform = lazy(() => import("@/pages/lp/platform"));
const LpLeaks = lazy(() => import("@/pages/lp/leaks"));
const LpScale = lazy(() => import("@/pages/lp/scale"));

// Agent Portal Pages
const AuthPage = lazy(() => import("@/pages/auth"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const AcceptInvitePage = lazy(() => import("@/pages/accept-invite"));
const VerifyEmailPage = lazy(() => import("@/pages/verify-email"));
const InvitePage = lazy(() => import("@/pages/invite"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const TeamPage = lazy(() => import("@/pages/team"));
const DealsPage = lazy(() => import("@/pages/deals"));
const EarningsPage = lazy(() => import("@/pages/earnings"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const RankPage = lazy(() => import("@/pages/rank"));
const LeaderboardsPage = lazy(() => import("@/pages/leaderboards"));
const ResourcesPage = lazy(() => import("@/pages/resources"));
const TrainingPage = lazy(() => import("@/pages/training"));
const ReportsPage = lazy(() => import("@/pages/reports"));
const LeadsPage = lazy(() => import("@/pages/leads"));
const SubscriptionsPage = lazy(() => import("@/pages/subscriptions"));
const NotFound = lazy(() => import("@/pages/not-found"));

// Admin Pages
const AdminDashboard = lazy(() => import("@/pages/admin/index"));
const AdminAgents = lazy(() => import("@/pages/admin/agents"));
const AdminCommissions = lazy(() => import("@/pages/admin/commissions"));
const AdminPayouts = lazy(() => import("@/pages/admin/payouts"));
const AdminLeads = lazy(() => import("@/pages/admin/leads"));
const AdminAIQueue = lazy(() => import("@/pages/admin/ai-queue"));
const AdminDeals = lazy(() => import("@/pages/admin/deals"));
const AdminAnnouncements = lazy(() => import("@/pages/admin/announcements"));
const AdminResources = lazy(() => import("@/pages/admin/resources"));
const AdminHoldbacks = lazy(() => import("@/pages/admin/holdbacks"));
const AdminActivityLog = lazy(() => import("@/pages/admin/activity-log"));
const AdminSettings = lazy(() => import("@/pages/admin/settings"));
const AdminSubscriptions = lazy(() => import("@/pages/admin/subscriptions"));
const AdminMigrations = lazy(() => import("@/pages/admin/migrations"));

// Suspense fallback shown while a lazily-loaded page is downloading
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

// Protected Route Wrapper
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

// Admin Route Wrapper
function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (!user.isAdmin) {
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
    <Switch>
      {/* Public Routes */}
      <Route path="/login">
        {user ? <Redirect to="/dashboard" /> : <AuthPage />}
      </Route>
      <Route path="/signup">
        {user ? <Redirect to="/dashboard" /> : <AuthPage />}
      </Route>
      <Route path="/join/:code">
        {(params) => user ? <Redirect to="/dashboard" /> : <Redirect to={`/signup?ref=${params.code}`} />}
      </Route>
      <Route path="/forgot-password">
        {user ? <Redirect to="/dashboard" /> : <ForgotPasswordPage />}
      </Route>
      <Route path="/reset-password">
        {user ? <Redirect to="/dashboard" /> : <ResetPasswordPage />}
      </Route>
      <Route path="/invite/accept">
        <AcceptInvitePage />
      </Route>
      <Route path="/verify-email">
        <VerifyEmailPage />
      </Route>

      {/* Public Ad Landing Pages (no auth guard, always public) */}
      <Route path="/lp/declined" component={LpDeclined} />
      <Route path="/lp/consolidation" component={LpConsolidation} />
      <Route path="/lp/growth" component={LpGrowth} />
      <Route path="/lp/seasonal" component={LpSeasonal} />
      <Route path="/lp/partners" component={LpCallCenterIso} />
      <Route path="/lp/referral" component={LpReferral} />
      <Route path="/lp/platform" component={LpPlatform} />
      <Route path="/lp/leaks" component={LpLeaks} />
      <Route path="/lp/scale" component={LpScale} />

      {/* Public Legal Pages */}
      <Route path="/privacy" component={PrivacyPolicyPage} />
      <Route path="/refund-policy" component={RefundPolicyPage} />
      <Route path="/terms" component={TermsOfServicePage} />

      {/* Public Landing Page */}
      <Route path="/">
        {user ? <Redirect to="/dashboard" /> : <LandingPage />}
      </Route>
      <Route path="/funding" component={FundingPage} />
      <Route path="/platform" component={PlatformPage} />
      <Route path="/opportunity" component={OpportunityPage} />
      <Route path="/commissions" component={CommissionsPage} />
      <Route path="/income-disclosure" component={IncomeDisclosurePage} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/team" component={() => <ProtectedRoute component={TeamPage} />} />
      <Route path="/invite" component={() => <ProtectedRoute component={InvitePage} />} />
      <Route path="/deals" component={() => <ProtectedRoute component={DealsPage} />} />
      <Route path="/earnings" component={() => <ProtectedRoute component={EarningsPage} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
      <Route path="/rank" component={() => <ProtectedRoute component={RankPage} />} />
      <Route path="/leaderboards" component={() => <ProtectedRoute component={LeaderboardsPage} />} />
      <Route path="/resources" component={() => <ProtectedRoute component={ResourcesPage} />} />
      <Route path="/reports" component={() => <ProtectedRoute component={ReportsPage} />} />
      <Route path="/training" component={() => <ProtectedRoute component={TrainingPage} />} />
      <Route path="/leads" component={() => <ProtectedRoute component={LeadsPage} />} />
      <Route path="/subscriptions" component={() => <ProtectedRoute component={SubscriptionsPage} />} />

      {/* Admin Routes */}
      <Route path="/admin" component={() => <AdminRoute component={AdminDashboard} />} />
      <Route path="/admin/agents" component={() => <AdminRoute component={AdminAgents} />} />
      <Route path="/admin/commissions" component={() => <AdminRoute component={AdminCommissions} />} />
      <Route path="/admin/payouts" component={() => <AdminRoute component={AdminPayouts} />} />
      <Route path="/admin/leads" component={() => <AdminRoute component={AdminLeads} />} />
      <Route path="/admin/ai-queue" component={() => <AdminRoute component={AdminAIQueue} />} />
      
      <Route path="/admin/deals" component={() => <AdminRoute component={AdminDeals} />} />
      
      <Route path="/admin/subscriptions" component={() => <AdminRoute component={AdminSubscriptions} />} />
      <Route path="/admin/announcements" component={() => <AdminRoute component={AdminAnnouncements} />} />
      <Route path="/admin/resources" component={() => <AdminRoute component={AdminResources} />} />
      <Route path="/admin/holdbacks" component={() => <AdminRoute component={AdminHoldbacks} />} />
      <Route path="/admin/activity" component={() => <AdminRoute component={AdminActivityLog} />} />
      <Route path="/admin/migrations" component={() => <AdminRoute component={AdminMigrations} />} />
      <Route path="/admin/settings" component={() => <AdminRoute component={AdminSettings} />} />

      {/* Fallback */}
      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
