import { useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useAgent(id: number) {
  return useQuery({
    queryKey: [api.agents.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.agents.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch agent");
      return api.agents.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useAgentTeam(id: number) {
  return useQuery({
    queryKey: [api.agents.team.path, id],
    queryFn: async () => {
      const url = buildUrl(api.agents.team.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch team");
      // Note: Team response is typed as 'any' in routes due to recursion complexity
      return await res.json();
    },
    enabled: !!id,
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: [api.agents.dashboard.path],
    queryFn: async () => {
      const res = await fetch(api.agents.dashboard.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return await res.json();
    },
  });
}
