import { AdminLayout } from "@/components/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Database,
  CheckCircle2,
  Clock,
  RotateCcw,
  AlertTriangle,
  Play,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  MoveRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

type MigrationEntry = {
  name: string;
  hasDown: boolean;
  appliedAt: string | null;
};

type DuplicatePlacement = {
  placementId: number;
  leg: string;
  agentIds: number[];
};

type DuplicatePlacementsResponse = {
  duplicates: DuplicatePlacement[];
  report: string | null;
};

const PLACEMENT_UNIQUE_MIGRATION = "016_add_agents_placement_leg_unique_index";

export default function AdminMigrations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: migrations,
    isLoading,
    isFetching,
  } = useQuery<MigrationEntry[]>({
    queryKey: ["/api/admin/migrations"],
  });

  const { data: duplicatePlacements } = useQuery<DuplicatePlacementsResponse>({
    queryKey: ["/api/admin/migrations/duplicate-placements"],
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/migrations"] });
    queryClient.invalidateQueries({
      queryKey: ["/api/admin/migrations/duplicate-placements"],
    });
  };

  const relocateMutation = useMutation({
    mutationFn: async (agentId: number) => {
      const res = await fetch(`/api/admin/agents/${agentId}/relocate-placement`, {
        method: "POST",
        credentials: "include",
      });
      const body: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof body === "object" &&
          body !== null &&
          "message" in body &&
          typeof (body as Record<string, unknown>).message === "string"
            ? ((body as Record<string, unknown>).message as string)
            : "Failed to relocate agent";
        throw new Error(msg);
      }
      return body;
    },
    onSuccess: () => {
      toast({
        title: "Agent relocated",
        description: "The agent has been moved to an open placement slot.",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/migrations/duplicate-placements"],
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "Relocation failed",
        description: err instanceof Error ? err.message : "Failed to relocate agent",
        variant: "destructive",
      });
    },
  });

  const revertMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(
        `/api/admin/migrations/${encodeURIComponent(name)}/revert`,
        { method: "POST", credentials: "include" },
      );
      const body: unknown = await res.json();
      if (!res.ok) {
        const serverMessage =
          typeof body === "object" &&
          body !== null &&
          "message" in body &&
          typeof (body as Record<string, unknown>).message === "string"
            ? ((body as Record<string, unknown>).message as string)
            : "Failed to revert migration";
        throw new Error(serverMessage);
      }
      return body;
    },
    onSuccess: (_data, name) => {
      toast({
        title: "Migration reverted",
        description: `"${name}" was rolled back successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/migrations"] });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Failed to revert migration";
      toast({
        title: "Revert failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  type ChainResult = {
    name: string;
    status: "reverted" | "failed" | "skipped";
    message: string;
  };

  const revertChainMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(
        `/api/admin/migrations/${encodeURIComponent(name)}/revert-chain`,
        { method: "POST", credentials: "include" },
      );
      const body: unknown = await res.json();
      if (!res.ok) {
        const serverMessage =
          typeof body === "object" &&
          body !== null &&
          "message" in body &&
          typeof (body as Record<string, unknown>).message === "string"
            ? ((body as Record<string, unknown>).message as string)
            : "Failed to revert migration chain";
        throw new Error(serverMessage);
      }
      return body as { success: boolean; results: ChainResult[] };
    },
    onSuccess: (data, name) => {
      const reverted = data.results.filter((r) => r.status === "reverted");
      if (data.success) {
        toast({
          title: "Migration chain reverted",
          description: `Rolled back ${reverted.length} migration${reverted.length === 1 ? "" : "s"} ending with "${name}".`,
        });
      } else {
        const failedStep = data.results.find((r) => r.status === "failed");
        toast({
          title: "Chain revert stopped",
          description: `Reverted ${reverted.length} migration${reverted.length === 1 ? "" : "s"} before "${failedStep?.name ?? name}" failed. The rest were not reverted.`,
          variant: "destructive",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/migrations"] });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Failed to revert migration chain";
      toast({
        title: "Chain revert failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  type ApplyChainResult = {
    name: string;
    status: "applied" | "failed" | "skipped";
    message: string;
  };

  const applyChainMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(
        `/api/admin/migrations/${encodeURIComponent(name)}/apply-chain`,
        { method: "POST", credentials: "include" },
      );
      const body: unknown = await res.json();
      if (!res.ok) {
        const serverMessage =
          typeof body === "object" &&
          body !== null &&
          "message" in body &&
          typeof (body as Record<string, unknown>).message === "string"
            ? ((body as Record<string, unknown>).message as string)
            : "Failed to apply migration chain";
        throw new Error(serverMessage);
      }
      return body as { success: boolean; results: ApplyChainResult[] };
    },
    onSuccess: (data, name) => {
      const applied = data.results.filter((r) => r.status === "applied");
      if (data.success) {
        toast({
          title: "Migration chain applied",
          description: `Applied ${applied.length} migration${applied.length === 1 ? "" : "s"} ending with "${name}".`,
        });
      } else {
        const failedStep = data.results.find((r) => r.status === "failed");
        toast({
          title: "Chain apply stopped",
          description: `Applied ${applied.length} migration${applied.length === 1 ? "" : "s"} before "${failedStep?.name ?? name}" failed. The rest were not applied.`,
          variant: "destructive",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/migrations"] });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Failed to apply migration chain";
      toast({
        title: "Chain apply failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const applyMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(
        `/api/admin/migrations/${encodeURIComponent(name)}/apply`,
        { method: "POST", credentials: "include" },
      );
      const body: unknown = await res.json();
      if (!res.ok) {
        const serverMessage =
          typeof body === "object" &&
          body !== null &&
          "message" in body &&
          typeof (body as Record<string, unknown>).message === "string"
            ? ((body as Record<string, unknown>).message as string)
            : "Failed to apply migration";
        throw new Error(serverMessage);
      }
      return body;
    },
    onSuccess: (_data, name) => {
      toast({
        title: "Migration applied",
        description: `"${name}" was applied successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/migrations"] });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Failed to apply migration";
      toast({
        title: "Apply failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const applied = migrations?.filter((m) => m.appliedAt) ?? [];
  const pending = migrations?.filter((m) => !m.appliedAt) ?? [];

  // Set of applied migration names for quick lookup
  const appliedNames = new Set(applied.map((m) => m.name));

  // For each pending migration, find any earlier migrations (by list order) that are not applied
  function unappliedPredecessors(migrationName: string): string[] {
    if (!migrations) return [];
    const idx = migrations.findIndex((m) => m.name === migrationName);
    return migrations
      .slice(0, idx)
      .filter((m) => !appliedNames.has(m.name))
      .map((m) => m.name);
  }

  // For each applied migration, find any later migrations (by list order) that are still applied
  function appliedSuccessors(migrationName: string): string[] {
    if (!migrations) return [];
    const idx = migrations.findIndex((m) => m.name === migrationName);
    return migrations
      .slice(idx + 1)
      .filter((m) => appliedNames.has(m.name))
      .map((m) => m.name);
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Database className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Database Migrations
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              View applied migrations and roll back if needed
            </p>
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-400">
              Loading migrations…
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Applied Migrations */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Applied Migrations
                      <Badge
                        variant="secondary"
                        className="ml-1"
                        data-testid="badge-applied-count"
                      >
                        {applied.length}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-1.5">
                      These migrations have been applied to the database. Use
                      Revert to roll back a migration.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isFetching}
                    data-testid="button-refresh-migrations"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`}
                    />
                    {isFetching ? "Refreshing…" : "Refresh"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {applied.length === 0 ? (
                  <p className="px-6 py-4 text-sm text-gray-400">
                    No migrations have been applied yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {applied.map((m) => {
                      const successors = appliedSuccessors(m.name);
                      const isUnsafeRevert = successors.length > 0;
                      return (
                        <li
                          key={m.name}
                          className="flex items-center justify-between px-6 py-4"
                          data-testid={`migration-row-${m.name}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p
                                className="text-sm font-mono font-medium text-gray-800 truncate"
                                data-testid={`text-migration-name-${m.name}`}
                              >
                                {m.name}
                              </p>
                              {m.hasDown ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span
                                      data-testid={`badge-reversible-${m.name}`}
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <span className="text-xs">
                                      Reversible — rollback is available
                                    </span>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span
                                      data-testid={`badge-no-rollback-${m.name}`}
                                    >
                                      <ShieldOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <span className="text-xs">
                                      No rollback defined
                                    </span>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {isUnsafeRevert && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span
                                      data-testid={`badge-unsafe-revert-${m.name}`}
                                    >
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <span className="text-xs">
                                      Reverting is unsafe — later migration
                                      {successors.length > 1 ? "s are" : " is"}{" "}
                                      still applied: {successors.join(", ")}
                                    </span>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              Applied{" "}
                              {m.appliedAt
                                ? new Date(m.appliedAt).toLocaleString()
                                : ""}
                            </p>
                            {isUnsafeRevert && (
                              <p
                                className="text-xs text-amber-600 mt-0.5 flex items-center gap-1"
                                data-testid={`text-unsafe-revert-${m.name}`}
                              >
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                Cannot revert — later migration
                                {successors.length > 1 ? "s" : ""} still
                                applied:{" "}
                                <span className="font-mono">
                                  {successors.join(", ")}
                                </span>
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 ml-4 shrink-0">
                            {isUnsafeRevert &&
                              (() => {
                                const revertOrder = [...successors]
                                  .reverse()
                                  .concat(m.name);
                                return (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                        disabled={revertChainMutation.isPending}
                                        data-testid={`button-revert-chain-${m.name}`}
                                      >
                                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                                        Revert all dependent
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>
                                          Revert this migration and its
                                          dependents?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription asChild>
                                          <div className="space-y-3">
                                            <p>
                                              To revert{" "}
                                              <span className="font-mono font-semibold">
                                                {m.name}
                                              </span>
                                              , the later migrations applied
                                              after it must be rolled back
                                              first. The following{" "}
                                              {revertOrder.length} migrations
                                              will be reverted in this order:
                                            </p>
                                            <ol
                                              className="list-decimal list-inside space-y-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5"
                                              data-testid={`list-revert-chain-${m.name}`}
                                            >
                                              {revertOrder.map((n) => (
                                                <li
                                                  key={n}
                                                  className="text-sm font-mono text-gray-800"
                                                  data-testid={`list-revert-chain-item-${n}`}
                                                >
                                                  {n}
                                                  {n === m.name && (
                                                    <span className="ml-1.5 text-xs font-sans text-gray-500">
                                                      (target)
                                                    </span>
                                                  )}
                                                </li>
                                              ))}
                                            </ol>
                                            <p className="text-sm text-gray-500">
                                              This modifies the database schema
                                              and cannot be undone without
                                              re-applying these migrations. If
                                              any step fails, the remaining
                                              migrations are left untouched.
                                            </p>
                                          </div>
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel data-testid="button-cancel-revert-chain">
                                          Cancel
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                          className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                                          onClick={() =>
                                            revertChainMutation.mutate(m.name)
                                          }
                                          data-testid="button-confirm-revert-chain"
                                        >
                                          Revert {revertOrder.length} migrations
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                );
                              })()}
                            {m.hasDown ? (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                    disabled={revertMutation.isPending}
                                    data-testid={`button-revert-${m.name}`}
                                  >
                                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                                    Revert
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Revert migration?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription asChild>
                                      <div className="space-y-3">
                                        <p>
                                          This will run the rollback for{" "}
                                          <span className="font-mono font-semibold">
                                            {m.name}
                                          </span>
                                          . This action modifies the database
                                          schema and cannot be undone without
                                          re-applying the migration.
                                        </p>
                                        {isUnsafeRevert && (
                                          <div
                                            className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-800"
                                            data-testid={`warning-unsafe-revert-dialog-${m.name}`}
                                          >
                                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                                            <p className="text-sm font-medium">
                                              This revert will be blocked. The
                                              following later migration
                                              {successors.length > 1
                                                ? "s are"
                                                : " is"}{" "}
                                              still applied and must be reverted
                                              first:{" "}
                                              <span className="font-mono font-semibold">
                                                {successors.join(", ")}
                                              </span>
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel data-testid="button-cancel-revert">
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                                      onClick={() =>
                                        revertMutation.mutate(m.name)
                                      }
                                      data-testid="button-confirm-revert"
                                    >
                                      Revert migration
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="ml-4">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled
                                      className="pointer-events-none opacity-50"
                                      data-testid={`button-revert-disabled-${m.name}`}
                                    >
                                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                                      Revert
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                                    This migration has no rollback defined
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Pending Migrations */}
            {pending.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-500" />
                    Pending Migrations
                    <Badge
                      variant="secondary"
                      className="ml-1"
                      data-testid="badge-pending-count"
                    >
                      {pending.length}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    These migrations are defined but have not yet been applied.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-gray-100">
                    {pending.map((m) => {
                      const blockers = unappliedPredecessors(m.name);
                      const isBlocked = blockers.length > 0;
                      return (
                        <li
                          key={m.name}
                          className="flex items-center justify-between px-6 py-4"
                          data-testid={`migration-row-pending-${m.name}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-mono font-medium text-gray-500 truncate">
                                {m.name}
                              </p>
                              {m.hasDown ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span
                                      data-testid={`badge-reversible-${m.name}`}
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <span className="text-xs">
                                      Reversible — rollback is available
                                    </span>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span
                                      data-testid={`badge-no-rollback-${m.name}`}
                                    >
                                      <ShieldOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <span className="text-xs">
                                      No rollback defined
                                    </span>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            {isBlocked ? (
                              <p
                                className="text-xs text-amber-600 mt-0.5 flex items-center gap-1"
                                data-testid={`text-blocked-${m.name}`}
                              >
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                Requires earlier migration
                                {blockers.length > 1 ? "s" : ""} to be applied
                                first:{" "}
                                <span className="font-mono">
                                  {blockers.join(", ")}
                                </span>
                              </p>
                            ) : (
                              <p className="text-xs text-gray-400 mt-0.5">
                                Not yet applied
                              </p>
                            )}
                            {m.name === PLACEMENT_UNIQUE_MIGRATION &&
                              duplicatePlacements &&
                              duplicatePlacements.duplicates.length > 0 && (
                                <div
                                  className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-800"
                                  data-testid={`warning-duplicate-placements-${m.name}`}
                                >
                                  <div className="flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium">
                                        Waiting on data cleanup —{" "}
                                        {duplicatePlacements.duplicates.length}{" "}
                                        placement slot
                                        {duplicatePlacements.duplicates
                                          .length === 1
                                          ? ""
                                          : "s"}{" "}
                                        {duplicatePlacements.duplicates
                                          .length === 1
                                          ? "is"
                                          : "are"}{" "}
                                        occupied by more than one agent. Move
                                        the extra agent(s) to an open slot
                                        before this index can be created.
                                      </p>
                                      <ul
                                        className="mt-2 space-y-3"
                                        data-testid={`list-duplicate-placements-${m.name}`}
                                      >
                                        {duplicatePlacements.duplicates.map(
                                          (d) => (
                                            <li
                                              key={`${d.placementId}-${d.leg}`}
                                              className="rounded border border-amber-200 bg-white px-3 py-2"
                                              data-testid={`duplicate-placement-${d.placementId}-${d.leg}`}
                                            >
                                              <p className="text-xs font-mono font-semibold text-amber-900 mb-1.5">
                                                Parent #{d.placementId},{" "}
                                                {d.leg} leg
                                              </p>
                                              <ul className="space-y-1.5">
                                                {d.agentIds.map(
                                                  (agentId, idx) => (
                                                    <li
                                                      key={agentId}
                                                      className="flex items-center gap-2"
                                                      data-testid={`conflict-agent-${d.placementId}-${d.leg}-${agentId}`}
                                                    >
                                                      <span className="text-xs font-mono text-amber-800 w-16 shrink-0">
                                                        Agent #{agentId}
                                                      </span>
                                                      {idx === 0 ? (
                                                        <span className="text-xs text-amber-600 italic">
                                                          stays in slot
                                                        </span>
                                                      ) : (
                                                        <AlertDialog>
                                                          <AlertDialogTrigger
                                                            asChild
                                                          >
                                                            <Button
                                                              variant="outline"
                                                              size="sm"
                                                              className="h-6 px-2 text-xs text-blue-700 border-blue-200 hover:bg-blue-50 hover:text-blue-800"
                                                              disabled={
                                                                relocateMutation.isPending
                                                              }
                                                              data-testid={`button-relocate-${agentId}`}
                                                            >
                                                              <MoveRight className="w-3 h-3 mr-1" />
                                                              Move to open slot
                                                            </Button>
                                                          </AlertDialogTrigger>
                                                          <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                              <AlertDialogTitle>
                                                                Move agent #
                                                                {agentId} to an
                                                                open slot?
                                                              </AlertDialogTitle>
                                                              <AlertDialogDescription
                                                                asChild
                                                              >
                                                                <div className="space-y-2 text-sm text-gray-600">
                                                                  <p>
                                                                    Agent #
                                                                    {agentId}{" "}
                                                                    currently
                                                                    shares the{" "}
                                                                    <span className="font-mono font-semibold">
                                                                      {d.leg}{" "}
                                                                      leg under
                                                                      agent #
                                                                      {
                                                                        d.placementId
                                                                      }
                                                                    </span>{" "}
                                                                    with agent #
                                                                    {
                                                                      d
                                                                        .agentIds[0]
                                                                    }
                                                                    .
                                                                  </p>
                                                                  <p>
                                                                    This will
                                                                    move agent #
                                                                    {agentId} to
                                                                    the next
                                                                    available
                                                                    open slot
                                                                    under their
                                                                    sponsor.
                                                                    Their
                                                                    commissions,
                                                                    deals, and
                                                                    team
                                                                    relationships
                                                                    are not
                                                                    affected.
                                                                  </p>
                                                                </div>
                                                              </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                              <AlertDialogCancel
                                                                data-testid={`button-cancel-relocate-${agentId}`}
                                                              >
                                                                Cancel
                                                              </AlertDialogCancel>
                                                              <AlertDialogAction
                                                                className="bg-blue-700 hover:bg-blue-800 focus:ring-blue-700"
                                                                onClick={() =>
                                                                  relocateMutation.mutate(
                                                                    agentId,
                                                                  )
                                                                }
                                                                data-testid={`button-confirm-relocate-${agentId}`}
                                                              >
                                                                Move agent #
                                                                {agentId}
                                                              </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                          </AlertDialogContent>
                                                        </AlertDialog>
                                                      )}
                                                    </li>
                                                  ),
                                                )}
                                              </ul>
                                            </li>
                                          ),
                                        )}
                                      </ul>
                                    </div>
                                  </div>
                                </div>
                              )}
                          </div>
                          {isBlocked ? (
                            <div className="flex items-center gap-2 ml-4 shrink-0">
                              {(() => {
                                const applyOrder = [...blockers, m.name];
                                return (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-green-700 border-green-200 hover:bg-green-50 hover:text-green-800"
                                        disabled={applyChainMutation.isPending}
                                        data-testid={`button-apply-chain-${m.name}`}
                                      >
                                        <Play className="w-3.5 h-3.5 mr-1.5" />
                                        Apply all required
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>
                                          Apply this migration and its
                                          prerequisites?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription asChild>
                                          <div className="space-y-3">
                                            <p>
                                              To apply{" "}
                                              <span className="font-mono font-semibold">
                                                {m.name}
                                              </span>
                                              , the earlier migrations that it
                                              depends on must be applied first.
                                              The following{" "}
                                              {applyOrder.length} migrations
                                              will be applied in this order:
                                            </p>
                                            <ol
                                              className="list-decimal list-inside space-y-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5"
                                              data-testid={`list-apply-chain-${m.name}`}
                                            >
                                              {applyOrder.map((n) => (
                                                <li
                                                  key={n}
                                                  className="text-sm font-mono text-gray-800"
                                                  data-testid={`list-apply-chain-item-${n}`}
                                                >
                                                  {n}
                                                  {n === m.name && (
                                                    <span className="ml-1.5 text-xs font-sans text-gray-500">
                                                      (target)
                                                    </span>
                                                  )}
                                                </li>
                                              ))}
                                            </ol>
                                            <p className="text-sm text-gray-500">
                                              This modifies the database schema.
                                              If any step fails, the remaining
                                              migrations are left unapplied.
                                            </p>
                                          </div>
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel data-testid="button-cancel-apply-chain">
                                          Cancel
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                          className="bg-green-700 hover:bg-green-800 focus:ring-green-700"
                                          onClick={() =>
                                            applyChainMutation.mutate(m.name)
                                          }
                                          data-testid="button-confirm-apply-chain"
                                        >
                                          Apply {applyOrder.length} migrations
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                );
                              })()}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    data-testid={`button-apply-blocked-${m.name}`}
                                  >
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled
                                      className="pointer-events-none opacity-50 text-green-700 border-green-200"
                                      data-testid={`button-apply-${m.name}`}
                                    >
                                      <Play className="w-3.5 h-3.5 mr-1.5" />
                                      Apply
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-xs">
                                  <div className="flex items-start gap-1.5 text-xs">
                                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
                                    <span>
                                      Apply{" "}
                                      {blockers.length > 1
                                        ? "these earlier migrations"
                                        : "this earlier migration"}{" "}
                                      first:{" "}
                                      <span className="font-mono font-semibold">
                                        {blockers.join(", ")}
                                      </span>
                                    </span>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          ) : (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="ml-4 text-green-700 border-green-200 hover:bg-green-50 hover:text-green-800"
                                  disabled={applyMutation.isPending}
                                  data-testid={`button-apply-${m.name}`}
                                >
                                  <Play className="w-3.5 h-3.5 mr-1.5" />
                                  Apply
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Apply migration?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription asChild>
                                    <div className="space-y-3">
                                      <p>
                                        This will run the forward migration for{" "}
                                        <span className="font-mono font-semibold">
                                          {m.name}
                                        </span>
                                        . This action modifies the database
                                        schema.
                                      </p>
                                      {!m.hasDown && (
                                        <div
                                          className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-800"
                                          data-testid={`warning-no-rollback-${m.name}`}
                                        >
                                          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                                          <p className="text-sm font-medium">
                                            This migration has no rollback. Once
                                            applied, it cannot be automatically
                                            reverted.
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel data-testid="button-cancel-apply">
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-green-700 hover:bg-green-800 focus:ring-green-700"
                                    onClick={() => applyMutation.mutate(m.name)}
                                    data-testid="button-confirm-apply"
                                  >
                                    Apply migration
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
