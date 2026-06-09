import { Sidebar } from "@/components/Sidebar";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { 
  Trophy, 
  Medal,
  Users,
  TrendingUp,
  Loader2,
  Crown
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function LeaderboardsPage() {
  const { data: topEarners, isLoading: earnersLoading } = useQuery({
    queryKey: ['leaderboards', 'top-earners'],
    queryFn: async () => {
      const res = await fetch(api.leaderboards.topEarners.path, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const { data: topRecruiters, isLoading: recruitersLoading } = useQuery({
    queryKey: ['leaderboards', 'top-recruiters'],
    queryFn: async () => {
      const res = await fetch(api.leaderboards.topRecruiters.path, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const getMedalIcon = (position: number) => {
    switch (position) {
      case 0: return <Crown className="w-5 h-5 text-yellow-500" />;
      case 1: return <Medal className="w-5 h-5 text-gray-400" />;
      case 2: return <Medal className="w-5 h-5 text-amber-600" />;
      default: return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-muted-foreground">{position + 1}</span>;
    }
  };

  const getRankBadgeColor = (rank: string) => {
    switch (rank) {
      case 'partner': return 'bg-purple-100 text-purple-800';
      case 'director': return 'bg-blue-100 text-blue-800';
      case 'leader': return 'bg-emerald-100 text-emerald-800';
      case 'builder': return 'bg-amber-100 text-amber-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar />
      
      <main className="flex-1 lg:ml-64 p-4 pt-20 lg:pt-8 lg:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-display font-bold text-primary">Leaderboards</h1>
          <p className="text-muted-foreground mt-2">
            See who's leading the pack this month.
          </p>
        </header>

        <Tabs defaultValue="earners" className="space-y-6">
          <TabsList className="bg-white border">
            <TabsTrigger value="earners" className="gap-2">
              <Trophy className="w-4 h-4" />
              Top Earners
            </TabsTrigger>
            <TabsTrigger value="recruiters" className="gap-2">
              <Users className="w-4 h-4" />
              Top Recruiters
            </TabsTrigger>
          </TabsList>

          {/* Top Earners */}
          <TabsContent value="earners">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  Top Earners This Month
                </CardTitle>
                <CardDescription>
                  Agents with the highest commissions earned
                </CardDescription>
              </CardHeader>
              <CardContent>
                {earnersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : topEarners?.length > 0 ? (
                  <div className="space-y-3">
                    {topEarners.map((agent: any, index: number) => (
                      <div 
                        key={agent.agentId}
                        className={cn(
                          "flex items-center gap-4 p-4 rounded-xl transition-colors",
                          index === 0 ? "bg-yellow-50 border border-yellow-200" :
                          index === 1 ? "bg-gray-50 border border-gray-200" :
                          index === 2 ? "bg-amber-50 border border-amber-200" :
                          "bg-white border border-gray-100 hover:bg-gray-50"
                        )}
                      >
                        <div className="w-8 flex justify-center">
                          {getMedalIcon(index)}
                        </div>
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {agent.firstName[0]}{agent.lastName[0]}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{agent.firstName} {agent.lastName}</p>
                          <Badge variant="secondary" className={cn("text-xs", getRankBadgeColor(agent.currentRank))}>
                            {agent.currentRank}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className={cn(
                            "font-mono font-bold",
                            index === 0 ? "text-yellow-600 text-xl" : "text-emerald-600"
                          )}>
                            ${agent.totalEarned.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">earned</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No earnings data yet this month</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Top Recruiters */}
          <TabsContent value="recruiters">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  Top Recruiters This Month
                </CardTitle>
                <CardDescription>
                  Agents who have recruited the most new members
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recruitersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : topRecruiters?.length > 0 ? (
                  <div className="space-y-3">
                    {topRecruiters.map((agent: any, index: number) => (
                      <div 
                        key={agent.agentId}
                        className={cn(
                          "flex items-center gap-4 p-4 rounded-xl transition-colors",
                          index === 0 ? "bg-blue-50 border border-blue-200" :
                          index === 1 ? "bg-gray-50 border border-gray-200" :
                          index === 2 ? "bg-cyan-50 border border-cyan-200" :
                          "bg-white border border-gray-100 hover:bg-gray-50"
                        )}
                      >
                        <div className="w-8 flex justify-center">
                          {getMedalIcon(index)}
                        </div>
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {agent.firstName[0]}{agent.lastName[0]}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{agent.firstName} {agent.lastName}</p>
                          <Badge variant="secondary" className={cn("text-xs", getRankBadgeColor(agent.currentRank))}>
                            {agent.currentRank}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className={cn(
                            "font-bold",
                            index === 0 ? "text-blue-600 text-xl" : "text-blue-600"
                          )}>
                            {agent.recruits}
                          </p>
                          <p className="text-xs text-muted-foreground">recruits</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No recruitment data yet this month</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
