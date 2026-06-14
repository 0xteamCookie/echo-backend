"use client";

import { useState } from "react";
import type { DeviceEntry } from "../../hooks/useRealtimeEvents";
import {
  formatRelativeTime,
  isResolvedStatus,
  isSosEntry,
  readSeverity,
} from "./types";

type Props = {
  reports: DeviceEntry[];
  assignedCount: number;
  onSelect: (entry: DeviceEntry) => void;
};

export function SosPanel({ reports, assignedCount, onSelect }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const sosCount = reports.filter(isSosEntry).length;

  return (
    <div
      className={`pointer-events-auto absolute top-3 right-3 z-10 flex flex-col rounded-xl border border-border bg-surface/95 backdrop-blur shadow-lg transition-all duration-200 ${
        collapsed ? "w-auto" : "w-[320px] max-h-[calc(100%-1.5rem)]"
      }`}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-elevated rounded-t-xl"
      >
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-danger" />
          </span>
          <span className="text-[13px] font-semibold text-ink">
            {collapsed
              ? `${sosCount} SOS · ${reports.length} total`
              : "Recent SOS / Reports"}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-muted transition-transform ${
            collapsed ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {!collapsed && (
        <>
          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-2 px-3 pb-2 text-center">
            <Stat label="SOS" value={sosCount} tone="red" />
            <Stat label="Reports" value={reports.length} tone="gray" />
            <Stat label="Assigned" value={assignedCount} tone="emerald" />
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto border-t border-border px-2 py-2">
            {reports.length === 0 ? (
              <div className="rounded-lg border border-border bg-elevated p-3 text-[12px] text-muted text-center">
                No SOS calls or reports yet.
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {reports.slice(0, 50).map((entry) => (
                  <ReportCard
                    key={entry.id}
                    entry={entry}
                    onClick={() => onSelect(entry)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "red" | "gray" | "emerald";
}) {
  const toneCls =
    tone === "red"
      ? "text-danger bg-danger/10"
      : tone === "emerald"
        ? "text-success bg-success/10"
        : "text-muted bg-elevated";
  return (
    <div className={`rounded-md px-2 py-1.5 ${toneCls}`}>
      <div className="text-[16px] font-bold leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-wide font-medium mt-0.5">
        {label}
      </div>
    </div>
  );
}

function ReportCard({
  entry,
  onClick,
}: {
  entry: DeviceEntry;
  onClick: () => void;
}) {
  const sos = isSosEntry(entry);
  const resolved = isResolvedStatus(entry.status);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border p-2.5 transition-colors ${
        sos
          ? "border-danger/40 bg-danger/10 hover:bg-danger/15"
          : "border-border hover:bg-elevated"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-ink flex items-center gap-1.5 min-w-0">
          {sos && (
            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-danger text-white shrink-0">
              SOS
            </span>
          )}
          <span className="truncate">
            {(entry.agency ?? "medical").toUpperCase()} · Sev{" "}
            {readSeverity(entry)}
          </span>
        </p>
        <span className="flex items-center gap-1.5 shrink-0">
          {resolved && (
            <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-success/15 text-success">
              Resolved
            </span>
          )}
          <span className="text-[10px] text-muted">
            {formatRelativeTime(entry.receivedAt || entry.time)}
          </span>
        </span>
      </div>
      <p className="text-[11px] text-muted mt-1 truncate">
        {entry.message?.trim() || `Incident ${entry.id.slice(0, 8)}`}
      </p>
      <p className="text-[11px] text-muted mt-0.5">
        {entry.gps
          ? `${entry.gps.lat.toFixed(3)}, ${entry.gps.lon.toFixed(3)}`
          : "Unknown location"}
      </p>
      {entry.assignment?.rescuerName && (
        <p className="text-[11px] text-success mt-0.5">
          Assigned to {entry.assignment.rescuerName}
        </p>
      )}
    </button>
  );
}
