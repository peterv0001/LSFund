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
  Activity,
  UserPlus,
  Bot,
  RefreshCw,
  Lock,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const adminNavItems = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/agents", icon: Users, label: "Agents" },
  { href: "/admin/leads", icon: UserPlus, label: "Leads" },
  { href: "/admin/ai-queue", icon: Bot, label: "AI Follow-up Queue" },
  { href: "/admin/deals", icon: Briefcase, label: "Deals" },
  { href: "/admin/commissions", icon: DollarSign, label: "Commissions" },
  { href: "/admin/payouts", icon: CreditCard, label: "Payouts" },
  { href: "/admin/holdbacks", icon: Lock, label: "Holdbacks" },
  { href: "/admin/subscriptions", icon: RefreshCw, label: "Subscriptions" },
  { href: "/admin/announcements", icon: Megaphone, label: "Announcements" },
  { href: "/admin/resources", icon: BookOpen, label: "Resources" },
  { href: "/admin/activity", icon: Activity, label: "Activity Log" },
  { href: "/admin/migrations", icon: Database, label: "Migrations" },
  { href: "/admin/settings", icon: Settings, label: "Settings" },
];

export function AdminSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 flex flex-col z-50 shadow-2xl" style={{ backgroundColor: 'hsl(212 100% 14%)' }}>
      {/* Logo */}
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex flex-col gap-1">
          <img
            src="/logo.png"
            alt="Leadershield Network"
            className="h-9 w-auto object-contain brightness-0 invert"
          />
          <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mt-1 pl-0.5">Admin Portal</p>
        </div>
      </div>

      {/* Back to Agent Portal */}
      <div className="px-4 py-2 border-b border-white/10">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="w-full justify-start text-white/50 hover:text-white hover:bg-white/5 text-xs">
            <ChevronLeft className="w-3.5 h-3.5 mr-1.5" />
            Back to Agent Portal
          </Button>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {adminNavItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/admin" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-md transition-all cursor-pointer text-sm",
                  isActive
                    ? "bg-white/10 text-white font-semibold"
                    : "text-white/55 hover:text-white hover:bg-white/5 font-medium"
                )}
              >
                <item.icon className={cn("w-4 h-4 shrink-0", isActive ? "text-white" : "text-white/40")} />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/80 font-bold text-xs border border-white/15">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate text-white">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-white/40">Administrator</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-white/50 hover:text-white hover:bg-white/5"
          onClick={() => logout()}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
