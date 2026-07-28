import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";

type CreateDealInput = z.infer<typeof api.deals.create.input>;

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
    mutationFn: async (data: CreateDealInput) => {
      // Ensure numbers are coerced properly before sending
      const validated = api.deals.create.input.parse({
        ...data,
        loanAmount: Number(data.loanAmount),
      });

      // Generate a per-submission idempotency key so concurrent or retried
      // network requests carrying the same key are deduplicated server-side
      // and always produce exactly one deal row.
      const idempotencyKey = crypto.randomUUID();

      const res = await fetch(api.deals.create.path, {
        method: api.deals.create.method,
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey,
        },
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
