import React from "react";
import { TrendingUp, TrendingDown, LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface StatCardProps {
  title: string;
  value: string | number;
  trend?: "up" | "down";
  trendValue?: string;
  icon?: LucideIcon;
  bgColor?: string;
  iconBgColor?: string;
  iconColor?: string;
  className?: string;
}

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function StatCard({
  title,
  value,
  trend,
  trendValue,
  icon: Icon,
  bgColor = "bg-surface",
  iconBgColor = "bg-elevated",
  iconColor = "text-muted",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "p-5 rounded-2xl border border-border shadow-sm flex flex-col justify-between h-full",
        bgColor,
        className,
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-muted font-medium text-sm mb-1">{title}</h3>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
        </div>
        {Icon && (
          <div className={cn("p-2 rounded-lg flex-shrink-0", iconBgColor)}>
            <Icon size={20} className={iconColor} />
          </div>
        )}
      </div>

      {trend && (
        <div className="flex items-center gap-2 mt-auto">
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-full w-fit",
              trend === "up"
                ? "bg-brand/15 text-brand"
                : "bg-success/15 text-success",
            )}
          >
            {trend === "up" ? (
              <TrendingUp size={12} />
            ) : (
              <TrendingDown size={12} />
            )}
            <span>{trendValue}</span>
          </div>
          <span className="text-xs text-muted font-medium">
            vs last hour
          </span>
        </div>
      )}
    </div>
  );
}
