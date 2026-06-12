import { AdminSidebar } from "@/components/AdminSidebar";
import { SchemaDriftBanner } from "@/components/SchemaDriftBanner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import {
  Settings,
  Loader2,
  Save,
  DollarSign,
  TrendingUp,
  Building,
  Zap,
  Bell,
  Webhook,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  Send,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Link } from "wouter";

type PlatformSettings = {
  commissionRates: Record<string, number> | null;
  rankRequirements: Record<string, { personalVolume: number; weakLegVolume: number }> | null;
  binaryBonusCaps: Record<string, { rate: number; max: number }> | null;
  companyInfo: { name: string; supportEmail: string } | null;
  expiryWarningDays: number;
};

type WebhookStatus = {
  secretStored: boolean;
  endpointId: string | null;
  endpointUrl: string | null;
  endpointActive: boolean | null;
};

type SystemInfo = {
  expiryCheckIntervalMs: number;
  expiryWarningDays: number;
  nodeEnv: string;
  schedulerLastRunAt: string | null;
  schedulerNextRunAt: string | null;
};

function formatInterval(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return `${ms} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds % 1 === 0 ? seconds : seconds.toFixed(1)} sec`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes % 1 === 0 ? minutes : minutes.toFixed(1)} min`;
  const hours = minutes / 60;
  return `${hours % 1 === 0 ? hours : hours.toFixed(1)} hr`;
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export default function AdminSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<PlatformSettings>({
    queryKey: [api.admin.settings.get.path],
  });

  const { data: warningPreview, isLoading: warningPreviewLoading } = useQuery<{
    days: number;
    count: number;
    subscriptionIds: number[];
  }>({
    queryKey: [api.admin.subscriptions.dueForWarning.path],
  });

  const { data: webhookStatus, isLoading: webhookLoading, refetch: refetchWebhook } = useQuery<WebhookStatus>({
    queryKey: [api.admin.webhookStatus.get.path],
  });

  const { data: systemInfo, isLoading: systemInfoLoading } = useQuery<SystemInfo>({
    queryKey: [api.admin.systemInfo.get.path],
  });

  const testWebhookMutation = useMutation({
    mutationFn: () => apiRequest("POST", api.admin.testWebhook.post.path).then((r) => r.json() as Promise<{ success: boolean; message: string }>),
    onSuccess: (result) => {
      toast({
        title: result.success ? "Webhook reachable" : "Webhook check failed",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
      refetchWebhook();
    },
    onError: () => toast({ title: "Failed to test webhook", variant: "destructive" }),
  });

  const [webhookSecret, setWebhookSecret] = useState("");

  const saveWebhookSecretMutation = useMutation({
    mutationFn: (secret: string) =>
      apiRequest("POST", api.admin.webhookSecret.update.path, { secret }),
    onSuccess: () => {
      toast({ title: "Webhook secret saved" });
      setWebhookSecret("");
      refetchWebhook();
    },
    onError: (err: any) =>
      toast({
        title: "Failed to save webhook secret",
        description: err?.message ?? undefined,
        variant: "destructive",
      }),
  });

  const [companyInfo, setCompanyInfo] = useState({ name: "", supportEmail: "" });
  const [rankReqs, setRankReqs] = useState<Record<string, { personalVolume: number; weakLegVolume: number }>>({});
  const [expiryWarningDays, setExpiryWarningDays] = useState<number>(7);

  useEffect(() => {
    if (settings) {
      setCompanyInfo({
        name: settings.companyInfo?.name ?? "Leader Shield Funding",
        supportEmail: settings.companyInfo?.supportEmail ?? "support@leadershieldfunding.com",
      });
      setRankReqs(settings.rankRequirements ?? {
        builder: { personalVolume: 10000, weakLegVolume: 5000 },
        leader: { personalVolume: 25000, weakLegVolume: 15000 },
        director: { personalVolume: 50000, weakLegVolume: 30000 },
        partner: { personalVolume: 100000, weakLegVolume: 60000 },
      });
      setExpiryWarningDays(settings.expiryWarningDays ?? 7);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<PlatformSettings>) =>
      apiRequest("PATCH", api.admin.settings.update.path, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.settings.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.admin.subscriptions.dueForWarning.path] });
      toast({ title: "Settings saved successfully" });
    },
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  function handleSaveCompanyInfo() {
    saveMutation.mutate({ companyInfo });
  }

  function handleSaveRankReqs() {
    saveMutation.mutate({ rankRequirements: rankReqs });
  }

  function handleSaveExpiryWarning() {
    const days = Math.max(1, Math.min(90, Math.round(expiryWarningDays)));
    saveMutation.mutate({ expiryWarningDays: days });
  }

  const sendWarningsMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", api.admin.subscriptions.sendWarnings.path).then(
        (r) => r.json() as Promise<{ days: number; total: number; sent: number }>,
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [api.admin.subscriptions.dueForWarning.path] });
      toast({
        title:
          result.sent > 0
            ? `Sent ${result.sent} warning email${result.sent !== 1 ? "s" : ""}`
            : "No warnings to send",
        description:
          result.sent > 0
            ? "Agents have been notified for subscriptions in the current warning window."
            : "There are no subscriptions in the warning window right now.",
      });
    },
    onError: () => toast({ title: "Failed to send warnings", variant: "destructive" }),
  });

  function updateRankReq(rank: string, field: "personalVolume" | "weakLegVolume", value: string) {
    setRankReqs((prev) => ({
      ...prev,
      [rank]: { ...prev[rank], [field]: parseFloat(value) || 0 },
    }));
  }

  const RANKS = ["builder", "leader", "director", "partner"];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 lg:ml-64 p-4 pt-20 lg:pt-8 lg:p-8">
        <SchemaDriftBanner />
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Settings className="w-6 h-6 text-primary" />
              Platform Settings
            </h1>
            <p className="text-gray-500 mt-1">Configure platform-wide settings and compensation parameters</p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Company Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building className="w-5 h-5 text-primary" />
                    Company Information
                  </CardTitle>
                  <CardDescription>Basic platform identity and contact details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Company Name</Label>
                      <Input
                        data-testid="input-company-name"
                        value={companyInfo.name}
                        onChange={(e) => setCompanyInfo({ ...companyInfo, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Support Email</Label>
                      <Input
                        data-testid="input-support-email"
                        type="email"
                        value={companyInfo.supportEmail}
                        onChange={(e) => setCompanyInfo({ ...companyInfo, supportEmail: e.target.value })}
                      />
                    </div>
                  </div>
                  <Button
                    data-testid="button-save-company"
                    onClick={handleSaveCompanyInfo}
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Company Info
                  </Button>
                </CardContent>
              </Card>

              {/* Rank Requirements */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Rank Qualification Requirements
                  </CardTitle>
                  <CardDescription>Minimum personal volume and weak-leg volume needed to qualify for each rank</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {RANKS.map((rank) => (
                      <div key={rank} className="grid grid-cols-3 gap-4 items-center">
                        <Label className="font-semibold capitalize">{rank}</Label>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">Personal Volume ($)</Label>
                          <Input
                            type="number"
                            data-testid={`input-pv-${rank}`}
                            value={rankReqs[rank]?.personalVolume ?? 0}
                            onChange={(e) => updateRankReq(rank, "personalVolume", e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">Weak Leg Volume ($)</Label>
                          <Input
                            type="number"
                            data-testid={`input-wlv-${rank}`}
                            value={rankReqs[rank]?.weakLegVolume ?? 0}
                            onChange={(e) => updateRankReq(rank, "weakLegVolume", e.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    className="mt-4"
                    data-testid="button-save-ranks"
                    onClick={handleSaveRankReqs}
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Rank Requirements
                  </Button>
                </CardContent>
              </Card>

              {/* Expiry Warning Lead Time */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Bell className="w-5 h-5 text-primary" />
                    Subscription Expiry Warning
                  </CardTitle>
                  <CardDescription>
                    How many days before a subscription expires to send the warning email to the agent (1–90 days)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-end gap-4">
                    <div className="space-y-1 w-48">
                      <Label>Days Before Expiry</Label>
                      <Input
                        type="number"
                        min={1}
                        max={90}
                        data-testid="input-expiry-warning-days"
                        value={expiryWarningDays}
                        onChange={(e) => setExpiryWarningDays(parseInt(e.target.value) || 7)}
                      />
                    </div>
                    <p className="text-sm text-gray-500 pb-2">
                      Currently set to <span className="font-medium text-gray-700">{expiryWarningDays} day{expiryWarningDays !== 1 ? 's' : ''}</span> before expiry
                    </p>
                  </div>
                  <Button
                    data-testid="button-save-expiry-warning"
                    onClick={handleSaveExpiryWarning}
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Warning Lead Time
                  </Button>

                  <div
                    className="rounded-md border border-gray-200 bg-gray-50 p-4"
                    data-testid="panel-warning-preview"
                  >
                    {warningPreviewLoading ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Checking which subscriptions would be warned…
                      </div>
                    ) : warningPreview && warningPreview.count > 0 ? (
                      <p className="text-sm text-gray-700">
                        <Link
                          href="/admin/subscriptions?dueForWarning=1"
                          className="font-semibold text-primary underline-offset-2 hover:underline"
                          data-testid="link-warning-preview-count"
                        >
                          {warningPreview.count} subscription{warningPreview.count !== 1 ? "s" : ""}
                        </Link>{" "}
                        would receive a warning email right now at the current setting of{" "}
                        <span className="font-medium">
                          {(warningPreview.days ?? expiryWarningDays)} day
                          {(warningPreview.days ?? expiryWarningDays) !== 1 ? "s" : ""}
                        </span>{" "}
                        before expiry.
                      </p>
                    ) : null}
                    {warningPreview && warningPreview.count > 0 ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        onClick={() => sendWarningsMutation.mutate()}
                        disabled={sendWarningsMutation.isPending}
                        data-testid="button-send-warnings-now"
                      >
                        {sendWarningsMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Sending…
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Send warnings now
                          </>
                        )}
                      </Button>
                    ) : null}
                    {!warningPreviewLoading && (!warningPreview || warningPreview.count === 0) ? (
                      <p className="text-sm text-gray-500" data-testid="text-warning-preview-empty">
                        No active subscriptions currently fall within the{" "}
                        <span className="font-medium">
                          {(warningPreview?.days ?? expiryWarningDays)} day
                          {(warningPreview?.days ?? expiryWarningDays) !== 1 ? "s" : ""}
                        </span>{" "}
                        warning window.
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-gray-400">
                      Save a new lead time above to refresh this preview.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Commission Config (read-only reference) */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <DollarSign className="w-5 h-5 text-primary" />
                    Commission Configuration (Reference)
                  </CardTitle>
                  <CardDescription>
                    Current GBR waterfall and holdback configuration. Edit in the server config file to change.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <p className="font-medium text-gray-700">GBR Waterfall (MAC)</p>
                      <p className="text-gray-500">Primary Agent: 22%</p>
                      <p className="text-gray-500">Senior Sponsor L1: 5%</p>
                      <p className="text-gray-500">Executive Sponsor L2: 3%</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-gray-700">Holdback Policy</p>
                      <p className="text-gray-500">Immediate Release: 70%</p>
                      <p className="text-gray-500">Deferred: 30%</p>
                      <p className="text-gray-500">Deferral Period: 90 days</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-gray-700">Subscription Pools</p>
                      <p className="text-gray-500">Starter ($149/mo): 25%</p>
                      <p className="text-gray-500">Growth Foundation ($397/mo): 35%</p>
                      <p className="text-gray-500">Revenue Growth System ($697/mo): 45%</p>
                      <p className="text-gray-500">Revenue Scale AI ($1,497/mo): 50%</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-gray-700">Subscription Decay</p>
                      <p className="text-gray-500">Months 1–3: 100%</p>
                      <p className="text-gray-500">Months 4–6: 75%</p>
                      <p className="text-gray-500">Months 7–9: 50%</p>
                      <p className="text-gray-500">Months 10–12: 25%</p>
                      <p className="text-gray-500">Month 12+: 10%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Stripe Webhook Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Webhook className="w-5 h-5 text-primary" />
                    Stripe Webhook
                  </CardTitle>
                  <CardDescription>
                    Status of the Stripe webhook endpoint used for billing events
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {webhookLoading ? (
                    <div className="flex items-center gap-2 text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Checking webhook status…</span>
                    </div>
                  ) : !webhookStatus ? (
                    <p className="text-sm text-gray-500">Unable to load webhook status.</p>
                  ) : (
                    <>
                      {(!webhookStatus.secretStored || !webhookStatus.endpointId || webhookStatus.endpointActive === false) && (
                        <Alert variant="destructive" data-testid="alert-webhook-not-configured">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Webhook not configured</AlertTitle>
                          <AlertDescription>
                            {!webhookStatus.secretStored
                              ? "No webhook secret is stored."
                              : !webhookStatus.endpointId
                                ? "No endpoint ID is on record."
                                : "The Stripe endpoint is not active."}{" "}
                            Restart the app to re-initialize the Stripe webhook endpoint.
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 font-medium">Secret stored:</span>
                          {webhookStatus.secretStored ? (
                            <Badge data-testid="badge-secret-stored" className="bg-green-100 text-green-700 border-green-200">
                              <CheckCircle className="w-3 h-3 mr-1" /> Yes
                            </Badge>
                          ) : (
                            <Badge data-testid="badge-secret-missing" variant="destructive">
                              <XCircle className="w-3 h-3 mr-1" /> No
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 font-medium">Endpoint status:</span>
                          {webhookStatus.endpointActive === null ? (
                            <Badge data-testid="badge-endpoint-unknown" variant="secondary">Unknown</Badge>
                          ) : webhookStatus.endpointActive ? (
                            <Badge data-testid="badge-endpoint-active" className="bg-green-100 text-green-700 border-green-200">
                              <CheckCircle className="w-3 h-3 mr-1" /> Active
                            </Badge>
                          ) : (
                            <Badge data-testid="badge-endpoint-inactive" variant="destructive">
                              <XCircle className="w-3 h-3 mr-1" /> Inactive
                            </Badge>
                          )}
                        </div>

                        {webhookStatus.endpointId && (
                          <div className="col-span-2 flex items-center gap-2">
                            <span className="text-gray-500 font-medium">Endpoint ID:</span>
                            <code data-testid="text-endpoint-id" className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">
                              {webhookStatus.endpointId}
                            </code>
                          </div>
                        )}

                        {webhookStatus.endpointUrl && (
                          <div className="col-span-2 flex items-center gap-2">
                            <span className="text-gray-500 font-medium">Endpoint URL:</span>
                            <span data-testid="text-endpoint-url" className="text-xs text-gray-600 break-all">
                              {webhookStatus.endpointUrl}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid="button-test-webhook"
                          onClick={() => testWebhookMutation.mutate()}
                          disabled={testWebhookMutation.isPending}
                        >
                          {testWebhookMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-2" />
                          )}
                          Test Webhook
                        </Button>
                      </div>

                      <div className="border-t pt-4 space-y-2">
                        <Label htmlFor="webhook-secret" className="text-sm font-medium text-gray-700">
                          Manually set webhook secret
                        </Label>
                        <p className="text-xs text-gray-500">
                          If automatic setup failed, paste the signing secret from your Stripe
                          webhook endpoint (starts with <code className="font-mono">whsec_</code>) to
                          recover without restarting.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Input
                            id="webhook-secret"
                            type="password"
                            data-testid="input-webhook-secret"
                            placeholder="whsec_..."
                            value={webhookSecret}
                            onChange={(e) => setWebhookSecret(e.target.value)}
                            className="font-mono"
                          />
                          <Button
                            size="sm"
                            data-testid="button-save-webhook-secret"
                            onClick={() => saveWebhookSecretMutation.mutate(webhookSecret.trim())}
                            disabled={
                              saveWebhookSecretMutation.isPending || !webhookSecret.trim()
                            }
                          >
                            {saveWebhookSecretMutation.isPending ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4 mr-2" />
                            )}
                            Save Secret
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* System Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="w-5 h-5 text-primary" />
                    System Info
                  </CardTitle>
                  <CardDescription>
                    Read-only view of the active operational configuration
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {systemInfoLoading ? (
                    <div className="flex items-center gap-2 text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Loading system info…</span>
                    </div>
                  ) : !systemInfo ? (
                    <p className="text-sm text-gray-500">Unable to load system info.</p>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      <div className="flex items-center justify-between gap-3 text-sm pb-4">
                        <div>
                          <p className="font-medium text-gray-700">Subscription expiry check interval</p>
                          <p className="text-gray-500">
                            How often the scheduler checks for expiring subscriptions
                            (<code className="font-mono">EXPIRY_CHECK_INTERVAL_MS</code>)
                          </p>
                        </div>
                        <Badge
                          data-testid="badge-expiry-check-interval"
                          variant="secondary"
                          className="font-mono whitespace-nowrap"
                        >
                          {formatInterval(systemInfo.expiryCheckIntervalMs)}
                          <span className="text-gray-400 ml-1">
                            ({systemInfo.expiryCheckIntervalMs.toLocaleString()} ms)
                          </span>
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between gap-3 text-sm py-4">
                        <div>
                          <p className="font-medium text-gray-700">Expiry warning window</p>
                          <p className="text-gray-500">
                            How many days before expiry agents are warned
                          </p>
                        </div>
                        <Badge
                          data-testid="badge-expiry-warning-days"
                          variant="secondary"
                          className="font-mono whitespace-nowrap"
                        >
                          {systemInfo.expiryWarningDays} day{systemInfo.expiryWarningDays !== 1 ? "s" : ""}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between gap-3 text-sm py-4">
                        <div>
                          <p className="font-medium text-gray-700">App environment</p>
                          <p className="text-gray-500">
                            Active runtime mode (<code className="font-mono">NODE_ENV</code>)
                          </p>
                        </div>
                        <Badge
                          data-testid="badge-node-env"
                          variant={systemInfo.nodeEnv === "production" ? "default" : "secondary"}
                          className="font-mono whitespace-nowrap"
                        >
                          {systemInfo.nodeEnv}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between gap-3 text-sm py-4">
                        <div>
                          <p className="font-medium text-gray-700">Scheduler last run</p>
                          <p className="text-gray-500">
                            When the expiry checks last executed
                          </p>
                        </div>
                        <Badge
                          data-testid="badge-scheduler-last-run"
                          variant="secondary"
                          className="font-mono whitespace-nowrap"
                        >
                          {formatTimestamp(systemInfo.schedulerLastRunAt)}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between gap-3 text-sm pt-4">
                        <div>
                          <p className="font-medium text-gray-700">Scheduler next run</p>
                          <p className="text-gray-500">
                            When the expiry checks are next due
                          </p>
                        </div>
                        <Badge
                          data-testid="badge-scheduler-next-run"
                          variant="secondary"
                          className="font-mono whitespace-nowrap"
                        >
                          {formatTimestamp(systemInfo.schedulerNextRunAt)}
                        </Badge>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Zap className="w-5 h-5 text-primary" />
                    Quick Actions
                  </CardTitle>
                  <CardDescription>Trigger on-demand calculations</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-3 flex-wrap">
                  <Button
                    variant="outline"
                    data-testid="button-calc-binary"
                    onClick={async () => {
                      try {
                        await apiRequest("POST", api.admin.commissions.calculate.path);
                        toast({ title: "Binary bonus calculation triggered" });
                      } catch {
                        toast({ title: "Failed to trigger calculation", variant: "destructive" });
                      }
                    }}
                  >
                    Calculate Binary Bonuses
                  </Button>
                  <Button
                    variant="outline"
                    data-testid="button-calc-subscriptions"
                    onClick={async () => {
                      try {
                        const res = await apiRequest("POST", api.admin.subscriptions.calculateCommissions.path);
                        const result = await res.json() as { processed: number };
                        toast({ title: `Subscription commissions calculated: ${result.processed} processed` });
                      } catch {
                        toast({ title: "Failed to calculate subscription commissions", variant: "destructive" });
                      }
                    }}
                  >
                    Calculate Subscription Commissions
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
