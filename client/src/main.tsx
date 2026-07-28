import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";
import { queryClient } from "./lib/queryClient";
import "./index.css";

// The query key used by useAuth() — must stay in sync with use-auth.ts.
const AUTH_QUERY_KEY = ["/api/user"] as const;

const rootEl = document.getElementById("root")!;

if (rootEl.hasAttribute("data-ssr")) {
  // The server sent a prerendered page body (data-ssr="1" on the root div).
  // Use hydrateRoot so React attaches to the existing DOM instead of
  // discarding and rebuilding it, preserving first-contentful-paint.
  //
  // Pre-seed auth as null (not logged in) so App's initial render matches
  // the server output: without this, App would render a loading spinner
  // (isLoading:true) which mismatches the prerendered page content and
  // forces React to throw away the server DOM anyway.
  //
  // The real auth state is fetched in the background immediately after mount;
  // if the visitor is signed in, the app re-renders (e.g. redirecting to
  // /dashboard from public-only routes) once the query resolves.
  queryClient.setQueryData(AUTH_QUERY_KEY, null);
  hydrateRoot(rootEl, <App />);
} else {
  // No prerendered content — standard SPA mount.
  createRoot(rootEl).render(<App />);
}
