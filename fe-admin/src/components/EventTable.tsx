"use client";

import React, { useMemo } from "react";
import { cn } from "./StatCard";
import {
  useRealtimeEvents,
  FIRESTORE_NO_CLIENT,
  type DeviceEntry,
} from "../hooks/useRealtimeEvents";
import { readSeverity } from "./map/types";

type Row = {
  id: string;
  badge: "M" | "F" | "P";
  code: string;
  loc: string;
  severity: number;
  status: string;
  time: string;
};

function agencyBadge(agency: DeviceEntry["agency"]): Row["badge"] {
  if (agency === "fire") return "F";
  if (agency === "police") return "P";
  return "M";
}

function readStatus(entry: DeviceEntry): string {
  if (typeof entry.status === "string" && entry.status.trim() !== "") {
    const s = entry.status.trim().toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return "Pending";
}

function readLocation(entry: DeviceEntry): string {
  if (entry.gps)
    return `${entry.gps.lat.toFixed(3)}, ${entry.gps.lon.toFixed(3)}`;
  return entry.macAddress || "Unknown";
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "--";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

function toRow(entry: DeviceEntry): Row {
  return {
    id: entry.id,
    badge: agencyBadge(entry.agency),
    code: `INC-${entry.id.slice(0, 6).toUpperCase()}`,
    loc: readLocation(entry),
    severity: readSeverity(entry),
    status: readStatus(entry),
    time: relativeTime(entry.receivedAt),
  };
}

export default function EventTable() {
  const { events, loading, error } = useRealtimeEvents({ limit: 10 });

  const rows = useMemo(() => events.slice(0, 8).map(toRow), [events]);

  return (
    <div className="bg-surface rounded-2xl p-6 border border-border h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-semibold text-[14px] text-ink">
          Recent Dispatch
        </h3>
        <a
          href="/live-feed"
          className="text-[12px] font-medium text-muted hover:text-ink transition-colors bg-elevated px-3 py-1 rounded-full shadow-sm"
        >
          View All
        </a>
      </div>

      <div className="flex-1">
        {loading && rows.length === 0 ? (
          <div className="text-[12px] text-muted py-6 text-center">
            Loading recent incidents...
          </div>
        ) : error && error !== FIRESTORE_NO_CLIENT ? (
          <div className="text-[12px] text-danger py-6 text-center">
            Unable to load incidents.
          </div>
        ) : rows.length === 0 ? (
          <div className="text-[12px] text-muted py-6 text-center">
            No incidents yet.
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-semibold text-muted uppercase tracking-wider border-b border-border">
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">ID / Loc</th>
                <th className="pb-3 font-medium">KPI</th>
                <th className="pb-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((inc) => (
                <tr
                  key={inc.id}
                  className="hover:bg-elevated transition-colors group"
                >
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white",
                          inc.badge === "M"
                            ? "bg-info"
                            : inc.badge === "F"
                              ? "bg-brand"
                              : "bg-elevated text-muted",
                        )}
                      >
                        {inc.badge}
                      </div>
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex flex-col">
                      <span className="font-bold text-ink text-[12px]">
                        {inc.code}
                      </span>
                      <span className="text-[10px] text-muted truncate max-w-[140px]">
                        {inc.loc}
                      </span>
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <span className="bg-elevated text-ink text-[10px] px-2 py-0.5 rounded-full">
                        {inc.severity} Sev
                      </span>
                      <span className="bg-elevated text-muted text-[10px] px-2 py-0.5 rounded-full">
                        {inc.time}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    <span
                      className={cn(
                        "text-[11px] font-bold",
                        inc.status === "Assigned" ||
                          inc.status === "Dispatching"
                          ? "text-brand"
                          : inc.status === "Resolved"
                            ? "text-success"
                            : "text-muted",
                      )}
                    >
                      {inc.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
