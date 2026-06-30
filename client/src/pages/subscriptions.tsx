import { useState, useEffect, useRef } from "react";
import { useSearch, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sidebar } from "@/components/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, RefreshCw, TrendingDown, Info, MoreVertical, Pause, Play, XCircle, History, ChevronDown, ChevronUp, AlertTriangle, Activity, ChevronLeft, ChevronRight, CreditCard, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInMonths } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { loadStripe, type Stripe as StripeType } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { getActionStyle, ACTION_STYLES, getActorBadge } from "@/lib/action-styles";

// === Types ===

type ActivityLogEntry = {
  id: number;
  action: string;
  description: string | null;
  createdAt: string;
  actorType: string | null;
  actorName: string | null;
};

type Subscription = {
  id: number;
  agentId: number;
  merchantName: string;
  merchantEmail: string | null;
  tier: "tier_1" | "tier_2" | "tier_3" | "tier_4";
  monthlyAmount: string;
  status: "active" | "paused" | "cancelled" | "expired";
  mcaPairedDealId: number | null;
  startDate: string;
  endDate: string | null;
  cancelledAt: string | null;
  pausedAt: string | null;
  reactivatedAt: string | null;
  reactivatedById: number | null;
  reactivatedByName: string | null;
  pausedById: number | null;
  pausedByName: string | null;
  cancelledById: number | null;
  cancelledByName: string | null;
  billingStatus: "pending" | "active" | "past_due" | "failed" | "cancelled" | null;
  stripeSubscriptionId: string | null;
  cardLast4: string | null;
  cardBrand: string | null;
  lastChargedAt: string | null;
  nextBillingDate: string | null;
  createdAt: string;
};

type Deal = {
  id: number;
  merchantName: string;
  status: string;
};

// === Constants ===

const TIER_LABELS: Record<string, string> = {
  tier_1: "Starter — $149/mo",
  tier_2: "Growth Foundation — $497/mo",
  tier_3: "Revenue Growth System — $997/mo",
  tier_4: "Revenue Scale AI — $1,497/mo",
};

const TIER_PRICES: Record<string, number> = {
  tier_1: 149,
  tier_2: 497,
  tier_3: 997,
  tier_4: 1497,
};

const POOL_RATES: Record<string, number> = {
  tier_1: 0.25,
  tier_2: 0.35,
  tier_3: 0.45,
  tier_4: 0.50,
};

const DECAY_SCHEDULE = [
  { label: "Month 1–3", months: 1, rate: 1.00 },
  { label: "Month 4–6", months: 4, rate: 0.75 },
  { label: "Month 7–9", months: 7, rate: 0.50 },
  { label: "Month 10–12", months: 10, rate: 0.25 },
  { label: "Month 13+", months: 13, rate: 0.10 },
];

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700 border-green-200",
  paused: "bg-yellow-100 text-yellow-700 border-yellow-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
  expired: "bg-gray-100 text-gray-500 border-gray-200",
};

// === Helpers ===

function getMonthsActive(startDate: string): number {
  return Math.max(0, differenceInMonths(new Date(), new Date(startDate)));
}

function getDecayRate(months: number): number {
  if (months < 3) return 1.00;
  if (months < 6) return 0.75;
  if (months < 9) return 0.50;
  if (months < 12) return 0.25;
  return 0.10;
}

function getEstimatedCommission(sub: Subscription): number {
  const months = getMonthsActive(sub.startDate);
  const poolRate = POOL_RATES[sub.tier] ?? 0.25;
  const decay = getDecayRate(months);
  const bonus = sub.mcaPairedDealId && months < 3 ? 0.05 : 0;
  return Number(sub.monthlyAmount) * (poolRate * decay + bonus);
}

// === Form Schema ===

const logSubscriptionSchema = z.object({
  merchantName: z.string().min(2, "Merchant name must be at least 2 characters"),
  merchantEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  tier: z.enum(["tier_1", "tier_2", "tier_3", "tier_4"], { required_error: "Please select a tier" }),
  startDate: z.string().min(1, "Start date is required"),
  pairedWithDeal: z.boolean().default(false),
  mcaPairedDealId: z.number().optional(),
});

type LogSubscriptionInput = z.infer<typeof logSubscriptionSchema>;

// === Stripe Provider ===

let stripePromise: ReturnType<typeof loadStripe> | null = null;

function useStripePublishableKey() {
  const { data } = useQuery<{ publishableKey: string }>({
    queryKey: ["/api/stripe/publishable-key"],
  });
  return data?.publishableKey ?? null;
}

function StripeProvider({ children }: { children: React.ReactNode }) {
  const publishableKey = useStripePublishableKey();
  const [stripe, setStripe] = useState<ReturnType<typeof loadStripe> | null>(null);

  useEffect(() => {
    if (publishableKey && !stripePromise) {
      stripePromise = loadStripe(publishableKey);
    }
    if (publishableKey) {
      setStripe(stripePromise);
    }
  }, [publishableKey]);

  return <Elements stripe={stripe}>{children}</Elements>;
}

// === Log Subscription Dialog ===

function LogSubscriptionDialogInner({ deals, onClose }: { deals: Deal[]; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const stripe = useStripe();
  const elements = useElements();
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);

  const form = useForm<LogSubscriptionInput>({
    resolver: zodResolver(logSubscriptionSchema),
    defaultValues: {
      merchantName: "",
      merchantEmail: "",
      tier: undefined,
      startDate: new Date().toISOString().split("T")[0],
      pairedWithDeal: false,
      mcaPairedDealId: undefined,
    },
  });

  const pairedWithDeal = form.watch("pairedWithDeal");
  const selectedTier = form.watch("tier");

  const mutation = useMutation({
    mutationFn: async (data: LogSubscriptionInput) => {
      let paymentMethodId: string | undefined;

      if (stripe && elements) {
        const cardElement = elements.getElement(CardElement);
        if (cardElement) {
          const { error, paymentMethod } = await stripe.createPaymentMethod({
            type: "card",
            card: cardElement,
            billing_details: {
              name: data.merchantName,
              email: data.merchantEmail || undefined,
            },
          });
          if (error) {
            throw new Error(error.message);
          }
          paymentMethodId = paymentMethod?.id;
        }
      }

      const payload: Record<string, unknown> = {
        merchantName: data.merchantName,
        merchantEmail: data.merchantEmail || undefined,
        tier: data.tier,
        startDate: new Date(data.startDate).toISOString(),
        mcaPairedDealId: data.pairedWithDeal ? data.mcaPairedDealId : undefined,
        paymentMethodId,
      };
      const res = await apiRequest("POST", "/api/subscriptions", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      toast({ title: "Subscription logged successfully" });
      form.reset();
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: err.message || "Failed to log subscription", variant: "destructive" });
    },
  });

  const fundedDeals = deals.filter((d) => d.status === "funded");

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => {
          if (data.pairedWithDeal && !data.mcaPairedDealId) {
            form.setError("mcaPairedDealId", {
              type: "manual",
              message: "Please select a funded deal to pair with this subscription",
            });
            return;
          }
          mutation.mutate(data);
        })}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="merchantName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Merchant Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Acme Corp"
                  data-testid="input-merchant-name"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="merchantEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Merchant Email (optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="merchant@example.com"
                  type="email"
                  data-testid="input-merchant-email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tier"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Subscription Tier</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-tier">
                    <SelectValue placeholder="Select a tier" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="tier_1" data-testid="option-tier-1">
                    Starter — $149/mo
                  </SelectItem>
                  <SelectItem value="tier_2" data-testid="option-tier-2">
                    Growth Foundation — $497/mo
                  </SelectItem>
                  <SelectItem value="tier_3" data-testid="option-tier-3">
                    Revenue Growth System — $997/mo
                  </SelectItem>
                  <SelectItem value="tier_4" data-testid="option-tier-4">
                    Revenue Scale AI — $1,497/mo
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedTier && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700">
            Monthly amount: <strong>${TIER_PRICES[selectedTier]}</strong> — Pool rate:{" "}
            <strong>{(POOL_RATES[selectedTier] * 100).toFixed(0)}%</strong>
          </div>
        )}

        <FormField
          control={form.control}
          name="startDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Start Date</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  data-testid="input-start-date"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="pairedWithDeal"
          render={({ field }) => (
            <FormItem className="flex items-center gap-3 space-y-0">
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="switch-paired-deal"
                />
              </FormControl>
              <FormLabel className="font-normal cursor-pointer">
                Paired with a funded MCA deal (+5% bonus for first 3 months)
              </FormLabel>
            </FormItem>
          )}
        />

        {pairedWithDeal && (
          <FormField
            control={form.control}
            name="mcaPairedDealId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Select Funded Deal</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(Number(v))}
                  value={field.value?.toString()}
                >
                  <FormControl>
                    <SelectTrigger data-testid="select-paired-deal">
                      <SelectValue placeholder="Choose a deal..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {fundedDeals.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        No funded deals available
                      </SelectItem>
                    ) : (
                      fundedDeals.map((d) => (
                        <SelectItem key={d.id} value={d.id.toString()}>
                          #{d.id} — {d.merchantName}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {stripe && (
          <div>
            <label className="text-sm font-medium leading-none mb-1.5 block">
              Credit Card (Merchant Billing)
            </label>
            <div
              className="rounded-md border border-input px-3 py-2.5 bg-background"
              data-testid="stripe-card-element"
            >
              <CardElement
                options={{
                  style: {
                    base: {
                      fontSize: "14px",
                      color: "hsl(var(--foreground))",
                      "::placeholder": { color: "hsl(var(--muted-foreground))" },
                    },
                  },
                }}
                onChange={(e) => {
                  setCardError(e.error?.message ?? null);
                  setCardComplete(e.complete);
                }}
              />
            </div>
            {cardError && <p className="text-sm text-destructive mt-1">{cardError}</p>}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            data-testid="button-cancel-subscription"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={mutation.isPending}
            data-testid="button-submit-subscription"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Log Subscription
          </Button>
        </div>
      </form>
    </Form>
  );
}

function LogSubscriptionDialog({ deals }: { deals: Deal[] }) {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="button-log-subscription">
          <Plus className="w-4 h-4 mr-2" />
          Log New Subscription
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-log-subscription">
        <DialogHeader>
          <DialogTitle>Log New Merchant Subscription</DialogTitle>
        </DialogHeader>
        <StripeProvider>
          <LogSubscriptionDialogInner deals={deals} onClose={() => setOpen(false)} />
        </StripeProvider>
      </DialogContent>
    </Dialog>
  );
}

// === Update Card Dialog ===

type CardUpdateResult =
  | { success: true; usedExistingCard: boolean }
  | { success: false; message: string };

function translateDeclineCode(code: string | null): string {
  const map: Record<string, string> = {
    insufficient_funds: "Your card has insufficient funds. Please use a different card.",
    card_declined: "Your card was declined. Please try a different card.",
    expired_card: "Your card is expired. Please use a card with a valid expiry date.",
    incorrect_cvc: "The security code (CVC) was incorrect. Please double-check and try again.",
    incorrect_number: "The card number is incorrect. Please check and try again.",
    processing_error: "A processing error occurred. Please try again in a moment.",
    do_not_honor: "Your bank declined the payment. Please contact your bank or use a different card.",
    lost_card: "This card has been reported lost. Please use a different card.",
    stolen_card: "This card has been reported stolen. Please use a different card.",
    fraudulent: "This transaction was flagged as fraudulent by your bank. Please contact your bank.",
    generic_decline: "Your card was declined. Please contact your bank or use a different card.",
  };
  if (!code) return "Your card was declined. Please try a different card.";
  return map[code] ?? "Your card was declined. Please try a different card or contact your bank.";
}

function UpdateCardDialogInner({ subId, cardLast4, cardBrand, onClose }: { subId: number; cardLast4: string | null; cardBrand: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const stripe = useStripe();
  const elements = useElements();
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [submitResult, setSubmitResult] = useState<CardUpdateResult | null>(null);

  const hasCardOnFile = Boolean(cardLast4);

  const handleResult = (data: Subscription & { declineCode: string | null }, usedExistingCard: boolean) => {
    if (data.billingStatus === "active") {
      queryClient.setQueryData<Subscription[]>(["/api/subscriptions"], (old) =>
        old?.map((s) => s.id === subId ? { ...s, ...data } : s) ?? old
      );
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      setSubmitResult({ success: true, usedExistingCard });
      setTimeout(() => onClose(), 1800);
    } else {
      const message = translateDeclineCode(data.declineCode);
      setSubmitResult({ success: false, message });
    }
  };

  const handleError = (err: Error) => {
    setSubmitResult({ success: false, message: err.message || "Failed to update card. Please try again." });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!stripe || !elements) throw new Error("Stripe not initialized");
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error("Card element not found");

      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card: cardElement,
      });
      if (error) throw new Error(error.message);
      if (!paymentMethod) throw new Error("Failed to create payment method");

      const res = await apiRequest("PATCH", `/api/subscriptions/${subId}/payment-method`, {
        paymentMethodId: paymentMethod.id,
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to update card");
      }
      return res.json() as Promise<Subscription & { declineCode: string | null }>;
    },
    onSuccess: (data) => handleResult(data, false),
    onError: handleError,
  });

  const retryMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/subscriptions/${subId}/payment-method`, {});
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to retry payment");
      }
      return res.json() as Promise<Subscription & { declineCode: string | null }>;
    },
    onSuccess: (data) => handleResult(data, true),
    onError: handleError,
  });

  const isBusy = mutation.isPending || retryMutation.isPending;

  if (!stripe || !elements) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading payment form…</span>
      </div>
    );
  }

  if (submitResult?.success) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3 text-center" data-testid="update-card-success">
        <CheckCircle2 className="w-10 h-10 text-green-500" />
        <p className="font-semibold text-foreground">Payment successful!</p>
        <p className="text-sm text-muted-foreground">
          {submitResult.usedExistingCard
            ? "The outstanding payment was collected with your card on file. Commissions will resume shortly."
            : "Your card has been updated and the outstanding payment was collected. Commissions will resume shortly."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Retry the outstanding payment with the card on file, or enter a new card.
      </p>
      {submitResult && !submitResult.success && (
        <div
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5"
          data-testid="update-card-error-message"
        >
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{submitResult.message}</p>
        </div>
      )}
      {hasCardOnFile && (
        <div className="space-y-2 rounded-md border border-input bg-muted/30 px-3 py-3" data-testid="retry-existing-card-section">
          <div className="flex items-center gap-2 text-sm">
            <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
            <span data-testid="text-card-on-file">
              {cardBrand ? cardBrand.charAt(0).toUpperCase() + cardBrand.slice(1) : "Card"} •••• {cardLast4}
            </span>
          </div>
          <Button
            className="w-full"
            variant="secondary"
            onClick={() => { setSubmitResult(null); retryMutation.mutate(); }}
            disabled={isBusy}
            data-testid="button-retry-existing-card"
          >
            {retryMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Retry with existing card
          </Button>
        </div>
      )}
      {hasCardOnFile && (
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground uppercase tracking-wide">or use a new card</span>
          <div className="h-px flex-1 bg-border" />
        </div>
      )}
      <div>
        <label className="text-sm font-medium leading-none mb-1.5 block">New Card Details</label>
        <div
          className="rounded-md border border-input px-3 py-2.5 bg-background"
          data-testid="update-card-element"
        >
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: "14px",
                  color: "hsl(var(--foreground))",
                  "::placeholder": { color: "hsl(var(--muted-foreground))" },
                },
              },
            }}
            onChange={(e) => {
              setCardError(e.error?.message ?? null);
              setCardComplete(e.complete);
            }}
          />
        </div>
        {cardError && <p className="text-sm text-destructive mt-1">{cardError}</p>}
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose} data-testid="button-cancel-update-card">
          Cancel
        </Button>
        <Button
          onClick={() => { setSubmitResult(null); mutation.mutate(); }}
          disabled={isBusy || !cardComplete}
          data-testid="button-submit-update-card"
        >
          {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {submitResult && !submitResult.success ? "Try Again" : "Update Card & Retry"}
        </Button>
      </div>
    </div>
  );
}

function UpdateCardDialog({ subId, cardLast4, cardBrand, open, onOpenChange }: { subId: number; cardLast4: string | null; cardBrand: string | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-update-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Update Payment Method
          </DialogTitle>
        </DialogHeader>
        <StripeProvider>
          <UpdateCardDialogInner subId={subId} cardLast4={cardLast4} cardBrand={cardBrand} onClose={() => onOpenChange(false)} />
        </StripeProvider>
      </DialogContent>
    </Dialog>
  );
}

// === Subscription History Timeline ===

function SubscriptionHistoryTimeline({ subId }: { subId: number }) {
  const { data: logs = [], isLoading } = useQuery<ActivityLogEntry[]>({
    queryKey: ["/api/subscriptions", subId, "history"],
    queryFn: async () => {
      const res = await fetch(`/api/subscriptions/${subId}/history`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load history");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2 pt-2" data-testid={`history-loading-${subId}`}>
        {[1, 2].map((i) => (
          <div key={i} className="flex items-start gap-2">
            <Skeleton className="w-2 h-2 rounded-full mt-1.5 shrink-0" />
            <div className="space-y-1 flex-1">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground pt-2 italic" data-testid={`history-empty-${subId}`}>
        No history recorded yet.
      </p>
    );
  }

  return (
    <div>
      <div
        className="flex flex-wrap gap-x-3 gap-y-1 pb-2 pt-1"
        data-testid={`history-legend-${subId}`}
      >
        {Object.entries(ACTION_STYLES).map(([key, style]) => (
          <span
            key={key}
            className="flex items-center gap-1"
            data-testid={`legend-entry-${key}`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
            <span className="text-[10px] text-muted-foreground">{style.label}</span>
          </span>
        ))}
      </div>
      <ol className="space-y-2" data-testid={`history-list-${subId}`}>
        {logs.map((log) => {
        const style = getActionStyle(log.action);
        return (
          <li key={log.id} className="flex items-start gap-2.5" data-testid={`history-entry-${log.id}`}>
            <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${style.dot}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium ${style.color}`}>
                {log.description || log.action}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm a")}
                {log.actorName && (
                  <span className="ml-1">
                    <span className="text-muted-foreground">by {log.actorName}</span>
                    {(() => {
                      const actorBadge = getActorBadge(log.actorType);
                      return actorBadge ? (
                        <Badge
                          variant="outline"
                          className={`ml-1 text-[10px] px-1 py-0 h-auto ${actorBadge.className}`}
                          data-testid={`badge-history-actortype-${log.id}`}
                        >
                          {actorBadge.label}
                        </Badge>
                      ) : null;
                    })()}
                  </span>
                )}
              </p>
            </div>
          </li>
        );
      })}
      </ol>
    </div>
  );
}

// === Decay Schedule Visualization ===

function DecayScheduleBar({ sub }: { sub: Subscription }) {
  const months = getMonthsActive(sub.startDate);
  const poolRate = POOL_RATES[sub.tier] ?? 0.25;

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
        <TrendingDown className="w-3 h-3" />
        Decay Schedule
      </p>
      <div className="flex gap-1">
        {DECAY_SCHEDULE.map((step) => {
          const isCurrent =
            step.months <= months + 1 &&
            (DECAY_SCHEDULE.indexOf(step) === DECAY_SCHEDULE.length - 1 ||
              months < DECAY_SCHEDULE[DECAY_SCHEDULE.indexOf(step) + 1].months);
          const commPct = (poolRate * step.rate * 100).toFixed(0);
          return (
            <div
              key={step.label}
              className={`flex-1 rounded p-1.5 text-center transition-colors ${
                isCurrent
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-400"
              }`}
              data-testid={`decay-step-${step.months}`}
            >
              <div className="text-[9px] font-medium leading-none mb-0.5">
                {step.label}
              </div>
              <div className="text-[11px] font-bold">{commPct}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// === Subscription Card ===

function SubscriptionCard({ sub }: { sub: Subscription }) {
  const months = getMonthsActive(sub.startDate);
  const decay = getDecayRate(months);
  const estimatedComm = getEstimatedCommission(sub);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [updateCardOpen, setUpdateCardOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const statusMutation = useMutation({
    mutationFn: async (status: "paused" | "cancelled" | "active") => {
      const res = await apiRequest("PATCH", `/api/subscriptions/${sub.id}/status`, { status });
      return res.json();
    },
    onSuccess: (_data, status) => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions", sub.id, "history"] });
      const labels: Record<string, string> = {
        paused: "Subscription paused",
        cancelled: "Subscription cancelled",
        active: "Subscription reactivated",
      };
      toast({ title: labels[status] || "Subscription updated" });
    },
    onError: (err: Error) => {
      toast({ title: err.message || "Failed to update subscription", variant: "destructive" });
    },
  });

  const isEditable = sub.status !== "cancelled" && sub.status !== "expired";

  return (
    <>
    <UpdateCardDialog subId={sub.id} cardLast4={sub.cardLast4} cardBrand={sub.cardBrand} open={updateCardOpen} onOpenChange={setUpdateCardOpen} />
    <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
          <AlertDialogDescription>
            This will cancel the subscription for <strong>{sub.merchantName}</strong>. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid={`button-cancel-dialog-cancel-${sub.id}`}>Keep subscription</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={() => statusMutation.mutate("cancelled")}
            data-testid={`button-cancel-dialog-confirm-${sub.id}`}
          >
            Yes, cancel it
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <div
      className={`bg-white rounded-2xl border shadow-sm p-6 hover:shadow-md transition-shadow ${
        sub.status === "expired"
          ? "border-red-300 bg-red-50/30"
          : "border-border"
      }`}
      data-testid={`card-subscription-${sub.id}`}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="font-semibold text-primary text-base" data-testid={`text-merchant-name-${sub.id}`}>
            {sub.merchantName}
          </h3>
          {sub.merchantEmail && (
            <p className="text-sm text-muted-foreground">{sub.merchantEmail}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex flex-col items-end gap-1">
            <Badge className={`text-xs border ${STATUS_COLORS[sub.status]}`} data-testid={`badge-status-${sub.id}`}>
              {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              #{sub.id}
            </span>
          </div>
          {isEditable && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  disabled={statusMutation.isPending}
                  data-testid={`button-subscription-actions-${sub.id}`}
                >
                  {statusMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MoreVertical className="w-4 h-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {sub.status === "active" && (
                  <DropdownMenuItem
                    onClick={() => statusMutation.mutate("paused")}
                    data-testid={`menu-pause-${sub.id}`}
                  >
                    <Pause className="w-4 h-4 mr-2 text-yellow-500" />
                    Pause subscription
                  </DropdownMenuItem>
                )}
                {sub.status === "paused" && (
                  <DropdownMenuItem
                    onClick={() => statusMutation.mutate("active")}
                    data-testid={`menu-reactivate-${sub.id}`}
                  >
                    <Play className="w-4 h-4 mr-2 text-green-500" />
                    Reactivate subscription
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={() => setCancelDialogOpen(true)}
                  data-testid={`menu-cancel-${sub.id}`}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancel subscription
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-1">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Tier</p>
          <p className="text-sm font-medium" data-testid={`text-tier-${sub.id}`}>
            {sub.tier === "tier_1" ? "Tier 1" : sub.tier === "tier_2" ? "Tier 2" : "Tier 3"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Monthly</p>
          <p className="text-sm font-semibold text-emerald-600" data-testid={`text-monthly-${sub.id}`}>
            ${Number(sub.monthlyAmount).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Active</p>
          <p className="text-sm font-medium" data-testid={`text-months-active-${sub.id}`}>
            {months} mo
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Commission Est.</p>
          <p className="text-sm font-semibold text-purple-600" data-testid={`text-estimated-commission-${sub.id}`}>
            ${estimatedComm.toFixed(2)}/mo
          </p>
        </div>
      </div>

      {sub.mcaPairedDealId && (
        <div className="flex items-center gap-1 mt-2 text-xs text-amber-600">
          <Info className="w-3 h-3" />
          Paired with MCA Deal #{sub.mcaPairedDealId}
          {months < 3 && <span className="ml-1 text-green-600 font-medium">(+5% bonus active)</span>}
        </div>
      )}

      {sub.billingStatus === "past_due" || sub.billingStatus === "failed" ? (
        <div
          className="flex items-center gap-2 mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700"
          data-testid={`banner-payment-failed-${sub.id}`}
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1">
            <strong>Payment {sub.billingStatus === "past_due" ? "past due" : "failed"}.</strong> Commissions are paused until billing is resolved.
          </span>
          {sub.stripeSubscriptionId && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2 border-red-300 text-red-700 hover:bg-red-100 shrink-0"
              onClick={() => setUpdateCardOpen(true)}
              data-testid={`button-update-card-${sub.id}`}
            >
              <CreditCard className="w-3 h-3 mr-1" />
              Update Card
            </Button>
          )}
        </div>
      ) : null}

      <div className="flex items-center gap-2 flex-wrap mt-2">
        {sub.billingStatus && (
          <Badge
            variant="outline"
            className={`text-[10px] px-2 py-0.5 ${
              sub.billingStatus === "active"
                ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                : sub.billingStatus === "past_due" || sub.billingStatus === "failed"
                ? "border-red-300 text-red-700 bg-red-50"
                : sub.billingStatus === "pending"
                ? "border-yellow-300 text-yellow-700 bg-yellow-50"
                : "border-gray-300 text-gray-600"
            }`}
            data-testid={`badge-billing-status-${sub.id}`}
          >
            Billing: {sub.billingStatus === "past_due" ? "Past Due" : sub.billingStatus.charAt(0).toUpperCase() + sub.billingStatus.slice(1)}
          </Badge>
        )}
        {sub.cardLast4 && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground" data-testid={`text-card-info-${sub.id}`}>
            <CreditCard className="w-3 h-3" />
            <span>{sub.cardBrand ? sub.cardBrand.charAt(0).toUpperCase() + sub.cardBrand.slice(1) : "Card"} •••• {sub.cardLast4}</span>
          </div>
        )}
        {sub.nextBillingDate && (
          <span className="text-[10px] text-muted-foreground" data-testid={`text-next-billing-${sub.id}`}>
            Next charge: {format(new Date(sub.nextBillingDate), "MMM d, yyyy")}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <span>Started {format(new Date(sub.startDate), "MMM d, yyyy")}</span>
        <span className="font-medium text-gray-600">Decay: {(decay * 100).toFixed(0)}%</span>
      </div>

      {sub.endDate && sub.status !== "cancelled" && sub.status !== "expired" && (() => {
        const endDate = new Date(sub.endDate);
        const now = new Date();
        const endOfDayInSevenDays = new Date(now);
        endOfDayInSevenDays.setDate(endOfDayInSevenDays.getDate() + 7);
        endOfDayInSevenDays.setHours(23, 59, 59, 999);
        const isExpiringSoon = endDate >= now && endDate <= endOfDayInSevenDays;
        return isExpiringSoon ? (
          <div
            className="flex items-start gap-2 mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800"
            data-testid={`banner-expiring-soon-${sub.id}`}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500 mt-0.5" />
            <span>
              <strong>Expiring soon:</strong> this subscription expires on{" "}
              {format(endDate, "MMM d, yyyy")}. Contact your admin to extend or renew it.
            </span>
          </div>
        ) : (
          <p className="mt-1 text-xs text-orange-600 font-medium" data-testid={`text-expires-on-${sub.id}`}>
            Scheduled to expire on {format(endDate, "MMM d, yyyy")}
          </p>
        );
      })()}

      {sub.status === "paused" && sub.pausedAt && (
        <p className="mt-1 text-xs text-yellow-600 font-medium" data-testid={`text-paused-since-${sub.id}`}>
          Paused since {format(new Date(sub.pausedAt), "MMM d, yyyy")}
          {sub.pausedByName ? (
            <span className="ml-1" data-testid={`text-paused-by-${sub.id}`}>by {sub.pausedByName}</span>
          ) : sub.pausedById ? (
            <span className="ml-1" data-testid={`text-paused-by-${sub.id}`}>by Admin</span>
          ) : null}
        </p>
      )}

      {sub.status === "cancelled" && sub.cancelledAt && (
        <p className="mt-1 text-xs text-red-600 font-medium" data-testid={`text-cancelled-on-${sub.id}`}>
          Cancelled on {format(new Date(sub.cancelledAt), "MMM d, yyyy")}
          {sub.cancelledByName ? (
            <span className="ml-1" data-testid={`text-cancelled-by-${sub.id}`}>by {sub.cancelledByName}</span>
          ) : sub.cancelledById ? (
            <span className="ml-1" data-testid={`text-cancelled-by-${sub.id}`}>by Admin</span>
          ) : null}
        </p>
      )}

      {sub.status === "active" && sub.reactivatedAt && (
        <p className="mt-1 text-xs text-green-600 font-medium" data-testid={`text-reactivated-on-${sub.id}`}>
          Reactivated on {format(new Date(sub.reactivatedAt), "MMM d, yyyy")}
          {sub.reactivatedByName ? (
            <span className="ml-1" data-testid={`text-reactivated-by-${sub.id}`}>by {sub.reactivatedByName}</span>
          ) : sub.reactivatedById ? (
            <span className="ml-1" data-testid={`text-reactivated-by-${sub.id}`}>by Admin</span>
          ) : null}
        </p>
      )}

      <DecayScheduleBar sub={sub} />

      <div className="mt-3 pt-3 border-t border-gray-100">
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors w-full text-left"
          onClick={() => setHistoryOpen((prev) => !prev)}
          data-testid={`button-toggle-history-${sub.id}`}
          aria-expanded={historyOpen}
        >
          <History className="w-3 h-3" />
          <span className="font-medium">Subscription History</span>
          {historyOpen ? (
            <ChevronUp className="w-3 h-3 ml-auto" />
          ) : (
            <ChevronDown className="w-3 h-3 ml-auto" />
          )}
        </button>
        {historyOpen && (
          <div data-testid={`history-panel-${sub.id}`}>
            <SubscriptionHistoryTimeline subId={sub.id} />
          </div>
        )}
      </div>
    </div>
    </>
  );
}

// === All Activity Timeline ===

type AllActivityEntry = {
  id: number;
  action: string;
  description: string | null;
  createdAt: string;
  actorType: string | null;
  entityId: number | null;
  merchantName: string | null;
};

type AllActivityResponse = {
  logs: AllActivityEntry[];
  total: number;
  page: number;
  pageSize: number;
};

const ACTION_OPTIONS = [
  { value: "create", label: "Created" },
  { value: "pause", label: "Paused" },
  { value: "cancel", label: "Cancelled" },
  { value: "reactivate", label: "Reactivated" },
];

function AllActivityTimeline({ subscriptions }: { subscriptions: Subscription[] }) {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const pageSize = 20;

  const searchParams = new URLSearchParams(search);
  const page = Math.max(1, parseInt(searchParams.get("actPage") ?? "1", 10) || 1);
  const subscriptionId = searchParams.get("actSub") ?? "all";
  const action = searchParams.get("actAction") ?? "all";
  const actSearch = searchParams.get("actSearch") ?? "";

  const updateUrl = (updates: { actPage?: string; actSub?: string; actAction?: string; actSearch?: string }) => {
    const next = new URLSearchParams(search);
    if (updates.actPage !== undefined) {
      if (updates.actPage === "1") next.delete("actPage");
      else next.set("actPage", updates.actPage);
    }
    if (updates.actSub !== undefined) {
      if (updates.actSub === "all") next.delete("actSub");
      else next.set("actSub", updates.actSub);
    }
    if (updates.actAction !== undefined) {
      if (updates.actAction === "all") next.delete("actAction");
      else next.set("actAction", updates.actAction);
    }
    if (updates.actSearch !== undefined) {
      if (!updates.actSearch.trim()) next.delete("actSearch");
      else next.set("actSearch", updates.actSearch.trim());
    }
    const qs = next.toString();
    setLocation(qs ? `?${qs}` : window.location.pathname, { replace: true });
  };

  const [searchInput, setSearchInput] = useState(actSearch);
  const isMounted = useRef(false);

  useEffect(() => {
    setSearchInput(actSearch);
  }, [actSearch]);

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    if (searchInput === actSearch) return;
    const timer = setTimeout(() => {
      updateUrl({ actSearch: searchInput, actPage: "1" });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, search, actSearch]);

  const buildUrl = () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (subscriptionId !== "all") params.set("subscriptionId", subscriptionId);
    if (action !== "all") params.set("action", action);
    if (actSearch.trim()) params.set("search", actSearch.trim());
    return `/api/subscriptions/history?${params.toString()}`;
  };

  const { data, isLoading, isError, refetch } = useQuery<AllActivityResponse>({
    queryKey: ["/api/subscriptions/history", page, subscriptionId, action, actSearch],
    queryFn: async () => {
      const res = await fetch(buildUrl(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load activity");
      return res.json();
    },
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const handleSubscriptionChange = (value: string) => {
    updateUrl({ actSub: value, actPage: "1" });
  };

  const handleActionChange = (value: string) => {
    updateUrl({ actAction: value, actPage: "1" });
  };

  const filtersActive = subscriptionId !== "all" || action !== "all" || actSearch.trim() !== "";

  const filterBar = (
    <div className="flex flex-wrap gap-3 mb-5" data-testid="activity-filter-bar">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground font-medium">Search</label>
        <Input
          className="h-8 text-sm w-52"
          placeholder="Search activity..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          data-testid="input-activity-search"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground font-medium">Subscription</label>
        <Select value={subscriptionId} onValueChange={handleSubscriptionChange}>
          <SelectTrigger className="h-8 text-sm w-52" data-testid="select-filter-subscription">
            <SelectValue placeholder="All subscriptions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subscriptions</SelectItem>
            {subscriptions.map((s) => (
              <SelectItem key={s.id} value={String(s.id)} data-testid={`filter-sub-option-${s.id}`}>
                {s.merchantName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground font-medium">Action type</label>
        <Select value={action} onValueChange={handleActionChange}>
          <SelectTrigger className="h-8 text-sm w-44" data-testid="select-filter-action">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {ACTION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} data-testid={`filter-action-option-${opt.value}`}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {filtersActive && (
        <div className="flex flex-col justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => updateUrl({ actSub: "all", actAction: "all", actSearch: "", actPage: "1" })}
            data-testid="button-clear-activity-filters"
          >
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );

  if (isError) {
    return (
      <div>
        {filterBar}
        <div className="text-center py-10" data-testid="all-activity-error">
          <p className="text-sm text-red-600 font-medium mb-2">Could not load activity history.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-activity-retry">
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        {filterBar}
        <div className="space-y-3" data-testid="all-activity-loading">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
              <Skeleton className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div>
        {filterBar}
        <div className="text-center py-12" data-testid="all-activity-empty">
          <Activity className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            {filtersActive ? "No activity matches the selected filters." : "No subscription activity yet."}
          </p>
          {!filtersActive && (
            <p className="text-muted-foreground/60 text-xs mt-1">Changes to your subscriptions will appear here.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div data-testid="all-activity-timeline">
      {filterBar}
      <ol className="divide-y divide-gray-100">
        {logs.map((log) => {
          const style = getActionStyle(log.action);
          return (
            <li key={log.id} className="flex items-start gap-3 py-3.5" data-testid={`activity-entry-${log.id}`}>
              <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${style.dot}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${style.color}`}>
                  {log.description || log.action}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {log.merchantName && (
                    <span className="text-xs text-muted-foreground font-medium">
                      {log.merchantName}
                    </span>
                  )}
                  {log.merchantName && <span className="text-xs text-muted-foreground/40">·</span>}
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm a")}
                  </span>
                  {log.actorType === "admin" && (
                    <span className="text-xs text-purple-500">(by admin)</span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-2" data-testid="activity-pagination">
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages} — {total} total events
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page <= 1}
              onClick={() => updateUrl({ actPage: String(page - 1) })}
              data-testid="button-activity-prev"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page >= totalPages}
              onClick={() => updateUrl({ actPage: String(page + 1) })}
              data-testid="button-activity-next"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// === Main Page ===

export default function SubscriptionsPage() {
  const { data: subscriptions = [], isLoading } = useQuery<Subscription[]>({
    queryKey: ["/api/subscriptions"],
  });

  const { data: deals = [] } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
  });

  const activeCount = subscriptions.filter((s) => s.status === "active").length;
  const expiredCount = subscriptions.filter((s) => s.status === "expired").length;
  const mrr = subscriptions
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + Number(s.monthlyAmount), 0);
  const totalEstComm = subscriptions
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + getEstimatedCommission(s), 0);

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar />
      <main className="flex-1 lg:ml-64 p-4 pt-20 lg:pt-8 lg:p-8">
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-primary flex items-center gap-2" data-testid="text-subscriptions-title">
              <RefreshCw className="w-7 h-7 text-yellow-500" />
              Subscriptions
            </h1>
            <p className="text-muted-foreground mt-1">
              Merchant Growth Platform subscriptions and your commission breakdown.
            </p>
          </div>
          <LogSubscriptionDialog deals={deals} />
        </header>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Active Subscriptions</p>
            <p className="text-3xl font-bold text-primary" data-testid="text-active-count">{activeCount}</p>
          </div>
          <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Monthly Revenue (MRR)</p>
            <p className="text-3xl font-bold text-emerald-600" data-testid="text-mrr">
              ${mrr.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Est. Monthly Commission</p>
            <p className="text-3xl font-bold text-purple-600" data-testid="text-estimated-commission-total">
              ${totalEstComm.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="subscriptions" data-testid="subscriptions-tabs">
          <TabsList className="mb-6" data-testid="tabs-list">
            <TabsTrigger value="subscriptions" data-testid="tab-subscriptions">
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Subscriptions
            </TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">
              <Activity className="w-4 h-4 mr-1.5" />
              All Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="subscriptions" data-testid="tab-content-subscriptions">
            {/* Expired Subscriptions Warning */}
            {!isLoading && expiredCount > 0 && (
              <div
                className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-6"
                data-testid="banner-expired-subscriptions"
              >
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-700">
                    {expiredCount === 1
                      ? "1 subscription has expired"
                      : `${expiredCount} subscriptions have expired`}
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">
                    Expired subscriptions no longer generate commission. Contact support or your admin to reactivate them.
                  </p>
                </div>
              </div>
            )}

            {/* Subscriptions List */}
            {isLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="subscriptions-skeleton">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-4 w-28" />
                      </div>
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {[1, 2, 3, 4].map((j) => (
                        <div key={j} className="space-y-1">
                          <Skeleton className="h-3 w-12" />
                          <Skeleton className="h-5 w-16" />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-1 pt-3 border-t border-gray-100">
                      {[1, 2, 3, 4, 5].map((k) => (
                        <Skeleton key={k} className="flex-1 h-10 rounded" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : subscriptions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-border p-12 text-center" data-testid="empty-subscriptions">
                <RefreshCw className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-primary mb-2">No Subscriptions Yet</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
                  Log your first merchant subscription to start earning recurring commission income from the Merchant Growth Platform.
                </p>
                <LogSubscriptionDialog deals={deals} />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="subscriptions-list">
                {subscriptions.map((sub) => (
                  <SubscriptionCard key={sub.id} sub={sub} />
                ))}
              </div>
            )}

            {/* Decay Info Banner */}
            {subscriptions.length > 0 && (
              <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">
                  Commission percentages decay over time per the comp plan. Pairing a subscription with a funded MCA deal earns a +5% bonus for the first 3 months.
                  Commissions shown are estimates; actual amounts are calculated monthly by the platform.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" data-testid="tab-content-activity">
            <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <Activity className="w-4 h-4 text-primary" />
                <h2 className="text-base font-semibold text-primary">All Subscription Activity</h2>
              </div>
              <AllActivityTimeline subscriptions={subscriptions} />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
