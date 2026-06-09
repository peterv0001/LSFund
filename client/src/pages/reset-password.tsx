import { useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BrandLockup } from "@/components/BrandMark";

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  usePageMeta(
    "Reset Password | Leader Shield Funding",
    "Create a new password for your Leader Shield Funding agent portal account.",
  );
  const [status, setStatus] = useState<"form" | "success" | "error">("form");
  const [errorMessage, setErrorMessage] = useState("");
  const { toast } = useToast();

  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get("token");

  const form = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(data: ResetPasswordForm) {
    if (!token) {
      setErrorMessage("Missing reset token. Please use the link from your email.");
      setStatus("error");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/auth/reset-password", {
        token,
        newPassword: data.newPassword,
      });
      setStatus("success");
    } catch (err: any) {
      setErrorMessage(err.message || "Something went wrong. Please try again.");
      setStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="flex items-center justify-center mb-4">
            <BrandLockup size="md" />
          </div>
          <div className="bg-card border border-border/50 shadow-xl shadow-black/5 rounded-2xl p-6 lg:p-8 text-center space-y-4" data-testid="reset-invalid-token">
            <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Invalid Reset Link</h2>
            <p className="text-sm text-muted-foreground">
              This password reset link is invalid. Please request a new one.
            </p>
            <div className="pt-4 space-y-2">
              <Link href="/forgot-password">
                <Button className="w-full bg-gradient-to-r from-[#C9A24B] to-[#A07B22] text-[#0A1628] hover:from-[#E0C27E] hover:to-[#C9A24B]" data-testid="link-request-new-reset">
                  Request New Reset Link
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="w-full" data-testid="link-back-to-login-invalid">
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
          {status === "success" ? (
            <div className="text-center space-y-4" data-testid="reset-success">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-foreground" data-testid="text-reset-success-title">Password Reset!</h2>
              <p className="text-sm text-muted-foreground" data-testid="text-reset-success-message">
                Your password has been reset successfully. You can now sign in with your new password.
              </p>
              <div className="pt-4">
                <Link href="/login">
                  <Button className="w-full bg-gradient-to-r from-[#C9A24B] to-[#A07B22] text-[#0A1628] hover:from-[#E0C27E] hover:to-[#C9A24B] shadow-lg shadow-[#C9A24B]/20" data-testid="link-go-to-login">
                    Sign In Now
                  </Button>
                </Link>
              </div>
            </div>
          ) : status === "error" ? (
            <div className="text-center space-y-4" data-testid="reset-error">
              <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-2xl font-bold text-foreground" data-testid="text-reset-error-title">Reset Failed</h2>
              <p className="text-sm text-muted-foreground" data-testid="text-reset-error-message">{errorMessage}</p>
              <div className="pt-4 space-y-2">
                <Link href="/forgot-password">
                  <Button className="w-full bg-gradient-to-r from-[#C9A24B] to-[#A07B22] text-[#0A1628] hover:from-[#E0C27E] hover:to-[#C9A24B]" data-testid="link-try-again">
                    Request New Reset Link
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline" className="w-full" data-testid="link-back-to-login-error">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <Lock className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground" data-testid="text-reset-title">Set new password</h2>
                <p className="text-sm text-muted-foreground">
                  Enter your new password below. Make sure it's at least 8 characters.
                </p>
              </div>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    className="h-12"
                    data-testid="input-new-password"
                    {...form.register("newPassword")}
                  />
                  {form.formState.errors.newPassword && (
                    <p className="text-xs text-destructive" data-testid="text-new-password-error">
                      {form.formState.errors.newPassword.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    className="h-12"
                    data-testid="input-confirm-password"
                    {...form.register("confirmPassword")}
                  />
                  {form.formState.errors.confirmPassword && (
                    <p className="text-xs text-destructive" data-testid="text-confirm-password-error">
                      {form.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-[#C9A24B] to-[#A07B22] text-[#0A1628] hover:from-[#E0C27E] hover:to-[#C9A24B] shadow-lg shadow-[#C9A24B]/20"
                  disabled={isSubmitting}
                  data-testid="button-reset-password"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                  Reset Password
                </Button>
              </form>

              <div className="text-center">
                <Link href="/login" className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1" data-testid="link-back-to-login-form">
                  <ArrowLeft className="w-3 h-3" />
                  Back to Sign In
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
