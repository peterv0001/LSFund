import { useState, useEffect } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@shared/routes";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { ArrowRight, Loader2, CheckCircle2, Search, X, ChevronDown, Star, Zap, DollarSign, Repeat, Users } from "lucide-react";
import { BrandLockup } from "@/components/BrandMark";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

type SponsorOption = {
  id: number;
  firstName: string;
  lastName: string;
  maskedEmail: string;
  referralCode: string | null;
};

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const { login, register, isLoggingIn, isRegistering } = useAuth();
  const [location] = useLocation();
  usePageMeta(
    isLogin ? "Agent Sign In | Leader Shield Funding" : "Create Agent Account | Leader Shield Funding",
    isLogin
      ? "Sign in to your Leader Shield Funding agent portal to manage deals, track commissions, and grow your team."
      : "Join Leader Shield Funding as an agent. Earn multi-tiered commissions on MCA deals and Merchant Growth Platform subscriptions.",
  );

  const searchParams = new URLSearchParams(window.location.search);
  const referralCode = searchParams.get("ref");

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left Panel - Immersive Hero */}
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden bg-gradient-to-br from-[#0A1628] via-[#0f1f3a] to-[#0A1628]">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-white/3 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-white/3 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(10,22,40,0.6)_70%)]" />

        <div className="relative z-10">
          <Link href="/" data-testid="link-logo-auth" className="mb-16 hover:opacity-90 transition-opacity w-fit block">
            <BrandLockup size="md" onDark />
          </Link>

          <h2 className="text-5xl font-display font-bold text-white leading-tight mb-6">
            Build Your
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#E0C27E] to-white/70">
              Financial Legacy
            </span>
          </h2>
          <p className="text-lg text-white/50 max-w-md leading-relaxed mb-10">
            Two revenue streams. No ceiling on your income. Join the platform that's transforming agents into long-term merchant partners.
          </p>

          <div className="space-y-3">
            {[
              { icon: DollarSign, text: "22% MCA commission on every funded deal", color: "text-emerald-400" },
              { icon: Repeat, text: "50-70% recurring subscription commissions", color: "text-blue-400" },
              { icon: Zap, text: "+5% pairing enhancement bonus", color: "text-[#E0C27E]" },
              { icon: Users, text: "Override income from your team", color: "text-purple-400" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <span className="text-white/60 text-sm">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <div className="grid grid-cols-3 gap-6 p-6 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">$200B+</p>
              <p className="text-xs text-white/40 mt-1">Industry Size</p>
            </div>
            <div className="text-center border-x border-white/10">
              <p className="text-2xl font-bold text-white">70%</p>
              <p className="text-xs text-white/40 mt-1">Max Commission</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">48hr</p>
              <p className="text-xs text-white/40 mt-1">Avg Funding</p>
            </div>
          </div>
          <p className="text-xs text-white/20 mt-3 text-center">*Individual results vary. No income guarantees.</p>
        </div>
      </div>

      {/* Right Panel - Forms */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile branding */}
          <div className="lg:hidden flex items-center justify-center mb-4">
            <Link href="/" data-testid="link-logo-auth-mobile" className="hover:opacity-90 transition-opacity">
              <BrandLockup size="md" showTagline={false} />
            </Link>
          </div>

          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              {isLogin ? "Welcome back" : "Create your account"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {isLogin
                ? "Sign in to access your agent dashboard"
                : "Start building your financial legacy today"}
            </p>
          </div>

          <div className="bg-card border border-border/50 shadow-xl shadow-black/5 rounded-2xl p-6 lg:p-8">
            <AnimatePresence mode="wait">
              {isLogin ? (
                <LoginForm key="login" onSubmit={login} isLoading={isLoggingIn} onToggle={() => setIsLogin(false)} />
              ) : (
                <RegisterForm
                  key="register"
                  onSubmit={register}
                  isLoading={isRegistering}
                  onToggle={() => setIsLogin(true)}
                  referralCode={referralCode}
                />
              )}
            </AnimatePresence>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Need help? Contact{" "}
            <a href="mailto:support@leadershieldfunding.com" className="text-primary hover:underline">support@leadershieldfunding.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginForm({ onSubmit, isLoading, onToggle }: {
  onSubmit: any,
  isLoading: boolean,
  onToggle: () => void
}) {
  const { toast } = useToast();
  const form = useForm({
    resolver: zodResolver(api.auth.login.input),
  });

  const handleLogin = async (data: any) => {
    try {
      await onSubmit(data);
    } catch (err: any) {
      toast({
        title: "Sign in failed",
        description: err?.message || "Invalid email or password. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      onSubmit={form.handleSubmit(handleLogin)}
      className="space-y-5"
    >
      <div className="space-y-2">
        <Label htmlFor="username">Email Address</Label>
        <Input
          id="username"
          type="email"
          placeholder="agent@leadershieldfunding.com"
          className="h-12"
          {...form.register("username")}
        />
        {form.formState.errors.username && (
          <p className="text-xs text-destructive">{form.formState.errors.username.message as string}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline" data-testid="link-forgot-password">Forgot password?</Link>
        </div>
        <Input
          id="password"
          type="password"
          className="h-12"
          {...form.register("password")}
        />
        {form.formState.errors.password && (
          <p className="text-xs text-destructive">{form.formState.errors.password.message as string}</p>
        )}
      </div>

      <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={isLoading}>
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
        Sign In
      </Button>

      <div className="text-center text-sm">
        <span className="text-muted-foreground">Don't have an account? </span>
        <button type="button" onClick={onToggle} className="font-semibold text-primary hover:underline">
          Apply Now
        </button>
      </div>
    </motion.form>
  );
}

function RegisterForm({ onSubmit, isLoading, onToggle, referralCode }: {
  onSubmit: any,
  isLoading: boolean,
  onToggle: () => void,
  referralCode?: string | null
}) {
  const { toast } = useToast();
  const [sponsorSearch, setSponsorSearch] = useState("");
  const [selectedSponsor, setSelectedSponsor] = useState<SponsorOption | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [referralLocked, setReferralLocked] = useState(!!referralCode);

  const registerSchema = api.auth.register.input.extend({
    legalConsent: z.literal(true, {
      errorMap: () => ({ message: "You must agree to the Terms of Service, Privacy Policy, and review the Income Disclosure Statement" }),
    }),
  });

  const form = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      referralCode: referralCode || "",
      sponsorId: undefined as number | undefined,
      placementLeg: "auto" as const,
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
      legalConsent: false as unknown as true,
    }
  });

  useEffect(() => {
    if (referralCode) {
      fetch(`/api/sponsors/search?q=${encodeURIComponent(referralCode)}`)
        .then(res => res.json())
        .then((sponsors: SponsorOption[]) => {
          const match = sponsors.find(s => s.referralCode === referralCode);
          if (match) {
            setSelectedSponsor(match);
            form.setValue("sponsorId", match.id);
            form.setValue("referralCode", "");
            setReferralLocked(true);
          }
        })
        .catch(console.error);
    }
  }, [referralCode]);

  const { data: sponsors = [], isLoading: isLoadingSponsors } = useQuery<SponsorOption[]>({
    queryKey: ['/api/sponsors/search', sponsorSearch],
    queryFn: async () => {
      const response = await fetch(`/api/sponsors/search?q=${encodeURIComponent(sponsorSearch)}`);
      if (!response.ok) throw new Error('Failed to fetch sponsors');
      return response.json();
    },
    enabled: showDropdown,
  });

  const handleSelectSponsor = (sponsor: SponsorOption) => {
    setSelectedSponsor(sponsor);
    form.setValue("sponsorId", sponsor.id);
    form.setValue("referralCode", "");
    setShowDropdown(false);
    setSponsorSearch("");
  };

  const handleClearSponsor = () => {
    setSelectedSponsor(null);
    form.setValue("sponsorId", undefined);
    setSponsorSearch("");
  };

  return (
    <motion.form
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      onSubmit={form.handleSubmit(async ({ legalConsent, ...data }) => {
        try {
          await onSubmit(data);
        } catch (err: any) {
          toast({
            title: "Registration failed",
            description: err?.message || "Something went wrong. Please try again.",
            variant: "destructive",
          });
        }
      })}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>First Name</Label>
          <Input {...form.register("firstName")} data-testid="input-first-name" />
        </div>
        <div className="space-y-2">
          <Label>Last Name</Label>
          <Input {...form.register("lastName")} data-testid="input-last-name" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Email</Label>
        <Input type="email" {...form.register("email")} data-testid="input-email" />
      </div>

      <div className="space-y-2">
        <Label>Phone</Label>
        <Input type="tel" {...form.register("phone")} data-testid="input-phone" />
      </div>

      <div className="space-y-2">
        <Label>Password</Label>
        <Input type="password" {...form.register("password")} data-testid="input-password" />
      </div>

      <div className="pt-2 border-t border-border">
        <h4 className="text-sm font-medium mb-3">Who Referred You?</h4>
        <div className="space-y-3">
          {selectedSponsor ? (
            <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg text-sm border border-primary/20">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-primary">
                  <strong>{selectedSponsor.firstName} {selectedSponsor.lastName}</strong>
                  <span className="text-muted-foreground ml-2">({selectedSponsor.maskedEmail})</span>
                </span>
              </div>
              <button
                type="button"
                onClick={handleClearSponsor}
                className="text-muted-foreground hover:text-foreground"
                data-testid="button-clear-sponsor"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : referralCode ? (
            <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg text-sm text-primary">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Sponsor Code Applied: <strong>{referralCode}</strong></span>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search for your referring agent..."
                  value={sponsorSearch}
                  onChange={(e) => setSponsorSearch(e.target.value)}
                  onFocus={() => setShowDropdown(true)}
                  className="pl-9 pr-9"
                  data-testid="input-sponsor-search"
                />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>

              {showDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-60 overflow-auto">
                  {isLoadingSponsors ? (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                      Loading agents...
                    </div>
                  ) : sponsors.length === 0 ? (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      No agents found. Try a different search.
                    </div>
                  ) : (
                    sponsors.map((sponsor) => (
                      <button
                        key={sponsor.id}
                        type="button"
                        onClick={() => handleSelectSponsor(sponsor)}
                        className="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b border-border last:border-0"
                        data-testid={`sponsor-option-${sponsor.id}`}
                      >
                        <div className="font-medium text-sm">
                          {sponsor.firstName} {sponsor.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {sponsor.maskedEmail}
                        </div>
                      </button>
                    ))
                  )}
                  <button
                    type="button"
                    onClick={() => setShowDropdown(false)}
                    className="w-full text-center py-2 text-xs text-muted-foreground hover:bg-muted border-t border-border"
                    data-testid="button-close-dropdown"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium">Placement Preference</h4>
        <RadioGroup
          defaultValue="auto"
          onValueChange={(val) => form.setValue("placementLeg", val as any)}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="auto" id="auto" />
            <Label htmlFor="auto" className="font-normal">Auto-Balance</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="left" id="left" />
            <Label htmlFor="left" className="font-normal">Left Leg</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="right" id="right" />
            <Label htmlFor="right" className="font-normal">Right Leg</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-2 pt-2">
        <div className="flex items-start gap-3">
          <Checkbox
            id="legalConsent"
            checked={form.watch("legalConsent")}
            onCheckedChange={(checked) => form.setValue("legalConsent", checked === true as any, { shouldValidate: true })}
            data-testid="checkbox-legal-consent"
          />
          <label htmlFor="legalConsent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
            I have read and agree to the{" "}
            <Link href="/terms" className="text-primary hover:underline font-medium" data-testid="link-terms">Terms of Service</Link>,{" "}
            <Link href="/privacy" className="text-primary hover:underline font-medium" data-testid="link-privacy">Privacy Policy</Link>, and have reviewed the{" "}
            <Link href="/income-disclosure" className="text-primary hover:underline font-medium" data-testid="link-income-disclosure">Income Disclosure Statement</Link>.
          </label>
        </div>
        {form.formState.errors.legalConsent && (
          <p className="text-xs text-destructive" data-testid="text-legal-consent-error">{form.formState.errors.legalConsent.message as string}</p>
        )}
      </div>

      <Button type="submit" className="w-full h-12 text-base font-semibold mt-4" disabled={isLoading} data-testid="button-create-account">
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
        Create Account
      </Button>

      <div className="text-center text-sm">
        <span className="text-muted-foreground">Already an agent? </span>
        <button type="button" onClick={onToggle} className="font-semibold text-primary hover:underline">
          Sign In
        </button>
      </div>
    </motion.form>
  );
}
