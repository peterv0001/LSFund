import { useEffect, useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { CheckCircle2, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/BrandMark";

type Status = "verifying" | "success" | "error";

export default function VerifyEmailPage() {
  usePageMeta(
    "Verify Email | LeaderShield Funding",
    "Confirm your email address to activate your LeaderShield Funding agent account.",
  );
  const queryClient = useQueryClient();

  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get("token");

  const [status, setStatus] = useState<Status>("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function verify() {
      if (!token) {
        if (active) {
          setStatus("error");
          setMessage("This verification link is missing its token. Please use the link from your email.");
        }
        return;
      }
      try {
        const path = api.auth.verifyEmail.path.replace(":token", encodeURIComponent(token));
        const res = await fetch(path, { credentials: "include" });
        const body = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) {
          setStatus("error");
          setMessage(body.message || "This verification link is invalid or has expired.");
        } else {
          setStatus("success");
          setMessage(body.message || "Your email address has been verified.");
          queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
          queryClient.invalidateQueries({ queryKey: [api.agents.onboarding.path] });
        }
      } catch {
        if (active) {
          setStatus("error");
          setMessage("Something went wrong while verifying your email. Please try again.");
        }
      }
    }
    verify();
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="flex items-center justify-center mb-4">
          <BrandLockup size="md" />
        </div>

        <div
          className="bg-card border border-border/50 shadow-xl shadow-black/5 rounded-2xl p-6 lg:p-8 text-center space-y-4"
          data-testid="verify-email-card"
        >
          {status === "verifying" && (
            <>
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Verifying your email…</h2>
              <p className="text-sm text-muted-foreground" data-testid="text-verify-status">
                Hang tight while we confirm your email address.
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-[#1C8A5B]" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Email verified</h2>
              <p className="text-sm text-muted-foreground" data-testid="text-verify-status">
                {message}
              </p>
              <div className="pt-4">
                <Link href="/dashboard">
                  <Button
                    className="w-full bg-gradient-to-r from-[#C9A24B] to-[#A07B22] text-[#0A1628] hover:from-[#E0C27E] hover:to-[#C9A24B]"
                    data-testid="link-go-dashboard"
                  >
                    Go to your dashboard
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Verification failed</h2>
              <p className="text-sm text-muted-foreground" data-testid="text-verify-status">
                {message}
              </p>
              <div className="pt-4 space-y-2">
                <Link href="/dashboard">
                  <Button variant="outline" className="w-full" data-testid="link-dashboard-resend">
                    Go to dashboard to resend
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="ghost" className="w-full" data-testid="link-verify-login">
                    Back to sign in
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
