import { useRef, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BrandLockup } from "@/components/BrandMark";
import {
  Shield,
  DollarSign,
  Users,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  BarChart3,
  Zap,
  Star,
  ChevronRight,
  ChevronDown,
  Repeat,
  Target,
  Bot,
  MessageSquare,
  FileCheck,
  Scale,
  Calendar,
  Rocket,
  Award,
  Layers,
  GraduationCap,
  Headphones,
  Quote,
  Sparkles,
  Trophy,
  Heart,
  Lock,
  Banknote,
  Gauge,
  CalendarClock,
  Wallet,
  FileText,
  Building2,
  Handshake,
  Search,
  Settings2,
} from "lucide-react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { COMP_V2026, type SubscriptionProduct } from "@shared/compensation";

// ---------------------------------------------------------------------------
// Display helpers — every compensation number on this page is sourced from the
// shared COMP_V2026 config so the marketing site never drifts from the engine.
// ---------------------------------------------------------------------------
const usd = (n: number) => `$${n.toLocaleString()}`;
const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
const { subscriptionPricing, subscriptionPools, mcaAllocation, mcaAgencyModels, subscriptionAgencySplits, downlineLevels, maxDownlineLevels, subscriptionAccelerators, mcaAccelerators, distributorQualification, membership, matureResidual } = COMP_V2026;

function AnimatedSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const reduceMotion = useReducedMotion();
  const hidden = reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 };
  const shown = { opacity: 1, y: 0 };
  return (
    <motion.div
      ref={ref}
      initial={hidden}
      animate={isInView ? shown : hidden}
      transition={{ duration: reduceMotion ? 0 : 0.7, delay: reduceMotion ? 0 : delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const slug = question.slice(0, 20).replace(/\s/g, '-').toLowerCase();
  const panelId = `faq-panel-${slug}`;
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="w-full flex items-center justify-between py-5 text-left group"
        data-testid={`faq-${slug}`}
      >
        <span className="text-base font-semibold text-foreground pr-4 group-hover:text-primary transition-colors">{question}</span>
        <ChevronDown className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <motion.div
        id={panelId}
        role="region"
        initial={false}
        animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <p className="pb-5 text-muted-foreground leading-relaxed">{answer}</p>
      </motion.div>
    </div>
  );
}

export default function LandingSections() {
  return (
    <>
      {/* Funding Profile Stats Bar */}
      <section className="py-16 px-6 bg-background border-b border-border">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "$2K–$2M", label: "Funding Range", icon: Banknote },
              { value: "1 Day", label: "Possible Funding Speed", icon: Gauge },
              { value: "6+ Mos.", label: "Time in Business Profile", icon: Building2 },
              { value: "$10K+", label: "Monthly Gross Revenue", icon: Wallet },
            ].map((stat, i) => (
              <AnimatedSection key={i} delay={i * 0.1}>
                <div className="flex flex-col items-center" data-testid={`funding-stat-${i}`}>
                  <stat.icon className="w-6 h-6 text-primary mb-3" />
                  <p className="text-3xl lg:text-4xl font-bold text-primary mb-1">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* MCA Funding Program */}
      <section id="funding" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 text-sm font-medium text-primary mb-6">
                <Banknote className="w-4 h-4" />
                The Funding Program
              </span>
              <h2 className="text-4xl lg:text-5xl font-display font-bold text-primary mb-6">
                Capital Designed Around<br />Business Momentum.
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Funding is structured as a merchant cash advance with a fixed factor rate — not a traditional APR-based loan. Every file is reviewed individually based on revenue, time in business, credit profile, cash flow, and existing obligations. Minimal paperwork, funding available as quickly as one business day.
              </p>
            </div>
          </AnimatedSection>

          {/* Program Highlights */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {[
              { icon: Banknote, title: "Funding Amounts", desc: "$2,000 to $2,000,000, with an average funded deal around $75,000." },
              { icon: Gauge, title: "Factor Rate Range", desc: "15% to 49%, based on business performance and underwriting review." },
              { icon: CalendarClock, title: "Repayment Terms", desc: "30 days to 24 months, with daily, weekly, bi-weekly, or monthly options." },
              { icon: Repeat, title: "Repayment Methods", desc: "ACH debits or credit card processing holdbacks, depending on structure." },
              { icon: Wallet, title: "Use of Funds", desc: "Inventory, payroll, marketing, expansion, consolidation, or operating cash flow." },
              { icon: TrendingUp, title: "Renewal Potential", desc: "Once a business repays about 50% of its balance, it may become eligible for additional funding." },
            ].map((item, i) => (
              <AnimatedSection key={i} delay={i * 0.08}>
                <Card className="border-border/50 shadow-sm hover:shadow-lg transition-all h-full group" data-testid={`funding-highlight-${i}`}>
                  <CardContent className="p-7">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <item.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-bold text-primary mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
          </div>

          {/* Who This Fits / What To Prepare */}
          <div className="grid md:grid-cols-2 gap-8">
            <AnimatedSection delay={0.1}>
              <Card className="border-border/50 shadow-sm h-full" data-testid="card-who-fits">
                <CardContent className="p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-100 flex items-center justify-center">
                      <Handshake className="w-6 h-6 text-emerald-600" />
                    </div>
                    <h3 className="text-xl font-bold text-primary">Who This Fits</h3>
                  </div>
                  <div className="space-y-3">
                    {[
                      "Businesses generating at least $10,000 per month in gross revenue.",
                      "Operators with at least six months in business who need fast access to capital.",
                      "Owners who prefer limited paperwork or may not qualify for bank financing.",
                      "Companies seeking to consolidate existing advances and improve cash flow.",
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-muted-foreground leading-relaxed">{item}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </AnimatedSection>

            <AnimatedSection delay={0.2}>
              <Card className="border-border/50 shadow-sm h-full" data-testid="card-what-prepare">
                <CardContent className="p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-11 h-11 rounded-2xl bg-blue-100 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold text-primary">What To Prepare</h3>
                  </div>
                  <div className="space-y-3">
                    {[
                      "Completed one-page data form or application.",
                      "Three to six months of business bank statements.",
                      "Driver's license and a voided business check.",
                      "Additional items may include ownership proof, financials, tax returns, P&L, balance sheet, or A/R reports.",
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-muted-foreground leading-relaxed">{item}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </AnimatedSection>
          </div>

          <AnimatedSection delay={0.2}>
            <div className="flex flex-col items-center text-center mt-14">
              <a href="https://apply.myrmapp.com/multi-step-apply/pg" target="_blank" rel="noopener noreferrer" data-testid="link-apply-funding">
                <Button size="lg" className="h-14 px-10 text-lg font-bold shadow-lg hover:scale-105 transition-all">
                  Apply for Funding
                  <ArrowRight className="w-5 h-5 ml-3" />
                </Button>
              </a>
              <p className="text-xs text-muted-foreground mt-3">Quick application — funding available as fast as one business day.</p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Streamlined Path From Intake To Funding */}
      <section className="py-24 px-6 bg-gradient-to-br from-[#0A1628] via-[#0f1f3a] to-[#0A1628] text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/4 rounded-full blur-[100px]" />
        <div className="max-w-7xl mx-auto relative z-10">
          <AnimatedSection>
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm font-medium text-white/80 mb-6">
                <Gauge className="w-4 h-4" />
                Intake to Funding
              </span>
              <h2 className="text-4xl lg:text-5xl font-display font-bold text-white mb-6">
                A Streamlined Path From<br />Intake To Funding.
              </h2>
              <p className="text-lg text-white/50 max-w-2xl mx-auto">
                Fast funding. Minimal paperwork. Flexible options. Full-service execution.
              </p>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: "1", title: "Identify the need", desc: "Clarify new capital, consolidation, or both.", icon: Target },
              { step: "2", title: "Review the file", desc: "Evaluate revenue, credit, obligations, and cash flow.", icon: Search },
              { step: "3", title: "Structure options", desc: "Match the business with flexible funding terms.", icon: Settings2 },
              { step: "4", title: "Fund quickly", desc: "Move from approval to capital delivery.", icon: Banknote },
            ].map((item, i) => (
              <AnimatedSection key={i} delay={i * 0.12}>
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-7 h-full hover:bg-white/8 transition-all" data-testid={`intake-step-${i + 1}`}>
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                      <item.icon className="w-6 h-6 text-[#C9A24B]" />
                    </div>
                    <span className="text-5xl font-display font-bold text-white/10">{item.step}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Affiliate / Referral Opportunity */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <AnimatedSection>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 text-sm font-medium text-primary mb-6">
                <Handshake className="w-4 h-4" />
                Affiliate Opportunity
              </span>
              <h2 className="text-4xl lg:text-5xl font-display font-bold text-primary mb-6">
                Refer the opportunity.<br />We handle the execution.
              </h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                Referral partners can monetize business funding opportunities without managing sales, underwriting, fulfillment, customer service, or the ongoing client relationship. Leader Shield manages the process from intake through funding and future renewals.
              </p>
              <div className="space-y-3 mb-8">
                {[
                  "Affiliate compensation is 1% of factoring origination.",
                  "On an average $75,000 funded deal, the example payout is approximately $750.",
                  "No sales, underwriting, or service obligations — just the introduction.",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
              <Link href="/signup">
                <Button size="lg" className="h-14 px-8 text-base font-bold shadow-lg transition-all hover:scale-105" data-testid="button-affiliate-cta">
                  Become a Referral Partner
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </AnimatedSection>

            <AnimatedSection delay={0.2}>
              <div className="relative">
                <div className="absolute -inset-3 bg-gradient-to-br from-primary/10 to-transparent rounded-3xl blur-2xl" />
                <Card className="relative border-border/50 shadow-xl overflow-hidden" data-testid="card-affiliate-example">
                  <div className="bg-gradient-to-br from-[#0A1628] to-[#15294B] p-8 text-center">
                    <p className="text-white/50 text-sm font-medium uppercase tracking-wider mb-3">Example Payout</p>
                    <p className="text-6xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-br from-[#C9A24B] to-[#A07B22]">1%</p>
                    <p className="text-white/60 mt-2">of factoring origination</p>
                  </div>
                  <CardContent className="p-8">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-4 border-b border-border">
                        <span className="text-muted-foreground">Average funded deal</span>
                        <span className="text-2xl font-bold text-primary">$75,000</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Example referral payout</span>
                        <span className="text-2xl font-bold text-emerald-600">~$750</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-6">*Illustrative example. Actual compensation depends on funded amount and program terms.</p>
                  </CardContent>
                </Card>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* The Opportunity — Why Now */}
      <section id="opportunity" className="py-24 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 text-sm font-medium text-primary mb-6">
                <Target className="w-4 h-4" />
                The Opportunity
              </span>
              <h2 className="text-4xl lg:text-5xl font-display font-bold text-primary mb-6">
                Beyond Referrals: Build a<br />Full Agent Business.
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Refer for 1% — or go further. Full agents earn enhanced MCA commissions AND build recurring subscription revenue that compounds every month. Two engines. One unstoppable career.
              </p>
            </div>
          </AnimatedSection>

          {/* How It Works — 3 Steps */}
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

      {/* Two Revenue Streams — Visual Split */}
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
                  both products — earning more on each side. This is the compound advantage that sets Leader Shield apart.
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
                Leader Shield is built so you can focus on relationships and opening opportunities — our partners handle the heavy
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

      {/* Merchant Growth Platform Tiers */}
      <section id="platform" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 text-sm font-medium text-primary mb-6">
                <Layers className="w-4 h-4" />
                The Products
              </span>
              <h2 className="text-4xl lg:text-5xl font-display font-bold text-primary mb-6">
                Four Subscription Tiers.<br />Real Solutions Merchants Need.
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Powered by our exclusive partnership with Marketing Titan + Lead Titan AI. These are not fluff products — each tier solves real business problems and delivers measurable ROI for merchants, making them easy to sell and easy to retain.
              </p>
            </div>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                tier: "Tier 1",
                name: "Starter",
                productKey: "tier_1" as SubscriptionProduct,
                poweredBy: "Powered by Lead Titan AI",
                color: "blue",
                icon: BarChart3,
                ideal: "Merchants who need a steady flow of new leads to get started",
                features: ["750 verified lead credits / month", "5 email outreach sequences (1,500 sends/mo)", "Basic AI Brand Intelligence", "Integrates with your existing CRM"]
              },
              {
                tier: "Tier 2",
                name: "Growth Foundation",
                productKey: "tier_2" as SubscriptionProduct,
                poweredBy: "Powered by Marketing Titan + Lead Titan",
                color: "blue",
                icon: Rocket,
                ideal: "Businesses ready to build visibility and a stable lead engine",
                features: ["Advanced AI Brand Intelligence (catalog, personas, SEO)", "Native AI CRM (1,000 contacts + scoring)", "24/7 AI chatbot lead capture", "AI visual email + performance dashboard"]
              },
              {
                tier: "Tier 3",
                name: "Revenue Growth System",
                productKey: "tier_3" as SubscriptionProduct,
                poweredBy: "Powered by Marketing Titan + Lead Titan",
                color: "purple",
                icon: Bot,
                popular: true,
                ideal: "Operators focused on growing and optimizing revenue",
                features: ["Everything in Growth Foundation", "2,000 lead credits/mo + Darwin AI Chief of Staff", "AI social content to Meta (30/mo) + Ask AI", "CRM 10,000 contacts + automation"]
              },
              {
                tier: "Tier 4",
                name: "Revenue Scale AI",
                productKey: "tier_4" as SubscriptionProduct,
                poweredBy: "Powered by Marketing Titan + Lead Titan",
                color: "amber",
                icon: Sparkles,
                bestValue: true,
                ideal: "Aggressive operators scaling with full AI automation",
                features: ["Everything in Revenue Growth System", "AI Caller (750 outbound min/mo, books meetings)", "AI paid ads + ad designer + ad insights", "CRM 25,000 contacts + advanced automation"]
              },
            ].map((item: any, i) => {
              const colorMap: Record<string, { bg: string; text: string; border: string; badge: string; iconBg: string }> = {
                blue: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200", badge: "bg-blue-100 text-blue-700", iconBg: "bg-blue-100" },
                purple: { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-200", badge: "bg-purple-100 text-purple-700", iconBg: "bg-purple-100" },
                amber: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-300", badge: "bg-amber-100 text-amber-700", iconBg: "bg-amber-100" },
              };
              const c = colorMap[item.color];
              const highlighted = item.popular || item.bestValue;
              return (
                <AnimatedSection key={i} delay={i * 0.15}>
                  <Card className={`relative overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 h-full ${highlighted ? `border-2 ${c.border} shadow-lg` : 'border-border/50'}`} data-testid={`card-tier-${i}`}>
                    {highlighted && (
                      <div className="absolute -top-0 left-0 right-0">
                        <div className={`${item.bestValue ? 'bg-[#C9A24B]' : 'bg-primary'} text-white text-xs font-bold px-4 py-1.5 text-center`}>
                          {item.bestValue ? 'BEST VALUE' : 'MOST POPULAR'}
                        </div>
                      </div>
                    )}
                    <CardContent className={`p-8 ${highlighted ? 'pt-12' : ''}`}>
                      <div className="flex items-center justify-between mb-4">
                        <span className={`text-xs font-bold uppercase tracking-wider ${c.text}`}>{item.tier}</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${c.badge}`}>Up to {pct(subscriptionPools.elite[item.productKey as SubscriptionProduct].m1to3)} Pool</span>
                      </div>
                      <div className={`w-14 h-14 rounded-2xl ${c.iconBg} flex items-center justify-center mb-4`}>
                        <item.icon className={`w-7 h-7 ${c.text}`} />
                      </div>
                      <h3 className="text-xl font-bold text-primary mb-1">{item.name}</h3>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#C9A24B] mb-2">{item.poweredBy}</p>
                      <p className="text-3xl font-bold text-primary mb-1">{usd(subscriptionPricing[item.productKey as SubscriptionProduct].retail)}<span className="text-base font-normal text-muted-foreground">/mo retail</span></p>
                      <p className="text-sm font-semibold text-[#1C8A5B] mb-2" data-testid={`text-member-price-${i}`}>Distributor member price: {usd(subscriptionPricing[item.productKey as SubscriptionProduct].member)}/mo</p>
                      <p className="text-sm text-muted-foreground mb-6 italic">{item.ideal}</p>
                      <div className="space-y-3">
                        {item.features.map((feature: string, j: number) => (
                          <div key={j} className="flex items-start gap-2">
                            <CheckCircle2 className={`w-4 h-4 ${c.text} mt-0.5 flex-shrink-0`} />
                            <span className="text-sm text-muted-foreground">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </AnimatedSection>
              );
            })}
          </div>
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
            ].map((item, i) => (
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

      {/* Compensation Section */}
      <section id="compensation" className="py-24 px-6 bg-gradient-to-br from-[#0A1628] via-[#0f1f3a] to-[#0A1628] text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(212,175,55,0.05)_0%,_transparent_60%)]" />
        <div className="max-w-7xl mx-auto relative z-10">
          <AnimatedSection>
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm font-medium text-white/80 mb-6">
                <Award className="w-4 h-4" />
                Compensation Plan
              </span>
              <h2 className="text-4xl lg:text-5xl font-display font-bold text-white mb-6">
                Multiple Streams. No Ceiling.
              </h2>
              <p className="text-lg text-white/50 max-w-2xl mx-auto">
                Our compensation plan is designed to aggressively reward front-end production while building long-term residual income.
              </p>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {[
              { icon: DollarSign, title: "MCA Opening Pool", rate: pct(mcaAllocation.openingAgentPool), desc: "Your share of the gross commission on every funded MCA deal you open", color: "from-emerald-400 to-emerald-500" },
              { icon: Repeat, title: "Subscription Pools", rate: `Up to ${pct(subscriptionPools.elite.tier_3.m1to3)}`, desc: "Recurring monthly commissions, paid on collected subscription revenue", color: "from-blue-400 to-blue-500" },
              { icon: Zap, title: "Accelerators", rate: `+${pct(subscriptionAccelerators.cap)}`, desc: "Performance accelerators stacked on top of your subscription pools", color: "from-[#E0C27E] to-white/70" },
              { icon: Users, title: "Team Overrides", rate: `Up to ${pct(subscriptionAgencySplits.recruiting.override)}`, desc: `Override income across up to ${maxDownlineLevels} downline levels`, color: "from-purple-400 to-purple-500" },
            ].map((item, i) => (
              <AnimatedSection key={i} delay={i * 0.1}>
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 text-center hover:bg-white/8 transition-all h-full" data-testid={`comp-card-${i}`}>
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                    <item.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">{item.title}</h3>
                  <p className="text-3xl font-bold text-[#C9A24B] mb-2">{item.rate}</p>
                  <p className="text-sm text-white/50">{item.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>

          <AnimatedSection delay={0.4}>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                  </div>
                  How MCA Commission Splits
                </h3>
                <p className="text-sm text-white/50 mb-6">Every funded deal's gross brokerage commission is allocated four ways.</p>
                <div className="space-y-3">
                  {[
                    { label: "Opening Agent Pool", note: "Producer + agency override", value: mcaAllocation.openingAgentPool, highlight: true },
                    { label: "Premium Merchant Funding (PMF)", note: "Closing & underwriting partner", value: mcaAllocation.pmf },
                    { label: "Performance Accelerator Pool", note: "Funds monthly MCA accelerators", value: mcaAllocation.performanceAcceleratorPool },
                    { label: "LeaderShield EBITDA", note: "Platform operations", value: mcaAllocation.leadershieldEbitda },
                  ].map((item, i) => (
                    <div key={i} className={`flex items-center justify-between p-3 rounded-xl ${item.highlight ? 'bg-emerald-500/15 border border-emerald-400/30' : 'bg-white/5'}`}>
                      <div>
                        <p className={`font-semibold ${item.highlight ? 'text-emerald-300' : 'text-white/80'}`}>{item.label}</p>
                        <p className="text-xs text-white/40">{item.note}</p>
                      </div>
                      <span className={`text-lg font-bold ${item.highlight ? 'text-emerald-300' : 'text-white/70'}`}>{pct(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <Award className="w-5 h-5 text-[#C9A24B]" />
                  </div>
                  Performance Accelerators
                </h3>
                <p className="text-sm text-white/50 mb-6">Earned on top of your pools and recalculated every month.</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                    <div>
                      <p className="font-semibold text-white">Subscription accelerators</p>
                      <p className="text-xs text-white/40">Volume, quality, MCA attachment, mix & team growth</p>
                    </div>
                    <span className="text-lg font-bold text-[#C9A24B]">up to +{pct(subscriptionAccelerators.cap)}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                    <div>
                      <p className="font-semibold text-white">MCA accelerators</p>
                      <p className="text-xs text-white/40">Volume, subscription attachment, penetration & repeat merchants</p>
                    </div>
                    <span className="text-lg font-bold text-[#C9A24B]">up to +{pct(mcaAccelerators.cap)}</span>
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>

          {/* Distributor Tiers */}
          <AnimatedSection delay={0.45}>
            <div className="mt-8">
              <h3 className="text-2xl font-bold text-white mb-2 text-center">Distributor Tiers</h3>
              <p className="text-sm text-white/50 text-center mb-8 max-w-2xl mx-auto">Your tier is recalculated every month from your own production. Higher tiers unlock higher commission pools — no recruiting required.</p>
              <div className="grid md:grid-cols-3 gap-6">
                {[
                  { name: "Standard", tier: "standard" as const, blurb: "Active membership + minimum production. The starting tier for every distributor.", qual: null },
                  { name: "Enhanced", tier: "enhanced" as const, blurb: "Qualify on any one threshold each month.", qual: distributorQualification.enhanced },
                  { name: "Elite", tier: "elite" as const, blurb: "Qualify on any one threshold each month.", qual: distributorQualification.elite },
                ].map((t, i) => (
                  <div key={i} className={`rounded-2xl p-6 border ${i === 2 ? 'bg-[#C9A24B]/10 border-[#C9A24B]/40' : 'bg-white/5 border-white/10'}`} data-testid={`tier-card-${t.tier}`}>
                    <p className={`text-lg font-bold mb-2 ${i === 2 ? 'text-[#C9A24B]' : 'text-white'}`}>{t.name}</p>
                    <p className="text-sm text-white/50 mb-4">{t.blurb}</p>
                    {t.qual && (
                      <ul className="text-sm text-white/70 space-y-1 mb-4">
                        <li>{usd(t.qual.fundedVolume)}+ funded volume, or</li>
                        <li>{usd(t.qual.subscriptionRevenue)}+ monthly subscription revenue, or</li>
                        <li>{t.qual.activeSubscriptions}+ active subscriptions</li>
                      </ul>
                    )}
                    <div className="pt-3 border-t border-white/10 text-sm">
                      <span className="text-white/50">Top subscription pool: </span>
                      <span className={`font-bold ${i === 2 ? 'text-[#C9A24B]' : 'text-white'}`}>{pct(subscriptionPools[t.tier].tier_3.m1to3)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedSection>

          {/* Subscription decay + residual */}
          <AnimatedSection delay={0.5}>
            <div className="mt-8 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Repeat className="w-5 h-5 text-blue-400" />
                </div>
                Subscription Pools Decay — Then Pay Residuals for Life
              </h3>
              <p className="text-sm text-white/50 mb-6">Example: Revenue Growth System (Tier 3) at Elite. Pools step down over the first year, then settle into a residual you keep as long as the merchant stays subscribed.</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: "Months 1–3", bucket: "m1to3" as const },
                  { label: "Months 4–6", bucket: "m4to6" as const },
                  { label: "Months 7–9", bucket: "m7to9" as const },
                  { label: "Months 10–12", bucket: "m10to12" as const },
                  { label: "Month 13+ residual", bucket: "residual" as const },
                ].map((d, i) => (
                  <div key={i} className={`text-center p-4 rounded-xl ${i === 4 ? 'bg-[#1C8A5B]/15 border border-[#1C8A5B]/40' : 'bg-white/5'}`}>
                    <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">{d.label}</p>
                    <p className={`text-2xl font-bold ${i === 4 ? 'text-[#1C8A5B]' : 'text-white'}`}>{pct(subscriptionPools.elite.tier_3[d.bucket])}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-white/40 mt-4">Starter (Tier 1) pays no residual. Tier 2 settles at {pct(matureResidual.tier_2)} and Tiers 3–4 at {pct(matureResidual.tier_3)} for the life of the subscription.</p>
            </div>
          </AnimatedSection>

          {/* Agency overrides + downline */}
          <AnimatedSection delay={0.55}>
            <div className="mt-8 grid md:grid-cols-2 gap-8">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-purple-400" />
                  </div>
                  Agency Override Models
                </h3>
                <p className="text-sm text-white/50 mb-6">Choose how much you keep as a producer versus pass to your organization as override. The total is always the same — overrides come out of your share, never on top of it.</p>
                <div className="space-y-2">
                  {[
                    { name: "Independent", key: "independent" },
                    { name: "Balanced", key: "balanced" },
                    { name: "Leadership", key: "leadership" },
                    { name: "Recruiting", key: "recruiting" },
                  ].map((m, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl text-sm">
                      <span className="text-white/80 font-semibold">{m.name}</span>
                      <span className="text-white/50">
                        Producer {pct(subscriptionAgencySplits[m.key].producer)} · Override {pct(subscriptionAgencySplits[m.key].override)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#C9A24B]/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#C9A24B]" />
                  </div>
                  Override Flows {maxDownlineLevels} Levels Deep
                </h3>
                <p className="text-sm text-white/50 mb-6">The override portion is distributed across your organization by level.</p>
                <div className="space-y-3">
                  {[
                    { level: "Level 1", note: "Your direct distributors", value: downlineLevels.level1 },
                    { level: "Level 2", note: "Their distributors", value: downlineLevels.level2 },
                    { level: "Level 3", note: "Third generation", value: downlineLevels.level3 },
                  ].map((l, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                      <div>
                        <p className="font-semibold text-white/80">{l.level}</p>
                        <p className="text-xs text-white/40">{l.note}</p>
                      </div>
                      <span className="text-lg font-bold text-[#C9A24B]">{pct(l.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.6}>
            <div className="text-center mt-12">
              <Link href="/signup">
                <Button size="lg" className="h-16 px-10 text-lg font-bold bg-white text-primary shadow-2xl hover:bg-white/90 transition-all hover:scale-105">
                  Start Earning Today
                  <ChevronRight className="w-6 h-6 ml-2" />
                </Button>
              </Link>
            </div>
          </AnimatedSection>
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
              { name: "Sarah K.", role: "Team Builder", location: "Phoenix, AZ", quote: "I started part-time while working my corporate job. Within 6 months, my Leader Shield income surpassed my salary. The training academy gave me everything I needed to succeed.", months: "11 months" },
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
                        <p className="text-xs text-muted-foreground">{item.months} with Leader Shield</p>
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

      {/* Platform & Tools */}
      <section className="py-24 px-6 bg-muted/30">
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
      <section className="py-24 px-6">
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

      {/* Compliance Section */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-12">
              <h2 className="text-3xl font-display font-bold text-primary mb-4">
                Compliance-First. Your Shield in the Market.
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                This framework protects you, the merchant, and the platform from regulatory risk.
              </p>
            </div>
          </AnimatedSection>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Lock, title: "Centralized Pricing", desc: "Agents never set or negotiate rates. All pricing is controlled by the platform." },
              { icon: FileCheck, title: "Automated Disclosures", desc: "All merchant disclosures are generated and archived centrally." },
              { icon: DollarSign, title: "Clear Compensation", desc: "Earnings are defined as incentive compensation for services." },
              { icon: Scale, title: "Regulatory Protection", desc: "Our framework adapts to evolving regulations, keeping you safe." },
            ].map((item, i) => (
              <AnimatedSection key={i} delay={i * 0.1}>
                <div className="flex items-start gap-4 p-4" data-testid={`compliance-card-${i}`}>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-primary mb-1">{item.title}</h4>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 text-sm font-medium text-primary mb-6">
                <MessageSquare className="w-4 h-4" />
                FAQ
              </span>
              <h2 className="text-4xl font-display font-bold text-primary mb-6">
                Common Questions
              </h2>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.1}>
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-6 md:p-8">
                <FAQItem
                  question="How does merchant cash advance funding work?"
                  answer="Funding is structured as a merchant cash advance with a fixed factor rate (15%–49%), not a traditional APR-based loan. Amounts range from $2,000 to $2,000,000, with repayment over 30 days to 24 months via ACH or card processing holdbacks. Every file is reviewed individually based on revenue, time in business, credit, and cash flow."
                />
                <FAQItem
                  question="How fast can a business get funded?"
                  answer="With minimal paperwork — a one-page application, three to six months of bank statements, a driver's license, and a voided business check — funding can be available as quickly as one business day after underwriting review."
                />
                <FAQItem
                  question="How does the 1% affiliate referral work?"
                  answer="Referral partners simply introduce the opportunity. Affiliate compensation is 1% of factoring origination — on an average $75,000 funded deal, that's an example payout of approximately $750. Leader Shield manages sales, underwriting, fulfillment, service, and the ongoing client relationship."
                />
                <FAQItem
                  question="What is the Merchant Growth Platform?"
                  answer="The Merchant Growth Platform is a subscription-based service designed to help merchants improve their financial visibility, accelerate revenue, and automate their marketing. It's a recurring revenue product that provides a stable, long-term income stream for full agents."
                />
                <FAQItem
                  question="Do I need experience to get started?"
                  answer="No prior experience is required. Our comprehensive training academy covers everything from product knowledge and sales techniques to compliance guidelines. You'll have access to scripts, objection handlers, and ongoing support from our team."
                />
                <FAQItem
                  question="Can I sell both MCA and subscriptions to the same merchant?"
                  answer="Absolutely, and we encourage it. Distributors can sell both products. Attaching a subscription to a funded MCA (or funding a subscribing merchant) triggers attachment accelerators on both products, so you earn more on each side."
                />
                <FAQItem
                  question="How are commissions calculated and how often am I paid?"
                  answer="Commissions are calculated on collected revenue — the money the company actually collects from merchants — and are paid monthly."
                />
                <FAQItem
                  question="How do distributor tiers work?"
                  answer={`There are three tiers — Standard, Enhanced, and Elite — and your tier is recalculated every month from your own production. You reach Enhanced by hitting any one of: ${usd(distributorQualification.enhanced.fundedVolume)} funded volume, ${usd(distributorQualification.enhanced.subscriptionRevenue)} in monthly subscription revenue, or ${distributorQualification.enhanced.activeSubscriptions} active subscriptions. Elite requires ${usd(distributorQualification.elite.fundedVolume)}, ${usd(distributorQualification.elite.subscriptionRevenue)}, or ${distributorQualification.elite.activeSubscriptions} active subscriptions. Higher tiers earn higher commission pools.`}
                />
                <FAQItem
                  question="How deep do override commissions go?"
                  answer={`Override commissions flow up to ${maxDownlineLevels} levels deep in your organization — ${pct(downlineLevels.level1)} on Level 1, ${pct(downlineLevels.level2)} on Level 2, and ${pct(downlineLevels.level3)} on Level 3 of the override portion you've allocated to your team.`}
                />
                <FAQItem
                  question="Is there a fee to be a Leader Shield distributor?"
                  answer={`Distributors pay a ${usd(membership.individual.fee)} monthly membership for access to the CRM, reporting, training, and support. It is automatically waived in any month you collect at least ${usd(membership.individual.waiverThreshold)} in commissions, so active producers effectively pay nothing. Agency plans are available at ${usd(membership.small_agency.fee)}, ${usd(membership.growth_agency.fee)}, and ${usd(membership.enterprise_agency.fee)} per month with higher waiver thresholds. Referral-only affiliates have no membership fee.`}
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
              Join Leader Shield Funding. Refer for 1%, or build a full agent business with two revenue streams. We'll handle the execution and train you every step of the way.
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

      {/* Legal Disclaimers */}
      <section id="disclaimers" className="py-12 px-6 bg-muted/50 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-lg font-bold text-primary mb-4">Important Disclosures</h3>
          <div className="space-y-4 text-xs text-muted-foreground">
            <div>
              <h4 className="font-semibold text-foreground mb-1">Funding Terms Disclosure</h4>
              <p>Merchant cash advance funding is not a traditional APR-based loan. Program terms, pricing, factor rates, documentation, funding availability, and eligibility are subject to underwriting review and may vary by business profile. Funding amounts, factor rates, repayment terms, and renewal eligibility described on this website are illustrative and not guaranteed.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Income Disclaimer</h4>
              <p>The income figures presented on this website are examples only and are not intended to represent or guarantee that anyone will achieve the same or similar results. Your individual results will vary and depend on many factors, including but not limited to your individual capacity, work ethic, business experience and knowledge, level of commitment, diligence in applying Leader Shield Funding's training and sales system, and market conditions. Leader Shield Funding does not guarantee any level of income or earnings to any agent.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Independent Contractor Status</h4>
              <p>Leader Shield Funding agents are independent contractors, not employees. As an independent contractor, you are responsible for your own taxes, insurance, and business expenses. Leader Shield Funding does not provide employment benefits, and agents are not entitled to minimum wage protections or overtime compensation.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">No Guaranteed Income</h4>
              <p>There is no guarantee that you will earn any income as a Leader Shield Funding agent. Success requires consistent effort, effective sales techniques, and the ability to build and maintain a productive team. Many participants in network marketing businesses earn little to no income. Past performance does not guarantee future results.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Business Opportunity Disclosure</h4>
              <p>This is a business opportunity, not a job offer. Before joining Leader Shield Funding, you should carefully review all materials and disclosures. Consult with a qualified financial or legal advisor if you have questions about the opportunity. Some states require additional disclosures for business opportunities.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Commission Structure Disclosure</h4>
              <p>Commission rates, residual percentages, and bonus structures described on this website are subject to the terms of the Leader Shield Funding Agent Agreement. Commission decay schedules, payout splits, and accelerator qualifications are detailed in the full compensation plan document provided during onboarding.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Testimonial Disclaimer</h4>
              <p>Testimonials and success stories on this website represent individual experiences and are not typical results. Individual results will vary based on background, dedication, effort, and market conditions. Names and details may be changed for privacy.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Anti-Pyramid Scheme Disclosure</h4>
              <p>Leader Shield Funding commissions are earned exclusively from the sale of legitimate products and services to end-user merchants — not from recruitment fees or the enrollment of other agents. Agents are never required to purchase products or inventory to participate. Our compensation plan rewards product sales performance, not headcount. Leader Shield Funding complies with all applicable FTC guidelines regarding multi-level marketing and business opportunity practices.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Material Connection Disclosure</h4>
              <p>Some individuals featured on this website, including those providing testimonials, endorsements, or success stories, have a material connection to Leader Shield Funding. They may be current agents, affiliates, or compensated participants. Their experiences and results are their own and should not be considered typical. Any compensation or benefits received are disclosed in accordance with the FTC's Endorsement Guides (16 CFR Part 255).</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">State-Specific Business Opportunity Notice</h4>
              <p>Certain states, including but not limited to California, Maryland, New York, and others, may require the registration or filing of business opportunity disclosures before an offer or sale can be made. Leader Shield Funding complies with all applicable state business opportunity laws. If you reside in a state with specific business opportunity registration requirements, additional disclosures may apply. Please contact compliance@leadershieldfunding.com for state-specific information before enrolling.</p>
            </div>
            <div className="pt-4 border-t border-border">
              <p>For complete details, please review our <Link href="/income-disclosure"><span className="text-primary underline cursor-pointer" data-testid="link-disclosure-ids">Income Disclosure Statement</span></Link>, <Link href="/terms"><span className="text-primary underline cursor-pointer" data-testid="link-disclosure-terms">Terms of Service</span></Link>, <Link href="/privacy"><span className="text-primary underline cursor-pointer" data-testid="link-disclosure-privacy">Privacy Policy</span></Link>, and <Link href="/refund-policy"><span className="text-primary underline cursor-pointer" data-testid="link-disclosure-refund">Refund Policy</span></Link>.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-6 bg-[#0A1628] text-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-6 gap-10 mb-12">
            <div className="md:col-span-2">
              <Link href="/" data-testid="link-logo-footer" className="mb-4 hover:opacity-90 transition-opacity w-fit block">
                <BrandLockup size="md" onDark />
              </Link>
              <p className="text-white/40 max-w-sm leading-relaxed">
                Fast funding. Minimal paperwork. Flexible options. Full-service execution. Unsecured working capital for business owners — and a network built to reward those who refer it.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-white/80 mb-4">Quick Links</h4>
              <div className="space-y-2 text-sm">
                <a href="#funding" className="block text-white/40 hover:text-white transition-colors">Funding</a>
                <a href="#opportunity" className="block text-white/40 hover:text-white transition-colors">Opportunity</a>
                <a href="#platform" className="block text-white/40 hover:text-white transition-colors">Platform</a>
                <a href="#compensation" className="block text-white/40 hover:text-white transition-colors">Earnings</a>
                <a href="#faq" className="block text-white/40 hover:text-white transition-colors">FAQ</a>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-white/80 mb-4">Funding Solutions</h4>
              <div className="space-y-2 text-sm">
                <Link href="/lp/declined"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-lp-declined">Declined by the Bank</span></Link>
                <Link href="/lp/consolidation"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-lp-consolidation">Consolidate Advances</span></Link>
                <Link href="/lp/growth"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-lp-growth">Capital for Growth</span></Link>
                <Link href="/lp/seasonal"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-lp-seasonal">Seasonal Funding</span></Link>
                <Link href="/lp/partners"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-lp-partners">Partner Network</span></Link>
                <Link href="/lp/referral"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-lp-referral">Referral Partners</span></Link>
                <Link href="/lp/platform"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-lp-platform">Merchant Growth Platform</span></Link>
                <Link href="/lp/leaks"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-lp-leaks">Plug Profit Leaks</span></Link>
                <Link href="/lp/scale"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-lp-scale">Scale Operations</span></Link>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-white/80 mb-4">Legal</h4>
              <div className="space-y-2 text-sm">
                <Link href="/income-disclosure"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-income-disclosure">Income Disclosure</span></Link>
                <Link href="/terms"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-terms">Terms of Service</span></Link>
                <Link href="/privacy"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-privacy">Privacy Policy</span></Link>
                <Link href="/refund-policy"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-refund">Refund Policy</span></Link>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-white/80 mb-4">Get Started</h4>
              <div className="space-y-2 text-sm">
                <Link href="/signup"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer">Join Now</span></Link>
                <Link href="/login"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer">Agent Login</span></Link>
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-white/30">
              &copy; 2026 Leader Shield Funding. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-4 text-xs text-white/30">
              <Link href="/income-disclosure"><span className="hover:text-white transition-colors cursor-pointer" data-testid="footer-bottom-income-disclosure">Income Disclosure</span></Link>
              <Link href="/terms"><span className="hover:text-white transition-colors cursor-pointer" data-testid="footer-bottom-terms">Terms</span></Link>
              <Link href="/privacy"><span className="hover:text-white transition-colors cursor-pointer" data-testid="footer-bottom-privacy">Privacy</span></Link>
              <Link href="/refund-policy"><span className="hover:text-white transition-colors cursor-pointer" data-testid="footer-bottom-refund">Refund Policy</span></Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
