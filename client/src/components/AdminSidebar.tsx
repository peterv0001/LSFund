import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  DollarSign, 
  CreditCard,
  Megaphone,
  BookOpen,
  Settings,
  LogOut,
  ChevronLeft,
  Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";

const adminNavItems = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/agents", icon: Users, label: "Agents" },
  { href: "/admin/deals", icon: Briefcase, label: "Deals" },
  { href: "/admin/commissions", icon: DollarSign, label: "Commissions" },
  { href: "/admin/payouts", icon: CreditCard, label: "Payouts" },
  { href: "/admin/announcements", icon: Megaphone, label: "Announcements" },
  { href: "/admin/resources", icon: BookOpen, label: "Resources" },
  { href: "/admin/activity", icon: Activity, label: "Activity Log" },
  { href: "/admin/settings", icon: Settings, label: "Settings" },
];

export function AdminSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-slate-900 text-white flex flex-col z-50">
      {/* Logo */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-bold text-slate-900">
            PSL
          </div>
          <div>
            <h1 className="font-bold text-lg">PSL Capital</h1>
            <p className="text-xs text-slate-400">Admin Portal</p>
          </div>
        </div>
      </div>

      {/* Back to Agent Portal */}
      <div className="px-4 py-3 border-b border-slate-700">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Agent Portal
          </Button>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {adminNavItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/admin" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all cursor-pointer",
                  isActive 
                    ? "bg-amber-500/10 text-amber-400" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-xs">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-slate-400">Administrator</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800"
          onClick={() => logout()}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
