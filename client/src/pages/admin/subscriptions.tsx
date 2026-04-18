import { AdminSidebar } from "@/components/AdminSidebar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import {
  RefreshCw,
  Loader2,
  DollarSign,
  Users,
  TrendingUp,
  Zap,
  Filter,
  Clock,
  X,
  Download,
  History,
  CalendarRange,
  Settings2,
  Bookmark,
  Trash2,
  Check,
  Plus,
  CalendarDays,
  GripVertical,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useState, useCallback, useEffect, useRef } from "react";
import { useSearch, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

type Agent = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
};

type Subscription = {
  id: number;
  agentId: number;
  agent?: Agent;
  merchantName: string;
  merchantEmail: string | null;
  tier: "tier_1" | "tier_2" | "tier_3";
  monthlyAmount: string;
  status: "active" | "paused" | "cancelled" | "expired";
  mcaPairedDealId: number | null;
  startDate: string;
  endDate: string | null;
  cancelledAt: string | null;
  pausedAt: string | null;
  reactivatedAt: string | null;
  cancelledById: number | null;
  pausedById: number | null;
  reactivatedById: number | null;
  pausedBy: Agent | null;
  cancelledBy: Agent | null;
  reactivatedBy: Agent | null;
  createdAt: string;
  updatedAt: string;
};

type ActivityEntry = {
  id: number;
  actorId: number | null;
  actorType: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: number | null;
  description: string | null;
  createdAt: string;
};

const ACTION_LABELS: Record<string, string> = {
  create: "Created",
  pause: "Paused",
  cancel: "Cancelled",
  reactivate: "Reactivated",
  expire: "Expired",
  update: "Updated",
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-blue-100 text-blue-700",
  pause: "bg-yellow-100 text-yellow-700",
  cancel: "bg-red-100 text-red-700",
  reactivate: "bg-green-100 text-green-700",
  expire: "bg-gray-100 text-gray-600",
  update: "bg-purple-100 text-purple-700",
};

const TIER_LABELS: Record<string, string> = {
  tier_1: "Tier 1 — $199/mo",
  tier_2: "Tier 2 — $399/mo",
  tier_3: "Tier 3 — $799/mo",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-700",
  expired: "bg-gray-100 text-gray-500",
};

type StatusFilter = "all" | "active" | "paused" | "cancelled" | "expired";
type DateRangeFilter = "all" | "7d" | "30d" | "custom";

type ExportColumnKey =
  | "id"
  | "merchantName"
  | "merchantEmail"
  | "agentName"
  | "agentEmail"
  | "tier"
  | "monthlyAmount"
  | "status"
  | "changeDate"
  | "startDate"
  | "reactivatedAt"
  | "reactivatedBy";

const EXPORT_COLUMNS: { key: ExportColumnKey; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "merchantName", label: "Merchant Name" },
  { key: "merchantEmail", label: "Merchant Email" },
  { key: "agentName", label: "Agent Name" },
  { key: "agentEmail", label: "Agent Email" },
  { key: "tier", label: "Tier" },
  { key: "monthlyAmount", label: "Monthly Amount" },
  { key: "status", label: "Status" },
  { key: "changeDate", label: "Change Date" },
  { key: "startDate", label: "Start Date" },
  { key: "reactivatedAt", label: "Reactivated At" },
  { key: "reactivatedBy", label: "Reactivated By" },
];

const DEFAULT_EXPORT_COLUMNS: ExportColumnKey[] = [
  "id",
  "merchantName",
  "agentName",
  "tier",
  "monthlyAmount",
  "status",
  "changeDate",
];

type ExportTemplate = {
  id: number;
  adminId: number;
  name: string;
  columns: ExportColumnKey[];
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
};

const VALID_COLUMN_KEYS = new Set<string>(EXPORT_COLUMNS.map((c) => c.key));

function getChangedAt(sub: Subscription): Date {
  if (sub.status === "cancelled" && sub.cancelledAt) return new Date(sub.cancelledAt);
  return new Date(sub.updatedAt);
}

type AgentSummary = {
  agentId: number;
  agentName: string;
  cancelledCount: number;
  pausedCount: number;
};

function buildAgentSummary(subscriptions: Subscription[]): AgentSummary[] {
  const map = new Map<number, AgentSummary>();
  for (const sub of subscriptions) {
    if (sub.status !== "cancelled" && sub.status !== "paused") continue;
    const agentId = sub.agentId;
    if (!map.has(agentId)) {
      const name = sub.agent
        ? `${sub.agent.firstName} ${sub.agent.lastName}`
        : `Agent #${agentId}`;
      map.set(agentId, { agentId, agentName: name, cancelledCount: 0, pausedCount: 0 });
    }
    const entry = map.get(agentId)!;
    if (sub.status === "cancelled") entry.cancelledCount++;
    if (sub.status === "paused") entry.pausedCount++;
  }
  return Array.from(map.values()).sort((a, b) =>
    (b.cancelledCount + b.pausedCount) - (a.cancelledCount + a.pausedCount)
  );
}

function resolveAgentName(
  agentId: number,
  subscriptions: Subscription[],
  agentSummary: AgentSummary[],
): string {
  const foundInSummary = agentSummary.find((a) => a.agentId === agentId);
  if (foundInSummary) return foundInSummary.agentName;
  const subWithAgent = subscriptions.find((s) => s.agentId === agentId && s.agent?.firstName);
  return subWithAgent
    ? `${subWithAgent.agent!.firstName} ${subWithAgent.agent!.lastName}`
    : `Agent #${agentId}`;
}

export default function AdminSubscriptions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const search = useSearch();
  const [, setLocation] = useLocation();

  const initialParams = new URLSearchParams(search);

  const LS_KEY = "admin:subscriptions:dateFilter";
  const COLUMNS_LS_KEY = "admin:subscriptions:exportColumns";

  function readStoredDateFilter(): { range: DateRangeFilter; start: string; end: string } {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return { range: "all", start: "", end: "" };
      const parsed = JSON.parse(raw);
      const range = (["all", "7d", "30d", "custom"] as DateRangeFilter[]).includes(parsed.range)
        ? parsed.range as DateRangeFilter
        : "all";
      return {
        range,
        start: typeof parsed.start === "string" ? parsed.start : "",
        end: typeof parsed.end === "string" ? parsed.end : "",
      };
    } catch {
      return { range: "all", start: "", end: "" };
    }
  }

  function persistDateFilter(range: DateRangeFilter, start: string, end: string) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ range, start, end }));
    } catch {
    }
  }

  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const urlStatus = initialParams.get("status");
    if (urlStatus === "active" || urlStatus === "paused" || urlStatus === "cancelled" || urlStatus === "expired") {
      return urlStatus;
    }
    return "all";
  });

  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>(() => {
    const urlRange = initialParams.get("range");
    if (urlRange === "7d" || urlRange === "30d" || urlRange === "custom") return urlRange;
    if (initialParams.has("range")) return "all";
    return readStoredDateFilter().range;
  });

  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const urlRange = initialParams.get("range");
    if (urlRange === "custom") return initialParams.get("start") ?? "";
    if (urlRange != null) return "";
    const stored = readStoredDateFilter();
    return stored.range === "custom" ? stored.start : "";
  });

  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    const urlRange = initialParams.get("range");
    if (urlRange === "custom") return initialParams.get("end") ?? "";
    if (urlRange != null) return "";
    const stored = readStoredDateFilter();
    return stored.range === "custom" ? stored.end : "";
  });

  const [agentFilter, setAgentFilter] = useState<number | null>(() => {
    const id = initialParams.get("agentId");
    if (!id) return null;
    const parsed = parseInt(id, 10);
    return Number.isFinite(parsed) ? parsed : null;
  });
  const [historySubId, setHistorySubId] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({
    agentId: "",
    merchantName: "",
    merchantEmail: "",
    tier: "tier_1" as "tier_1" | "tier_2" | "tier_3",
    startDate: "",
    endDate: "",
  });
  const [editEndDateSubId, setEditEndDateSubId] = useState<number | null>(null);
  const [editEndDateValue, setEditEndDateValue] = useState("");

  const updateDateRangeInUrl = useCallback((range: DateRangeFilter, start: string, end: string) => {
    persistDateFilter(range, start, end);
    const params = new URLSearchParams(window.location.search);
    if (range === "all") {
      params.delete("range");
      params.delete("start");
      params.delete("end");
    } else if (range === "custom") {
      params.set("range", "custom");
      if (start) params.set("start", start); else params.delete("start");
      if (end) params.set("end", end); else params.delete("end");
    } else {
      params.set("range", range);
      params.delete("start");
      params.delete("end");
    }
    const qs = params.toString();
    setLocation(qs ? `${window.location.pathname}?${qs}` : window.location.pathname, { replace: true });
  }, [setLocation]);
  const updateAgentInUrl = useCallback((agentId: number | null) => {
    const params = new URLSearchParams(window.location.search);
    if (agentId === null) {
      params.delete("agentId");
    } else {
      params.set("agentId", String(agentId));
    }
    const qs = params.toString();
    setLocation(qs ? `${window.location.pathname}?${qs}` : window.location.pathname, { replace: true });
  }, [setLocation]);

  const updateStatusInUrl = useCallback((status: StatusFilter) => {
    const params = new URLSearchParams(window.location.search);
    if (status === "all") {
      params.delete("status");
    } else {
      params.set("status", status);
    }
    const qs = params.toString();
    setLocation(qs ? `${window.location.pathname}?${qs}` : window.location.pathname, { replace: true });
  }, [setLocation]);

  const handleAgentFilterChange = useCallback((agentId: number | null) => {
    setAgentFilter(agentId);
    updateAgentInUrl(agentId);
  }, [updateAgentInUrl]);
  const [selectedColumns, setSelectedColumns] = useState<Set<ExportColumnKey>>(() => {
    try {
      const raw = localStorage.getItem(COLUMNS_LS_KEY);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const validKeys = new Set(EXPORT_COLUMNS.map((c) => c.key));
          const filtered = (parsed as string[]).filter((k) => validKeys.has(k as ExportColumnKey));
          return new Set(filtered as ExportColumnKey[]);
        }
      }
    } catch {
    }
    return new Set(DEFAULT_EXPORT_COLUMNS);
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLUMNS_LS_KEY, JSON.stringify(Array.from(selectedColumns)));
    } catch {
    }
  }, [selectedColumns]);

  const [columnOrder, setColumnOrder] = useState<ExportColumnKey[]>(() => {
    try {
      const raw = localStorage.getItem("admin:subscriptions:columnOrder");
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const allKeys = EXPORT_COLUMNS.map((c) => c.key);
          const valid = (parsed as string[]).filter((k): k is ExportColumnKey => VALID_COLUMN_KEYS.has(k));
          const missing = allKeys.filter((k) => !valid.includes(k));
          return [...valid, ...missing];
        }
      }
    } catch {
    }
    return EXPORT_COLUMNS.map((c) => c.key);
  });

  useEffect(() => {
    try {
      localStorage.setItem("admin:subscriptions:columnOrder", JSON.stringify(columnOrder));
    } catch {
    }
  }, [columnOrder]);

  const draggedKeyRef = useRef<ExportColumnKey | null>(null);

  const { data: templates = [], isLoading: templatesLoading } = useQuery<ExportTemplate[]>({
    queryKey: [api.exportTemplates.list.path],
    select: (data) =>
      data.map((t) => ({
        ...t,
        columns: (t.columns as string[]).filter((k): k is ExportColumnKey => VALID_COLUMN_KEYS.has(k)),
      })).filter((t) => t.columns.length > 0),
  });

  const createTemplateMutation = useMutation({
    mutationFn: (vars: { name: string; columns: ExportColumnKey[]; isShared: boolean }) =>
      apiRequest("POST", api.exportTemplates.create.path, vars),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.exportTemplates.list.path] });
    },
    onError: () => toast({ title: "Failed to save template", variant: "destructive" }),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", buildUrl(api.exportTemplates.delete.path, { id })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.exportTemplates.list.path] });
    },
    onError: () => toast({ title: "Failed to delete template", variant: "destructive" }),
  });

  const updateTemplateMutation = useMutation({
    mutationFn: (vars: { id: number; isShared: boolean }) =>
      apiRequest("PATCH", buildUrl(api.exportTemplates.update.path, { id: vars.id }), { isShared: vars.isShared }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.exportTemplates.list.path] });
    },
    onError: () => toast({ title: "Failed to update template", variant: "destructive" }),
  });
  const [newTemplateName, setNewTemplateName] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);

  const { data: historyEntries = [], isLoading: historyLoading } = useQuery<ActivityEntry[]>({
    queryKey: [api.admin.subscriptions.activity.path, historySubId],
    queryFn: historySubId != null
      ? () => fetch(buildUrl(api.admin.subscriptions.activity.path, { id: historySubId }), { credentials: "include" }).then(r => r.json())
      : undefined,
    enabled: historySubId != null,
  });

  const { data: subscriptions = [], isLoading } = useQuery<Subscription[]>({
    queryKey: [api.admin.subscriptions.list.path],
  });

  const { data: agentsData } = useQuery<{ agents: Agent[] }>({
    queryKey: [api.admin.agents.list.path],
  });
  const allAgents: Agent[] = agentsData?.agents ?? [];

  const createSubscriptionMutation = useMutation({
    mutationFn: (data: {
      agentId: number;
      merchantName: string;
      merchantEmail?: string;
      tier: "tier_1" | "tier_2" | "tier_3";
      startDate?: string;
      endDate?: string;
    }) => apiRequest("POST", api.admin.subscriptions.create.path, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.subscriptions.list.path] });
      toast({ title: "Subscription created" });
      setShowCreateDialog(false);
      setCreateForm({ agentId: "", merchantName: "", merchantEmail: "", tier: "tier_1", startDate: "", endDate: "" });
    },
    onError: () => toast({ title: "Failed to create subscription", variant: "destructive" }),
  });

  const updateEndDateMutation = useMutation({
    mutationFn: ({ id, endDate }: { id: number; endDate: string | null }) =>
      apiRequest("PATCH", buildUrl(api.admin.subscriptions.updateEndDate.path, { id }), { endDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.subscriptions.list.path] });
      toast({ title: "End date updated" });
      setEditEndDateSubId(null);
      setEditEndDateValue("");
    },
    onError: () => toast({ title: "Failed to update end date", variant: "destructive" }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", buildUrl(api.admin.subscriptions.updateStatus.path, { id }), { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.subscriptions.list.path] });
      toast({ title: "Subscription status updated" });
    },
    onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
  });

  const calcCommissionsMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", api.admin.subscriptions.calculateCommissions.path)
        .then((res): Promise<{ processed: number; totalActive: number }> => res.json()),
    onSuccess: (data) => {
      toast({ title: `Calculated commissions for ${data.processed} of ${data.totalActive} active subscriptions` });
    },
    onError: () => toast({ title: "Failed to calculate commissions", variant: "destructive" }),
  });

  const activeCount = subscriptions.filter((s) => s.status === "active").length;
  const mrr = subscriptions
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + Number(s.monthlyAmount), 0);
  const totalSubs = subscriptions.length;

  const agentSummary = buildAgentSummary(subscriptions);

  const dateThreshold = dateRangeFilter === "all" || dateRangeFilter === "custom"
    ? null
    : new Date(Date.now() - (dateRangeFilter === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000);

  const customStart = dateRangeFilter === "custom" && customStartDate
    ? new Date(customStartDate + "T00:00:00")
    : null;
  const customEnd = dateRangeFilter === "custom" && customEndDate
    ? new Date(customEndDate + "T23:59:59")
    : null;

  const filteredSubscriptions = subscriptions.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (dateThreshold && getChangedAt(s) < dateThreshold) return false;
    if (agentFilter !== null && s.agentId !== agentFilter) return false;
    if (customStart && getChangedAt(s) < customStart) return false;
    if (customEnd && getChangedAt(s) > customEnd) return false;
    return true;
  });

  const selectedAgentSummary = agentFilter !== null
    ? agentSummary.find((a) => a.agentId === agentFilter) ?? (() => {
        const hasNamedAgent = subscriptions.some((s) => s.agentId === agentFilter && s.agent?.firstName);
        if (!hasNamedAgent) return null;
        return {
          agentId: agentFilter,
          agentName: resolveAgentName(agentFilter, subscriptions, agentSummary),
          cancelledCount: 0,
          pausedCount: 0,
        };
      })()
    : null;

  const hasActiveFilters = statusFilter !== "all" || dateRangeFilter !== "all" || agentFilter !== null;

  const showDateRangeSummary =
    dateRangeFilter === "7d" ||
    dateRangeFilter === "30d" ||
    (dateRangeFilter === "custom" && (customStartDate || customEndDate));

  const dateRangeSummary = (() => {
    if (!showDateRangeSummary) return null;
    const base = subscriptions.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (agentFilter !== null && s.agentId !== agentFilter) return false;
      return true;
    });
    const effectiveStart = dateThreshold ?? customStart;
    const effectiveEnd = customEnd;
    const newCount = base.filter((s) => {
      const d = new Date(s.createdAt);
      if (effectiveStart && d < effectiveStart) return false;
      if (effectiveEnd && d > effectiveEnd) return false;
      return true;
    }).length;
    const pausedCount = base.filter((s) => {
      if (!s.pausedAt) return false;
      const d = new Date(s.pausedAt);
      if (effectiveStart && d < effectiveStart) return false;
      if (effectiveEnd && d > effectiveEnd) return false;
      return true;
    }).length;
    const cancelledCount = base.filter((s) => {
      if (!s.cancelledAt) return false;
      const d = new Date(s.cancelledAt);
      if (effectiveStart && d < effectiveStart) return false;
      if (effectiveEnd && d > effectiveEnd) return false;
      return true;
    }).length;
    return { newCount, pausedCount, cancelledCount };
  })();

  function getCellValue(key: ExportColumnKey, s: Subscription): string {
    const agentName = s.agent?.firstName
      ? `${s.agent.firstName} ${s.agent.lastName}`
      : `#${s.agentId}`;
    const changeDate = s.status === "cancelled" && s.cancelledAt
      ? format(new Date(s.cancelledAt), "yyyy-MM-dd")
      : s.status === "paused" && s.pausedAt
        ? format(new Date(s.pausedAt), "yyyy-MM-dd")
        : format(new Date(s.updatedAt), "yyyy-MM-dd");
    switch (key) {
      case "id": return String(s.id);
      case "merchantName": return s.merchantName;
      case "merchantEmail": return s.merchantEmail ?? "";
      case "agentName": return agentName;
      case "agentEmail": return s.agent?.email ?? "";
      case "tier": return TIER_LABELS[s.tier] ?? s.tier;
      case "monthlyAmount": return s.monthlyAmount;
      case "status": return s.status;
      case "changeDate": return changeDate;
      case "startDate": return format(new Date(s.startDate), "yyyy-MM-dd");
      case "reactivatedAt": return s.reactivatedAt ? format(new Date(s.reactivatedAt), "yyyy-MM-dd") : "";
      case "reactivatedBy": return s.reactivatedBy ? `${s.reactivatedBy.firstName} ${s.reactivatedBy.lastName}` : "";
    }
  }

  function exportCsv() {
    const colMap = new Map(EXPORT_COLUMNS.map((c) => [c.key, c]));
    const cols = columnOrder
      .filter((k) => selectedColumns.has(k))
      .map((k) => colMap.get(k)!)
      .filter(Boolean);
    if (cols.length === 0) {
      toast({ title: "Select at least one column to export", variant: "destructive" });
      return;
    }

    const exportDate = format(new Date(), "yyyy-MM-dd HH:mm:ss");
    const statusLabel = statusFilter === "all" ? "All statuses" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1);
    let dateLabel: string;
    if (dateRangeFilter === "all") {
      dateLabel = "All time";
    } else if (dateRangeFilter === "7d") {
      dateLabel = "Last 7 days";
    } else if (dateRangeFilter === "30d") {
      dateLabel = "Last 30 days";
    } else if (dateRangeFilter === "custom") {
      const start = customStartDate || "—";
      const end = customEndDate || "—";
      dateLabel = `${start} to ${end}`;
    } else {
      dateLabel = dateRangeFilter;
    }
    const agentLabel = agentFilter === null
      ? "All agents"
      : resolveAgentName(agentFilter, subscriptions, agentSummary);
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const metaLines = [
      `${esc("Exported")},${esc(exportDate)}`,
      `${esc("Status filter")},${esc(statusLabel)}`,
      `${esc("Date range")},${esc(dateLabel)}`,
      `${esc("Agent filter")},${esc(agentLabel)}`,
      "",
    ];

    const headers = cols.map((c) => c.label);
    const rows = filteredSubscriptions.map((s) =>
      cols.map((c) => `"${getCellValue(c.key, s).replace(/"/g, '""')}"`).join(",")
    );
    const totalAmount = filteredSubscriptions.reduce((sum, s) => sum + Number(s.monthlyAmount), 0);
    const formattedTotal = `$${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const statusCounts: Record<string, number> = {};
    const statusMrr: Record<string, number> = {};
    for (const s of filteredSubscriptions) {
      statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1;
      statusMrr[s.status] = (statusMrr[s.status] ?? 0) + Number(s.monthlyAmount);
    }
    const statusOrder = ["active", "paused", "cancelled", "expired"];
    const orderedStatuses = [
      ...statusOrder.filter((st) => statusCounts[st]),
      ...Object.keys(statusCounts).filter((st) => !statusOrder.includes(st)),
    ];
    const statusBreakdown = orderedStatuses.map((st) => `${statusCounts[st]} ${st}`).join(", ");
    const mrrBreakdown = orderedStatuses.map((st) => {
      const amt = statusMrr[st] ?? 0;
      return `$${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${st}`;
    }).join(", ");
    const totalLabel = `${filteredSubscriptions.length} total`;
    const countLabel = statusBreakdown ? `${totalLabel} (${statusBreakdown})` : totalLabel;
    const summaryValues = cols.map((c, i) => {
      if (i === 0) return "Total";
      if (c.key === "monthlyAmount") return formattedTotal;
      if (c.key === "status") return countLabel;
      return "";
    });
    const summaryRow = summaryValues.map((v) => `"${v.replace(/"/g, '""')}"`).join(",");
    const mrrBreakdownValues = cols.map((c, i) => {
      if (i === 0) return "MRR by Status";
      if (c.key === "monthlyAmount") return mrrBreakdown;
      return "";
    });
    const mrrBreakdownRow = mrrBreakdownValues.map((v) => `"${v.replace(/"/g, '""')}"`).join(",");
    const csv = [...metaLines, headers.join(","), ...rows, summaryRow, mrrBreakdownRow].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subscriptions-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const activeFilterCount = [
    statusFilter !== "all",
    dateRangeFilter !== "all",
    agentFilter !== null,
  ].filter(Boolean).length;

  function clearAllFilters() {
    setStatusFilter("all");
    setDateRangeFilter("all");
    setCustomStartDate("");
    setCustomEndDate("");
    setAgentFilter(null);
    persistDateFilter("all", "", "");
    const params = new URLSearchParams(window.location.search);
    params.delete("range");
    params.delete("start");
    params.delete("end");
    params.delete("agentId");
    params.delete("status");
    const qs = params.toString();
    setLocation(qs ? `${window.location.pathname}?${qs}` : window.location.pathname, { replace: true });
  }

  function toggleColumn(key: ExportColumnKey) {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const [shareOnSave, setShareOnSave] = useState(false);

  function saveTemplate() {
    const trimmed = newTemplateName.trim();
    if (!trimmed) return;
    if (selectedColumns.size === 0) {
      toast({ title: "Select at least one column before saving a template", variant: "destructive" });
      return;
    }
    const orderedSelected = columnOrder.filter((k) => selectedColumns.has(k));
    createTemplateMutation.mutate(
      { name: trimmed, columns: orderedSelected, isShared: shareOnSave },
      {
        onSuccess: () => {
          setNewTemplateName("");
          setShowSaveForm(false);
          setShareOnSave(false);
          toast({ title: `Template "${trimmed}" saved` });
        },
      }
    );
  }

  function applyTemplate(template: ExportTemplate) {
    setSelectedColumns(new Set(template.columns));
    const allKeys = EXPORT_COLUMNS.map((c) => c.key);
    const rest = allKeys.filter((k) => !template.columns.includes(k));
    setColumnOrder([...template.columns, ...rest]);
  }

  function deleteTemplate(id: number, name: string) {
    deleteTemplateMutation.mutate(id, {
      onSuccess: () => toast({ title: `Template "${name}" deleted` }),
    });
  }

  function toggleTemplateSharing(template: ExportTemplate) {
    updateTemplateMutation.mutate(
      { id: template.id, isShared: !template.isShared },
      {
        onSuccess: () =>
          toast({ title: template.isShared ? `Template "${template.name}" is now private` : `Template "${template.name}" shared with all admins` }),
      }
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <RefreshCw className="w-6 h-6 text-primary" />
                Subscriptions
              </h1>
              <p className="text-gray-500 mt-1">Manage merchant subscriptions and commission payouts</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                data-testid="button-new-subscription"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Subscription
              </Button>
              <Button
                data-testid="button-calc-commissions"
                onClick={() => calcCommissionsMutation.mutate()}
                disabled={calcCommissionsMutation.isPending}
              >
                {calcCommissionsMutation.isPending
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <Zap className="w-4 h-4 mr-2" />
                }
                Calculate Commissions
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <Users className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Active</p>
                    <p className="text-2xl font-bold text-gray-900" data-testid="text-active-count">{activeCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">MRR</p>
                    <p className="text-2xl font-bold text-gray-900" data-testid="text-mrr">
                      ${mrr.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Subscriptions</p>
                    <p className="text-2xl font-bold text-gray-900" data-testid="text-total-subs">{totalSubs}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Agent Summary Panel */}
          {agentSummary.length > 0 && (
            <Card className="mb-6">
              <CardHeader className="pb-3 pt-4 px-5">
                <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-500" />
                  Agent Activity — Cancellations &amp; Pauses
                  <span className="text-xs font-normal text-gray-400 ml-1">Click an agent to filter the table</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="flex flex-wrap gap-2" data-testid="agent-summary-panel">
                  {agentSummary.map((summary) => {
                    const isSelected = agentFilter === summary.agentId;
                    return (
                      <button
                        key={summary.agentId}
                        data-testid={`chip-agent-${summary.agentId}`}
                        onClick={() => handleAgentFilterChange(isSelected ? null : summary.agentId)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-primary text-white border-primary shadow-sm"
                            : "bg-white text-gray-700 border-gray-200 hover:border-primary hover:text-primary"
                        }`}
                        aria-pressed={isSelected}
                      >
                        <span>{summary.agentName}</span>
                        {summary.cancelledCount > 0 && (
                          <span
                            data-testid={`chip-agent-cancelled-${summary.agentId}`}
                            className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full ${
                              isSelected
                                ? "bg-white/20 text-white"
                                : "bg-red-100 text-red-600"
                            }`}
                          >
                            {summary.cancelledCount} cancelled
                          </span>
                        )}
                        {summary.pausedCount > 0 && (
                          <span
                            data-testid={`chip-agent-paused-${summary.agentId}`}
                            className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full ${
                              isSelected
                                ? "bg-white/20 text-white"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {summary.pausedCount} paused
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Filter by status:</span>
            <Select
              value={statusFilter}
              onValueChange={(v) => { const s = v as StatusFilter; setStatusFilter(s); updateStatusInUrl(s); }}
            >
              <SelectTrigger className="w-44 h-9 text-sm" data-testid="select-status-filter">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex flex-wrap items-center gap-2 ml-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-600">Recently changed:</span>
              <Select
                value={dateRangeFilter}
                onValueChange={(v) => {
                  const next = v as DateRangeFilter;
                  setDateRangeFilter(next);
                  if (next !== "custom") {
                    setCustomStartDate("");
                    setCustomEndDate("");
                    updateDateRangeInUrl(next, "", "");
                  } else {
                    updateDateRangeInUrl(next, customStartDate, customEndDate);
                  }
                }}
              >
                <SelectTrigger className="w-44 h-9 text-sm" data-testid="select-date-range-filter">
                  <SelectValue placeholder="All time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
              </Select>

              {dateRangeFilter === "custom" && (
                <div className="flex items-center gap-2" data-testid="custom-date-range-inputs">
                  <CalendarRange className="w-4 h-4 text-gray-400" />
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => {
                      setCustomStartDate(e.target.value);
                      updateDateRangeInUrl("custom", e.target.value, customEndDate);
                    }}
                    className="h-9 text-sm w-36"
                    data-testid="input-custom-start-date"
                    aria-label="Start date"
                  />
                  <span className="text-sm text-gray-400">to</span>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => {
                      setCustomEndDate(e.target.value);
                      updateDateRangeInUrl("custom", customStartDate, e.target.value);
                    }}
                    className="h-9 text-sm w-36"
                    data-testid="input-custom-end-date"
                    aria-label="End date"
                    min={customStartDate || undefined}
                  />
                </div>
              )}
            </div>

            {agentFilter !== null && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium"
                data-testid="agent-filter-indicator"
              >
                <Users className="w-3.5 h-3.5" />
                <span>{selectedAgentSummary?.agentName ?? `Agent #${agentFilter}`}</span>
                <button
                  data-testid="button-clear-agent-filter"
                  onClick={() => handleAgentFilterChange(null)}
                  className="ml-0.5 hover:text-primary/70 transition-colors"
                  aria-label="Clear agent filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {activeFilterCount >= 2 && (
              <Button
                variant="outline"
                size="sm"
                data-testid="button-clear-all-filters"
                onClick={clearAllFilters}
                className="h-9 text-sm gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                Clear all filters
              </Button>
            )}

            {hasActiveFilters && (
              <span className="text-sm text-gray-500" data-testid="text-filter-count">
                {filteredSubscriptions.length} result{filteredSubscriptions.length !== 1 ? "s" : ""}
              </span>
            )}

            <div className="ml-auto flex items-center gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="button-csv-columns"
                    className="rounded-r-none border-r-0"
                    title="Choose export columns"
                  >
                    <Settings2 className="w-4 h-4" />
                    <span className="ml-1.5 text-xs text-gray-500">
                      {selectedColumns.size}/{EXPORT_COLUMNS.length}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-0">
                  <div className="px-3 py-2.5 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-800">Export columns</p>
                    <p className="text-xs text-gray-400 mt-0.5">Select columns and drag to reorder</p>
                  </div>

                  {/* Templates section */}
                  {templatesLoading && (
                    <div className="px-3 py-2 flex items-center gap-2 text-xs text-gray-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Loading templates…
                    </div>
                  )}
                  {!templatesLoading && templates.length > 0 && (
                    <>
                      <div className="px-3 pt-2 pb-1">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Saved templates</p>
                        <div className="space-y-1" data-testid="export-templates-list">
                          {templates.map((tpl) => {
                            const isOwner = tpl.adminId === user?.id;
                            const testSlug = tpl.name.replace(/\s+/g, "-").toLowerCase();
                            return (
                              <div
                                key={tpl.id}
                                className="flex items-center justify-between gap-1 group"
                                data-testid={`export-template-${testSlug}`}
                              >
                                <button
                                  className="flex-1 text-left text-sm text-gray-700 px-2 py-1 rounded hover:bg-gray-50 truncate"
                                  onClick={() => applyTemplate(tpl)}
                                  data-testid={`button-apply-template-${testSlug}`}
                                  title={`Apply "${tpl.name}" template`}
                                >
                                  {tpl.name}
                                </button>
                                {tpl.isShared && !isOwner && (
                                  <span
                                    className="shrink-0 text-xs text-blue-500 px-1"
                                    title="Shared by another admin"
                                    data-testid={`badge-shared-template-${testSlug}`}
                                  >
                                    <Share2 className="w-3 h-3" />
                                  </span>
                                )}
                                {isOwner && (
                                  <button
                                    className={`shrink-0 transition-colors p-1 rounded ${tpl.isShared ? "text-blue-400 hover:text-blue-600" : "text-gray-300 hover:text-blue-400"}`}
                                    onClick={() => toggleTemplateSharing(tpl)}
                                    data-testid={`button-toggle-share-template-${testSlug}`}
                                    title={tpl.isShared ? "Unshare template" : "Share with all admins"}
                                    aria-label={tpl.isShared ? `Unshare ${tpl.name}` : `Share ${tpl.name}`}
                                  >
                                    <Share2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {isOwner && (
                                  <button
                                    className="shrink-0 text-gray-300 hover:text-red-500 transition-colors p-1 rounded"
                                    onClick={() => deleteTemplate(tpl.id, tpl.name)}
                                    data-testid={`button-delete-template-${testSlug}`}
                                    title={`Delete "${tpl.name}" template`}
                                    aria-label={`Delete ${tpl.name}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <Separator />
                    </>
                  )}

                  <div className="py-2 max-h-52 overflow-y-auto" data-testid="column-order-list">
                    {(() => {
                      const colMap = new Map(EXPORT_COLUMNS.map((c) => [c.key, c]));
                      return columnOrder.map((key) => {
                        const col = colMap.get(key);
                        if (!col) return null;
                        return (
                          <div
                            key={col.key}
                            draggable
                            onDragStart={() => { draggedKeyRef.current = col.key; }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              if (draggedKeyRef.current && draggedKeyRef.current !== col.key) {
                                setColumnOrder((prev) => {
                                  const next = [...prev];
                                  const fromIdx = next.indexOf(draggedKeyRef.current!);
                                  const toIdx = next.indexOf(col.key);
                                  if (fromIdx === -1 || toIdx === -1) return prev;
                                  next.splice(fromIdx, 1);
                                  next.splice(toIdx, 0, draggedKeyRef.current!);
                                  return next;
                                });
                              }
                            }}
                            onDragEnd={() => { draggedKeyRef.current = null; }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 cursor-default group"
                            data-testid={`column-row-${col.key}`}
                          >
                            <span
                              className="text-gray-300 group-hover:text-gray-400 cursor-grab active:cursor-grabbing shrink-0"
                              title="Drag to reorder"
                              data-testid={`drag-handle-${col.key}`}
                            >
                              <GripVertical className="w-3.5 h-3.5" />
                            </span>
                            <label
                              htmlFor={`col-${col.key}`}
                              className="flex items-center gap-2 flex-1 cursor-pointer"
                            >
                              <Checkbox
                                id={`col-${col.key}`}
                                checked={selectedColumns.has(col.key)}
                                onCheckedChange={() => toggleColumn(col.key)}
                                data-testid={`checkbox-col-${col.key}`}
                              />
                              <span className="text-sm text-gray-700 select-none">
                                {col.label}
                              </span>
                            </label>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <Separator />
                  <div className="px-3 py-2 flex justify-between">
                    <button
                      className="text-xs text-primary hover:underline"
                      data-testid="button-col-select-all"
                      onClick={() => setSelectedColumns(new Set(EXPORT_COLUMNS.map((c) => c.key)))}
                    >
                      Select all
                    </button>
                    <button
                      className="text-xs text-amber-600 hover:underline"
                      data-testid="button-col-reset-defaults"
                      onClick={() => {
                        setSelectedColumns(new Set(DEFAULT_EXPORT_COLUMNS));
                        const defaultOrder = DEFAULT_EXPORT_COLUMNS;
                        const rest = EXPORT_COLUMNS.map((c) => c.key).filter((k) => !defaultOrder.includes(k));
                        setColumnOrder([...defaultOrder, ...rest]);
                      }}
                    >
                      Reset to defaults
                    </button>
                    <button
                      className="text-xs text-gray-400 hover:underline"
                      data-testid="button-col-clear-all"
                      onClick={() => setSelectedColumns(new Set())}
                    >
                      Clear all
                    </button>
                  </div>
                  <Separator />

                  {/* Save as template */}
                  <div className="px-3 py-2">
                    {showSaveForm ? (
                      <div className="space-y-1.5" data-testid="save-template-form">
                        <div className="flex gap-1.5">
                          <Input
                            autoFocus
                            placeholder="Template name"
                            value={newTemplateName}
                            onChange={(e) => setNewTemplateName(e.target.value)}
                            className="h-7 text-xs flex-1"
                            data-testid="input-template-name"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveTemplate();
                              if (e.key === "Escape") { setShowSaveForm(false); setNewTemplateName(""); setShareOnSave(false); }
                            }}
                          />
                          <button
                            className="shrink-0 text-primary hover:text-primary/80 transition-colors p-1 rounded"
                            onClick={saveTemplate}
                            data-testid="button-save-template-confirm"
                            aria-label="Confirm save template"
                            disabled={!newTemplateName.trim() || createTemplateMutation.isPending}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded"
                            onClick={() => { setShowSaveForm(false); setNewTemplateName(""); setShareOnSave(false); }}
                            data-testid="button-save-template-cancel"
                            aria-label="Cancel save template"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <label
                          className="flex items-center gap-1.5 cursor-pointer"
                          data-testid="label-share-on-save"
                        >
                          <Checkbox
                            checked={shareOnSave}
                            onCheckedChange={(v) => setShareOnSave(Boolean(v))}
                            data-testid="checkbox-share-on-save"
                            className="h-3.5 w-3.5"
                          />
                          <span className="text-xs text-gray-500">Share with all admins</span>
                        </label>
                      </div>
                    ) : (
                      <button
                        className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                        onClick={() => setShowSaveForm(true)}
                        data-testid="button-save-as-template"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        Save as template
                      </button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                variant="outline"
                size="sm"
                className="rounded-l-none"
                data-testid="button-export-csv"
                onClick={exportCsv}
                disabled={filteredSubscriptions.length === 0 || selectedColumns.size === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Date Range Summary Card */}
          {showDateRangeSummary && dateRangeSummary && (
            <Card className="mb-4 border-primary/20 bg-primary/5" data-testid="date-range-summary-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarRange className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-gray-700">
                    {dateRangeFilter === "7d"
                      ? "Summary: Last 7 days"
                      : dateRangeFilter === "30d"
                      ? "Summary: Last 30 days"
                      : `Summary${
                          customStartDate && customEndDate
                            ? `: ${format(new Date(customStartDate + "T00:00:00"), "MMM d, yyyy")} – ${format(new Date(customEndDate + "T00:00:00"), "MMM d, yyyy")}`
                            : customStartDate
                            ? `: from ${format(new Date(customStartDate + "T00:00:00"), "MMM d, yyyy")}`
                            : `: until ${format(new Date(customEndDate + "T00:00:00"), "MMM d, yyyy")}`
                        }`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4">
                  <button
                    data-testid="summary-new-count"
                    aria-pressed={statusFilter === "active"}
                    onClick={() => {
                      const next: StatusFilter = statusFilter === "active" ? "all" : "active";
                      setStatusFilter(next);
                      updateStatusInUrl(next);
                    }}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1 transition-colors cursor-pointer ${
                      statusFilter === "active"
                        ? "ring-2 ring-green-400 bg-green-50"
                        : "hover:bg-green-50"
                    }`}
                  >
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-100 text-green-700 font-bold text-sm">
                      {dateRangeSummary.newCount}
                    </span>
                    <span className="text-sm text-gray-600">
                      New subscription{dateRangeSummary.newCount !== 1 ? "s" : ""}
                    </span>
                  </button>
                  <button
                    data-testid="summary-paused-count"
                    aria-pressed={statusFilter === "paused"}
                    onClick={() => {
                      const next: StatusFilter = statusFilter === "paused" ? "all" : "paused";
                      setStatusFilter(next);
                      updateStatusInUrl(next);
                    }}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1 transition-colors cursor-pointer ${
                      statusFilter === "paused"
                        ? "ring-2 ring-yellow-400 bg-yellow-50"
                        : "hover:bg-yellow-50"
                    }`}
                  >
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-yellow-100 text-yellow-700 font-bold text-sm">
                      {dateRangeSummary.pausedCount}
                    </span>
                    <span className="text-sm text-gray-600">
                      Paused
                    </span>
                  </button>
                  <button
                    data-testid="summary-cancelled-count"
                    aria-pressed={statusFilter === "cancelled"}
                    onClick={() => {
                      const next: StatusFilter = statusFilter === "cancelled" ? "all" : "cancelled";
                      setStatusFilter(next);
                      updateStatusInUrl(next);
                    }}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1 transition-colors cursor-pointer ${
                      statusFilter === "cancelled"
                        ? "ring-2 ring-red-400 bg-red-50"
                        : "hover:bg-red-50"
                    }`}
                  >
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 text-red-700 font-bold text-sm">
                      {dateRangeSummary.cancelledCount}
                    </span>
                    <span className="text-sm text-gray-600">
                      Cancelled
                    </span>
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Table */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredSubscriptions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                {!hasActiveFilters
                  ? "No subscriptions found."
                  : `No ${statusFilter === "all" ? "" : statusFilter + " "}subscriptions found${agentFilter !== null && selectedAgentSummary ? ` for ${selectedAgentSummary.agentName}` : ""}${
                      dateRangeFilter === "7d"
                        ? " in the last 7 days"
                        : dateRangeFilter === "30d"
                        ? " in the last 30 days"
                        : dateRangeFilter === "custom" && (customStartDate || customEndDate)
                        ? " for the selected date range"
                        : ""
                    }.`}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Merchant</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Monthly</TableHead>
                      <TableHead>Paired Deal</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubscriptions.map((sub) => (
                      <TableRow key={sub.id} data-testid={`row-subscription-${sub.id}`}>
                        <TableCell className="font-mono text-sm">#{sub.id}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{sub.merchantName}</p>
                            {sub.merchantEmail && (
                              <p className="text-xs text-gray-400">{sub.merchantEmail}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            {sub.agent?.firstName ? (
                              <>
                                <p className="font-medium text-sm" data-testid={`text-agent-name-${sub.id}`}>{sub.agent.firstName} {sub.agent.lastName}</p>
                                <p className="text-xs text-gray-400">#{sub.agentId}</p>
                              </>
                            ) : (
                              <span className="text-sm text-gray-500">#{sub.agentId}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {TIER_LABELS[sub.tier] ?? sub.tier}
                        </TableCell>
                        <TableCell className="font-medium">
                          ${Number(sub.monthlyAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          {sub.mcaPairedDealId ? (
                            <span className="text-primary font-medium">#{sub.mcaPairedDealId}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {format(new Date(sub.startDate), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <div>
                            <Badge className={STATUS_COLORS[sub.status] ?? ""}>
                              {sub.status}
                            </Badge>
                            {sub.status === "cancelled" && sub.cancelledAt && (
                              <p className="text-xs text-red-500 font-medium mt-1" data-testid={`text-cancelled-at-${sub.id}`}>
                                Cancelled on {format(new Date(sub.cancelledAt), "MMM d, yyyy")}
                                {sub.cancelledBy && (
                                  <span className="block text-gray-400 font-normal" data-testid={`text-cancelled-by-${sub.id}`}>
                                    by {sub.cancelledBy.firstName} {sub.cancelledBy.lastName}
                                  </span>
                                )}
                              </p>
                            )}
                            {sub.status === "paused" && sub.pausedAt && (
                              <p className="text-xs text-yellow-600 font-medium mt-1" data-testid={`text-paused-at-${sub.id}`}>
                                Paused on {format(new Date(sub.pausedAt), "MMM d, yyyy")}
                                {sub.pausedBy && (
                                  <span className="block text-gray-400 font-normal" data-testid={`text-paused-by-${sub.id}`}>
                                    by {sub.pausedBy.firstName} {sub.pausedBy.lastName}
                                  </span>
                                )}
                              </p>
                            )}
                            {sub.status === "active" && sub.reactivatedAt && (
                              <p className="text-xs text-green-600 font-medium mt-1" data-testid={`text-reactivated-at-${sub.id}`}>
                                Reactivated on {format(new Date(sub.reactivatedAt), "MMM d, yyyy")}
                                {sub.reactivatedBy && (
                                  <span className="block text-gray-400 font-normal" data-testid={`text-reactivated-by-${sub.id}`}>
                                    by {sub.reactivatedBy.firstName} {sub.reactivatedBy.lastName}
                                  </span>
                                )}
                              </p>
                            )}
                            {sub.endDate && (
                              <p className="text-xs text-orange-600 font-medium mt-1 flex items-center gap-1" data-testid={`text-end-date-${sub.id}`}>
                                <CalendarDays className="w-3 h-3" />
                                Expires {format(new Date(sub.endDate), "MMM d, yyyy")}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Select
                              value={sub.status}
                              onValueChange={(v) => updateStatusMutation.mutate({ id: sub.id, status: v })}
                            >
                              <SelectTrigger
                                className="w-36 h-8 text-sm"
                                data-testid={`select-status-${sub.id}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="paused">Paused</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                                <SelectItem value="expired">Expired</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-400 hover:text-orange-500"
                              title="Set expiration date"
                              data-testid={`button-end-date-${sub.id}`}
                              onClick={() => {
                                setEditEndDateSubId(sub.id);
                                setEditEndDateValue(sub.endDate ? sub.endDate.split("T")[0] : "");
                              }}
                            >
                              <CalendarDays className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-400 hover:text-primary"
                              title="View history"
                              data-testid={`button-history-${sub.id}`}
                              onClick={() => setHistorySubId(sub.id)}
                            >
                              <History className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </div>
      </main>

      {/* Create Subscription Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) setShowCreateDialog(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              New Subscription
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-agent">Agent</Label>
              <Select
                value={createForm.agentId}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, agentId: v }))}
              >
                <SelectTrigger id="create-agent" data-testid="select-create-agent">
                  <SelectValue placeholder="Select agent…" />
                </SelectTrigger>
                <SelectContent>
                  {allAgents.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.firstName} {a.lastName} (#{a.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-merchant">Merchant Name</Label>
              <Input
                id="create-merchant"
                data-testid="input-create-merchant"
                placeholder="Merchant name"
                value={createForm.merchantName}
                onChange={(e) => setCreateForm((f) => ({ ...f, merchantName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-email">Merchant Email <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Input
                id="create-email"
                data-testid="input-create-email"
                type="email"
                placeholder="merchant@example.com"
                value={createForm.merchantEmail}
                onChange={(e) => setCreateForm((f) => ({ ...f, merchantEmail: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-tier">Tier</Label>
              <Select
                value={createForm.tier}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, tier: v as typeof f.tier }))}
              >
                <SelectTrigger id="create-tier" data-testid="select-create-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tier_1">Tier 1 — $199/mo</SelectItem>
                  <SelectItem value="tier_2">Tier 2 — $399/mo</SelectItem>
                  <SelectItem value="tier_3">Tier 3 — $799/mo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="create-start">Start Date <span className="text-gray-400 font-normal">(optional)</span></Label>
                <Input
                  id="create-start"
                  data-testid="input-create-start"
                  type="date"
                  value={createForm.startDate}
                  onChange={(e) => setCreateForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-end">End Date <span className="text-gray-400 font-normal">(optional)</span></Label>
                <Input
                  id="create-end"
                  data-testid="input-create-end"
                  type="date"
                  value={createForm.endDate}
                  onChange={(e) => setCreateForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button
              data-testid="button-create-submit"
              disabled={!createForm.agentId || !createForm.merchantName || createSubscriptionMutation.isPending}
              onClick={() => {
                if (!createForm.agentId || !createForm.merchantName) return;
                createSubscriptionMutation.mutate({
                  agentId: Number(createForm.agentId),
                  merchantName: createForm.merchantName,
                  merchantEmail: createForm.merchantEmail || undefined,
                  tier: createForm.tier,
                  startDate: createForm.startDate || undefined,
                  endDate: createForm.endDate || undefined,
                });
              }}
            >
              {createSubscriptionMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit End Date Dialog */}
      <Dialog open={editEndDateSubId != null} onOpenChange={(open) => { if (!open) { setEditEndDateSubId(null); setEditEndDateValue(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-orange-500" />
              Set Expiration Date
              {editEndDateSubId != null && (
                <span className="text-sm font-normal text-gray-500 ml-1">
                  — #{editEndDateSubId} {subscriptions.find(s => s.id === editEndDateSubId)?.merchantName ? `· ${subscriptions.find(s => s.id === editEndDateSubId)!.merchantName}` : ""}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <p className="text-sm text-gray-500">
              Set or clear the date when this subscription will automatically expire. Leave blank to remove the expiration date.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="edit-end-date">Expiration Date</Label>
              <Input
                id="edit-end-date"
                data-testid="input-edit-end-date"
                type="date"
                value={editEndDateValue}
                onChange={(e) => setEditEndDateValue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              data-testid="button-end-date-clear"
              disabled={updateEndDateMutation.isPending}
              onClick={() => {
                if (editEndDateSubId != null) {
                  updateEndDateMutation.mutate({ id: editEndDateSubId, endDate: null });
                }
              }}
            >
              Clear Date
            </Button>
            <Button
              data-testid="button-end-date-save"
              disabled={!editEndDateValue || updateEndDateMutation.isPending}
              onClick={() => {
                if (editEndDateSubId != null && editEndDateValue) {
                  updateEndDateMutation.mutate({ id: editEndDateSubId, endDate: editEndDateValue });
                }
              }}
            >
              {updateEndDateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscription History Dialog */}
      <Dialog open={historySubId != null} onOpenChange={(open) => { if (!open) setHistorySubId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Subscription History
              {historySubId != null && (
                <span className="text-sm font-normal text-gray-500 ml-1">
                  — #{historySubId} {subscriptions.find(s => s.id === historySubId)?.merchantName ? `· ${subscriptions.find(s => s.id === historySubId)!.merchantName}` : ""}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-2" data-testid="subscription-history-panel">
            {historyLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : historyEntries.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No activity recorded for this subscription.</p>
            ) : (
              <ol className="relative border-l border-gray-200 ml-3 space-y-4">
                {historyEntries.map((entry) => (
                  <li key={entry.id} className="ml-4" data-testid={`history-entry-${entry.id}`}>
                    <span className="absolute -left-1.5 mt-1 w-3 h-3 rounded-full bg-primary border-2 border-white" />
                    <div className="flex items-start gap-2 flex-wrap">
                      <Badge
                        className={`text-xs ${ACTION_COLORS[entry.action] ?? "bg-gray-100 text-gray-600"}`}
                        data-testid={`text-history-action-${entry.id}`}
                      >
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </Badge>
                      <span className="text-sm font-medium text-gray-800" data-testid={`text-history-actor-${entry.id}`}>
                        {entry.actorName}
                      </span>
                      <Badge
                        className={`text-xs ${
                          entry.actorType === "admin"
                            ? "bg-purple-100 text-purple-700 border-purple-200"
                            : entry.actorType === "system"
                            ? "bg-gray-100 text-gray-500 border-gray-200"
                            : "bg-blue-100 text-blue-700 border-blue-200"
                        }`}
                        data-testid={`badge-history-actortype-${entry.id}`}
                      >
                        {entry.actorType === "admin" ? "Admin" : entry.actorType === "system" ? "System" : "Agent"}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5" data-testid={`text-history-date-${entry.id}`}>
                      {format(new Date(entry.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                    {entry.description && (
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{entry.description}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
