// SSR entry point used exclusively by script/prerender.ts at build time.
// Each public route is rendered to a static HTML string that is injected into
// the <div id="root"> placeholder so crawlers receive real page content in the
// first HTTP response instead of an empty SPA shell.
//
// Rules:
// - Import page components directly (no React.lazy / Suspense) so
//   renderToString can resolve them synchronously.
// - Mirror the provider tree from App.tsx exactly so hydrateRoot on the client
//   sees a matching component tree and can keep the server DOM.
// - Pre-seed auth as null (not logged in) so App's router doesn't render a
//   loading spinner — the rendered tree then matches what the client produces
//   when main.tsx calls hydrateRoot with auth pre-seeded the same way.
// - CSS imports are handled by Vite's SSR build (treated as no-ops).

import React from "react";
import { renderToString } from "react-dom/server";
import { Router as WouterRouter } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "@/lib/queryClient";

// Public section pages
import LandingPage from "@/pages/landing";
import FundingPage from "@/pages/funding";
import PlatformPage from "@/pages/platform";
import OpportunityPage from "@/pages/opportunity";
import CommissionsPage from "@/pages/commissions";

// Legal pages
import PrivacyPolicyPage from "@/pages/privacy";
import TermsOfServicePage from "@/pages/terms";
import RefundPolicyPage from "@/pages/refund-policy";
import IncomeDisclosurePage from "@/pages/income-disclosure";

// Ad landing pages
import LpDeclined from "@/pages/lp/declined";
import LpConsolidation from "@/pages/lp/consolidation";
import LpGrowth from "@/pages/lp/growth";
import LpSeasonal from "@/pages/lp/seasonal";
import LpCallCenterIso from "@/pages/lp/callcenter-iso";
import LpReferral from "@/pages/lp/referral";
import LpPlatform from "@/pages/lp/platform";
import LpLeaks from "@/pages/lp/leaks";
import LpScale from "@/pages/lp/scale";

// The query key used by useAuth() — must stay in sync with use-auth.ts.
// Pre-seeding this key avoids the loading-spinner initial render so the SSR
// output matches the client's first paint after hydrateRoot is called.
const AUTH_QUERY_KEY = ["/api/user"] as const;

export type PublicRoute = { path: string; Component: React.ComponentType };

/**
 * Every public URL that should be prerendered at build time.
 * Keep in sync with the Route declarations in client/src/App.tsx.
 */
export const PUBLIC_ROUTES: PublicRoute[] = [
  { path: "/", Component: LandingPage },
  { path: "/funding", Component: FundingPage },
  { path: "/platform", Component: PlatformPage },
  { path: "/opportunity", Component: OpportunityPage },
  { path: "/commissions", Component: CommissionsPage },
  { path: "/privacy", Component: PrivacyPolicyPage },
  { path: "/terms", Component: TermsOfServicePage },
  { path: "/refund-policy", Component: RefundPolicyPage },
  { path: "/income-disclosure", Component: IncomeDisclosurePage },
  { path: "/lp/declined", Component: LpDeclined },
  { path: "/lp/consolidation", Component: LpConsolidation },
  { path: "/lp/growth", Component: LpGrowth },
  { path: "/lp/seasonal", Component: LpSeasonal },
  { path: "/lp/partners", Component: LpCallCenterIso },
  { path: "/lp/referral", Component: LpReferral },
  { path: "/lp/platform", Component: LpPlatform },
  { path: "/lp/leaks", Component: LpLeaks },
  { path: "/lp/scale", Component: LpScale },
];

/**
 * Returns a wouter location hook fixed at the given path.
 * This lets wouter's Link and useLocation work correctly during SSR
 * without accessing window or browser history.
 */
function makeStaticHook(path: string) {
  return () => [path, () => {}] as [string, (to: string) => void];
}

/**
 * Render a single public route to an HTML string.
 *
 * The provider tree mirrors App.tsx (QueryClientProvider → WouterRouter →
 * TooltipProvider → Component + Toaster) so hydrateRoot on the client
 * produces the same DOM output and can keep the server-rendered nodes.
 *
 * Returns an empty string if the route is not in PUBLIC_ROUTES.
 */
export function render(url: string): string {
  const route = PUBLIC_ROUTES.find((r) => r.path === url);
  if (!route) return "";

  const { Component } = route;

  // Pre-seed auth as null (not logged in) so useAuth() returns immediately
  // with isLoading:false, user:null — the same state the client has when
  // main.tsx calls hydrateRoot after pre-seeding the same key.  This prevents
  // the loading-spinner branch in App's Router and ensures the server and
  // client render the same component tree.
  queryClient.setQueryData(AUTH_QUERY_KEY, null);

  return renderToString(
    // QueryClientProvider with the module-level singleton matches what App.tsx
    // passes to its own QueryClientProvider, so React Query context is
    // identical on both sides of hydration.
    <QueryClientProvider client={queryClient}>
      {/* Static wouter router: supplies URL context for Link / useLocation
          without touching window or browser history APIs. */}
      <WouterRouter hook={makeStaticHook(url)}>
        <TooltipProvider>
          <Component />
          {/* Toaster renders an empty <ol> when there are no toasts; include
              it here so the DOM matches App.tsx's render output exactly. */}
          <Toaster />
        </TooltipProvider>
      </WouterRouter>
    </QueryClientProvider>,
  );
}
