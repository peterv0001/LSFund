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
  Layers
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-primary">Leadershield Network</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#platform" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Platform</a>
            <a href="#mca" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">MCA</a>
            <a href="#compensation" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Compensation</a>
            <a href="#get-started" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Get Started</a>
          </div>
          
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" data-testid="button-login">Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-gradient-to-r from-primary to-primary/90" data-testid="button-join">
                Join Now
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-yellow-500/5" />
        <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-yellow-400/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-3xl" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 mb-6">
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium text-yellow-600">Two Revenue Streams. One Powerful Platform.</span>
              </div>
              
              <h1 className="text-5xl lg:text-6xl font-display font-bold text-primary leading-tight mb-6">
                Your Path to <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-yellow-600">Recurring Revenue</span>
                <br />and Long-Term Wealth
              </h1>
              
              <p className="text-lg text-muted-foreground mb-8 max-w-lg">
                Tap into the $200B+ Merchant Cash Advance market for immediate income, 
                plus build recurring wealth with the Merchant Growth Platform. 
                Two revenue streams, one unstoppable career.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <Link href="/signup">
                  <Button size="lg" className="h-14 px-8 text-base font-semibold bg-gradient-to-r from-primary to-primary/90 shadow-xl shadow-primary/25" data-testid="button-get-started">
                    Get Started Today
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <a href="#platform">
                  <Button size="lg" variant="outline" className="h-14 px-8 text-base font-semibold">
                    Learn More
                  </Button>
                </a>
              </div>
              
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-3xl font-bold text-primary" data-testid="stat-gbr">22%</p>
                  <p className="text-sm text-muted-foreground">of GBR*</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-primary" data-testid="stat-commission-pool">50-70%</p>
                  <p className="text-sm text-muted-foreground">Commission Pool*</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-primary" data-testid="stat-pairing">+5%</p>
                  <p className="text-sm text-muted-foreground">Pairing Enhancement*</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">*Individual results vary. Income depends on individual effort, market conditions, and other factors. See income disclosure below.</p>
            </div>
            
            <div className="relative hidden lg:block">
              <div className="absolute inset-0 bg-gradient-to-br from-primary to-slate-900 rounded-3xl transform rotate-3 scale-105 opacity-10" />
              <Card className="relative bg-gradient-to-br from-primary to-slate-900 rounded-3xl p-8 text-white shadow-2xl">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
                <h3 className="text-2xl font-display font-bold mb-6">Two Revenue Streams</h3>
                
                <div className="space-y-4 mb-8">
                  <div className="flex items-center justify-between gap-3 p-4 bg-white/5 rounded-xl">
                    <span className="text-white/60">MCA Commissions</span>
                    <span className="font-bold text-yellow-400">Immediate Income</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 p-4 bg-white/5 rounded-xl">
                    <span className="text-white/60">Merchant Growth Platform</span>
                    <span className="font-bold text-yellow-400">Recurring Wealth</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                    <span className="text-white/80">Pairing Enhancement</span>
                    <span className="font-bold text-yellow-400">+5% Bonus</span>
                  </div>
                </div>
                
                <Link href="/signup">
                  <Button className="w-full h-12 bg-yellow-500 text-primary font-semibold">
                    Start Earning Now
                  </Button>
                </Link>
                <p className="text-xs text-white/40 mt-4 text-center">*Earnings are not guaranteed and depend on individual effort, skills, and market conditions.</p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Two Revenue Streams Section */}
      <section id="platform" className="py-20 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold text-primary mb-4">
              Two Revenue Streams, One Career
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Combine immediate MCA commissions with recurring platform revenue 
              for a compounding income engine that grows every month.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <Card className="border-border/50 shadow-sm" data-testid="card-mca-stream">
              <CardContent className="p-8">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-6">
                  <DollarSign className="w-7 h-7 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-bold text-primary mb-2">MCA Revenue</h3>
                <p className="text-lg font-semibold text-emerald-600 mb-4">22% of GBR — Immediate Income</p>
                <p className="text-muted-foreground mb-6">
                  Earn commissions from the $200B+ Merchant Cash Advance industry. 
                  Fast closings, high ticket values, and repeat funding opportunities 
                  mean you can start earning immediately.
                </p>
                <div className="space-y-3">
                  {["Fast approval and funding (24-48 hours)", "High demand from 30M+ small businesses", "Repeat funding as businesses grow", "No lending license required"].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-border/50 shadow-sm" data-testid="card-platform-stream">
              <CardContent className="p-8">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                  <Repeat className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-primary mb-2">Merchant Growth Platform</h3>
                <p className="text-lg font-semibold text-primary mb-4">50-70% Commission Pool — Recurring Wealth</p>
                <p className="text-muted-foreground mb-6">
                  Sell monthly subscription products that merchants actually need. 
                  Every subscription you place generates monthly recurring commissions 
                  that compound over time.
                </p>
                <div className="space-y-3">
                  {["Monthly recurring commissions", "Three subscription tiers ($199-$749/mo)", "Commission decay protects long-term residuals", "Lifetime residual income potential"].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-yellow-500/30 bg-yellow-500/5" data-testid="card-pairing-enhancement">
            <CardContent className="p-6 flex flex-col md:flex-row items-center gap-6">
              <div className="w-14 h-14 rounded-2xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                <Zap className="w-7 h-7 text-yellow-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-primary mb-1">Pairing Enhancement: +5% Bonus</h3>
                <p className="text-muted-foreground">
                  Pair an MCA deal with a Merchant Growth Platform subscription and earn an 
                  additional 5% commission enhancement on the MCA deal. 
                  Maximize every merchant relationship.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Merchant Growth Platform Tiers */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold text-primary mb-4">
              Merchant Growth Platform
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Three subscription tiers designed to help merchants grow their business — 
              and generate recurring commissions for you every month.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-border/50 shadow-sm" data-testid="card-tier-essentials">
              <CardContent className="p-8">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-6">
                  <BarChart3 className="w-7 h-7 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-primary mb-1">Merchant Essentials</h3>
                <p className="text-3xl font-bold text-primary mb-4">$199<span className="text-base font-normal text-muted-foreground">/mo</span></p>
                <div className="space-y-3">
                  {[
                    { icon: LineChart, text: "Financial reporting & analytics" },
                    { icon: TrendingUp, text: "Revenue forecasting" },
                    { icon: Layers, text: "Expense categorization" },
                    { icon: CreditCard, text: "Credit monitoring" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <item.icon className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{item.text}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-yellow-500/30 shadow-lg relative" data-testid="card-tier-growth">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-yellow-500 text-primary text-xs font-bold px-3 py-1 rounded-full">Most Popular</span>
              </div>
              <CardContent className="p-8">
                <div className="w-14 h-14 rounded-2xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mb-6">
                  <Rocket className="w-7 h-7 text-yellow-600" />
                </div>
                <h3 className="text-xl font-bold text-primary mb-1">Growth Accelerator</h3>
                <p className="text-3xl font-bold text-primary mb-4">$429<span className="text-base font-normal text-muted-foreground">/mo</span></p>
                <div className="space-y-3">
                  {[
                    { icon: Globe, text: "Google Business optimization" },
                    { icon: Star, text: "Review capture & management" },
                    { icon: MessageSquare, text: "SMS & email automation" },
                    { icon: Users, text: "CRM + AI chatbot" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <item.icon className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{item.text}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-border/50 shadow-sm" data-testid="card-tier-elite">
              <CardContent className="p-8">
                <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-6">
                  <Bot className="w-7 h-7 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-primary mb-1">Elite AI Revenue System</h3>
                <p className="text-3xl font-bold text-primary mb-4">$749<span className="text-base font-normal text-muted-foreground">/mo</span></p>
                <div className="space-y-3">
                  {[
                    { icon: Target, text: "AI-driven lead generation" },
                    { icon: Calendar, text: "Automated appointment booking" },
                    { icon: TrendingUp, text: "Conversion funnels" },
                    { icon: Search, text: "Competitive ad intelligence" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <item.icon className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{item.text}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Commission Decay Visualization */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold text-primary mb-4">
              Commission Decay: Built for Lifetime Residuals
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Our commission structure rewards upfront effort with aggressive initial payouts, 
              then transitions to structured residuals that pay you for the life of each account.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-border/50 shadow-sm" data-testid="card-decay-upfront">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-primary mb-2">Aggressive Upfront</h3>
                <p className="text-3xl font-bold text-emerald-600 mb-2">Months 1-3</p>
                <p className="text-muted-foreground">
                  Highest commission rates when you first place a subscription. 
                  Get rewarded immediately for your sales effort.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-border/50 shadow-sm" data-testid="card-decay-structured">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-8 h-8 text-yellow-600" />
                </div>
                <h3 className="text-xl font-bold text-primary mb-2">Structured Decay</h3>
                <p className="text-3xl font-bold text-yellow-600 mb-2">Months 4-12</p>
                <p className="text-muted-foreground">
                  Commissions gradually adjust as the account matures. 
                  Still earning meaningful residuals every month.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-border/50 shadow-sm" data-testid="card-decay-lifetime">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Repeat className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-primary mb-2">Lifetime Residual</h3>
                <p className="text-3xl font-bold text-primary mb-2">Month 13+</p>
                <p className="text-muted-foreground">
                  Settle into a lifetime residual rate. 
                  As you stack accounts, these residuals compound into substantial monthly income.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* MCA Commission Section */}
      <section id="mca" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold text-primary mb-4">
              MCA Commission Structure
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Transparent, performance-driven compensation from the Gross Broker Revenue (GBR) waterfall.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <h3 className="text-2xl font-bold text-primary mb-6">GBR Waterfall Allocation</h3>
              <div className="space-y-3">
                {[
                  { label: "MAC (Main Agent Commission)", value: "22%", color: "bg-emerald-500" },
                  { label: "Pairing Enhancement", value: "5%", color: "bg-yellow-500" },
                  { label: "Override Pool", value: "3%", color: "bg-blue-500" },
                  { label: "Company Operations", value: "Remainder", color: "bg-muted-foreground/30" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl" data-testid={`waterfall-item-${i}`}>
                    <div className={`w-3 h-3 rounded-full ${item.color} flex-shrink-0`} />
                    <span className="flex-1 text-foreground">{item.label}</span>
                    <span className="font-bold text-primary">{item.value}</span>
                  </div>
                ))}
              </div>
              
              <div className="mt-8">
                <h4 className="font-bold text-primary mb-3">MAC Splits</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex justify-between gap-2 p-3 bg-muted/30 rounded-lg">
                    <span>Primary Referring Agent (Opener)</span>
                    <span className="font-semibold text-foreground">22% of GBR</span>
                  </div>
                  <div className="flex justify-between gap-2 p-3 bg-muted/30 rounded-lg">
                    <span>Pairing Enhancement (if applicable)</span>
                    <span className="font-semibold text-foreground">+5% of GBR</span>
                  </div>
                  <div className="flex justify-between gap-2 p-3 bg-muted/30 rounded-lg">
                    <span>Override Pool (Sponsor levels)</span>
                    <span className="font-semibold text-foreground">3% of GBR</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-primary mb-6">Payout Mechanics</h3>
              <Card className="border-border/50 shadow-sm mb-6">
                <CardContent className="p-6">
                  <h4 className="font-bold text-primary mb-4">70/30 Payout Split</h4>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                        <DollarSign className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">70% Advance</p>
                        <p className="text-sm text-muted-foreground">Paid upfront when the deal funds</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">30% Reserve</p>
                        <p className="text-sm text-muted-foreground">Released upon successful merchant repayment</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardContent className="p-6">
                  <h4 className="font-bold text-primary mb-3">Quarterly Accelerators</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Hit quarterly volume targets and unlock accelerator bonuses that boost your 
                    commission rate on all deals for the following quarter.
                  </p>
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm font-semibold text-yellow-600">Performance rewards top producers</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Fees Section */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-4xl font-display font-bold text-primary mb-4">
            Platform Fee: $99/month
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Access the full Leadershield Network platform, training, deal management, 
            and commission tracking. Production waivers available for active agents.
          </p>
          <Card className="border-emerald-500/30 bg-emerald-500/5 max-w-lg mx-auto" data-testid="card-platform-fee">
            <CardContent className="p-8">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-primary mb-2">Active Agents Effectively Pay Nothing</h3>
              <p className="text-muted-foreground">
                Meet minimum production requirements and your monthly platform fee is waived. 
                Focus on selling — the platform pays for itself.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Compliance-First Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold text-primary mb-4">
              Compliance-First. Always.
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Leadershield Network is built on transparency, regulatory compliance, 
              and protecting both agents and merchants.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Lock, title: "Centralized Pricing", desc: "Consistent, fair pricing across all agents — no undercutting or inflated rates" },
              { icon: FileCheck, title: "Automated Disclosures", desc: "Compliant disclosures built into every deal for full transparency" },
              { icon: DollarSign, title: "Clear Compensation", desc: "No hidden fees or confusing structures — you know exactly what you earn" },
              { icon: Scale, title: "Regulatory Protection", desc: "Operating within all federal and state guidelines to protect your business" },
            ].map((item, i) => (
              <Card key={i} className="border-border/50 shadow-sm" data-testid={`compliance-card-${i}`}>
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    <item.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-bold text-primary mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Your First 30 Days */}
      <section id="get-started" className="py-20 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold text-primary mb-4">
              Your First 30 Days
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A clear, week-by-week roadmap to get you producing and earning from day one.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { 
                week: "Week 1", 
                title: "Foundation", 
                color: "bg-blue-100 dark:bg-blue-900/30",
                textColor: "text-blue-600",
                items: ["Complete onboarding training", "Set up your agent portal", "Learn the product offerings", "Shadow experienced agents"]
              },
              { 
                week: "Week 2", 
                title: "Activation", 
                color: "bg-emerald-100 dark:bg-emerald-900/30",
                textColor: "text-emerald-600",
                items: ["Make your first outreach calls", "Practice your pitch", "Identify target merchants", "Submit your first lead"]
              },
              { 
                week: "Week 3", 
                title: "Momentum", 
                color: "bg-yellow-100 dark:bg-yellow-900/30",
                textColor: "text-yellow-600",
                items: ["Follow up on active leads", "Close your first deal", "Pair MCA with platform sub", "Refine your process"]
              },
              { 
                week: "Week 4", 
                title: "Results", 
                color: "bg-purple-100 dark:bg-purple-900/30",
                textColor: "text-purple-600",
                items: ["Build your pipeline", "Start recruiting your team", "Review your first commissions", "Set monthly goals"]
              },
            ].map((item, i) => (
              <Card key={i} className="border-border/50 shadow-sm" data-testid={`roadmap-week-${i + 1}`}>
                <CardContent className="p-6">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${item.color} mb-4`}>
                    <span className={`text-sm font-bold ${item.textColor}`}>{item.week}</span>
                  </div>
                  <h3 className="text-lg font-bold text-primary mb-3">{item.title}</h3>
                  <div className="space-y-2">
                    {item.items.map((task, j) => (
                      <div key={j} className="flex items-start gap-2">
                        <CheckCircle2 className={`w-4 h-4 ${item.textColor} mt-0.5 flex-shrink-0`} />
                        <span className="text-sm text-muted-foreground">{task}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Income Projection */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold text-primary mb-4">
              Income Projection: Realistic Scenario
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              See how 4 subscriptions per month plus 1 MCA deal creates compounding growth.*
            </p>
          </div>
          
          <Card className="border-border/50 shadow-sm" data-testid="card-income-projection">
            <CardContent className="p-8">
              <div className="grid md:grid-cols-4 gap-6 mb-8">
                {[
                  { month: "Month 1", mca: "$2,200", platform: "$400", total: "$2,600" },
                  { month: "Month 3", mca: "$2,200", platform: "$1,100", total: "$3,300" },
                  { month: "Month 6", mca: "$2,200", platform: "$2,000", total: "$4,200" },
                  { month: "Month 12", mca: "$2,200", platform: "$3,500", total: "$5,700" },
                ].map((item, i) => (
                  <div key={i} className="text-center p-4 bg-muted/50 rounded-xl">
                    <p className="text-sm font-semibold text-muted-foreground mb-2">{item.month}</p>
                    <p className="text-2xl font-bold text-primary mb-1">{item.total}</p>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>MCA: {item.mca}</p>
                      <p>Platform: {item.platform}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                <TrendingUp className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">Compounding effect:</span> Platform subscriptions stack monthly. 
                  By month 12, your recurring revenue alone may exceed your MCA commissions — creating true passive income.*
                </p>
              </div>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            *This projection is an illustrative example only based on 4 new subscriptions/month at average tier pricing and 1 MCA deal/month. 
            Actual results depend on individual effort, sales ability, retention rates, and market conditions. 
            Leadershield Network makes no guarantees regarding income.
          </p>
        </div>
      </section>

      {/* Compensation Overview */}
      <section id="compensation" className="py-20 px-6 bg-primary text-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold mb-4">
              How You Earn
            </h2>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">
              A transparent, multi-stream compensation plan that rewards personal production 
              and team building.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { 
                icon: DollarSign, 
                title: "MCA Commission", 
                rate: "22% GBR",
                desc: "Immediate income on every funded MCA deal you refer"
              },
              { 
                icon: Repeat, 
                title: "Platform Residuals", 
                rate: "50-70% Pool",
                desc: "Monthly recurring commissions on every active subscription"
              },
              { 
                icon: Zap, 
                title: "Pairing Enhancement", 
                rate: "+5% Bonus",
                desc: "Extra commission when you pair MCA with a platform subscription"
              },
              { 
                icon: Users, 
                title: "Override Income", 
                rate: "3% Pool",
                desc: "Earn overrides on your team's production as a sponsor"
              },
            ].map((item, i) => (
              <Card key={i} className="bg-white/5 border-white/10 backdrop-blur">
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-7 h-7 text-yellow-400" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">{item.title}</h3>
                  <p className="text-2xl font-bold text-yellow-400 mb-2">{item.rate}</p>
                  <p className="text-sm text-white/60">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <Link href="/signup">
              <Button size="lg" className="h-14 px-8 text-base font-semibold bg-yellow-500 text-primary shadow-xl shadow-yellow-500/25">
                Start Your Journey Today
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
          
          <p className="text-xs text-white/40 text-center mt-8 max-w-3xl mx-auto">*Commission rates and bonus amounts shown represent potential earnings and are subject to qualification requirements. Actual earnings depend on individual effort, deal volume, team performance, and market conditions. Leadershield Network makes no guarantees regarding income.</p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-display font-bold text-primary mb-6">
            Ready to Build Your Recurring Revenue Empire?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join the Leadershield Network and start building two revenue streams — 
            immediate MCA commissions and compounding platform residuals. 
            No experience needed — we'll train you.
          </p>
          <Link href="/signup">
            <Button size="lg" className="h-14 px-10 text-base font-semibold bg-gradient-to-r from-primary to-primary/90 shadow-xl shadow-primary/25">
              Apply Now - It's Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Legal Disclaimers Section */}
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
              <p>This is a business opportunity, not a job offer. Before joining Leadershield Network, you should carefully review all materials and disclosures. Consult with a qualified financial or legal advisor if you have questions about the opportunity. Some states require additional disclosures for business opportunities. Please contact us for state-specific information.</p>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-1">Commission Structure Disclosure</h4>
              <p>Commission rates, residual percentages, and bonus structures described on this website are subject to the terms of the Leadershield Network Agent Agreement. Commission decay schedules, payout splits, and accelerator qualifications are detailed in the full compensation plan document provided during onboarding. Platform subscription commissions are based on the active commission pool allocation which may vary.</p>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-1">State and Federal Compliance</h4>
              <p>Leadershield Network operates in compliance with all applicable federal and state laws governing business opportunities and network marketing. Agents are required to comply with all applicable laws in their respective jurisdictions, including but not limited to FTC guidelines, state business opportunity laws, and securities regulations. The Merchant Cash Advance industry is regulated, and agents must comply with all applicable lending and financial services regulations.</p>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-1">Results Disclaimer</h4>
              <p>Testimonials and examples used on this website are exceptional results that are not typical and are not intended to be a representation, guarantee, or promise that others will achieve the same or similar results. Individual results will vary, and there is no assurance you will do as well. Each individual's success depends on their background, dedication, desire, and motivation.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="font-display font-bold text-primary">Leadershield Network</span>
            </div>
            
            <div className="flex items-center gap-6 flex-wrap text-sm text-muted-foreground">
              <a href="#platform" className="hover:text-primary transition-colors">Platform</a>
              <a href="#mca" className="hover:text-primary transition-colors">MCA</a>
              <a href="#compensation" className="hover:text-primary transition-colors">Compensation</a>
              <a href="#disclaimers" className="hover:text-primary transition-colors">Disclosures</a>
              <Link href="/login">
                <span className="hover:text-primary transition-colors cursor-pointer">Agent Portal</span>
              </Link>
            </div>
            
            <p className="text-sm text-muted-foreground">
              © 2026 Leadershield Network. All rights reserved.
            </p>
          </div>
          
          <div className="mt-8 pt-6 border-t border-border text-center">
            <p className="text-xs text-muted-foreground max-w-3xl mx-auto">
              Leadershield Network is a network marketing company operating in the Merchant Cash Advance and merchant services industries. Results vary by individual. This website and its content are for informational purposes only and do not constitute financial, legal, or tax advice. Please consult appropriate professionals before making any business decisions.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
