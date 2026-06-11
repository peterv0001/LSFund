import { useEffect, useState, lazy, Suspense, Component, type ReactNode } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/BrandMark";
import {
  ArrowRight,
  Play,
  Banknote,
  Gauge,
  Building2,
  Wallet,
  Sparkles,
} from "lucide-react";

// Retry a dynamic import a couple of times before giving up — flaky mobile
// networks can drop a chunk request that succeeds on a quick retry.
function retryImport<T>(factory: () => Promise<T>, retries = 2, delay = 400): Promise<T> {
  return factory().catch((err) => {
    if (retries <= 0) throw err;
    return new Promise<T>((resolve) => setTimeout(resolve, delay)).then(() =>
      retryImport(factory, retries - 1, delay),
    );
  });
}

const importLandingSections = () => import("@/pages/landing-sections");

// Below-the-fold sections are animation-heavy (framer-motion) and account for
// the bulk of the landing page weight. Load them lazily so the hero can paint
// immediately without waiting on the animation library or the full page.
const LandingSections = lazy(() => retryImport(importLandingSections));

// Last-resort recovery if the lazy chunk can't be fetched at all (e.g. the
// network drops mid-load). Keeps the page from being stuck with no content.
class SectionsErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="py-24 px-6 text-center" data-testid="error-landing-sections">
          <p className="text-muted-foreground mb-6">Some of this page didn't finish loading.</p>
          <Button onClick={() => window.location.reload()} data-testid="button-reload-sections">
            Reload page
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function LandingPage() {
  usePageMeta(
    "Business Funding & Merchant Cash Advance | Leader Shield Funding",
    "Leader Shield Funding helps businesses access fast merchant cash advances and grow recurring revenue. Join our agent network or apply for capital today.",
  );
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Proactively fetch the below-the-fold chunk once the hero has painted (on
  // idle), so anchor links and scrolling resolve quickly without blocking the
  // first screen.
  useEffect(() => {
    const preload = () => { void importLandingSections(); };
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const id = w.requestIdleCallback ? w.requestIdleCallback(preload) : window.setTimeout(preload, 200);
    return () => {
      const wc = window as Window & { cancelIdleCallback?: (handle: number) => void };
      if (wc.cancelIdleCallback) wc.cancelIdleCallback(id as number);
      else clearTimeout(id as number);
    };
  }, []);

  // Deep links to in-page sections (e.g. /#faq) target IDs that live in the
  // lazy chunk; once it has loaded, scroll to the target when it appears.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    let cancelled = false;
    importLandingSections().then(() => {
      let attempts = 0;
      const tryScroll = () => {
        if (cancelled) return;
        let el: Element | null = null;
        try { el = document.querySelector(hash); } catch { el = null; }
        if (el) {
          el.scrollIntoView();
        } else if (attempts++ < 10) {
          setTimeout(tryScroll, 100);
        }
      };
      tryScroll();
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-background/95 backdrop-blur-xl shadow-sm border-b border-border' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" data-testid="link-logo-landing" className="hover:opacity-90 transition-opacity">
            <BrandLockup size="md" onDark={!scrolled} />
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {[
              { href: "#funding", label: "Funding" },
              { href: "#opportunity", label: "Opportunity" },
              { href: "#platform", label: "Platform" },
              { href: "#compensation", label: "Earnings" },
              { href: "#faq", label: "FAQ" },
            ].map((l) => (
              <a key={l.href} href={l.href} className={`text-sm font-medium transition-colors ${scrolled ? 'text-muted-foreground hover:text-primary' : 'text-white/70 hover:text-white'}`}>{l.label}</a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className={scrolled ? '' : 'text-white hover:bg-white/10 hover:text-white'} data-testid="button-login">Agent Login</Button>
            </Link>
            <a href="https://apply.myrmapp.com/multi-step-apply/pg" target="_blank" rel="noopener noreferrer" data-testid="link-apply-now">
              <Button variant="outline" size="sm" className={scrolled ? '' : 'border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white'}>
                Apply Now
              </Button>
            </a>
            <Link href="/signup">
              <Button size="sm" className="bg-white text-primary font-semibold hover:bg-white/90 shadow-md" data-testid="button-join">
                Join Now
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section — Full-width immersive dark */}
      <section className="relative min-h-[100vh] flex items-center pt-16 overflow-hidden bg-gradient-to-br from-[#0A1628] via-[#0f1f3a] to-[#0A1628]">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 -right-32 w-[600px] h-[600px] bg-white/5 rounded-full blur-[120px] animate-float" />
          <div className="absolute bottom-1/4 -left-32 w-[500px] h-[500px] bg-white/4 rounded-full blur-[100px] animate-float-delayed" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[150px]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(10,22,40,0.8)_70%)]" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 py-20">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="animate-fade-in-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 mb-8">
                <Sparkles className="w-4 h-4 text-[#C9A24B]" />
                <span className="text-sm font-medium text-white/80">Unsecured working capital, fast</span>
              </div>

              <h1 className="text-5xl lg:text-7xl font-display font-bold text-white leading-[1.08] mb-8">
                Capital when your
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#E0C27E] to-white/70">
                  business needs it most.
                </span>
              </h1>

              <p className="text-xl text-white/60 mb-10 max-w-lg leading-relaxed">
                Leader Shield Funding helps business owners access fast, flexible merchant cash advance funding — and rewards the agents who connect them with capital.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <Link href="/signup">
                  <Button size="lg" className="h-16 px-10 text-lg font-bold bg-white text-primary shadow-2xl hover:bg-white/90 transition-all hover:scale-105" data-testid="button-get-started">
                    Join the Network
                    <ArrowRight className="w-6 h-6 ml-3" />
                  </Button>
                </Link>
                <a href="#funding">
                  <Button size="lg" variant="outline" className="h-16 px-10 text-lg font-semibold border-white/20 text-white hover:bg-white/10 hover:text-white">
                    <Play className="w-5 h-5 mr-2" />
                    Explore Funding
                  </Button>
                </a>
              </div>

              <p className="text-xs text-white/30">*Merchant cash advance funding is not a traditional APR-based loan. Terms subject to underwriting review. Individual agent results vary.</p>
            </div>

            <div className="animate-fade-in-right relative hidden lg:block">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-br from-white/10 to-transparent rounded-3xl blur-2xl" />
                <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 space-y-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-white/60 text-sm font-medium uppercase tracking-wider">The Funding Profile</span>
                  </div>

                  <div className="space-y-4">
                    {[
                      { icon: Banknote, color: "emerald", label: "Funding Range", value: "$2K–$2M" },
                      { icon: Gauge, color: "blue", label: "Funding Speed", value: "As fast as 1 day" },
                      { icon: Building2, color: "platinum", label: "Time in Business", value: "6+ months" },
                      { icon: Wallet, color: "purple", label: "Monthly Revenue", value: "$10K+" },
                    ].map((row, i) => {
                      const map: Record<string, { bg: string; text: string }> = {
                        emerald: { bg: "bg-emerald-500/20", text: "text-emerald-400" },
                        blue: { bg: "bg-blue-500/20", text: "text-blue-400" },
                        platinum: { bg: "bg-white/10", text: "text-[#E0C27E]" },
                        purple: { bg: "bg-purple-500/20", text: "text-purple-400" },
                      };
                      const c = map[row.color];
                      return (
                        <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
                              <row.icon className={`w-5 h-5 ${c.text}`} />
                            </div>
                            <span className="text-white/70">{row.label}</span>
                          </div>
                          <span className={`text-base font-bold ${c.text}`}>{row.value}</span>
                        </div>
                      );
                    })}
                  </div>

                  <Link href="/signup">
                    <Button className="w-full h-14 bg-white text-primary font-bold text-lg hover:bg-white/90 shadow-xl mt-4">
                      Start a Funding Review
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      </section>

      {/* Below-the-fold content loads after the hero is visible. */}
      <SectionsErrorBoundary>
        <Suspense fallback={<div className="min-h-[40vh]" aria-hidden="true" />}>
          <LandingSections />
        </Suspense>
      </SectionsErrorBoundary>
    </div>
  );
}
