import { usePageMeta } from "@/hooks/use-page-meta";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { PublicNav } from "@/components/PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import {
  ArrowRight,
  Banknote,
  Gauge,
  Building2,
  Wallet,
  Users,
  Repeat,
  Award,
  Sparkles,
} from "lucide-react";

const TRUST_STATS = [
  { value: "$2K–$2M", label: "Funding Range", icon: Banknote },
  { value: "1 Day", label: "Possible Funding Speed", icon: Gauge },
  { value: "6+ Mos.", label: "Time in Business Profile", icon: Building2 },
  { value: "$10K+", label: "Monthly Revenue Profile", icon: Wallet },
];

const SECTION_TEASERS = [
  {
    href: "/funding",
    icon: Banknote,
    eyebrow: "For Business Owners",
    title: "Merchant Cash Advance",
    desc: "Fast, flexible capital from $2K to $2M — funding available as quickly as one business day, with minimal paperwork.",
    cta: "Explore Funding",
  },
  {
    href: "/platform",
    icon: Repeat,
    eyebrow: "The Products",
    title: "Merchant Growth Platform",
    desc: "Four AI-powered subscription tiers that help merchants attract, capture, and convert more customers — month after month.",
    cta: "See the Tiers",
  },
  {
    href: "/opportunity",
    icon: Users,
    eyebrow: "For Agents",
    title: "The Agent Opportunity",
    desc: "Build a business with two revenue streams: immediate MCA commissions plus compounding subscription residuals.",
    cta: "See the Opportunity",
  },
  {
    href: "/commissions",
    icon: Award,
    eyebrow: "How You Earn",
    title: "The Compensation Plan",
    desc: "Transparent commission pools, performance accelerators, distributor tiers, and overrides up to three levels deep.",
    cta: "View Compensation",
  },
];

export default function LandingPage() {
  usePageMeta(
    "Business Funding & Merchant Cash Advance | LeaderShield Funding",
    "LeaderShield Funding helps businesses access fast merchant cash advances and grow recurring revenue. Join our agent network or apply for capital today.",
  );

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <PublicNav />

      {/* Hero — two-fork: get funded or become an agent */}
      <section className="relative min-h-[100vh] flex items-center pt-16 overflow-hidden bg-gradient-to-br from-[#0A1628] via-[#0f1f3a] to-[#0A1628]">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 -right-32 w-[600px] h-[600px] bg-white/5 rounded-full blur-[120px] animate-float" />
          <div className="absolute bottom-1/4 -left-32 w-[500px] h-[500px] bg-white/4 rounded-full blur-[100px] animate-float-delayed" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[150px]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(10,22,40,0.8)_70%)]" />
        </div>

        <div className="max-w-5xl mx-auto px-6 relative z-10 py-20 text-center">
          <div className="animate-fade-in-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 mb-8">
              <Sparkles className="w-4 h-4 text-[#C9A24B]" />
              <span className="text-sm font-medium text-white/80">Capital for merchants. Income for agents.</span>
            </div>

            <h1 className="text-5xl lg:text-7xl font-display font-bold text-white leading-[1.08] mb-8">
              Two ways to grow with
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#E0C27E] to-white/70">
                LeaderShield Funding.
              </span>
            </h1>

            <p className="text-xl text-white/60 mb-12 max-w-2xl mx-auto leading-relaxed">
              We help business owners access fast, flexible merchant cash advance funding — and reward the agents who
              connect them with capital and growth tools. Pick your path.
            </p>
          </div>

          {/* Two-fork cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto animate-fade-in-right">
            <Link href="/funding" data-testid="fork-get-funded" className="group">
              <div className="h-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-left hover:bg-white/10 transition-all hover:scale-[1.02]">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center mb-5">
                  <Banknote className="w-7 h-7 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Get Funded</h2>
                <p className="text-white/55 mb-6 leading-relaxed">
                  Need working capital? See how merchant cash advance funding works and what it takes to qualify.
                </p>
                <span className="inline-flex items-center text-emerald-400 font-semibold group-hover:gap-2 transition-all">
                  Explore funding <ArrowRight className="w-5 h-5 ml-2" />
                </span>
              </div>
            </Link>

            <Link href="/opportunity" data-testid="fork-become-agent" className="group">
              <div className="h-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-left hover:bg-white/10 transition-all hover:scale-[1.02]">
                <div className="w-14 h-14 rounded-2xl bg-[#C9A24B]/20 flex items-center justify-center mb-5">
                  <Users className="w-7 h-7 text-[#C9A24B]" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Become an Agent</h2>
                <p className="text-white/55 mb-6 leading-relaxed">
                  Build a business with two income streams. Learn how agents earn on capital and recurring subscriptions.
                </p>
                <span className="inline-flex items-center text-[#C9A24B] font-semibold group-hover:gap-2 transition-all">
                  See the opportunity <ArrowRight className="w-5 h-5 ml-2" />
                </span>
              </div>
            </Link>
          </div>

          <p className="text-xs text-white/30 mt-10 max-w-2xl mx-auto">
            *Merchant cash advance funding is not a traditional APR-based loan. Terms subject to underwriting review.
            Individual agent results vary.
          </p>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      </section>

      {/* Trust strip */}
      <section className="py-16 px-6 bg-background border-b border-border">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {TRUST_STATS.map((stat, i) => (
              <div key={i} className="flex flex-col items-center" data-testid={`trust-stat-${i}`}>
                <stat.icon className="w-6 h-6 text-primary mb-3" />
                <p className="text-3xl lg:text-4xl font-bold text-primary mb-1">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section teasers — point inward to the focused pages */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 text-sm font-medium text-primary mb-6">
              <Sparkles className="w-4 h-4" />
              Explore the Platform
            </span>
            <h2 className="text-4xl lg:text-5xl font-display font-bold text-primary mb-6">
              Everything You Need, Organized.
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Dive into the details that matter to you — the funding product, the subscription platform, the agent
              opportunity, and exactly how you get paid.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {SECTION_TEASERS.map((s, i) => (
              <Link key={i} href={s.href} data-testid={`teaser-${s.href.slice(1)}`} className="group">
                <div className="h-full bg-background border border-border/60 rounded-2xl p-8 shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5">
                  <div className="flex items-start gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                      <s.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#C9A24B] mb-1">{s.eyebrow}</p>
                      <h3 className="text-xl font-bold text-primary mb-2">{s.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-4">{s.desc}</p>
                      <span className="inline-flex items-center text-sm font-semibold text-primary group-hover:gap-2 transition-all">
                        {s.cta} <ArrowRight className="w-4 h-4 ml-1.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 bg-gradient-to-br from-[#0A1628] via-[#0f1f3a] to-[#0A1628] relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/4 rounded-full blur-[120px]" />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl lg:text-6xl font-display font-bold text-white mb-6 leading-tight">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-white/50 mb-10 max-w-2xl mx-auto">
            Apply for capital in minutes, or join the network and start building a full agent business with two revenue
            streams.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://apply.myrmapp.com/multi-step-apply/pg"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-apply-home"
            >
              <Button
                size="lg"
                variant="outline"
                className="h-16 px-10 text-lg font-semibold border-white/20 text-white hover:bg-white/10 hover:text-white"
              >
                Apply for Funding
              </Button>
            </a>
            <Link href="/signup">
              <Button
                size="lg"
                className="h-16 px-12 text-lg font-bold bg-white text-primary shadow-2xl hover:bg-white/90 transition-all hover:scale-105"
                data-testid="button-home-join"
              >
                Join the Network
                <ArrowRight className="w-6 h-6 ml-3" />
              </Button>
            </Link>
          </div>
          <p className="text-xs text-white/30 mt-6">No obligations. Complete training at your own pace. Start earning when you're ready.</p>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
