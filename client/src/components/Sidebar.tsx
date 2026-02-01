import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  DollarSign, 
  Briefcase, 
  Settings, 
  LogOut,
  Building
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [location] = useLocation();
  const { logout, user } = useAuth();

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/team", label: "My Team", icon: Users },
    { href: "/deals", label: "Deals", icon: Briefcase },
    { href: "/earnings", label: "Earnings", icon: DollarSign },
  ];

  if (user?.isAdmin) {
    links.push({ href: "/admin", label: "Admin", icon: Settings });
  }

  return (
    <aside className="w-64 bg-primary text-primary-foreground flex flex-col h-screen fixed left-0 top-0 z-50 shadow-2xl">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/20">
            <Building className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg tracking-wide leading-none">Capital</h1>
            <h2 className="text-xs text-white/50 tracking-widest uppercase mt-1">Partners</h2>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 py-8 space-y-2">
        {links.map((link) => {
          const isActive = location === link.href;
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href} className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group",
              isActive 
                ? "bg-white/10 text-white shadow-inner" 
                : "text-white/60 hover:text-white hover:bg-white/5"
            )}>
              <Icon className={cn(
                "w-5 h-5 transition-colors",
                isActive ? "text-yellow-400" : "text-white/40 group-hover:text-white/80"
              )} />
              <span className="font-medium">{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="bg-white/5 rounded-xl p-4 mb-4">
          <p className="text-xs text-white/40 mb-1">Signed in as</p>
          <p className="font-medium truncate">{user?.firstName} {user?.lastName}</p>
          <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            {user?.currentRank}
          </div>
        </div>
        
        <button 
          onClick={() => logout()}
          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-300 hover:text-red-200 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
