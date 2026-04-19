import { useRef, useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Clock,
  Repeat,
  Target,
  Bot,
  MessageSquare,
  Search,
  LineChart,
  CreditCard,
  Globe,
  Lock,
  FileCheck,
  Scale,
  Calendar,
  Rocket,
  Award,
  Layers,
  Play,
  GraduationCap,
  Headphones,
  Quote,
  ArrowUpRight,
  Sparkles,
  Trophy,
  Heart,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";
import { motion, useInView } from "framer-motion";

function AnimatedSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.7, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function CountUp({ end, suffix = "", prefix = "", duration = 2000 }: { end: number; suffix?: string; prefix?: string; duration?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, end, duration]);

  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>;
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-5 text-left group"
        data-testid={`faq-${question.slice(0, 20).replace(/\s/g, '-').toLowerCase()}`}
      >
        <span className="text-base font-semibold text-foreground pr-4 group-hover:text-primary transition-colors">{question}</span>
        <ChevronDown className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <motion.div
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

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-background/95 backdrop-blur-xl shadow-sm border-b border-border' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" data-testid="link-logo-landing" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Shield className="w-5 h-5 text-primary shrink-0" />
            <span className="font-display font-bold text-primary text-lg tracking-wide">Leader Shield Network</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="#opportunity" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Opportunity</a>
            <a href="#platform" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Platform</a>
            <a href="#compensation" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Earnings</a>
            <a href="#faq" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">FAQ</a>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" data-testid="button-login">Agent Login</Button>
            </Link>
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
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 mb-8">
                <Sparkles className="w-4 h-4 text-white/60" />
                <span className="text-sm font-medium text-white/80">The $200B+ Opportunity is Here</span>
              </div>

              <h1 className="text-5xl lg:text-7xl font-display font-bold text-white leading-[1.1] mb-8">
                Build Your
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#E5E4E2] to-white/70">
                  Financial Legacy
                </span>
              </h1>

              <p className="text-xl text-white/60 mb-10 max-w-lg leading-relaxed">
                Two revenue streams. No ceiling on your income. Leadershield Network gives you the platform, the products, and the training to build generational wealth.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <Link href="/signup">
                  <Button size="lg" className="h-16 px-10 text-lg font-bold bg-white text-primary font-bold shadow-2xl hover:bg-white/90 transition-all hover:scale-105" data-testid="button-get-started">
                    Start Your Journey
                    <ArrowRight className="w-6 h-6 ml-3" />
                  </Button>
                </Link>
                <a href="#opportunity">
                  <Button size="lg" variant="outline" className="h-16 px-10 text-lg font-semibold border-white/20 text-white hover:bg-white/10 hover:text-white">
                    <Play className="w-5 h-5 mr-2" />
                    See How It Works
                  </Button>
                </a>
              </div>

              <p className="text-xs text-white/30">*Individual results vary. Income depends on effort, market conditions, and other factors.</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              className="relative hidden lg:block"
            >
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-br from-white/10 to-transparent rounded-3xl blur-2xl" />
                <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 space-y-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-white/60 text-sm font-medium uppercase tracking-wider">Live Earning Potential</span>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                          <DollarSign className="w-5 h-5 text-emerald-400" />
                        </div>
                        <span className="text-white/70">MCA Commission</span>
                      </div>
                      <span className="text-xl font-bold text-emerald-400">22% GBR</span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                          <Repeat className="w-5 h-5 text-blue-400" />
                        </div>
                        <span className="text-white/70">Platform Residuals</span>
                      </div>
                      <span className="text-xl font-bold text-blue-400">50-70%</span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white/8 rounded-2xl border border-white/15">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                          <Zap className="w-5 h-5 text-[#E5E4E2]" />
                        </div>
                        <span className="text-white/80">Pairing Bonus</span>
                      </div>
                      <span className="text-xl font-bold text-[#E5E4E2]">+5%</span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-purple-400" />
                        </div>
                        <span className="text-white/70">Quarterly Accelerator</span>
                      </div>
                      <span className="text-xl font-bold text-purple-400">Up to +3%</span>
                    </div>
                  </div>

                  <Link href="/signup">
                    <Button className="w-full h-14 bg-white text-primary font-bold text-lg hover:bg-white/90 shadow-xl mt-4">
                      Claim Your Spot
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      </section>

      {/* Social Proof Stats Bar */}
      <section className="py-16 px-6 bg-background border-b border-border">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: 200, suffix: "B+", prefix: "$", label: "Industry Size", icon: BarChart3 },
              { value: 30, suffix: "M+", label: "US Small Businesses", icon: Users },
              { value: 70, suffix: "%", label: "Max Commission Pool", icon: TrendingUp },
              { value: 48, suffix: "hr", label: "Average Funding Time", icon: Clock },
            ].map((stat, i) => (
              <AnimatedSection key={i} delay={i * 0.1}>
                <div className="flex flex-col items-center" data-testid={`social-stat-${i}`}>
                  <stat.icon className="w-6 h-6 text-primary mb-3" />
                  <p className="text-4xl font-bold text-primary mb-1">
                    <CountUp end={stat.value} prefix={stat.prefix || ""} suffix={stat.suffix} />
                  </p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* The Opportunity — Why Now */}
      <section id="opportunity" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 text-sm font-medium text-primary mb-6">
                <Target className="w-4 h-4" />
                The Opportunity
              </span>
              <h2 className="text-4xl lg:text-5xl font-display font-bold text-primary mb-6">
                The MCA Industry is Booming.<br />Most Agents Are Leaving Money on the Table.
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Traditional MCA agents earn once and start over. Leadershield agents earn immediate MCA commissions
                AND build recurring subscription revenue that compounds every month. Two engines. One unstoppable career.
              </p>
            </div>
          </AnimatedSection>

          {/* How It Works — 3 Steps */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
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
                  {["22% of Gross Brokerage Revenue", "70% paid at funding, 30% deferred", "Quarterly performance accelerators up to +3%", "Renewal commissions on repeat deals"].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-white/70">{item}</span>
                    </div>
                  ))}
                </div>
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
                  {["50-70% commission pool by tier", "Aggressive upfront payouts (months 1-3)", "Lifetime 10% residual after month 12", "Three tiers from $199 to $749/month"].map((item, i) => (
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
                <Zap className="w-8 h-8 text-[#E5E4E2]" />
              </div>
              <div className="text-center md:text-left">
                <h3 className="text-xl font-bold text-white mb-1">The Power of Pairing: +5% Enhancement</h3>
                <p className="text-white/60">
                  Bundle an MCA with a subscription and earn an extra 5% commission on the subscription for the first 3 months.
                  This is the compound advantage that sets Leadershield apart.
                </p>
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
                Three Subscription Tiers.<br />Real Solutions Merchants Need.
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                These are not fluff products. Each tier solves real business problems and delivers measurable ROI for merchants — making them easy to sell and easy to retain.
              </p>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                tier: "Tier 1",
                name: "Merchant Essentials",
                price: "$199",
                pool: "50%",
                color: "blue",
                icon: BarChart3,
                ideal: "Businesses seeking financial discipline and operational clarity",
                features: ["Financial reporting dashboards", "30-day forecasting projections", "AI-based expense categorization", "Credit monitoring & fraud alerts"]
              },
              {
                tier: "Tier 2",
                name: "Growth Accelerator",
                price: "$429",
                pool: "60%",
                color: "blue",
                icon: Rocket,
                popular: true,
                ideal: "Businesses with stable operations looking to accelerate revenue growth",
                features: ["Google Business optimization", "Automated review capture systems", "SMS & email marketing automation", "CRM infrastructure & AI chatbot"]
              },
              {
                tier: "Tier 3",
                name: "Elite AI Revenue System",
                price: "$749",
                pool: "70%",
                color: "purple",
                icon: Bot,
                ideal: "Aggressive operators seeking to dominate their market with AI-driven growth",
                features: ["AI-driven lead generation", "Appointment booking automation", "Advanced conversion funnel builds", "Competitive ad intelligence"]
              },
            ].map((item, i) => {
              const colorMap: Record<string, { bg: string; text: string; border: string; badge: string; iconBg: string }> = {
                blue: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200", badge: "bg-blue-100 text-blue-700", iconBg: "bg-blue-100" },
                yellow: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-300", badge: "bg-blue-100 text-blue-700", iconBg: "bg-blue-100" },
                purple: { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-200", badge: "bg-purple-100 text-purple-700", iconBg: "bg-purple-100" },
              };
              const c = colorMap[item.color];
              return (
                <AnimatedSection key={i} delay={i * 0.15}>
                  <Card className={`relative overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 h-full ${item.popular ? `border-2 ${c.border} shadow-lg` : 'border-border/50'}`} data-testid={`card-tier-${i}`}>
                    {item.popular && (
                      <div className="absolute -top-0 left-0 right-0">
                        <div className="bg-primary text-white text-xs font-bold px-4 py-1.5 text-center">
                          MOST POPULAR
                        </div>
                      </div>
                    )}
                    <CardContent className={`p-8 ${item.popular ? 'pt-12' : ''}`}>
                      <div className="flex items-center justify-between mb-4">
                        <span className={`text-xs font-bold uppercase tracking-wider ${c.text}`}>{item.tier}</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${c.badge}`}>{item.pool} Pool</span>
                      </div>
                      <div className={`w-14 h-14 rounded-2xl ${c.iconBg} flex items-center justify-center mb-4`}>
                        <item.icon className={`w-7 h-7 ${c.text}`} />
                      </div>
                      <h3 className="text-xl font-bold text-primary mb-1">{item.name}</h3>
                      <p className="text-3xl font-bold text-primary mb-2">{item.price}<span className="text-base font-normal text-muted-foreground">/mo</span></p>
                      <p className="text-sm text-muted-foreground mb-6 italic">{item.ideal}</p>
                      <div className="space-y-3">
                        {item.features.map((feature, j) => (
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

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {[
              { title: "Part-Time Agent", subtitle: "10-15 hrs/week", income: "$2,500-$4,000", timeframe: "/month", desc: "2 MCA deals + 3 subscriptions per month. Perfect for side income while keeping your day job.", color: "border-blue-200 bg-blue-50/50" },
              { title: "Full-Time Producer", subtitle: "40 hrs/week", income: "$8,000-$15,000", timeframe: "/month", desc: "4 MCA deals + 6 subscriptions per month. Full-time focus with compounding platform residuals.", color: "border-primary/20 bg-primary/5", featured: true },
              { title: "Team Builder", subtitle: "Team of 5-10", income: "$25,000+", timeframe: "/month", desc: "Personal production plus override commissions from your growing team. This is where legacy income begins.", color: "border-emerald-200 bg-emerald-50/50" },
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
            <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/10 rounded-2xl p-6 md:p-8">
              <h3 className="text-xl font-bold text-primary mb-4 text-center">Monthly Income Projection: 4 Subscriptions + 1 MCA Deal</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { month: "Month 1", total: "$2,600", platform: "$400", mca: "$2,200" },
                  { month: "Month 3", total: "$3,300", platform: "$1,100", mca: "$2,200" },
                  { month: "Month 6", total: "$4,200", platform: "$2,000", mca: "$2,200" },
                  { month: "Month 12", total: "$5,700", platform: "$3,500", mca: "$2,200" },
                ].map((item, i) => (
                  <div key={i} className="text-center p-4 bg-background rounded-xl shadow-sm">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{item.month}</p>
                    <p className="text-2xl font-bold text-primary mb-2">{item.total}</p>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>MCA: {item.mca}</p>
                      <p>Platform: {item.platform}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-center text-xs text-muted-foreground mt-4">*Illustrative example only. Actual results depend on individual effort, retention, and market conditions.</p>
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
              { icon: DollarSign, title: "MCA Commission", rate: "22% GBR", desc: "Earn on every funded deal you refer", color: "from-emerald-400 to-emerald-500" },
              { icon: Repeat, title: "Platform Residuals", rate: "50-70%", desc: "Monthly recurring subscription commissions", color: "from-blue-400 to-blue-500" },
              { icon: Zap, title: "Pairing Bonus", rate: "+5%", desc: "Enhancement when you bundle MCA + subscription", color: "from-[#E5E4E2] to-white/70" },
              { icon: Users, title: "Team Overrides", rate: "Up to 8%", desc: "Earn on your team's production as a sponsor", color: "from-purple-400 to-purple-500" },
            ].map((item, i) => (
              <AnimatedSection key={i} delay={i * 0.1}>
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 text-center hover:bg-white/8 transition-all h-full" data-testid={`comp-card-${i}`}>
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                    <item.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">{item.title}</h3>
                  <p className="text-3xl font-bold text-primary mb-2">{item.rate}</p>
                  <p className="text-sm text-white/50">{item.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>

          <AnimatedSection delay={0.4}>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                  </div>
                  Payout Mechanics
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                      <span className="text-2xl font-bold text-emerald-400">70%</span>
                    </div>
                    <div>
                      <p className="font-semibold text-white">Immediate Release</p>
                      <p className="text-sm text-white/50">Paid when the deal is confirmed funded</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                      <span className="text-2xl font-bold text-blue-400">30%</span>
                    </div>
                    <div>
                      <p className="font-semibold text-white">Deferred Release</p>
                      <p className="text-sm text-white/50">Released after 60-90 days to cover clawbacks</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <Award className="w-5 h-5 text-primary" />
                  </div>
                  Quarterly Accelerators
                </h3>
                <div className="space-y-3">
                  {[
                    { volume: "$250K+", bonus: "+0.5%" },
                    { volume: "$500K+", bonus: "+1.0%" },
                    { volume: "$1M+", bonus: "+2.0%" },
                    { volume: "$2M+", bonus: "+3.0%" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                      <span className="text-white/70">{item.volume} quarterly volume</span>
                      <span className="font-bold text-primary">{item.bonus}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.5}>
            <div className="text-center mt-12">
              <Link href="/signup">
                <Button size="lg" className="h-16 px-10 text-lg font-bold shadow-2xl transition-all hover:scale-105">
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
              { name: "Sarah K.", role: "Team Builder", location: "Phoenix, AZ", quote: "I started part-time while working my corporate job. Within 6 months, my Leadershield income surpassed my salary. The training academy gave me everything I needed to succeed.", months: "11 months" },
              { name: "David R.", role: "Agency Partner", location: "Miami, FL", quote: "Building a team was the multiplier. My personal production earns well, but the overrides from my team of 8 agents have created the financial freedom I always wanted.", months: "18 months" },
            ].map((item, i) => (
              <AnimatedSection key={i} delay={i * 0.15}>
                <Card className="h-full border-border/50 shadow-sm hover:shadow-lg transition-all" data-testid={`testimonial-${i}`}>
                  <CardContent className="p-8">
                    <Quote className="w-8 h-8 text-white/20 mb-4" />
                    <p className="text-muted-foreground leading-relaxed mb-6 italic">"{item.quote}"</p>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white font-bold text-lg">
                        {item.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-primary">{item.name}</p>
                        <p className="text-sm text-muted-foreground">{item.role} - {item.location}</p>
                        <p className="text-xs text-muted-foreground">{item.months} with Leadershield</p>
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

          {/* Platform Fee */}
          <AnimatedSection delay={0.3}>
            <div className="bg-background border border-border rounded-2xl p-8 md:p-10 max-w-3xl mx-auto text-center shadow-sm">
              <h3 className="text-2xl font-bold text-primary mb-2">Platform Fee: $99/month</h3>
              <p className="text-muted-foreground mb-6">Access to CRM, training, reporting, and support. Production waivers available.</p>
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { revenue: "$3,000+", benefit: "50% Off" },
                  { revenue: "$5,000+", benefit: "100% Waived" },
                  { revenue: "$8,500+", benefit: "Waived + $100 Credit" },
                ].map((item, i) => (
                  <div key={i} className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <p className="text-xs font-bold text-emerald-700 mb-1">{item.revenue}</p>
                    <p className="text-sm font-bold text-emerald-600">{item.benefit}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm font-semibold text-emerald-600">Active, producing agents effectively pay nothing.</p>
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
                  question="What is the Merchant Growth Platform?"
                  answer="The Merchant Growth Platform is a subscription-based service designed to help merchants improve their financial visibility, accelerate revenue, and automate their marketing. It's a recurring revenue product that provides a stable, long-term income stream for our agents."
                />
                <FAQItem
                  question="Do I need experience to get started?"
                  answer="No prior experience is required. Our comprehensive training academy covers everything from product knowledge and sales techniques to compliance guidelines. You'll have access to scripts, objection handlers, and ongoing support from our team."
                />
                <FAQItem
                  question="How quickly can I start earning?"
                  answer="Many agents close their first deal within the first 2-3 weeks. MCA commissions are paid at funding (70% immediately), and subscription commissions start the first month the merchant is active. Follow the 30-day roadmap and you could see your first payout within weeks."
                />
                <FAQItem
                  question="What is the commission decay schedule?"
                  answer="Subscription commissions start at the full pool rate (50-70% depending on tier) for months 1-3, then gradually decrease: 75% for months 4-6, 50% for months 7-9, and 25% for months 10-12. After month 12, you earn a lifetime 10% residual on each active account."
                />
                <FAQItem
                  question="Can I sell MCA and subscriptions to the same merchant?"
                  answer="Absolutely, and we encourage it. When you pair a new subscription with a funded MCA, you earn a 5% commission enhancement on the subscription for the first three months. This pairing strategy maximizes your upfront earnings."
                />
                <FAQItem
                  question="Is there a fee to be a Leadershield agent?"
                  answer="Yes, there's a $99 monthly platform fee that gives you access to our CRM, reporting, training, and support. This fee can be reduced (50% off at $3,000 revenue) or completely waived ($5,000+ revenue). Top producers get a $100 credit on top of the waiver."
                />
                <FAQItem
                  question="How does team building work?"
                  answer="As you grow, you can sponsor other agents to join Leadershield Network. You'll earn override commissions on their production (up to 8% as a Partner). Our binary tree structure and rank advancement system reward you for developing and mentoring successful agents."
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
              <Sparkles className="w-4 h-4" />
              Your future starts here
            </div>
            <h2 className="text-4xl lg:text-6xl font-display font-bold text-white mb-6 leading-tight">
              Ready to Build Something<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#E5E4E2] to-white/70">That Pays You for Life?</span>
            </h2>
            <p className="text-xl text-white/50 mb-10 max-w-2xl mx-auto">
              Join Leadershield Network. Build two revenue streams. Create financial freedom for you and your family. No experience needed — we'll train you every step of the way.
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
              <h4 className="font-semibold text-foreground mb-1">FTC Income Disclosure</h4>
              <p>The income figures presented on this website are examples only and are not intended to represent or guarantee that anyone will achieve the same or similar results. Your individual results will vary and depend on many factors, including but not limited to your individual capacity, work ethic, business experience and knowledge, level of commitment, diligence in applying Leadershield Network's training and sales system, and market conditions. Leadershield Network does not guarantee any level of income or earnings to any agent.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Independent Contractor Status</h4>
              <p>Leadershield Network agents are independent contractors, not employees. As an independent contractor, you are responsible for your own taxes, insurance, and business expenses. Leadershield Network does not provide employment benefits, and agents are not entitled to minimum wage protections or overtime compensation.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">No Guaranteed Income</h4>
              <p>There is no guarantee that you will earn any income as a Leadershield Network agent. Success requires consistent effort, effective sales techniques, and the ability to build and maintain a productive team. Many participants in network marketing businesses earn little to no income. Past performance does not guarantee future results.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Business Opportunity Disclosure</h4>
              <p>This is a business opportunity, not a job offer. Before joining Leadershield Network, you should carefully review all materials and disclosures. Consult with a qualified financial or legal advisor if you have questions about the opportunity. Some states require additional disclosures for business opportunities.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Commission Structure Disclosure</h4>
              <p>Commission rates, residual percentages, and bonus structures described on this website are subject to the terms of the Leadershield Network Agent Agreement. Commission decay schedules, payout splits, and accelerator qualifications are detailed in the full compensation plan document provided during onboarding.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Testimonial Disclaimer</h4>
              <p>Testimonials and success stories on this website represent individual experiences and are not typical results. Individual results will vary based on background, dedication, effort, and market conditions. Names and details may be changed for privacy.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Anti-Pyramid Scheme Disclosure</h4>
              <p>Leadershield Network commissions are earned exclusively from the sale of legitimate products and services to end-user merchants — not from recruitment fees or the enrollment of other agents. Agents are never required to purchase products or inventory to participate. Our compensation plan rewards product sales performance, not headcount. Leadershield Network complies with all applicable FTC guidelines regarding multi-level marketing and business opportunity practices.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Material Connection Disclosure</h4>
              <p>Some individuals featured on this website, including those providing testimonials, endorsements, or success stories, have a material connection to Leadershield Network. They may be current agents, affiliates, or compensated participants. Their experiences and results are their own and should not be considered typical. Any compensation or benefits received are disclosed in accordance with the FTC's Endorsement Guides (16 CFR Part 255).</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">State-Specific Business Opportunity Notice</h4>
              <p>Certain states, including but not limited to California, Maryland, New York, and others, may require the registration or filing of business opportunity disclosures before an offer or sale can be made. Leadershield Network complies with all applicable state business opportunity laws. If you reside in a state with specific business opportunity registration requirements, additional disclosures may apply. Please contact compliance@leadershield.com for state-specific information before enrolling.</p>
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
          <div className="grid md:grid-cols-5 gap-10 mb-12">
            <div className="md:col-span-2">
              <Link href="/" data-testid="link-logo-footer" className="flex items-center gap-2 mb-4 hover:opacity-80 transition-opacity w-fit">
                <Shield className="w-5 h-5 text-white shrink-0" />
                <span className="font-display font-bold text-white text-lg tracking-wide">Leader Shield Network</span>
              </Link>
              <p className="text-white/40 max-w-sm leading-relaxed">
                Empowering agents. Transforming merchants. Building legacies. Two revenue streams, one powerful platform.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-white/80 mb-4">Quick Links</h4>
              <div className="space-y-2 text-sm">
                <a href="#opportunity" className="block text-white/40 hover:text-white transition-colors">Opportunity</a>
                <a href="#platform" className="block text-white/40 hover:text-white transition-colors">Platform</a>
                <a href="#compensation" className="block text-white/40 hover:text-white transition-colors">Earnings</a>
                <a href="#faq" className="block text-white/40 hover:text-white transition-colors">FAQ</a>
                <a href="#disclaimers" className="block text-white/40 hover:text-white transition-colors">Disclosures</a>
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
              &copy; 2026 Leadershield Network. All rights reserved.
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
    </div>
  );
}
