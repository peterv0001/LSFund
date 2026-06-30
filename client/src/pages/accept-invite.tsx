import { useEffect, useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { ArrowLeft, Loader2, AlertCircle, Lock, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { BrandLockup } from "@/components/BrandMark";

const acceptSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    legalConsent: z.literal(true, {
      errorMap: () => ({ message: "You must accept the terms to continue" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type AcceptForm = z.infer<typeof acceptSchema>;

type Preview = {
  firstName: string;
  lastName: string;
  email: string;
  inviterName: string;
};

export default function AcceptInvitePage() {
  usePageMeta(
    "Accept Invitation | LeaderShield Funding",
    "Accept your invitation to join LeaderShield Funding.",
  );
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<AcceptForm>({
    resolver: zodResolver(acceptSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
      legalConsent: false as unknown as true,
    },
  });

  useEffect(() => {
    let active = true;
    async function lookup() {
      if (!token) {
        setLookupError("Missing invitation token. Please use the link from your email.");
        setLoading(false);
        return;
      }
      try {
        const path = api.invitations.lookup.path.replace(":token", encodeURIComponent(token));
        const res = await fetch(path, { credentials: "include" });
        const body = await res.json();
        if (!active) return;
        if (!res.ok) {
          setLookupError(body.message || "This invitation link is invalid.");
        } else {
          setPreview(body);
        }
      } catch {
        if (active) setLookupError("Something went wrong. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    }
    lookup();
    return () => {
      active = false;
    };
  }, [token]);

  async function onSubmit(data: AcceptForm) {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch(api.invitations.accept.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          token,
          password: data.password,
          legalConsent: data.legalConsent,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || "Could not accept the invitation.");
      }
      queryClient.setQueryData([api.auth.me.path], body);
      toast({
        title: "Welcome aboard!",
        description: "Your account is ready.",
      });
      setLocation("/dashboard");
    } catch (err: any) {
      toast({
        title: "Couldn't complete sign up",
        description: err.message?.replace(/^\d+:\s*/, "") || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (lookupError || !preview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="flex items-center justify-center mb-4">
            <BrandLockup size="md" />
          </div>
          <div
            className="bg-card border border-border/50 shadow-xl shadow-black/5 rounded-2xl p-6 lg:p-8 text-center space-y-4"
            data-testid="invite-invalid"
          >
            <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Invitation Unavailable</h2>
            <p className="text-sm text-muted-foreground" data-testid="text-invite-error">
              {lookupError || "This invitation link is invalid."}
            </p>
            <div className="pt-4 space-y-2">
              <Link href="/signup">
                <Button className="w-full bg-gradient-to-r from-[#C9A24B] to-[#A07B22] text-[#0A1628] hover:from-[#E0C27E] hover:to-[#C9A24B]" data-testid="link-signup-instead">
                  Sign Up Without an Invite
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="w-full" data-testid="link-back-to-login">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="flex items-center justify-center mb-4">
          <BrandLockup size="md" />
        </div>

        <div className="bg-card border border-border/50 shadow-xl shadow-black/5 rounded-2xl p-6 lg:p-8">
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <UserPlus className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground" data-testid="text-invite-title">
                Join {preview.inviterName}'s team
              </h2>
              <p className="text-sm text-muted-foreground">
                Hi {preview.firstName}, set a password to finish creating your account.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={preview.email}
                disabled
                className="h-12 bg-muted/50"
                data-testid="input-invite-email-locked"
              />
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  className="h-12"
                  data-testid="input-accept-password"
                  {...form.register("password")}
                />
                {form.formState.errors.password && (
                  <p className="text-xs text-destructive" data-testid="error-accept-password">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  className="h-12"
                  data-testid="input-accept-confirm-password"
                  {...form.register("confirmPassword")}
                />
                {form.formState.errors.confirmPassword && (
                  <p className="text-xs text-destructive" data-testid="error-accept-confirm-password">
                    {form.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <div className="flex items-start gap-3 pt-1">
                <Checkbox
                  id="legalConsent"
                  checked={form.watch("legalConsent")}
                  onCheckedChange={(checked) =>
                    form.setValue("legalConsent", (checked === true) as true, { shouldValidate: true })
                  }
                  data-testid="checkbox-accept-consent"
                />
                <Label htmlFor="legalConsent" className="text-xs text-muted-foreground leading-relaxed font-normal">
                  I agree to the{" "}
                  <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>,{" "}
                  <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>, and{" "}
                  <Link href="/income-disclosure" className="text-primary hover:underline">Income Disclosure</Link>.
                </Label>
              </div>
              {form.formState.errors.legalConsent && (
                <p className="text-xs text-destructive" data-testid="error-accept-consent">
                  {form.formState.errors.legalConsent.message as string}
                </p>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-[#C9A24B] to-[#A07B22] text-[#0A1628] hover:from-[#E0C27E] hover:to-[#C9A24B] shadow-lg shadow-[#C9A24B]/20"
                disabled={submitting}
                data-testid="button-accept-invite"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Lock className="w-5 h-5 mr-2" />}
                Create Account & Join
              </Button>
            </form>

            <div className="text-center">
              <Link href="/login" className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1" data-testid="link-accept-back-to-login">
                <ArrowLeft className="w-3 h-3" />
                Already have an account? Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
