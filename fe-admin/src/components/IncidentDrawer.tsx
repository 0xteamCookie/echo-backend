"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X, BrainCircuit, MapPin, Clock, User, Loader2 } from "lucide-react";
import type { DeviceEntry } from "../hooks/useRealtimeEvents";
import { apiUrl } from "../lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

export type RescuerOption = {
  id: string;
  name: string;
  agency?: "medical" | "fire" | "police";
  onDuty?: boolean;
};

export type TriageInfo = {
  summary?: string;
  severity?: number;
  categories?: string[];
  source?: string; // e.g. "on-device" | "server"
};

type IncidentDrawerProps = {
  entry: DeviceEntry | null;
  onClose: () => void;
  authHeader: Record<string, string>;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractTriage(entry: DeviceEntry): TriageInfo | null {
  const t = entry.meta?.triage;
  if (!t || typeof t !== "object" || Array.isArray(t)) return null;
  const obj = t as Record<string, unknown>;
  const severity =
    typeof obj.severity === "number" && Number.isFinite(obj.severity)
      ? obj.severity
      : undefined;
  const categories = Array.isArray(obj.categories)
    ? obj.categories.filter((v): v is string => typeof v === "string")
    : undefined;
  return {
    summary: typeof obj.summary === "string" ? obj.summary : undefined,
    severity,
    categories,
    source: typeof obj.source === "string" ? obj.source : undefined,
  };
}

function agencyBadgeClass(agency?: string): string {
  if (agency === "medical") return "bg-info/15 text-info";
  if (agency === "fire") return "bg-brand/15 text-brand";
  if (agency === "police") return "bg-elevated text-muted";
  return "bg-elevated text-muted";
}

function formatOperationalStatus(status: string | undefined): string | null {
  if (typeof status !== "string" || status.trim() === "") return null;
  const s = status.trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function statusBadgeClass(status: string | undefined): string {
  const s = typeof status === "string" ? status.trim().toLowerCase() : "";
  if (s === "resolved") return "bg-success/15 text-success";
  if (s === "acknowledged") return "bg-elevated text-muted";
  if (s === "assigned") return "bg-warning/15 text-warning";
  return "bg-elevated text-muted";
}

export function TriagedPill({
  triage,
}: {
  triage: TriageInfo | null | undefined;
}) {
  if (!triage || triage.source !== "on-device") return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-semibold">
      <BrainCircuit size={10} />
      Triaged on-device
    </span>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function IncidentDrawer({
  entry,
  onClose,
  authHeader,
}: IncidentDrawerProps) {
  const [rescuers, setRescuers] = useState<RescuerOption[]>([]);
  const [rescuerId, setRescuerId] = useState<string>("");
  const [loadingRescuers, setLoadingRescuers] = useState(false);
  const [actionBusy, setActionBusy] = useState<string>("");
  const [toast, setToast] = useState<{
    kind: "ok" | "err";
    msg: string;
  } | null>(null);

  const triage = useMemo(() => (entry ? extractTriage(entry) : null), [entry]);
  const agency = entry?.agency;
  const opStatus = formatOperationalStatus(entry?.status);
  const isResolved = entry?.status?.trim().toLowerCase() === "resolved";

  // Fetch on-duty rescuers whenever a new incident opens or agency changes.
  useEffect(() => {
    if (!entry) return;
    let cancelled = false;
    setRescuers([]);
    setRescuerId("");
    setLoadingRescuers(true);
    const url = apiUrl(
      "/api/dispatch/rescuers?" +
        new URLSearchParams({
          ...(agency ? { agency } : {}),
          onDuty: "true",
        }).toString(),
    );

    (async () => {
      try {
        const res = await fetch(url, { headers: authHeader });
        if (cancelled) return;
        if (!res.ok) {
          setRescuers([]);
          return;
        }
        const data = (await res.json()) as { rescuers?: unknown };
        const list: RescuerOption[] = Array.isArray(data.rescuers)
          ? data.rescuers.flatMap((r): RescuerOption[] => {
              if (!r || typeof r !== "object" || Array.isArray(r)) return [];
              const rec = r as Record<string, unknown>;
              const id = typeof rec.id === "string" ? rec.id : "";
              const name =
                typeof rec.name === "string" && rec.name ? rec.name : id;
              if (!id) return [];
              const ag = rec.agency;
              return [
                {
                  id,
                  name,
                  agency:
                    ag === "medical" || ag === "fire" || ag === "police"
                      ? ag
                      : undefined,
                  onDuty: Boolean(rec.onDuty),
                },
              ];
            })
          : [];
        setRescuers(list);
      } catch {
        if (!cancelled) setRescuers([]);
      } finally {
        if (!cancelled) setLoadingRescuers(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entry, agency, authHeader]);

  if (!entry) return null;

  async function doAssign() {
    if (!entry || !rescuerId) return;
    setActionBusy("assign");
    setToast(null);
    try {
      const res = await fetch(apiUrl("/api/dispatch/assign"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ messageId: entry.id, rescuerId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setToast({ kind: "ok", msg: "Responder assigned." });
    } catch (e) {
      setToast({
        kind: "err",
        msg: e instanceof Error ? e.message : "Assign failed",
      });
    } finally {
      setActionBusy("");
    }
  }

  async function setStatus(status: "acknowledged" | "resolved") {
    if (!entry) return;
    setActionBusy(status);
    setToast(null);
    try {
      const res = await fetch(
        apiUrl(`/api/data/${encodeURIComponent(entry.id)}/status`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify({ status }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setToast({ kind: "ok", msg: `Marked ${status}.` });
    } catch (e) {
      setToast({
        kind: "err",
        msg: e instanceof Error ? e.message : "Status update failed",
      });
    } finally {
      setActionBusy("");
    }
  }

  const gps = entry.gps;
  const staticMapUrl = gps
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${gps.lat},${gps.lon}` +
      `&zoom=15&size=320x140&scale=2&markers=color:red%7C${gps.lat},${gps.lon}` +
      (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        ? `&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
        : "")
    : null;

  return (
    <>
      {/* Backdrop */}
      <button
        aria-label="Close incident drawer"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/50"
      />
      <aside
        role="dialog"
        aria-label="Incident detail"
        className="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-surface shadow-2xl border-l border-border flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${agencyBadgeClass(agency)}`}
              >
                {(agency ?? "unknown").toUpperCase()}
              </span>
              {opStatus && (
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadgeClass(entry.status)}`}
                >
                  {opStatus}
                </span>
              )}
              <TriagedPill triage={triage} />
            </div>
            <h2 className="text-[15px] font-semibold text-ink">
              Incident {entry.id.slice(0, 8)}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-elevated text-muted"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {/* Triage block */}
          {triage && (
            <section className="rounded-xl border border-border bg-elevated p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-muted uppercase tracking-wide">
                <BrainCircuit size={14} className="text-brand" />
                Triage summary
              </div>
              {typeof triage.severity === "number" && (
                <div className="text-[12px] text-muted">
                  Severity{" "}
                  <span className="font-semibold text-ink">
                    {triage.severity}/5
                  </span>
                </div>
              )}
              {triage.categories && triage.categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {triage.categories.map((c) => (
                    <span
                      key={c}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-border text-muted"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
              {triage.summary && (
                <p className="text-[13px] text-ink">{triage.summary}</p>
              )}
            </section>
          )}

          {/* Raw message */}
          <section className="flex flex-col gap-2">
            <div className="text-[12px] font-semibold text-muted uppercase tracking-wide">
              Message
            </div>
            <p className="text-[13px] text-ink whitespace-pre-wrap">
              {entry.message || <span className="text-muted">(empty)</span>}
            </p>
            <div className="flex items-center gap-3 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1">
                <User size={11} />
                {entry.macAddress || "unknown"}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock size={11} />
                {new Date(entry.receivedAt).toLocaleString()}
              </span>
            </div>
          </section>

          {/* GPS / static map */}
          {gps && (
            <section className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-muted uppercase tracking-wide">
                <MapPin size={14} className="text-brand" />
                Location
              </div>
              <p className="text-[12px] text-muted font-mono">
                {gps.lat.toFixed(5)}, {gps.lon.toFixed(5)}
              </p>
              {staticMapUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={staticMapUrl}
                  alt="Incident location"
                  className="rounded-xl border border-border w-full h-auto"
                />
              )}
            </section>
          )}

          {/* Responder selector */}
          <section className="flex flex-col gap-2">
            <div className="text-[12px] font-semibold text-muted uppercase tracking-wide">
              Assign responder
            </div>
            {isResolved && (
              <p className="text-[12px] text-success bg-success/10 border border-success/30 rounded-lg px-3 py-2">
                This SOS is marked resolved. Assignment and dispatch actions are
                disabled.
              </p>
            )}
            {loadingRescuers ? (
              <div className="inline-flex items-center gap-2 text-[12px] text-muted">
                <Loader2 size={12} className="animate-spin" />
                Loading on-duty rescuers…
              </div>
            ) : rescuers.length === 0 ? (
              <div className="rounded-xl border border-border bg-elevated p-3 text-[12px] text-muted">
                No on-duty rescuers found for this agency.
              </div>
            ) : (
              <select
                value={rescuerId}
                onChange={(e) => setRescuerId(e.target.value)}
                disabled={isResolved}
                className="w-full rounded-xl border border-border bg-elevated text-ink px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Select a rescuer…</option>
                {rescuers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.agency ? ` · ${r.agency}` : ""}
                  </option>
                ))}
              </select>
            )}
          </section>

          {/* Toast */}
          {toast && (
            <div
              className={
                "rounded-xl px-3 py-2 text-[12px] " +
                (toast.kind === "ok"
                  ? "bg-success/10 text-success border border-success/30"
                  : "bg-danger/10 text-danger border border-danger/40")
              }
            >
              {toast.msg}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-border p-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void doAssign()}
            disabled={isResolved || !rescuerId || actionBusy !== ""}
            className="flex-1 min-w-[110px] rounded-xl bg-brand text-white py-2 text-[13px] font-medium hover:bg-brand-hover disabled:opacity-50 transition-colors"
          >
            {actionBusy === "assign" ? "Assigning…" : "Assign"}
          </button>
          <button
            type="button"
            onClick={() => void setStatus("acknowledged")}
            disabled={isResolved || actionBusy !== ""}
            className="flex-1 min-w-[110px] rounded-xl bg-brand text-white py-2 text-[13px] font-medium hover:bg-brand-hover disabled:opacity-50 transition-colors"
          >
            {actionBusy === "acknowledged" ? "…" : "Acknowledge"}
          </button>
          <button
            type="button"
            onClick={() => void setStatus("resolved")}
            disabled={isResolved || actionBusy !== ""}
            className="flex-1 min-w-[110px] rounded-xl border border-border bg-surface text-ink py-2 text-[13px] font-medium hover:bg-elevated disabled:opacity-50 transition-colors"
          >
            {actionBusy === "resolved"
              ? "…"
              : isResolved
                ? "Resolved"
                : "Resolve"}
          </button>
        </div>
      </aside>
    </>
  );
}
