import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  DollarSign, 
  Briefcase, 
  Settings, 
  LogOut,
  Building,
  BookOpen,
  Trophy,
  TrendingUp,
  Shield,
  Menu,
  X,
  BarChart3
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./NotificationBell";

export function Sidebar() {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Prevent body scroll when mobile menu is open
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
    { href: "/team", label: "My Team", icon: Users },
    { href: "/deals", label: "Deals", icon: Briefcase },
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
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/20">
              <Building className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg tracking-wide leading-none">PSL Capital</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            {/* Mobile close button */}
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
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        <p className="text-[10px] uppercase tracking-wider text-white/30 px-4 mb-2">Menu</p>
        {mainLinks.map((link) => {
          const isActive = location === link.href || (link.href !== "/dashboard" && location.startsWith(link.href));
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href}>
              <div className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group cursor-pointer",
                isActive 
                  ? "bg-white/10 text-white shadow-inner" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )}>
                <Icon className={cn(
                  "w-5 h-5 transition-colors",
                  isActive ? "text-yellow-400" : "text-white/40 group-hover:text-white/80"
                )} />
                <span className="font-medium text-sm">{link.label}</span>
              </div>
            </Link>
          );
        })}

        <div className="pt-4">
          <p className="text-[10px] uppercase tracking-wider text-white/30 px-4 mb-2">Account</p>
          {settingsLinks.map((link) => {
            const isActive = location === link.href;
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href}>
                <div className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group cursor-pointer",
                  isActive 
                    ? "bg-white/10 text-white shadow-inner" 
                    : "text-white/60 hover:text-white hover:bg-white/5"
                )}>
                  <Icon className={cn(
                    "w-5 h-5 transition-colors",
                    isActive ? "text-yellow-400" : "text-white/40 group-hover:text-white/80"
                  )} />
                  <span className="font-medium text-sm">{link.label}</span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Admin Link */}
        {user?.isAdmin && (
          <div className="pt-4">
            <p className="text-[10px] uppercase tracking-wider text-white/30 px-4 mb-2">Admin</p>
            <Link href="/admin">
              <div className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group cursor-pointer",
                location.startsWith("/admin")
                  ? "bg-amber-500/20 text-amber-400" 
                  : "text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/10"
              )}>
                <Shield className="w-5 h-5" />
                <span className="font-medium text-sm">Admin Portal</span>
              </div>
            </Link>
          </div>
        )}
      </nav>

      {/* User Footer */}
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
    </>
  );

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-primary text-white h-16 flex items-center justify-between px-4 shadow-lg">
        <button 
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 text-white/80 hover:text-white"
        >
          <Menu className="w-6 h-6" />
        </button>
        
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
            <Building className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold">PSL Capital</span>
        </div>
        
        <NotificationBell />
      </header>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
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

      {/* Desktop Sidebar - CSS media query ensures hidden on mobile */}
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
  return <div className="h-16 lg:hidden" />;
}
