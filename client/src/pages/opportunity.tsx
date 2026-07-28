import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PublicNav } from "@/components/PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { AnimatedSection, FAQItem } from "@/components/AnimatedSection";
import {
  Target,
  GraduationCap,
  DollarSign,
  Users,
  Zap,
  Repeat,
  CheckCircle2,
  ArrowRight,
  Gauge,
  Handshake,
  FileCheck,
  Banknote,
  TrendingUp,
  Trophy,
  Star,
  FileText,
  Shield,
  BarChart3,
  Headphones,
  Calendar,
  Rocket,
  Heart,
  Quote,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import { COMP_V2026 } from "@shared/compensation";
import { usd, pct } from "@shared/compensation-format";
const {
  mcaAllocation,
  mcaAccelerators,
  subscriptionPools,
  matureResidual,
  subscriptionPricing,
  subscriptionAccelerators,
  membership,
} = COMP_V2026;

export default function OpportunityPage() {
  usePageMeta(
    "The Agent Opportunity | LeaderShield Funding",
    "Build a full agent business with two revenue streams — immediate MCA commissions plus compounding subscription residuals. See how it works, income scenarios, your toolkit, and a 30-day roadmap.",
  );

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <PublicNav />

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden bg-gradient-to-br from-[#0A1628] via-[#0f1f3a] to-[#0A1628] text-white">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#C9A24B]/8 rounded-full blur-[120px]" />
        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm font-medium text-white/80 mb-6">
            <Target className="w-4 h-4 text-[#C9A24B]" />
            The Agent Opportunity
          </span>
          <h1 className="text-4xl lg:text-6xl font-display font-bold mb-6 leading-tight">
            Two Revenue Streams.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#E0C27E] to-white/70">
              One Unstoppable Career.
            </span>
          </h1>
          <p className="text-lg text-white/55 max-w-2xl mx-auto mb-10">
            Full agents earn immediate MCA commissions AND build recurring subscription revenue that compounds every
            month. We handle closing, underwriting, and fulfillment — you focus on relationships.
          </p>
          <Link href="/signup">
            <Button size="lg" className="h-14 px-10 text-lg font-bold bg-white text-primary hover:bg-white/90 shadow-2xl hover:scale-105 transition-all" data-testid="button-join-hero">
              Join the Network — Free
              <ArrowRight className="w-5 h-5 ml-3" />
            </Button>
          </Link>
        </div>
      </section>

      {/* The Opportunity — How It Works */}
      <section className="py-24 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-16">
              <h2 className="text-4xl lg:text-5xl font-display font-bold text-primary mb-6">
                Build a Full Agent Business<br />With Two Revenue Streams.
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Full agents earn enhanced MCA commissions AND build recurring subscription revenue that compounds every month. Two engines. One unstoppable career.
              </p>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Join & Learn", desc: "Complete our training academy, set up your agent portal, and get certified. We give you everything you need to hit the ground running.", icon: GraduationCap, color: "from-blue-500 to-blue-600" },
              { step: "02", title: "Sell & Earn", desc: "Present MCA funding and subscription products to merchants. Earn immediate MCA commissions plus monthly recurring platform revenue.", icon: DollarSign, color: "from-emerald-500 to-emerald-600" },
              { step: "03", title: "Build & Scale", desc: "Recruit and mentor your own team of agents. Earn override commissions and watch your income multiply as your team produces.", icon: Users, color: "from-primary to-slate-700" },
            ].map((item, i) => (
              <AnimatedSection key={i} delay={i * 0.15}>
                <Card className="relative overflow-hidden border-border/50 shadow-sm hover:shadow-xl transition-all duration-500 group h-full" data-testid={`how-it-works-${i}`}>
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${item.color}`} />
                  <CardContent className="p-8">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                      <item.icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="text-6xl font-bold text-muted/20 absolute top-6 right-6 font-display">{item.step}</div>
                    <h3 className="text-xl font-bold text-primary mb-3">{item.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Two Revenue Streams */}
      <section className="py-24 px-6 bg-gradient-to-br from-[#0A1628] via-[#0f1f3a] to-[#0A1628] text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/4 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-400/5 rounded-full blur-[100px]" />
        <div className="max-w-7xl mx-auto relative z-10">
          <AnimatedSection>
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm font-medium text-white/80 mb-6">
                <Zap className="w-4 h-4" />
                Double the Earning Power
              </span>
              <h2 className="text-4xl lg:text-5xl font-display font-bold text-white mb-6">
                Two Revenue Streams.<br />One Powerful Platform.
              </h2>
              <p className="text-lg text-white/50 max-w-2xl mx-auto">
                The MCA engine produces cash flow. The subscription platform builds enterprise value. Together, they create wealth.
              </p>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <AnimatedSection delay={0.1}>
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 h-full hover:bg-white/8 transition-all" data-testid="card-mca-stream">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                    <DollarSign className="w-7 h-7 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">Merchant Cash Advance</h3>
                    <p className="text-emerald-400 font-semibold">Immediate Income</p>
                  </div>
                </div>
                <p className="text-white/60 mb-6 leading-relaxed">
                  Earn competitive commissions on every funded MCA deal. Fast approvals, high ticket values, and repeat business mean you can start earning within your first week.
                </p>
                <div className="space-y-3">
                  {[`${pct(mcaAllocation.openingAgentPool)} Opening Agent Pool on every funded deal`, "Paid monthly on collected revenue", `Performance accelerators up to +${pct(mcaAccelerators.cap)}`, "Repeat-merchant and penetration bonuses"].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-white/70">{item}</span>
                    </div>
                  ))}
                </div>
                <a href="https://apply.myrmapp.com/multi-step-apply/pg" target="_blank" rel="noopener noreferrer" data-testid="link-apply-mca-stream" className="block mt-6">
                  <Button className="w-full h-12 bg-emerald-500 text-white font-bold hover:bg-emerald-600 shadow-lg">
                    Apply for Funding
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </a>
              </div>
            </AnimatedSection>

            <AnimatedSection delay={0.2}>
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 h-full hover:bg-white/8 transition-all" data-testid="card-platform-stream">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                    <Repeat className="w-7 h-7 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">Merchant Growth Platform</h3>
                    <p className="text-blue-400 font-semibold">Recurring Wealth</p>
                  </div>
                </div>
                <p className="text-white/60 mb-6 leading-relaxed">
                  Sell monthly subscription products that merchants genuinely need. Every subscription you place generates recurring commissions that compound month after month.
                </p>
                <div className="space-y-3">
                  {[`Pools up to ${pct(subscriptionPools.elite.tier_3.m1to3)} by distributor tier`, "Aggressive upfront payouts (months 1–3)", `Lifetime residual up to ${pct(matureResidual.tier_3)} after month 12`, `Four tiers from ${usd(subscriptionPricing.tier_1.retail)} to ${usd(subscriptionPricing.tier_4.retail)}/month`, "Powered by Marketing Titan + Lead Titan AI"].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-white/70">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </AnimatedSection>
          </div>

          <AnimatedSection delay={0.3}>
            <div className="bg-white/8 border border-white/20 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6" data-testid="card-pairing-enhancement">
              <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0 animate-pulse-glow">
                <Zap className="w-8 h-8 text-[#C9A24B]" />
              </div>
              <div className="text-center md:text-left">
                <h3 className="text-xl font-bold text-white mb-1">The Power of Pairing</h3>
                <p className="text-white/60">
                  Attach a subscription to a funded MCA (or fund a subscribing merchant) and you trigger attachment accelerators on
                  both products — earning more on each side. This is the compound advantage that sets LeaderShield apart.
                </p>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Sales Strategy — Distribution Flywheel */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 text-sm font-medium text-primary mb-6">
                <Gauge className="w-4 h-4" />
                How The Business Works
              </span>
              <h2 className="text-4xl lg:text-5xl font-display font-bold text-primary mb-6">
                You Open. We Close. Everyone Grows.
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                LeaderShield is built so you can focus on relationships and opening opportunities — our partners handle the heavy
                lifting of closing, underwriting, and fulfillment.
              </p>
            </div>
          </AnimatedSection>

          {/* Opening vs Closing */}
          <AnimatedSection delay={0.1}>
            <div className="grid md:grid-cols-2 gap-6 mb-16">
              <div className="bg-primary/5 border border-primary/10 rounded-2xl p-8" data-testid="card-opening-agent">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Handshake className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-primary mb-2">You're the Opening Agent</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Your job is to start the conversation — find merchants who need capital or growth tools and introduce them.
                  You own the relationship; you don't need to be an underwriting expert.
                </p>
              </div>
              <div className="bg-muted/40 border border-border rounded-2xl p-8" data-testid="card-closing-partner">
                <div className="w-12 h-12 rounded-2xl bg-[#C9A24B]/15 flex items-center justify-center mb-4">
                  <FileCheck className="w-6 h-6 text-[#C9A24B]" />
                </div>
                <h3 className="text-xl font-bold text-primary mb-2">Our Partners Close</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Premium Merchant Funding (PMF) and our platform partners handle closing, underwriting, fulfillment, and ongoing
                  service — which is exactly why PMF takes the largest share of each funded deal.
                </p>
              </div>
            </div>
          </AnimatedSection>

          {/* Three Engines */}
          <AnimatedSection delay={0.2}>
            <h3 className="text-2xl font-bold text-primary mb-2 text-center">Three Engines, One Flywheel</h3>
            <p className="text-muted-foreground text-center mb-10 max-w-2xl mx-auto">
              Each merchant relationship can power three connected income engines — and each one feeds the next.
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: Banknote, title: "Capital", desc: "Fund merchants with a merchant cash advance and earn from the Opening Agent Pool on every deal.", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
                { icon: Repeat, title: "Merchant Growth Platform", desc: "Place recurring subscriptions that solve real problems and pay you compounding monthly residuals.", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
                { icon: Users, title: "Distribution", desc: "Build an organization of distributors and earn override income across up to 3 levels.", color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100" },
              ].map((item, i) => (
                <div key={i} className={`rounded-2xl p-8 border ${item.border} ${item.bg}`} data-testid={`engine-card-${i}`}>
                  <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center mb-4 shadow-sm">
                    <item.icon className={`w-7 h-7 ${item.color}`} />
                  </div>
                  <h4 className="text-lg font-bold text-primary mb-2">{item.title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </AnimatedSection>

          {/* Flywheel steps */}
          <AnimatedSection delay={0.3}>
            <div className="mt-12 bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/10 rounded-2xl p-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { icon: Target, label: "Open", desc: "Introduce a merchant" },
                  { icon: Banknote, label: "Fund & Subscribe", desc: "Capital + platform" },
                  { icon: TrendingUp, label: "Grow", desc: "Merchant succeeds & retains" },
                  { icon: Repeat, label: "Repeat", desc: "Renewals, residuals & referrals" },
                ].map((item, i) => (
                  <div key={i} className="text-center">
                    <div className="w-14 h-14 rounded-2xl bg-background shadow-sm flex items-center justify-center mx-auto mb-3">
                      <item.icon className="w-6 h-6 text-primary" />
                    </div>
                    <p className="font-bold text-primary mb-1">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Income Lifestyle Section */}
      <section className="py-24 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 text-sm font-medium text-primary mb-6">
                <Trophy className="w-4 h-4" />
                Real Earning Potential
              </span>
              <h2 className="text-4xl lg:text-5xl font-display font-bold text-primary mb-6">
                What Could Your Income Look Like?
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                These scenarios illustrate what's possible when you follow the system. The compounding effect of subscription revenue means your income grows every month you stay active.*
              </p>
            </div>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[
              { title: "Subscription Producer", subtitle: "Platform-focused", income: "$30K–$60K", timeframe: "/year illustrative", desc: "Builds a book of recurring Merchant Growth Platform subscriptions and earns compounding monthly residuals.", color: "border-blue-200 bg-blue-50/50" },
              { title: "Balanced Distributor", subtitle: "Capital + platform", income: "$100K–$200K", timeframe: "/year illustrative", desc: "Pairs funded MCA deals with subscriptions, reaching Enhanced tier and stacking accelerators.", color: "border-primary/20 bg-primary/5", featured: true },
              { title: "Elite Distributor", subtitle: "High-volume producer", income: "$250K–$350K", timeframe: "/year illustrative", desc: "Consistently hits Elite qualification thresholds with strong funded volume and a mature residual base.", color: "border-emerald-200 bg-emerald-50/50" },
              { title: "Agency Leader", subtitle: "Builds an organization", income: "$200K–$500K+", timeframe: "/year illustrative", desc: "Personal production plus override income from a multi-level distributor organization (up to 3 levels deep).", color: "border-amber-200 bg-amber-50/50" },
            ].map((item: any, i) => (
              <AnimatedSection key={i} delay={i * 0.15}>
                <Card className={`h-full border-2 ${item.color} ${item.featured ? 'shadow-xl scale-[1.02]' : 'shadow-sm'}`} data-testid={`income-scenario-${i}`}>
                  <CardContent className="p-8 text-center">
                    {item.featured && (
                      <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-white text-xs font-bold mb-4">
                        <Star className="w-3 h-3" />
                        Most Common Path
                      </div>
                    )}
                    <h3 className="text-xl font-bold text-primary mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{item.subtitle}</p>
                    <p className="text-4xl font-bold text-primary mb-1">{item.income}</p>
                    <p className="text-sm text-muted-foreground mb-4">{item.timeframe}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
          </div>

          <AnimatedSection delay={0.3}>
            <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/10 rounded-2xl p-6 md:p-8 text-center">
              <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl mx-auto" data-testid="text-income-disclaimer">
                <strong className="text-foreground">These figures are illustrative archetypes, not guarantees or projections of income.</strong> They
                do not represent typical or average earnings. The majority of participants earn little to no income. Actual results
                depend entirely on your own effort, skill, retention, and market conditions.
              </p>
              <Link href="/income-disclosure">
                <Button variant="outline" className="mt-5" data-testid="button-view-income-disclosure">
                  <FileText className="w-4 h-4 mr-2" />
                  Read the full Income Disclosure Statement
                </Button>
              </Link>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Platform & Tools */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 text-sm font-medium text-primary mb-6">
                <Shield className="w-4 h-4" />
                Your Toolkit
              </span>
              <h2 className="text-4xl lg:text-5xl font-display font-bold text-primary mb-6">
                Everything You Need to Succeed
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                From CRM to compliance, we provide the infrastructure. You focus on building relationships and closing deals.
              </p>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[
              { icon: BarChart3, title: "CRM & Pipeline", desc: "Track leads, deals, and commissions in real-time with our powerful agent dashboard" },
              { icon: GraduationCap, title: "Training Academy", desc: "Comprehensive video modules covering products, sales mastery, and compliance" },
              { icon: FileCheck, title: "Compliance Shield", desc: "Automated disclosures and governance tools to keep your business safe" },
              { icon: Headphones, title: "Dedicated Support", desc: "Expert support team for deal structuring, technical help, and strategy" },
            ].map((item, i) => (
              <AnimatedSection key={i} delay={i * 0.1}>
                <Card className="border-border/50 shadow-sm hover:shadow-lg transition-all h-full group" data-testid={`tool-card-${i}`}>
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <item.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-bold text-primary mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
          </div>

          {/* Membership Fee */}
          <AnimatedSection delay={0.3}>
            <div className="bg-background border border-border rounded-2xl p-8 md:p-10 max-w-4xl mx-auto text-center shadow-sm">
              <h3 className="text-2xl font-bold text-primary mb-2">Membership: {usd(membership.individual.fee)}/month</h3>
              <p className="text-muted-foreground mb-6">
                Access to your CRM, training, reporting, and support. Your membership is <strong className="text-foreground">automatically waived</strong> in any
                month you collect at least {usd(membership.individual.waiverThreshold)} in commissions — so active, producing distributors effectively pay nothing.
              </p>
              <p className="text-sm font-semibold text-primary mb-4">Building an agency? Pick the plan that fits your team:</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { name: "Individual", key: "individual", band: "Solo distributor" },
                  { name: "Small Agency", key: "small_agency", band: "1–5 distributors" },
                  { name: "Growth Agency", key: "growth_agency", band: "5–10 distributors" },
                  { name: "Enterprise Agency", key: "enterprise_agency", band: "11+ distributors" },
                ].map((m, i) => (
                  <div key={i} className="p-5 bg-muted/40 rounded-xl border border-border text-left" data-testid={`membership-plan-${m.key}`}>
                    <p className="text-sm font-bold text-primary mb-1">{m.name}</p>
                    <p className="text-xs text-muted-foreground mb-3">{m.band}</p>
                    <p className="text-2xl font-bold text-primary">{usd(membership[m.key].fee)}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                    <p className="text-xs font-semibold text-[#1C8A5B] mt-2">Waived at {usd(membership[m.key].waiverThreshold)} collected</p>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Your First 30 Days */}
      <section className="py-24 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 text-sm font-medium text-primary mb-6">
                <Calendar className="w-4 h-4" />
                Your Roadmap
              </span>
              <h2 className="text-4xl lg:text-5xl font-display font-bold text-primary mb-6">
                Your First 30 Days
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Follow the system, and the results will follow. Here's your clear path from day one to your first commission.
              </p>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-4 gap-6 relative">
            <div className="hidden md:block absolute top-16 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-blue-200 via-blue-200 to-purple-200 z-0" />
            {[
              { week: "Week 1", title: "Foundation", icon: GraduationCap, color: "blue", items: ["Complete Academy training modules", "Setup CRM & email signature", "Review compliance guidelines", "Shadow experienced agents"] },
              { week: "Week 2", title: "Activation", icon: Rocket, color: "emerald", items: ["Build 100-lead prospect list", "Launch email outreach campaign", "Begin daily call block (2 hrs)", "Submit your first lead"] },
              { week: "Week 3", title: "Momentum", icon: TrendingUp, color: "indigo", items: ["Conduct 5 merchant demos", "Generate 3 subscription quotes", "Collect 1st MCA application", "Follow up on pipeline"] },
              { week: "Week 4", title: "Results", icon: Trophy, color: "purple", items: ["Close 1st subscription deal", "Fund 1st MCA deal", "Receive first commission payout", "Set goals for month 2"] },
            ].map((item, i) => {
              const colors: Record<string, { bg: string; text: string; dot: string; iconBg: string }> = {
                blue: { bg: "bg-blue-50", text: "text-blue-600", dot: "bg-blue-500", iconBg: "bg-blue-100" },
                emerald: { bg: "bg-emerald-50", text: "text-emerald-600", dot: "bg-emerald-500", iconBg: "bg-emerald-100" },
                indigo: { bg: "bg-indigo-50", text: "text-indigo-600", dot: "bg-indigo-500", iconBg: "bg-indigo-100" },
                purple: { bg: "bg-purple-50", text: "text-purple-600", dot: "bg-purple-500", iconBg: "bg-purple-100" },
              };
              const c = colors[item.color];
              return (
                <AnimatedSection key={i} delay={i * 0.15}>
                  <div className="relative z-10" data-testid={`roadmap-week-${i + 1}`}>
                    <div className={`w-8 h-8 rounded-full ${c.dot} mx-auto mb-4 flex items-center justify-center shadow-lg`}>
                      <span className="text-white text-xs font-bold">{i + 1}</span>
                    </div>
                    <Card className="border-border/50 shadow-sm hover:shadow-lg transition-all h-full">
                      <CardContent className="p-6">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${c.bg} mb-3`}>
                          <item.icon className={`w-3.5 h-3.5 ${c.text}`} />
                          <span className={`text-xs font-bold ${c.text}`}>{item.week}</span>
                        </div>
                        <h3 className="text-lg font-bold text-primary mb-3">{item.title}</h3>
                        <div className="space-y-2">
                          {item.items.map((task, j) => (
                            <div key={j} className="flex items-start gap-2">
                              <CheckCircle2 className={`w-3.5 h-3.5 ${c.text} mt-0.5 flex-shrink-0`} />
                              <span className="text-xs text-muted-foreground">{task}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </AnimatedSection>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 text-sm font-medium text-primary mb-6">
                <Heart className="w-4 h-4" />
                Agent Success Stories
              </span>
              <h2 className="text-4xl lg:text-5xl font-display font-bold text-primary mb-6">
                Hear It From Our Agents
              </h2>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { name: "Marcus T.", role: "Full-Time Producer", location: "Atlanta, GA", quote: "I was doing traditional MCA for 3 years. When I added the subscription platform, my monthly income went from unpredictable to a steady climb. The residuals changed everything.", months: "14 months" },
              { name: "Sarah K.", role: "Team Builder", location: "Phoenix, AZ", quote: "I started part-time while working my corporate job. Within 6 months, my LeaderShield income surpassed my salary. The training academy gave me everything I needed to succeed.", months: "11 months" },
              { name: "David R.", role: "Agency Partner", location: "Miami, FL", quote: "Building a team was the multiplier. My personal production earns well, but the overrides from my team of 8 agents have created the financial freedom I always wanted.", months: "18 months" },
            ].map((item, i) => (
              <AnimatedSection key={i} delay={i * 0.15}>
                <Card className="h-full border-border/50 shadow-sm hover:shadow-lg transition-all" data-testid={`testimonial-${i}`}>
                  <CardContent className="p-8">
                    <Quote className="w-8 h-8 text-primary/15 mb-4" />
                    <p className="text-muted-foreground leading-relaxed mb-6 italic">"{item.quote}"</p>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white font-bold text-lg">
                        {item.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-primary">{item.name}</p>
                        <p className="text-sm text-muted-foreground">{item.role} - {item.location}</p>
                        <p className="text-xs text-muted-foreground">{item.months} with LeaderShield</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-6">*These testimonials represent individual experiences and are not guarantees of income. Results vary by person.</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6 bg-muted/30">
        <div className="max-w-3xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 text-sm font-medium text-primary mb-6">
                <MessageSquare className="w-4 h-4" />
                Opportunity FAQ
              </span>
              <h2 className="text-4xl font-display font-bold text-primary mb-6">Common Questions</h2>
            </div>
          </AnimatedSection>
          <AnimatedSection delay={0.1}>
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-6 md:p-8">
                <FAQItem
                  question="Do I need experience to get started?"
                  answer="No prior experience is required — drive and relationships matter more than your background. Our comprehensive training academy covers everything from product knowledge and sales techniques to compliance guidelines. You'll have access to scripts, objection handlers, and ongoing support from our team."
                />
                <FAQItem
                  question="Can I sell both MCA and subscriptions to the same merchant?"
                  answer={`Yes — when it's the right fit for the merchant. Distributors can offer both products, and consistent MCA-plus-subscription attachment is one of the performance accelerators that can lift your subscription commission pool by up to an additional ${pct(subscriptionAccelerators.cap)}. It's an accelerator earned across your production, not a standalone per-deal pairing bonus, and you should only place products that genuinely suit the merchant's needs.`}
                />
              </CardContent>
            </Card>
          </AnimatedSection>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 bg-gradient-to-br from-[#0A1628] via-[#0f1f3a] to-[#0A1628] relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/4 rounded-full blur-[120px]" />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <AnimatedSection>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm font-medium text-white/80 mb-8">
              <Sparkles className="w-4 h-4 text-[#C9A24B]" />
              Fast funding. Full-service execution.
            </div>
            <h2 className="text-4xl lg:text-6xl font-display font-bold text-white mb-6 leading-tight">
              Ready to Connect Businesses<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#E0C27E] to-white/70">With the Capital They Need?</span>
            </h2>
            <p className="text-xl text-white/50 mb-10 max-w-2xl mx-auto">
              Join LeaderShield Funding. Build a full agent business with two revenue streams. We'll handle the execution and train you every step of the way.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <Button size="lg" className="h-16 px-12 text-lg font-bold bg-white text-primary shadow-2xl hover:bg-white/90 transition-all hover:scale-105" data-testid="button-final-cta">
                  Apply Now — Free to Join
                  <ArrowRight className="w-6 h-6 ml-3" />
                </Button>
              </Link>
            </div>
            <p className="text-xs text-white/30 mt-6">No obligations. Complete training at your own pace. Start earning when you're ready.</p>
          </AnimatedSection>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
