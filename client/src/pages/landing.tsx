import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Building, 
  DollarSign, 
  Users, 
  TrendingUp, 
  CheckCircle2, 
  ArrowRight,
  BarChart3,
  Shield,
  Zap,
  Star,
  ChevronRight
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/20">
              <Building className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-primary">PSL Capital</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#about-mca" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">About MCA</a>
            <a href="#opportunity" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Opportunity</a>
            <a href="#compensation" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Compensation</a>
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
                <span className="text-sm font-medium text-yellow-600">Join 12,000+ Successful Agents</span>
              </div>
              
              <h1 className="text-5xl lg:text-6xl font-display font-bold text-primary leading-tight mb-6">
                Build Your <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-yellow-600">Financial Empire</span>
              </h1>
              
              <p className="text-lg text-muted-foreground mb-8 max-w-lg">
                Partner with PSL Capital and unlock unlimited earning potential in the $200B+ 
                Merchant Cash Advance industry. No experience required.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <Link href="/signup">
                  <Button size="lg" className="h-14 px-8 text-base font-semibold bg-gradient-to-r from-primary to-primary/90 shadow-xl shadow-primary/25" data-testid="button-get-started">
                    Get Started Today
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <a href="#opportunity">
                  <Button size="lg" variant="outline" className="h-14 px-8 text-base font-semibold">
                    Learn More
                  </Button>
                </a>
              </div>
              
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-3xl font-bold text-primary">$450M+</p>
                  <p className="text-sm text-muted-foreground">Funded Volume</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-primary">12k+</p>
                  <p className="text-sm text-muted-foreground">Active Agents</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-primary">60%</p>
                  <p className="text-sm text-muted-foreground">Max Commission</p>
                </div>
              </div>
            </div>
            
            <div className="relative hidden lg:block">
              <div className="absolute inset-0 bg-gradient-to-br from-primary to-slate-900 rounded-3xl transform rotate-3 scale-105 opacity-10" />
              <Card className="relative bg-gradient-to-br from-primary to-slate-900 rounded-3xl p-8 text-white shadow-2xl">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
                <h3 className="text-2xl font-display font-bold mb-6">Your Earning Potential</h3>
                
                <div className="space-y-4 mb-8">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                    <span className="text-white/60">Personal Commissions</span>
                    <span className="font-bold text-yellow-400">40-60%</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                    <span className="text-white/60">Binary Bonus</span>
                    <span className="font-bold text-yellow-400">Up to $25k/week</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                    <span className="text-white/60">Generation Override</span>
                    <span className="font-bold text-yellow-400">4 Levels Deep</span>
                  </div>
                </div>
                
                <Link href="/signup">
                  <Button className="w-full h-12 bg-yellow-500 hover:bg-yellow-400 text-primary font-semibold">
                    Start Earning Now
                  </Button>
                </Link>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* About MCA Section */}
      <section id="about-mca" className="py-20 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold text-primary mb-4">
              What is Merchant Cash Advance?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              MCA is a financial solution that provides businesses with fast access to working capital. 
              It's a $200+ billion industry with explosive growth potential.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-white border-border/50 shadow-sm hover:shadow-lg transition-shadow">
              <CardContent className="p-8">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                  <Zap className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-primary mb-3">Fast Funding</h3>
                <p className="text-muted-foreground">
                  Businesses get approved and funded within 24-48 hours. 
                  No lengthy bank processes or perfect credit required.
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-white border-border/50 shadow-sm hover:shadow-lg transition-shadow">
              <CardContent className="p-8">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mb-6">
                  <DollarSign className="w-7 h-7 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-primary mb-3">High Demand</h3>
                <p className="text-muted-foreground">
                  Over 30 million small businesses in the US alone. 
                  Most are underserved by traditional banks and need alternative funding.
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-white border-border/50 shadow-sm hover:shadow-lg transition-shadow">
              <CardContent className="p-8">
                <div className="w-14 h-14 rounded-2xl bg-yellow-100 flex items-center justify-center mb-6">
                  <BarChart3 className="w-7 h-7 text-yellow-600" />
                </div>
                <h3 className="text-xl font-bold text-primary mb-3">Recurring Revenue</h3>
                <p className="text-muted-foreground">
                  Businesses often return for additional funding as they grow. 
                  Build lasting relationships and recurring commissions.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Opportunity Section */}
      <section id="opportunity" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-display font-bold text-primary mb-6">
                Why Partner with PSL Capital?
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                We provide everything you need to succeed—training, support, technology, 
                and one of the most lucrative compensation plans in the industry.
              </p>
              
              <div className="space-y-6">
                {[
                  { title: "No Experience Required", desc: "Complete training and ongoing support from industry experts" },
                  { title: "Work From Anywhere", desc: "Build your business on your own schedule, from anywhere in the world" },
                  { title: "Unlimited Income Potential", desc: "The more you work and grow your team, the more you earn" },
                  { title: "Cutting-Edge Technology", desc: "Our platform handles everything—deals, commissions, and team management" },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-primary">{item.title}</h4>
                      <p className="text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-muted to-muted/50 rounded-3xl p-8">
              <h3 className="text-2xl font-bold text-primary mb-6">Income Examples</h3>
              <div className="space-y-4">
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-primary">Part-Time Agent</span>
                    <span className="text-2xl font-bold text-emerald-600">$3-5k/mo</span>
                  </div>
                  <p className="text-sm text-muted-foreground">2-3 deals per month</p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-primary">Full-Time Builder</span>
                    <span className="text-2xl font-bold text-emerald-600">$10-20k/mo</span>
                  </div>
                  <p className="text-sm text-muted-foreground">5-8 deals + small team</p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-yellow-400">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-primary">Team Leader</span>
                    <span className="text-2xl font-bold text-emerald-600">$50k+/mo</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Active team + binary bonus</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Compensation Section */}
      <section id="compensation" className="py-20 px-6 bg-primary text-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold mb-4">
              4 Ways to Earn
            </h2>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">
              Our multi-tier compensation plan rewards you for your personal production 
              and for building a successful team.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { 
                icon: DollarSign, 
                title: "Personal Commission", 
                rate: "40-60%",
                desc: "Earn on every deal you close based on your rank"
              },
              { 
                icon: Users, 
                title: "Binary Bonus", 
                rate: "Up to $25k/wk",
                desc: "Weekly bonus based on your team's weaker leg volume"
              },
              { 
                icon: TrendingUp, 
                title: "Generation Override", 
                rate: "5-20%",
                desc: "Earn overrides on your team's commissions 4 levels deep"
              },
              { 
                icon: Shield, 
                title: "Leadership Pool", 
                rate: "Bonus",
                desc: "Top leaders share in company-wide profit distributions"
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
              <Button size="lg" className="h-14 px-8 text-base font-semibold bg-yellow-500 hover:bg-yellow-400 text-primary shadow-xl shadow-yellow-500/25">
                Start Your Journey Today
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-display font-bold text-primary mb-6">
            Ready to Take Control of Your Financial Future?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of successful agents who have transformed their lives with PSL Capital. 
            No experience needed—we'll teach you everything.
          </p>
          <Link href="/signup">
            <Button size="lg" className="h-14 px-10 text-base font-semibold bg-gradient-to-r from-primary to-primary/90 shadow-xl shadow-primary/25">
              Apply Now - It's Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                <Building className="w-4 h-4 text-white" />
              </div>
              <span className="font-display font-bold text-primary">PSL Capital</span>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#about-mca" className="hover:text-primary transition-colors">About MCA</a>
              <a href="#opportunity" className="hover:text-primary transition-colors">Opportunity</a>
              <a href="#compensation" className="hover:text-primary transition-colors">Compensation</a>
              <Link href="/login">
                <span className="hover:text-primary transition-colors cursor-pointer">Agent Portal</span>
              </Link>
            </div>
            
            <p className="text-sm text-muted-foreground">
              © 2025 PSL Capital. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
