import { useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Mail,
  Send,
  UserPlus,
  RefreshCw,
  X,
  Clock,
  CheckCircle2,
  Ban,
  AlertTriangle,
} from "lucide-react";

const inviteSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Enter a valid email"),
  placementLeg: z.enum(["left", "right", "auto"]),
});

type InviteForm = z.infer<typeof inviteSchema>;

type Invitation = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  placementLeg: string;
  status: "pending" | "accepted" | "cancelled" | "expired";
  expiresAt: string;
  createdAt: string;
};

const statusConfig: Record<
  Invitation["status"],
  { label: string; className: string; icon: typeof Clock }
> = {
  pending: {
    label: "Pending",
    className: "bg-amber-100 text-amber-700 border-amber-200",
    icon: Clock,
  },
  accepted: {
    label: "Accepted",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-gray-100 text-gray-600 border-gray-200",
    icon: Ban,
  },
  expired: {
    label: "Expired",
    className: "bg-red-100 text-red-700 border-red-200",
    icon: AlertTriangle,
  },
};

function legLabel(leg: string) {
  if (leg === "left") return "Left leg";
  if (leg === "right") return "Right leg";
  return "Auto-place";
}

export default function InvitePage() {
  usePageMeta(
    "Invite a Teammate | Leader Shield Funding",
    "Invite a prospect to join your team by email.",
  );
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      placementLeg: "auto",
    },
  });

  const { data: invitations, isLoading } = useQuery<Invitation[]>({
    queryKey: [api.invitations.list.path],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InviteForm) => {
      const res = await apiRequest("POST", api.invitations.create.path, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.invitations.list.path] });
      form.reset({ firstName: "", lastName: "", email: "", placementLeg: "auto" });
      toast({
        title: "Invitation sent",
        description: "We've emailed your prospect a secure link to join.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't send invitation",
        description: err.message?.replace(/^\d+:\s*/, "") || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (id: number) => {
      const path = api.invitations.resend.path.replace(":id", String(id));
      const res = await apiRequest("POST", path);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.invitations.list.path] });
      toast({ title: "Invitation resent", description: "A fresh link is on its way." });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't resend",
        description: err.message?.replace(/^\d+:\s*/, "") || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const path = api.invitations.cancel.path.replace(":id", String(id));
      const res = await apiRequest("POST", path);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.invitations.list.path] });
      toast({ title: "Invitation cancelled" });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't cancel",
        description: err.message?.replace(/^\d+:\s*/, "") || "Please try again.",
        variant: "destructive",
      });
    },
  });

  async function onSubmit(data: InviteForm) {
    setSubmitting(true);
    try {
      await createMutation.mutateAsync(data);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar />

      <main className="flex-1 lg:ml-64 p-4 pt-20 lg:pt-8 lg:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-display font-bold text-primary">Invite a Teammate</h1>
          <p className="text-muted-foreground mt-2">
            Send a secure email invitation. When your prospect accepts, they're placed under you automatically.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Invite form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-display font-bold text-lg text-primary">New Invitation</h2>
              </div>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input
                      id="firstName"
                      data-testid="input-invite-first-name"
                      {...form.register("firstName")}
                    />
                    {form.formState.errors.firstName && (
                      <p className="text-xs text-destructive" data-testid="error-invite-first-name">
                        {form.formState.errors.firstName.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input
                      id="lastName"
                      data-testid="input-invite-last-name"
                      {...form.register("lastName")}
                    />
                    {form.formState.errors.lastName && (
                      <p className="text-xs text-destructive" data-testid="error-invite-last-name">
                        {form.formState.errors.lastName.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="prospect@example.com"
                    data-testid="input-invite-email"
                    {...form.register("email")}
                  />
                  {form.formState.errors.email && (
                    <p className="text-xs text-destructive" data-testid="error-invite-email">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="placementLeg">Placement preference</Label>
                  <Select
                    value={form.watch("placementLeg")}
                    onValueChange={(v) => form.setValue("placementLeg", v as InviteForm["placementLeg"])}
                  >
                    <SelectTrigger id="placementLeg" data-testid="select-invite-leg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto" data-testid="option-leg-auto">Auto-place (recommended)</SelectItem>
                      <SelectItem value="left" data-testid="option-leg-left">Left leg</SelectItem>
                      <SelectItem value="right" data-testid="option-leg-right">Right leg</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The exact spot is finalized when your prospect accepts.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 bg-gradient-to-r from-[#C9A24B] to-[#A07B22] text-[#0A1628] hover:from-[#E0C27E] hover:to-[#C9A24B] font-semibold"
                  data-testid="button-send-invite"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Send Invitation
                </Button>
              </form>
            </div>
          </div>

          {/* Sent invitations */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl border border-border shadow-sm p-6 min-h-[300px]">
              <h2 className="font-display font-bold text-lg text-primary mb-5">Sent Invitations</h2>

              {isLoading ? (
                <div className="flex items-center justify-center h-40 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : !invitations || invitations.length === 0 ? (
                <div className="text-center p-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <Mail className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <h3 className="font-medium text-gray-900">No invitations yet</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Invite your first teammate using the form.
                  </p>
                </div>
              ) : (
                <div className="space-y-3" data-testid="list-invitations">
                  {invitations.map((inv) => {
                    const cfg = statusConfig[inv.status];
                    const StatusIcon = cfg.icon;
                    const isPending = inv.status === "pending";
                    return (
                      <div
                        key={inv.id}
                        className="flex items-center gap-3 p-4 border border-border/60 rounded-xl"
                        data-testid={`row-invitation-${inv.id}`}
                      >
                        <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-700 font-bold text-xs border border-indigo-100 shrink-0">
                          {inv.firstName[0]}
                          {inv.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-primary truncate" data-testid={`text-invite-name-${inv.id}`}>
                            {inv.firstName} {inv.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{inv.email}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{legLabel(inv.placementLeg)}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`${cfg.className} gap-1 shrink-0`}
                          data-testid={`badge-status-${inv.id}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                        </Badge>
                        {isPending && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Resend"
                              disabled={resendMutation.isPending}
                              onClick={() => resendMutation.mutate(inv.id)}
                              data-testid={`button-resend-${inv.id}`}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              title="Cancel"
                              disabled={cancelMutation.isPending}
                              onClick={() => cancelMutation.mutate(inv.id)}
                              data-testid={`button-cancel-${inv.id}`}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
