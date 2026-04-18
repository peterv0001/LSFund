import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  DollarSign, 
  Briefcase, 
  Settings, 
  LogOut,
  BookOpen,
  Trophy,
  TrendingUp,
  Shield,
  Menu,
  X,
  BarChart3,
  UserPlus,
  RefreshCw
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./NotificationBell";

export function Sidebar() {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const mainLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/training", label: "Training", icon: BookOpen },
    { href: "/leads", label: "My Leads", icon: UserPlus },
    { href: "/team", label: "My Team", icon: Users },
    { href: "/deals", label: "Deals", icon: Briefcase },
    { href: "/subscriptions", label: "Subscriptions", icon: RefreshCw },
    { href: "/earnings", label: "Earnings", icon: DollarSign },
    { href: "/reports", label: "Reports", icon: BarChart3 },
    { href: "/rank", label: "Rank Progress", icon: TrendingUp },
    { href: "/leaderboards", label: "Leaderboards", icon: Trophy },
    { href: "/resources", label: "Resources", icon: Briefcase },
  ];

  const settingsLinks = [
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const SidebarContent = () => (
    <>
      {/* Header / Logo */}
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <span className="font-display font-bold text-white text-base leading-tight tracking-wide">
            Leader Shield<br />Network
          </span>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-2 -mr-2 text-white/60 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] uppercase tracking-wider text-white/30 px-4 mb-2 font-semibold">Menu</p>
        {mainLinks.map((link) => {
          const isActive = location === link.href || (link.href !== "/dashboard" && location.startsWith(link.href));
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href}>
              <div className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-md transition-all duration-150 group cursor-pointer",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )}>
                <Icon className={cn(
                  "w-4 h-4 shrink-0 transition-colors",
                  isActive ? "text-white" : "text-white/40 group-hover:text-white/80"
                )} />
                <span className="text-sm font-medium">{link.label}</span>
              </div>
            </Link>
          );
        })}

        <div className="pt-4">
          <p className="text-[10px] uppercase tracking-wider text-white/30 px-4 mb-2 font-semibold">Account</p>
          {settingsLinks.map((link) => {
            const isActive = location === link.href;
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href}>
                <div className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-md transition-all duration-150 group cursor-pointer",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                )}>
                  <Icon className={cn(
                    "w-4 h-4 shrink-0 transition-colors",
                    isActive ? "text-white" : "text-white/40 group-hover:text-white/80"
                  )} />
                  <span className="text-sm font-medium">{link.label}</span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Admin Link */}
        {user?.isAdmin && (
          <div className="pt-4">
            <p className="text-[10px] uppercase tracking-wider text-white/30 px-4 mb-2 font-semibold">Admin</p>
            <Link href="/admin">
              <div className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-md transition-all duration-150 group cursor-pointer",
                location.startsWith("/admin")
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )}>
                <Shield className="w-4 h-4 shrink-0" />
                <span className="text-sm font-medium">Admin Portal</span>
              </div>
            </Link>
          </div>
        )}
      </nav>

      {/* User Footer */}
      <div className="p-4 border-t border-white/10">
        <div className="bg-white/5 rounded-lg p-3 mb-3">
          <p className="text-[11px] text-white/40 mb-0.5">Signed in as</p>
          <p className="text-sm font-semibold truncate">{user?.firstName} {user?.lastName}</p>
          <div className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 text-white/70 border border-white/15">
            {user?.currentRank}
          </div>
        </div>

        <button
          onClick={() => logout()}
          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 rounded-md transition-colors"
          data-testid="button-sign-out"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-3 mt-2 border-t border-white/10">
          <Link href="/income-disclosure">
            <span className="text-[10px] text-white/30 hover:text-white/50 transition-colors cursor-pointer" data-testid="link-income-disclosure-sidebar">Income Disclosure</span>
          </Link>
          <Link href="/terms">
            <span className="text-[10px] text-white/30 hover:text-white/50 transition-colors cursor-pointer" data-testid="link-terms-sidebar">Terms</span>
          </Link>
          <Link href="/privacy">
            <span className="text-[10px] text-white/30 hover:text-white/50 transition-colors cursor-pointer" data-testid="link-privacy-sidebar">Privacy</span>
          </Link>
          <Link href="/refund-policy">
            <span className="text-[10px] text-white/30 hover:text-white/50 transition-colors cursor-pointer" data-testid="link-refund-policy-sidebar">Refund Policy</span>
          </Link>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-primary text-white h-14 flex items-center justify-between px-4 shadow-lg">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 text-white/80 hover:text-white"
        >
          <Menu className="w-5 h-5" />
        </button>

        <span className="font-display font-bold text-white text-sm tracking-wide">Leader Shield Network</span>

        <NotificationBell />
      </header>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside className={cn(
        "lg:hidden fixed left-0 top-0 bottom-0 w-72 bg-primary text-primary-foreground flex flex-col z-50 shadow-2xl transition-transform duration-300 ease-in-out",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarContent />
      </aside>

      {/* Desktop Sidebar */}
      <style>{`
        .desktop-sidebar-container {
          display: none !important;
        }
        @media (min-width: 1024px) {
          .desktop-sidebar-container {
            display: flex !important;
          }
        }
      `}</style>
      <aside className="desktop-sidebar-container w-64 bg-primary text-primary-foreground flex-col h-screen fixed left-0 top-0 z-50 shadow-2xl">
        <SidebarContent />
      </aside>
    </>
  );
}

// Mobile spacer component to add padding for fixed header
export function MobileHeaderSpacer() {
  return <div className="h-14 lg:hidden" />;
}
