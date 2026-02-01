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

export function useSearchAgents(query: string) {
  return useQuery({
    queryKey: [api.agents.search.path, query],
    queryFn: async () => {
      if (!query) return [];
      const url = `${api.agents.search.path}?query=${encodeURIComponent(query)}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Search failed");
      return api.agents.search.responses[200].parse(await res.json());
    },
    enabled: query.length > 2,
  });
}
