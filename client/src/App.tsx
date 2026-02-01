import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

// Agent Portal Pages
import AuthPage from "@/pages/auth";
import Dashboard from "@/pages/dashboard";
import TeamPage from "@/pages/team";
import DealsPage from "@/pages/deals";
import EarningsPage from "@/pages/earnings";
import SettingsPage from "@/pages/settings";
import RankPage from "@/pages/rank";
import LeaderboardsPage from "@/pages/leaderboards";
import ResourcesPage from "@/pages/resources";
import NotFound from "@/pages/not-found";

// Admin Pages
import AdminDashboard from "@/pages/admin/index";
import AdminAgents from "@/pages/admin/agents";
import AdminCommissions from "@/pages/admin/commissions";

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

      {/* Agent Portal Routes */}
      <Route path="/">
        {user ? <Redirect to="/dashboard" /> : <Redirect to="/login" />}
      </Route>
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/team" component={() => <ProtectedRoute component={TeamPage} />} />
      <Route path="/deals" component={() => <ProtectedRoute component={DealsPage} />} />
      <Route path="/earnings" component={() => <ProtectedRoute component={EarningsPage} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
      <Route path="/rank" component={() => <ProtectedRoute component={RankPage} />} />
      <Route path="/leaderboards" component={() => <ProtectedRoute component={LeaderboardsPage} />} />
      <Route path="/resources" component={() => <ProtectedRoute component={ResourcesPage} />} />

      {/* Admin Routes */}
      <Route path="/admin" component={() => <AdminRoute component={AdminDashboard} />} />
      <Route path="/admin/agents" component={() => <AdminRoute component={AdminAgents} />} />
      <Route path="/admin/commissions" component={() => <AdminRoute component={AdminCommissions} />} />
      
      {/* Placeholder admin routes - will redirect to main admin for now */}
      <Route path="/admin/deals" component={() => <AdminRoute component={AdminDashboard} />} />
      <Route path="/admin/payouts" component={() => <AdminRoute component={AdminDashboard} />} />
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
