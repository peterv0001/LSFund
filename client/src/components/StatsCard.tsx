import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  trendUp?: boolean;
  className?: string;
}

export function StatsCard({ title, value, icon, trend, trendUp, className }: StatsCardProps) {
  return (
    <div className={cn(
      "bg-white rounded-2xl p-6 shadow-lg shadow-black/5 border border-border/50",
      "hover:shadow-xl hover:border-border transition-all duration-300",
      className
    )}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
          <h3 className="mt-2 text-3xl font-display font-bold text-primary">{value}</h3>
          
          {trend && (
            <div className={cn(
              "mt-2 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
              trendUp 
                ? "text-emerald-700 bg-emerald-50 border border-emerald-100" 
                : "text-red-700 bg-red-50 border border-red-100"
            )}>
              <span>{trendUp ? "↑" : "↓"}</span>
              <span>{trend}</span>
            </div>
          )}
        </div>
        
        <div className="p-3 bg-primary/5 rounded-xl text-primary">
          {icon}
        </div>
      </div>
    </div>
  );
}
