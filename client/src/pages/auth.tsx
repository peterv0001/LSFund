import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@shared/routes";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Building, ArrowRight, Loader2, CheckCircle2, Search, X, ChevronDown } from "lucide-react";
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
  
  // Parse referral code from URL
  const searchParams = new URLSearchParams(window.location.search);
  const referralCode = searchParams.get("ref");

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left Panel - Hero */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-primary relative overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-yellow-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/20">
              <Building className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-display font-bold text-white tracking-wide">PSL Capital</h1>
          </div>

          <h2 className="text-5xl font-display font-bold text-white leading-tight mb-6">
            Build Your <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-200">Financial Legacy</span>
          </h2>
          <p className="text-lg text-white/60 max-w-md leading-relaxed">
            Join the fastest growing network of elite financial professionals. 
            Scale your team, amplify your earnings, and secure your future.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-8">
          <div>
            <h3 className="text-3xl font-bold text-white mb-1">12k+</h3>
            <p className="text-white/40 text-sm">Active Agents</p>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-white mb-1">$450M</h3>
            <p className="text-white/40 text-sm">Deal Volume</p>
          </div>
        </div>
      </div>

      {/* Right Panel - Forms */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              {isLogin ? "Welcome back" : "Create your account"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {isLogin 
                ? "Enter your credentials to access your dashboard" 
                : "Start your journey with PSL Capital today"}
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
  const form = useForm({
    resolver: zodResolver(api.auth.login.input),
  });

  return (
    <motion.form 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      onSubmit={form.handleSubmit(onSubmit)} 
      className="space-y-5"
    >
      <div className="space-y-2">
        <Label htmlFor="username">Email Address</Label>
        <Input 
          id="username" 
          type="email" 
          placeholder="agent@psl.capital" 
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
          <a href="#" className="text-xs font-medium text-primary hover:underline">Forgot password?</a>
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
  const [sponsorSearch, setSponsorSearch] = useState("");
  const [selectedSponsor, setSelectedSponsor] = useState<SponsorOption | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [referralLocked, setReferralLocked] = useState(!!referralCode);

  const form = useForm({
    resolver: zodResolver(api.auth.register.input),
    defaultValues: {
      referralCode: referralCode || "",
      sponsorId: undefined as number | undefined,
      placementLeg: "auto" as const,
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
    }
  });

  // Auto-lookup sponsor when referral code is provided via URL
  useEffect(() => {
    if (referralCode) {
      fetch(`/api/sponsors/search?q=${encodeURIComponent(referralCode)}`)
        .then(res => res.json())
        .then((sponsors: SponsorOption[]) => {
          // Find exact match by referralCode
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
      onSubmit={form.handleSubmit(onSubmit)} 
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
