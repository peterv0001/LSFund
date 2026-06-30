import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PublicNav } from "@/components/PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { AnimatedSection, FAQItem } from "@/components/AnimatedSection";
import {
  Layers,
  BarChart3,
  Rocket,
  Bot,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  MessageSquare,
} from "lucide-react";
import { COMP_V2026, type SubscriptionProduct } from "@shared/compensation";

const usd = (n: number) => `$${n.toLocaleString()}`;
const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
const { subscriptionPricing, subscriptionPools } = COMP_V2026;

export default function PlatformPage() {
  usePageMeta(
    "Merchant Growth Platform Subscription Tiers | LeaderShield Funding",
    "Four AI-powered Merchant Growth Platform subscription tiers — Starter, Growth Foundation, Revenue Growth System, and Revenue Scale AI — powered by Marketing Titan + Lead Titan AI.",
  );

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <PublicNav />

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden bg-gradient-to-br from-[#0A1628] via-[#0f1f3a] to-[#0A1628] text-white">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-400/8 rounded-full blur-[120px]" />
        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm font-medium text-white/80 mb-6">
            <Layers className="w-4 h-4 text-[#C9A24B]" />
            The Merchant Growth Platform
          </span>
          <h1 className="text-4xl lg:text-6xl font-display font-bold mb-6 leading-tight">
            Four Subscription Tiers.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#E0C27E] to-white/70">
              Real Solutions Merchants Need.
            </span>
          </h1>
          <p className="text-lg text-white/55 max-w-2xl mx-auto">
            Powered by our exclusive partnership with Marketing Titan + Lead Titan AI. Each tier solves real business
            problems and delivers measurable ROI — making them easy to sell and easy to retain.
          </p>
        </div>
      </section>

      {/* Tiers */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
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
                features: ["750 verified lead credits / month", "5 email outreach sequences (1,500 sends/mo)", "Basic AI Brand Intelligence", "Integrates with your existing CRM"],
              },
              {
                tier: "Tier 2",
                name: "Growth Foundation",
                productKey: "tier_2" as SubscriptionProduct,
                poweredBy: "Powered by Marketing Titan + Lead Titan",
                color: "blue",
                icon: Rocket,
                ideal: "Businesses ready to build visibility and a stable lead engine",
                features: ["Advanced AI Brand Intelligence (catalog, personas, SEO)", "Native AI CRM (1,000 contacts + scoring)", "24/7 AI chatbot lead capture", "AI visual email + performance dashboard"],
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
                features: ["Everything in Growth Foundation", "2,000 lead credits/mo + Darwin AI Chief of Staff", "AI social content to Meta (30/mo) + Ask AI", "CRM 10,000 contacts + automation"],
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
                features: ["Everything in Revenue Growth System", "AI Caller (750 outbound min/mo, books meetings)", "AI paid ads + ad designer + ad insights", "CRM 25,000 contacts + advanced automation"],
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
                  <Card className={`relative overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 h-full ${highlighted ? `border-2 ${c.border} shadow-lg` : "border-border/50"}`} data-testid={`card-tier-${i}`}>
                    {highlighted && (
                      <div className="absolute -top-0 left-0 right-0">
                        <div className={`${item.bestValue ? "bg-[#C9A24B]" : "bg-primary"} text-white text-xs font-bold px-4 py-1.5 text-center`}>
                          {item.bestValue ? "BEST VALUE" : "MOST POPULAR"}
                        </div>
                      </div>
                    )}
                    <CardContent className={`p-8 ${highlighted ? "pt-12" : ""}`}>
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

          <AnimatedSection delay={0.2}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-14">
              <a href="https://apply.myrmapp.com/multi-step-apply/pg" target="_blank" rel="noopener noreferrer" data-testid="link-apply-platform">
                <Button size="lg" className="h-14 px-10 text-lg font-bold shadow-lg hover:scale-105 transition-all">
                  Apply Now
                  <ArrowRight className="w-5 h-5 ml-3" />
                </Button>
              </a>
              <Link href="/opportunity">
                <Button size="lg" variant="outline" className="h-14 px-10 text-lg font-semibold" data-testid="link-learn-opportunity">
                  Learn More About Earning
                </Button>
              </Link>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6 bg-muted/30">
        <div className="max-w-3xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 text-sm font-medium text-primary mb-6">
                <MessageSquare className="w-4 h-4" />
                Platform FAQ
              </span>
              <h2 className="text-4xl font-display font-bold text-primary mb-6">Common Questions</h2>
            </div>
          </AnimatedSection>
          <AnimatedSection delay={0.1}>
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-6 md:p-8">
                <FAQItem
                  question="What is the Merchant Growth Platform?"
                  answer="The Merchant Growth Platform is a subscription suite of lead-generation, marketing-automation, CRM, and AI customer-acquisition tools that help merchants attract, capture, and convert more customers. Powered by Marketing Titan AI and Lead Titan AI, it's a recurring revenue product that provides a stable, long-term income stream for full agents."
                />
              </CardContent>
            </Card>
          </AnimatedSection>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
