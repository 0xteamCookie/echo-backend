import React from "react";
import { cn } from "./StatCard";

interface DataCardProps {
  title: string;
  value: string | number;
  trend?: string;
  trendDir?: "up" | "down";
  icon?: React.ReactNode;
  subtitle?: string;
  highlighted?: boolean;
}

export default function DataCard({
  title,
  value,
  trend,
  trendDir,
  icon,
  subtitle,
  highlighted,
}: DataCardProps) {
  return (
    <div
      className={cn(
        "p-5 rounded-2xl border border-border flex flex-col justify-between shadow-sm min-w-[160px] flex-1",
        highlighted ? "bg-elevated text-ink" : "bg-surface text-ink",
      )}
    >
      <div className="flex justify-between items-start mb-2">
        <h3
          className={cn(
            "text-[13px] font-medium",
            highlighted ? "text-muted" : "text-muted",
          )}
        >
          {title}
        </h3>
      </div>

      <div className="flex flex-col gap-2 mt-auto">
        <p className="text-2xl font-bold">{value}</p>

        {trend && (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center",
                highlighted
                  ? "bg-background text-muted"
                  : trendDir === "up"
                    ? "bg-brand/15 text-brand"
                    : "bg-elevated text-muted",
              )}
            >
              {trendDir === "up" ? "↑" : "↓"} {trend}
            </span>
            {subtitle && (
              <span
                className={cn(
                  "text-[11px]",
                  highlighted ? "text-muted" : "text-muted",
                )}
              >
                {subtitle}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
