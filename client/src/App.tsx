import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

// Public Pages
import LandingPage from "@/pages/landing";
import PrivacyPolicyPage from "@/pages/privacy";
import TermsOfServicePage from "@/pages/terms";
import RefundPolicyPage from "@/pages/refund-policy";
import IncomeDisclosurePage from "@/pages/income-disclosure";

// Agent Portal Pages
import AuthPage from "@/pages/auth";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import Dashboard from "@/pages/dashboard";
import TeamPage from "@/pages/team";
import DealsPage from "@/pages/deals";
import EarningsPage from "@/pages/earnings";
import SettingsPage from "@/pages/settings";
import RankPage from "@/pages/rank";
import LeaderboardsPage from "@/pages/leaderboards";
import ResourcesPage from "@/pages/resources";
import TrainingPage from "@/pages/training";
import ReportsPage from "@/pages/reports";
import LeadsPage from "@/pages/leads";
import NotFound from "@/pages/not-found";

// Admin Pages
import AdminDashboard from "@/pages/admin/index";
import AdminAgents from "@/pages/admin/agents";
import AdminCommissions from "@/pages/admin/commissions";
import AdminPayouts from "@/pages/admin/payouts";
import AdminLeads from "@/pages/admin/leads";
import AdminAIQueue from "@/pages/admin/ai-queue";
import AdminDeals from "@/pages/admin/deals";

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

      {/* Public Legal Pages */}
      <Route path="/privacy" component={PrivacyPolicyPage} />
      <Route path="/refund-policy" component={RefundPolicyPage} />
      <Route path="/terms" component={TermsOfServicePage} />

      {/* Public Landing Page */}
      <Route path="/">
        {user ? <Redirect to="/dashboard" /> : <LandingPage />}
      </Route>
      <Route path="/income-disclosure" component={IncomeDisclosurePage} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/team" component={() => <ProtectedRoute component={TeamPage} />} />
      <Route path="/deals" component={() => <ProtectedRoute component={DealsPage} />} />
      <Route path="/earnings" component={() => <ProtectedRoute component={EarningsPage} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
      <Route path="/rank" component={() => <ProtectedRoute component={RankPage} />} />
      <Route path="/leaderboards" component={() => <ProtectedRoute component={LeaderboardsPage} />} />
      <Route path="/resources" component={() => <ProtectedRoute component={ResourcesPage} />} />
      <Route path="/reports" component={() => <ProtectedRoute component={ReportsPage} />} />
      <Route path="/training" component={() => <ProtectedRoute component={TrainingPage} />} />
      <Route path="/leads" component={() => <ProtectedRoute component={LeadsPage} />} />

      {/* Admin Routes */}
      <Route path="/admin" component={() => <AdminRoute component={AdminDashboard} />} />
      <Route path="/admin/agents" component={() => <AdminRoute component={AdminAgents} />} />
      <Route path="/admin/commissions" component={() => <AdminRoute component={AdminCommissions} />} />
      <Route path="/admin/payouts" component={() => <AdminRoute component={AdminPayouts} />} />
      <Route path="/admin/leads" component={() => <AdminRoute component={AdminLeads} />} />
      <Route path="/admin/ai-queue" component={() => <AdminRoute component={AdminAIQueue} />} />
      
      <Route path="/admin/deals" component={() => <AdminRoute component={AdminDeals} />} />
      
      {/* Placeholder admin routes - will redirect to main admin for now */}
      <Route path="/admin/subscriptions" component={() => <AdminRoute component={AdminCommissions} />} />
      <Route path="/admin/announcements" component={() => <AdminRoute component={AdminDashboard} />} />
      <Route path="/admin/resources" component={() => <AdminRoute component={AdminDashboard} />} />
      <Route path="/admin/activity" component={() => <AdminRoute component={AdminDashboard} />} />
      <Route path="/admin/settings" component={() => <AdminRoute component={AdminDashboard} />} />

      {/* Fallback */}
      <Route component={NotFound} />
    </Switch>
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
