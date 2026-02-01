import { useAuth } from "@/hooks/use-auth";
import { useAgentTeam } from "@/hooks/use-agents";
import { Sidebar } from "@/components/Sidebar";
import { Loader2, Users, ChevronDown, ChevronRight, User } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

// Simplified recursive tree node component
function TreeNode({ node, depth = 0 }: { node: any, depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="relative">
      <div 
        className={cn(
          "flex items-center gap-3 p-4 bg-white border border-border/60 rounded-xl shadow-sm hover:shadow-md transition-all mb-3 cursor-pointer",
          depth === 0 ? "border-primary/20 ring-2 ring-primary/5 bg-primary/5" : ""
        )}
        style={{ marginLeft: `${depth * 24}px` }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-700 font-bold text-xs border border-indigo-100">
          {node.firstName[0]}{node.lastName[0]}
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-primary">{node.firstName} {node.lastName}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 uppercase tracking-wide border border-gray-200">
              {node.currentRank}
            </span>
          </div>
          <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
            <span>Vol L: ${node.volume?.left || 0}</span>
            <span>Vol R: ${node.volume?.right || 0}</span>
          </div>
        </div>

        {hasChildren && (
          <div className="text-gray-400">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        )}
      </div>

      {hasChildren && expanded && (
        <div className="relative pl-6">
          {/* Vertical connector line */}
          <div className="absolute left-[22px] top-0 bottom-6 w-px bg-border/60" style={{ left: `${depth * 24 + 22}px` }} />
          
          {node.children.map((child: any) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TeamPage() {
  const { user } = useAuth();
  const { data: team, isLoading } = useAgentTeam(user?.id || 0);

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar />
      
      <main className="flex-1 ml-64 p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-display font-bold text-primary">Genealogy Tree</h1>
          <p className="text-muted-foreground mt-2">
            View your binary tree structure and volume distribution.
          </p>
        </header>

        <div className="bg-white rounded-2xl border border-border shadow-sm p-6 min-h-[600px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Loading your empire...</p>
            </div>
          ) : team ? (
            <div className="max-w-3xl mx-auto">
              {/* Root Node (You) */}
              <TreeNode node={team} />
              
              {(!team.children || team.children.length === 0) && (
                <div className="mt-8 text-center p-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <h3 className="font-medium text-gray-900">Your team is growing</h3>
                  <p className="text-sm text-gray-500 mt-1">Start recruiting to see your tree expand.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              Failed to load team data.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
