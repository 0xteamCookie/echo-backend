"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  Siren,
  UserCheck,
  CheckCircle2,
  Map as MapIcon,
  ArrowRight,
} from "lucide-react";
import PageHeader from "./PageHeader";
import LatestAnnouncement from "./LatestAnnouncement";
import EventTable from "./EventTable";
import { useRealtimeEvents } from "../hooks/useRealtimeEvents";
import { isResolvedStatus, isSosEntry } from "./map/types";

export default function OverviewDashboard() {
  const { events, loading } = useRealtimeEvents({ limit: 200 });

  const stats = useMemo(() => {
    let sos = 0;
    let assigned = 0;
    let resolved = 0;
    for (const e of events) {
      const isResolved = isResolvedStatus(e.status);
      if (isResolved) resolved += 1;
      if (isSosEntry(e) && !isResolved) sos += 1;
      if (e.assignment?.rescuerId && !isResolved) assigned += 1;
    }
    return { total: events.length, sos, assigned, resolved };
  }, [events]);

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Echo · live SOS mesh — command console at a glance"
        info={
          <>
            A high-level snapshot of the response network: live incident
            counts, the latest public announcement, and the most recent
            dispatches. Use the tiles to gauge load, then jump to the{" "}
            <strong className="text-ink">Operations Map</strong> for the full
            geospatial view or <strong className="text-ink">Live Feed</strong>{" "}
            to triage individual incidents.
          </>
        }
      />

      <LatestAnnouncement />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Total incidents"
          value={stats.total}
          loading={loading}
          icon={<Activity size={16} />}
          tone="info"
        />
        <StatTile
          label="Active SOS"
          value={stats.sos}
          loading={loading}
          icon={<Siren size={16} />}
          tone="danger"
        />
        <StatTile
          label="Assigned"
          value={stats.assigned}
          loading={loading}
          icon={<UserCheck size={16} />}
          tone="brand"
        />
        <StatTile
          label="Resolved"
          value={stats.resolved}
          loading={loading}
          icon={<CheckCircle2 size={16} />}
          tone="success"
        />
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 xl:col-span-7">
          <EventTable />
        </div>
        <div className="col-span-12 xl:col-span-5">
          <Link
            href="/map"
            className="group flex h-full flex-col justify-between rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-brand/50"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/15 text-brand">
                <MapIcon size={20} />
              </span>
              <ArrowRight
                size={18}
                className="text-muted transition-transform group-hover:translate-x-1 group-hover:text-brand"
              />
            </div>
            <div className="mt-6">
              <h3 className="text-[16px] font-semibold text-ink">
                Operations Map
              </h3>
              <p className="mt-1 text-[13px] text-muted leading-relaxed">
                Open the live geospatial view — SOS heatmap, clustered
                incidents, and the recent-reports panel for field dispatch.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-[12px] font-medium text-brand">
              View operations map
              <ArrowRight size={14} />
            </div>
          </Link>
        </div>
      </div>
    </>
  );
}

const TONES: Record<string, { text: string; bg: string }> = {
  info: { text: "text-info", bg: "bg-info/15" },
  danger: { text: "text-danger", bg: "bg-danger/15" },
  brand: { text: "text-brand", bg: "bg-brand/15" },
  success: { text: "text-success", bg: "bg-success/15" },
};

function StatTile({
  label,
  value,
  loading,
  icon,
  tone,
}: {
  label: string;
  value: number;
  loading: boolean;
  icon: React.ReactNode;
  tone: keyof typeof TONES | string;
}) {
  const t = TONES[tone] ?? TONES.brand;
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${t.bg} ${t.text}`}>
          {icon}
        </span>
      </div>
      <div>
        <p className="text-[28px] font-bold text-ink leading-none tracking-tight">
          {loading ? "—" : value}
        </p>
        <p className="text-[12px] text-muted mt-2 uppercase tracking-wide">
          {label}
        </p>
      </div>
    </div>
  );
}
