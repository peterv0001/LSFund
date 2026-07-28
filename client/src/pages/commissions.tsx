import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PublicNav } from "@/components/PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { AnimatedSection, FAQItem } from "@/components/AnimatedSection";
import {
  Award,
  DollarSign,
  Repeat,
  Zap,
  Users,
  Building2,
  ChevronRight,
  ArrowRight,
  FileText,
  MessageSquare,
} from "lucide-react";
import { COMP_V2026 } from "@shared/compensation";
import { usd, pct } from "@shared/compensation-format";
const {
  mcaAllocation,
  mcaAccelerators,
  subscriptionPools,
  matureResidual,
  subscriptionAccelerators,
  subscriptionAgencySplits,
  distributorQualification,
  downlineLevels,
  maxDownlineLevels,
  membership,
} = COMP_V2026;

export default function CommissionsPage() {
  usePageMeta(
    "The Compensation Plan | LeaderShield Funding",
    "Transparent LeaderShield compensation: MCA Opening Agent Pool, subscription pools by distributor tier, performance accelerators, lifetime residuals, agency overrides, and downline income up to three levels.",
  );

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <PublicNav />

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden bg-gradient-to-br from-[#0A1628] via-[#0f1f3a] to-[#0A1628] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(212,175,55,0.06)_0%,_transparent_60%)]" />
        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm font-medium text-white/80 mb-6">
            <Award className="w-4 h-4 text-[#C9A24B]" />
            The Compensation Plan
          </span>
          <h1 className="text-4xl lg:text-6xl font-display font-bold mb-6 leading-tight">
            Multiple Streams.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#E0C27E] to-white/70">
              No Ceiling.
            </span>
          </h1>
          <p className="text-lg text-white/55 max-w-2xl mx-auto">
            Our compensation plan is designed to aggressively reward front-end production while building long-term
            residual income. Every number below comes straight from the LeaderShield compensation manual.
          </p>
        </div>
      </section>

      {/* Compensation Section */}
      <section className="py-24 px-6 bg-gradient-to-br from-[#0A1628] via-[#0f1f3a] to-[#0A1628] text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(212,175,55,0.05)_0%,_transparent_60%)]" />
        <div className="max-w-7xl mx-auto relative z-10">
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
            <div className="max-w-3xl mx-auto">
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
                <Button size="lg" className="h-16 px-10 text-lg font-bold bg-white text-primary shadow-2xl hover:bg-white/90 transition-all hover:scale-105" data-testid="button-start-earning">
                  Start Earning Today
                  <ChevronRight className="w-6 h-6 ml-2" />
                </Button>
              </Link>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 text-sm font-medium text-primary mb-6">
                <MessageSquare className="w-4 h-4" />
                Compensation FAQ
              </span>
              <h2 className="text-4xl font-display font-bold text-primary mb-6">Common Questions</h2>
            </div>
          </AnimatedSection>
          <AnimatedSection delay={0.1}>
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-6 md:p-8">
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
                  question="Is there a fee to be a LeaderShield distributor?"
                  answer={`Distributors pay a ${usd(membership.individual.fee)} monthly membership for access to the CRM, reporting, training, and support. It is automatically waived in any month you collect at least ${usd(membership.individual.waiverThreshold)} in commissions, so active producers effectively pay nothing. Agency plans are available at ${usd(membership.small_agency.fee)}, ${usd(membership.growth_agency.fee)}, and ${usd(membership.enterprise_agency.fee)} per month with higher waiver thresholds.`}
                />
              </CardContent>
            </Card>
          </AnimatedSection>
        </div>
      </section>

      {/* Income disclosure callout */}
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/10 rounded-2xl p-8 text-center">
            <h3 className="text-xl font-bold text-primary mb-3">Earnings Are Never Guaranteed</h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-5">
              The rates and pools above describe how compensation is structured — not what any individual will earn. The
              majority of participants earn little to no income. Your results depend entirely on your own effort, skill,
              retention, and market conditions.
            </p>
            <Link href="/income-disclosure">
              <Button variant="outline" data-testid="button-income-disclosure">
                <FileText className="w-4 h-4 mr-2" />
                Read the full Income Disclosure Statement
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-6 bg-gradient-to-br from-[#0A1628] via-[#0f1f3a] to-[#0A1628] relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/4 rounded-full blur-[120px]" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl lg:text-5xl font-display font-bold text-white mb-6 leading-tight">
            Ready to Build Your Income?
          </h2>
          <p className="text-lg text-white/50 mb-10 max-w-2xl mx-auto">
            Join the network and start earning across capital, subscriptions, and your own organization.
          </p>
          <Link href="/signup">
            <Button size="lg" className="h-16 px-12 text-lg font-bold bg-white text-primary shadow-2xl hover:bg-white/90 transition-all hover:scale-105" data-testid="button-commissions-join">
              Join the Network
              <ArrowRight className="w-6 h-6 ml-3" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Important Disclosures */}
      <section className="py-12 px-6 bg-muted/50 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-lg font-bold text-primary mb-4">Important Disclosures</h3>
          <div className="space-y-4 text-xs text-muted-foreground">
            <div>
              <h4 className="font-semibold text-foreground mb-1">Funding Terms Disclosure</h4>
              <p>Merchant cash advance funding is not a traditional APR-based loan. Program terms, pricing, factor rates, documentation, funding availability, and eligibility are subject to underwriting review and may vary by business profile. Funding amounts, factor rates, repayment terms, and renewal eligibility described on this website are illustrative and not guaranteed.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Income Disclaimer</h4>
              <p>The income figures presented on this website are examples only and are not intended to represent or guarantee that anyone will achieve the same or similar results. Your individual results will vary and depend on many factors, including but not limited to your individual capacity, work ethic, business experience and knowledge, level of commitment, diligence in applying LeaderShield Funding's training and sales system, and market conditions. LeaderShield Funding does not guarantee any level of income or earnings to any agent.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Independent Contractor Status</h4>
              <p>LeaderShield Funding agents are independent contractors, not employees. As an independent contractor, you are responsible for your own taxes, insurance, and business expenses. LeaderShield Funding does not provide employment benefits, and agents are not entitled to minimum wage protections or overtime compensation.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">No Guaranteed Income</h4>
              <p>There is no guarantee that you will earn any income as a LeaderShield Funding agent. Success requires consistent effort, effective sales techniques, and the ability to build and maintain a productive team. Many participants in network marketing businesses earn little to no income. Past performance does not guarantee future results.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Business Opportunity Disclosure</h4>
              <p>This is a business opportunity, not a job offer. Before joining LeaderShield Funding, you should carefully review all materials and disclosures. Consult with a qualified financial or legal advisor if you have questions about the opportunity. Some states require additional disclosures for business opportunities.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Commission Structure Disclosure</h4>
              <p>Commission rates, residual percentages, and bonus structures described on this website are subject to the terms of the LeaderShield Funding Agent Agreement. Commission decay schedules, payout splits, and accelerator qualifications are detailed in the full compensation plan document provided during onboarding.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Testimonial Disclaimer</h4>
              <p>Testimonials and success stories on this website represent individual experiences and are not typical results. Individual results will vary based on background, dedication, effort, and market conditions. Names and details may be changed for privacy.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Anti-Pyramid Scheme Disclosure</h4>
              <p>LeaderShield Funding commissions are earned exclusively from the sale of legitimate products and services to end-user merchants — not from recruitment fees or the enrollment of other agents. Agents are never required to purchase products or inventory to participate. Our compensation plan rewards product sales performance, not headcount. LeaderShield Funding complies with all applicable FTC guidelines regarding multi-level marketing and business opportunity practices.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Material Connection Disclosure</h4>
              <p>Some individuals featured on this website, including those providing testimonials, endorsements, or success stories, have a material connection to LeaderShield Funding. They may be current agents, affiliates, or compensated participants. Their experiences and results are their own and should not be considered typical. Any compensation or benefits received are disclosed in accordance with the FTC's Endorsement Guides (16 CFR Part 255).</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">State-Specific Business Opportunity Notice</h4>
              <p>Certain states, including but not limited to California, Maryland, New York, and others, may require the registration or filing of business opportunity disclosures before an offer or sale can be made. LeaderShield Funding complies with all applicable state business opportunity laws. If you reside in a state with specific business opportunity registration requirements, additional disclosures may apply. Please contact compliance@leadershieldfunding.com for state-specific information before enrolling.</p>
            </div>
            <div className="pt-4 border-t border-border">
              <p>For complete details, please review our <Link href="/income-disclosure"><span className="text-primary underline cursor-pointer" data-testid="link-disclosure-ids">Income Disclosure Statement</span></Link>, <Link href="/terms"><span className="text-primary underline cursor-pointer" data-testid="link-disclosure-terms">Terms of Service</span></Link>, <Link href="/privacy"><span className="text-primary underline cursor-pointer" data-testid="link-disclosure-privacy">Privacy Policy</span></Link>, and <Link href="/refund-policy"><span className="text-primary underline cursor-pointer" data-testid="link-disclosure-refund">Refund Policy</span></Link>.</p>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
