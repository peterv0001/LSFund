import { useState } from "react";
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
import { Loader2, Plus, RefreshCw, TrendingDown, Info, MoreVertical, Pause, Play, XCircle, History, ChevronDown, ChevronUp } from "lucide-react";
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
  tier: "tier_1" | "tier_2" | "tier_3";
  monthlyAmount: string;
  status: "active" | "paused" | "cancelled" | "expired";
  mcaPairedDealId: number | null;
  startDate: string;
  cancelledAt: string | null;
  pausedAt: string | null;
  reactivatedAt: string | null;
  reactivatedById: number | null;
  reactivatedByName: string | null;
  createdAt: string;
};

type Deal = {
  id: number;
  merchantName: string;
  status: string;
};

// === Constants ===

const TIER_LABELS: Record<string, string> = {
  tier_1: "Tier 1 — $199/mo",
  tier_2: "Tier 2 — $429/mo",
  tier_3: "Tier 3 — $749/mo",
};

const TIER_PRICES: Record<string, number> = {
  tier_1: 199,
  tier_2: 429,
  tier_3: 749,
};

const POOL_RATES: Record<string, number> = {
  tier_1: 0.50,
  tier_2: 0.60,
  tier_3: 0.70,
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
  const poolRate = POOL_RATES[sub.tier] ?? 0.50;
  const decay = getDecayRate(months);
  const bonus = sub.mcaPairedDealId && months < 3 ? 0.05 : 0;
  return Number(sub.monthlyAmount) * (poolRate * decay + bonus);
}

// === Form Schema ===

const logSubscriptionSchema = z.object({
  merchantName: z.string().min(2, "Merchant name must be at least 2 characters"),
  merchantEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  tier: z.enum(["tier_1", "tier_2", "tier_3"], { required_error: "Please select a tier" }),
  startDate: z.string().min(1, "Start date is required"),
  pairedWithDeal: z.boolean().default(false),
  mcaPairedDealId: z.number().optional(),
});

type LogSubscriptionInput = z.infer<typeof logSubscriptionSchema>;

// === Log Subscription Dialog ===

function LogSubscriptionDialog({ deals }: { deals: Deal[] }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) form.reset();
  };

  const pairedWithDeal = form.watch("pairedWithDeal");
  const selectedTier = form.watch("tier");

  const mutation = useMutation({
    mutationFn: async (data: LogSubscriptionInput) => {
      const payload: Record<string, unknown> = {
        merchantName: data.merchantName,
        merchantEmail: data.merchantEmail || undefined,
        tier: data.tier,
        startDate: new Date(data.startDate).toISOString(),
        mcaPairedDealId: data.pairedWithDeal ? data.mcaPairedDealId : undefined,
      };
      const res = await apiRequest("POST", "/api/subscriptions", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      toast({ title: "Subscription logged successfully" });
      form.reset();
      setOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: err.message || "Failed to log subscription", variant: "destructive" });
    },
  });

  const fundedDeals = deals.filter((d) => d.status === "funded");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="button-log-subscription">
          <Plus className="w-4 h-4 mr-2" />
          Log New Subscription
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" data-testid="dialog-log-subscription">
        <DialogHeader>
          <DialogTitle>Log New Merchant Subscription</DialogTitle>
        </DialogHeader>

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
                        Tier 1 — $199/mo
                      </SelectItem>
                      <SelectItem value="tier_2" data-testid="option-tier-2">
                        Tier 2 — $429/mo
                      </SelectItem>
                      <SelectItem value="tier_3" data-testid="option-tier-3">
                        Tier 3 — $749/mo
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

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
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
      </DialogContent>
    </Dialog>
  );
}

// === Action Icon/Color Helpers ===

const ACTION_STYLES: Record<string, { color: string; dot: string }> = {
  create: { color: "text-green-700", dot: "bg-green-500" },
  pause: { color: "text-yellow-700", dot: "bg-yellow-500" },
  cancel: { color: "text-red-700", dot: "bg-red-500" },
  reactivate: { color: "text-blue-700", dot: "bg-blue-500" },
};

function getActionStyle(action: string) {
  const key = Object.keys(ACTION_STYLES).find((k) => action.toLowerCase().includes(k));
  return key ? ACTION_STYLES[key] : { color: "text-gray-600", dot: "bg-gray-400" };
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
    <ol className="space-y-2 pt-2" data-testid={`history-list-${subId}`}>
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
                  <span className="ml-1 text-purple-500">(by {log.actorName})</span>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// === Decay Schedule Visualization ===

function DecayScheduleBar({ sub }: { sub: Subscription }) {
  const months = getMonthsActive(sub.startDate);
  const poolRate = POOL_RATES[sub.tier] ?? 0.50;

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
      className="bg-white rounded-2xl border border-border shadow-sm p-6 hover:shadow-md transition-shadow"
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

      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <span>Started {format(new Date(sub.startDate), "MMM d, yyyy")}</span>
        <span className="font-medium text-gray-600">Decay: {(decay * 100).toFixed(0)}%</span>
      </div>

      {sub.status === "paused" && sub.pausedAt && (
        <p className="mt-1 text-xs text-yellow-600 font-medium" data-testid={`text-paused-since-${sub.id}`}>
          Paused since {format(new Date(sub.pausedAt), "MMM d, yyyy")}
        </p>
      )}

      {sub.status === "cancelled" && sub.cancelledAt && (
        <p className="mt-1 text-xs text-red-600 font-medium" data-testid={`text-cancelled-on-${sub.id}`}>
          Cancelled on {format(new Date(sub.cancelledAt), "MMM d, yyyy")}
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

// === Main Page ===

export default function SubscriptionsPage() {
  const { data: subscriptions = [], isLoading } = useQuery<Subscription[]>({
    queryKey: ["/api/subscriptions"],
  });

  const { data: deals = [] } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
  });

  const activeCount = subscriptions.filter((s) => s.status === "active").length;
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
      </main>
    </div>
  );
}
