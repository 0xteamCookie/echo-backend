"use client";
import React from "react";
import dynamic from "next/dynamic";

// SSR-safe: Google Maps SDK touches `window`.
const RealMap = dynamic(() => import("./map/RealMap"), { ssr: false });

type Props = {
  /** Optional title — pass `null` to hide the header bar entirely. */
  title?: string | null;
};

export default function MapHeatmap({ title = "Live Operations Map" }: Props) {
  return (
    <div className="bg-surface rounded-2xl border border-border shadow-sm h-full flex flex-col overflow-hidden">
      {title !== null && (
        <div className="flex justify-between items-center w-full bg-surface px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-[14px] text-ink">{title}</h3>
          <div className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            Live
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 relative">
        <RealMap />
      </div>
    </div>
  );
}
