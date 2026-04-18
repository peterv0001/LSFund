import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { ArrowLeft, Loader2, Mail, CheckCircle2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const form = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(data: ForgotPasswordForm) {
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/auth/forgot-password", data);
      setSubmitted(true);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-primary shrink-0" />
          <span className="font-display font-bold text-primary text-xl tracking-wide">Leader Shield Network</span>
        </div>

        <div className="bg-card border border-border/50 shadow-xl shadow-black/5 rounded-2xl p-6 lg:p-8">
          {submitted ? (
            <div className="text-center space-y-4" data-testid="forgot-password-success">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-foreground" data-testid="text-success-title">Check your email</h2>
              <p className="text-sm text-muted-foreground" data-testid="text-success-message">
                If an account with that email exists, we've sent a password reset link. Please check your inbox and spam folder.
              </p>
              <div className="pt-4">
                <Link href="/login">
                  <Button variant="outline" className="w-full" data-testid="link-back-to-login">
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
                  <Mail className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground" data-testid="text-forgot-title">Forgot your password?</h2>
                <p className="text-sm text-muted-foreground">
                  Enter the email address associated with your account and we'll send you a link to reset your password.
                </p>
              </div>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="agent@leadershield.com"
                    className="h-12"
                    data-testid="input-forgot-email"
                    {...form.register("email")}
                  />
                  {form.formState.errors.email && (
                    <p className="text-xs text-destructive" data-testid="text-email-error">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold"
                  disabled={isSubmitting}
                  data-testid="button-send-reset"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                  Send Reset Link
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
