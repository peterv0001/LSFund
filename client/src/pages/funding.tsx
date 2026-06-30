import { usePageMeta } from "@/hooks/use-page-meta";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PublicNav } from "@/components/PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { AnimatedSection, FAQItem } from "@/components/AnimatedSection";
import {
  Banknote,
  Gauge,
  Building2,
  Wallet,
  CalendarClock,
  Repeat,
  TrendingUp,
  Handshake,
  FileText,
  CheckCircle2,
  ArrowRight,
  Target,
  Search,
  Settings2,
  Lock,
  FileCheck,
  DollarSign,
  Scale,
  MessageSquare,
} from "lucide-react";

export default function FundingPage() {
  usePageMeta(
    "Merchant Cash Advance Funding | LeaderShield Funding",
    "Fast, flexible merchant cash advance funding from $2K to $2M. See eligibility, factor rates, repayment terms, and how our streamlined intake gets businesses funded in as little as one day.",
  );

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <PublicNav />

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden bg-gradient-to-br from-[#0A1628] via-[#0f1f3a] to-[#0A1628] text-white">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full blur-[120px]" />
        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm font-medium text-white/80 mb-6">
            <Banknote className="w-4 h-4 text-[#C9A24B]" />
            The Funding Program
          </span>
          <h1 className="text-4xl lg:text-6xl font-display font-bold mb-6 leading-tight">
            Capital When Your<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#E0C27E] to-white/70">
              Business Needs It Most.
            </span>
          </h1>
          <p className="text-lg text-white/55 max-w-2xl mx-auto mb-10">
            Funding is structured as a merchant cash advance with a fixed factor rate — not a traditional APR-based loan.
            Minimal paperwork, with funding available as quickly as one business day.
          </p>
          <a href="https://apply.myrmapp.com/multi-step-apply/pg" target="_blank" rel="noopener noreferrer" data-testid="link-apply-hero">
            <Button size="lg" className="h-14 px-10 text-lg font-bold bg-white text-primary hover:bg-white/90 shadow-2xl hover:scale-105 transition-all">
              Apply for Funding
              <ArrowRight className="w-5 h-5 ml-3" />
            </Button>
          </a>
        </div>
      </section>

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
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-16">
              <h2 className="text-4xl lg:text-5xl font-display font-bold text-primary mb-6">
                Capital Designed Around<br />Business Momentum.
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Every file is reviewed individually based on revenue, time in business, credit profile, cash flow, and
                existing obligations. Minimal paperwork, funding available as quickly as one business day.
              </p>
            </div>
          </AnimatedSection>

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

          <AnimatedSection delay={0.3}>
            <div className="flex flex-col items-center text-center mt-14">
              <a href="https://apply.myrmapp.com/multi-step-apply/pg" target="_blank" rel="noopener noreferrer" data-testid="link-apply-funding">
                <Button size="lg" className="h-14 px-10 text-lg font-bold bg-white text-primary hover:bg-white/90 shadow-lg hover:scale-105 transition-all">
                  Apply for Funding
                  <ArrowRight className="w-5 h-5 ml-3" />
                </Button>
              </a>
              <p className="text-xs text-white/40 mt-3">Quick application — funding available as fast as one business day.</p>
            </div>
          </AnimatedSection>
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

      {/* FAQ */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 text-sm font-medium text-primary mb-6">
                <MessageSquare className="w-4 h-4" />
                Funding FAQ
              </span>
              <h2 className="text-4xl font-display font-bold text-primary mb-6">Common Questions</h2>
            </div>
          </AnimatedSection>
          <AnimatedSection delay={0.1}>
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-6 md:p-8">
                <FAQItem
                  question="How does merchant cash advance funding work?"
                  answer="Funding is structured as a merchant cash advance with a factor rate that is typically 15%–49%, set by underwriting based on the merchant's profile — not a traditional APR-based loan. A factor rate means the merchant repays the advance plus a single fixed fee, not interest that compounds over time. Amounts range from $2,000 to $2,000,000, with repayment over 30 days to 24 months via ACH or card processing holdbacks. Every file is reviewed individually based on revenue, time in business, credit, and cash flow."
                />
                <FAQItem
                  question="How fast can a business get funded?"
                  answer="With minimal paperwork — a one-page application, three to six months of bank statements, a driver's license, and a voided business check — funding can be available as quickly as one business day after underwriting review."
                />
              </CardContent>
            </Card>
          </AnimatedSection>
        </div>
      </section>

      {/* Funding terms disclosure */}
      <section className="py-12 px-6 bg-muted/50 border-t border-border">
        <div className="max-w-4xl mx-auto text-xs text-muted-foreground">
          <h3 className="text-base font-bold text-primary mb-3">Funding Terms Disclosure</h3>
          <p>
            Merchant cash advance funding is not a traditional APR-based loan. Program terms, pricing, factor rates,
            documentation, funding availability, and eligibility are subject to underwriting review and may vary by
            business profile. Funding amounts, factor rates, repayment terms, and renewal eligibility described on this
            website are illustrative and not guaranteed.
          </p>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
