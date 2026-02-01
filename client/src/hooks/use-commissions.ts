import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useCommissions() {
  return useQuery({
    queryKey: [api.commissions.list.path],
    queryFn: async () => {
      const res = await fetch(api.commissions.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch commissions");
      return api.commissions.list.responses[200].parse(await res.json());
    },
  });
}

export function useCommissionStats() {
  return useQuery({
    queryKey: [api.commissions.stats.path],
    queryFn: async () => {
      const res = await fetch(api.commissions.stats.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return await res.json();
    },
  });
}

// Admin-only: Calculate binary commissions
export function useCalculateCommissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.admin.commissions.calculate.path, {
        method: 'POST',
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to calculate commissions");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.commissions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.commissions.stats.path] });
    },
  });
}
