import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertDeal } from "@shared/routes";
import { z } from "zod";

export function useDeals() {
  return useQuery({
    queryKey: [api.deals.list.path],
    queryFn: async () => {
      const res = await fetch(api.deals.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch deals");
      return api.deals.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertDeal) => {
      // Ensure numbers are coerced properly before sending
      const validated = api.deals.create.input.parse({
        ...data,
        loanAmount: Number(data.loanAmount),
      });

      const res = await fetch(api.deals.create.path, {
        method: api.deals.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.deals.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create deal");
      }

      return api.deals.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.deals.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.commissions.stats.path] });
    },
  });
}
