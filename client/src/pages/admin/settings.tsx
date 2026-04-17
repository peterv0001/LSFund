import { AdminSidebar } from "@/components/AdminSidebar";
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
} from "lucide-react";
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

type PlatformSettings = {
  commissionRates: Record<string, number> | null;
  rankRequirements: Record<string, { personalVolume: number; weakLegVolume: number }> | null;
  binaryBonusCaps: Record<string, { rate: number; max: number }> | null;
  companyInfo: { name: string; supportEmail: string } | null;
};

export default function AdminSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<PlatformSettings>({
    queryKey: [api.admin.settings.get.path],
  });

  const [companyInfo, setCompanyInfo] = useState({ name: "", supportEmail: "" });
  const [rankReqs, setRankReqs] = useState<Record<string, { personalVolume: number; weakLegVolume: number }>>({});

  useEffect(() => {
    if (settings) {
      setCompanyInfo({
        name: settings.companyInfo?.name ?? "Leadershield Network",
        supportEmail: settings.companyInfo?.supportEmail ?? "support@leadershield.com",
      });
      setRankReqs(settings.rankRequirements ?? {
        builder: { personalVolume: 10000, weakLegVolume: 5000 },
        leader: { personalVolume: 25000, weakLegVolume: 15000 },
        director: { personalVolume: 50000, weakLegVolume: 30000 },
        partner: { personalVolume: 100000, weakLegVolume: 60000 },
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<PlatformSettings>) =>
      apiRequest("PATCH", api.admin.settings.update.path, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.settings.get.path] });
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
      <main className="flex-1 ml-64 p-8">
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
                      <p className="text-gray-500">Tier 1 ($199/mo): 50%</p>
                      <p className="text-gray-500">Tier 2 ($399/mo): 60%</p>
                      <p className="text-gray-500">Tier 3 ($799/mo): 70%</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-gray-700">Subscription Decay</p>
                      <p className="text-gray-500">Months 1–3: 100%</p>
                      <p className="text-gray-500">Months 4–6: 80%</p>
                      <p className="text-gray-500">Months 7–9: 60%</p>
                      <p className="text-gray-500">Months 10–12: 40%</p>
                      <p className="text-gray-500">Month 12+: 20%</p>
                    </div>
                  </div>
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
