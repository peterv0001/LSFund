import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/Sidebar";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { 
  TrendingUp, 
  Trophy,
  Star,
  Target,
  CheckCircle,
  Circle,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const RANKS = [
  { name: 'agent', label: 'Agent', color: 'bg-gray-500', icon: '🌱' },
  { name: 'builder', label: 'Builder', color: 'bg-amber-500', icon: '🔨' },
  { name: 'leader', label: 'Leader', color: 'bg-emerald-500', icon: '⭐' },
  { name: 'director', label: 'Director', color: 'bg-blue-500', icon: '💎' },
  { name: 'partner', label: 'Partner', color: 'bg-purple-500', icon: '👑' },
];

const RANK_REQUIREMENTS = {
  builder: { personalVolume: 1000, weakLegVolume: 2500 },
  leader: { personalVolume: 2500, weakLegVolume: 10000 },
  director: { personalVolume: 5000, weakLegVolume: 25000 },
  partner: { personalVolume: 10000, weakLegVolume: 100000 },
};

export default function RankPage() {
  const { user } = useAuth();

  const { data: rankProgress, isLoading } = useQuery({
    queryKey: ['rank-progress'],
    queryFn: async () => {
      const res = await fetch(api.agents.rankProgress.path, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const currentRankIndex = RANKS.findIndex(r => r.name === user?.currentRank);

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-gray-50/50">
        <Sidebar />
        <main className="flex-1 lg:ml-64 p-4 pt-20 lg:pt-8 lg:p-8 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar />
      
      <main className="flex-1 lg:ml-64 p-4 pt-20 lg:pt-8 lg:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-display font-bold text-primary">Rank Progress</h1>
          <p className="text-muted-foreground mt-2">
            Track your advancement through the ranks.
          </p>
        </header>

        {/* Current Rank Card */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2 bg-gradient-to-br from-primary to-slate-900 text-white border-0">
            <CardContent className="p-8">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-2xl bg-white/10 flex items-center justify-center text-5xl">
                  {RANKS[currentRankIndex]?.icon || '🌱'}
                </div>
                <div>
                  <p className="text-white/60 text-sm mb-1">Current Rank</p>
                  <h2 className="text-4xl font-bold text-white capitalize">
                    {user?.currentRank}
                  </h2>
                  {rankProgress?.nextRank && (
                    <p className="text-white/60 mt-2">
                      Next: <span className="text-white font-medium capitalize">{rankProgress.nextRank}</span>
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                Highest Achieved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary capitalize">
                {rankProgress?.highestRank || user?.currentRank}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Rank Ladder */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Rank Ladder</CardTitle>
            <CardDescription>Your journey through the ranks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between relative">
              {/* Progress line */}
              <div className="absolute top-6 left-0 right-0 h-1 bg-gray-200 -z-10" />
              <div 
                className="absolute top-6 left-0 h-1 bg-primary -z-10 transition-all"
                style={{ width: `${(currentRankIndex / (RANKS.length - 1)) * 100}%` }}
              />
              
              {RANKS.map((rank, index) => {
                const isAchieved = index <= currentRankIndex;
                const isCurrent = index === currentRankIndex;
                
                return (
                  <div key={rank.name} className="flex flex-col items-center">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center text-xl border-4 transition-all",
                      isCurrent ? "border-primary bg-primary text-white scale-110" :
                      isAchieved ? "border-primary bg-white text-primary" :
                      "border-gray-200 bg-white text-gray-400"
                    )}>
                      {isAchieved ? rank.icon : <Circle className="w-5 h-5" />}
                    </div>
                    <p className={cn(
                      "text-sm font-medium mt-2 capitalize",
                      isCurrent ? "text-primary" : isAchieved ? "text-gray-700" : "text-gray-400"
                    )}>
                      {rank.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Requirements for Next Rank */}
        {rankProgress?.nextRank && rankProgress?.requirements && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Requirements for {rankProgress.nextRank.charAt(0).toUpperCase() + rankProgress.nextRank.slice(1)}
              </CardTitle>
              <CardDescription>
                Complete these requirements to advance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Personal Volume */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {rankProgress.progress?.personalVolume?.current >= rankProgress.requirements.personalVolume ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-300" />
                    )}
                    <span className="font-medium">Personal Volume</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    ${rankProgress.progress?.personalVolume?.current?.toLocaleString() || 0} / ${rankProgress.requirements.personalVolume.toLocaleString()}
                  </span>
                </div>
                <Progress 
                  value={Math.min(((rankProgress.progress?.personalVolume?.current || 0) / rankProgress.requirements.personalVolume) * 100, 100)} 
                  className="h-2"
                />
              </div>

              {/* Weak Leg Volume */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {rankProgress.progress?.weakLegVolume?.current >= rankProgress.requirements.weakLegVolume ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-300" />
                    )}
                    <span className="font-medium">Weak Leg Volume</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    ${rankProgress.progress?.weakLegVolume?.current?.toLocaleString() || 0} / ${rankProgress.requirements.weakLegVolume.toLocaleString()}
                  </span>
                </div>
                <Progress 
                  value={Math.min(((rankProgress.progress?.weakLegVolume?.current || 0) / rankProgress.requirements.weakLegVolume) * 100, 100)} 
                  className="h-2"
                />
              </div>

              {/* Qualification Status */}
              <div className={cn(
                "p-4 rounded-lg border",
                rankProgress.qualified 
                  ? "bg-emerald-50 border-emerald-200" 
                  : "bg-gray-50 border-gray-200"
              )}>
                {rankProgress.qualified ? (
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-emerald-500" />
                    <div>
                      <p className="font-medium text-emerald-800">You're qualified!</p>
                      <p className="text-sm text-emerald-600">You've met all requirements for {rankProgress.nextRank}.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-6 h-6 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-700">Keep building!</p>
                      <p className="text-sm text-muted-foreground">Complete the requirements above to advance.</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Already at Top Rank */}
        {!rankProgress?.nextRank && (
          <Card className="bg-gradient-to-br from-purple-50 to-slate-50 border-purple-200">
            <CardContent className="p-8 text-center">
              <div className="text-6xl mb-4">👑</div>
              <h3 className="text-2xl font-bold text-primary mb-2">You've reached the top!</h3>
              <p className="text-muted-foreground">
                Congratulations on achieving Partner rank. Continue building your team and maximizing your earnings.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
