import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

import AuthPage from "@/pages/auth";
import Dashboard from "@/pages/dashboard";
import TeamPage from "@/pages/team";
import DealsPage from "@/pages/deals";
import EarningsPage from "@/pages/earnings";
import NotFound from "@/pages/not-found";

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

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null; // or a splash screen
  }

  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/login">
        {user ? <Redirect to="/" /> : <AuthPage />}
      </Route>
      <Route path="/signup">
        {user ? <Redirect to="/" /> : <AuthPage />}
      </Route>

      {/* Protected Routes */}
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/team" component={() => <ProtectedRoute component={TeamPage} />} />
      <Route path="/deals" component={() => <ProtectedRoute component={DealsPage} />} />
      <Route path="/earnings" component={() => <ProtectedRoute component={EarningsPage} />} />

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
