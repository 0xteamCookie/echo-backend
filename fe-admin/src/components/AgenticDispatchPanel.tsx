"use client";

import React, { useMemo } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  RefreshCcw,
  Siren,
  Timer,
} from "lucide-react";
import useSWR from "swr";
import { useAuth } from "../lib/auth/provider";
import { apiUrl } from "../lib/api";

type DispatchRecommendation = {
  incidentId: string;
  selectedResponderId: string;
  selectedResponderName: string;
  summary: string;
  severity: number;
  agency: "medical" | "fire" | "police";
  etaMinutes: number;
  confidenceLevel: 1 | 2 | 3;
  rationale: string;
  escalate: boolean;
  modelAssisted: boolean;
};

type DispatchPayload = {
  generatedAt: string;
  meta: {
    totalIncidents: number;
    modelAssistedCount: number;
    fallbackCount: number;
  };
  recommendations: DispatchRecommendation[];
};

function agencyBadge(agency: "medical" | "fire" | "police"): string {
  if (agency === "medical") return "bg-info/15 text-info";
  if (agency === "fire") return "bg-brand/15 text-brand";
  return "bg-elevated text-muted";
}

export default function AgenticDispatchPanel() {
  const { authHeader } = useAuth();
  const authValue = authHeader.Authorization ?? "";
  const swrKey = authValue
    ? ([apiUrl("/api/dispatch/recommendations?limit=12"), authValue] as const)
    : null;
  const {
    data: payload,
    error,
    isLoading,
    mutate,
  } = useSWR<DispatchPayload>(
    swrKey,
    async ([url, authorization]: readonly [string, string]) => {
      const res = await fetch(url, {
        headers: { Authorization: authorization },
      });
      const data = (await res.json()) as DispatchPayload & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to fetch recommendations");
      }
      return data;
    },
    { refreshInterval: 12000, revalidateOnFocus: false },
  );

  const top = useMemo(
    () => payload?.recommendations.slice(0, 6) ?? [],
    [payload],
  );

  return (
    <div className="bg-surface rounded-2xl border border-border p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[16px] font-semibold text-ink flex items-center gap-2">
            <BrainCircuit size={18} className="text-brand" />
            Agentic Dispatch Recommendations
          </h3>
          <p className="text-[12px] text-muted mt-1">
            Per-incident Gemini decisions with deterministic guardrails and
            fallback.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void mutate()}
          className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-[12px] font-medium hover:bg-elevated"
        >
          <RefreshCcw size={14} />
          Refresh
        </button>
      </div>

      {payload && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-elevated border border-border p-3">
            <p className="text-[11px] text-muted uppercase">Incidents</p>
            <p className="text-[20px] font-semibold text-ink mt-1">
              {payload.meta.totalIncidents}
            </p>
          </div>
          <div className="rounded-xl bg-elevated border border-border p-3">
            <p className="text-[11px] text-muted uppercase">
              AI recommended
            </p>
            <p className="text-[20px] font-semibold text-ink mt-1">
              {payload.meta.modelAssistedCount}
            </p>
          </div>
          <div className="rounded-xl bg-elevated border border-border p-3">
            <p className="text-[11px] text-muted uppercase">
              Fallback assigned
            </p>
            <p className="text-[20px] font-semibold text-brand mt-1">
              {payload.meta.fallbackCount}
            </p>
          </div>
        </div>
      )}

      {isLoading && (
        <p className="text-[13px] text-muted">
          Computing dispatch recommendations...
        </p>
      )}
      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-[13px] text-danger">
          {error.message}
        </div>
      )}

      {!isLoading && !error && top.length === 0 && (
        <div className="rounded-xl border border-border bg-elevated p-3 text-[13px] text-muted">
          No actionable incidents found yet. As new events are triaged, dispatch
          suggestions will appear here.
        </div>
      )}

      {!isLoading && !error && top.length > 0 && (
        <div className="flex flex-col gap-3">
          {top.map((item) => (
            <div
              key={`${item.incidentId}-${item.agency}`}
              className="rounded-xl border border-border p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${agencyBadge(item.agency)}`}
                  >
                    {item.agency.toUpperCase()}
                  </span>
                  <span className="text-[11px] text-muted">
                    Incident {item.incidentId.slice(0, 8)}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      item.modelAssisted
                        ? "bg-success/15 text-success"
                        : "bg-warning/15 text-warning"
                    }`}
                  >
                    {item.modelAssisted ? "AI recommended" : "Auto-assigned"}
                  </span>
                </div>
                <div className="text-[11px] text-muted">
                  Confidence{" "}
                  <span className="font-semibold">
                    {item.confidenceLevel}/3
                  </span>
                </div>
              </div>

              <p className="text-[13px] font-semibold text-ink mt-2">
                {item.summary}
              </p>
              <div className="mt-3 rounded-lg bg-elevated border border-border p-2.5">
                <div className="flex items-center justify-between gap-2 text-[12px]">
                  <div className="flex items-center gap-2">
                    <Siren size={14} className="text-muted" />
                    <span className="font-medium text-ink">
                      {item.selectedResponderName}
                    </span>
                    <span className="text-muted">
                      ({item.selectedResponderId})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted">
                    <Timer size={13} />
                    <span>ETA {item.etaMinutes}m</span>
                  </div>
                </div>
              </div>
              <p className="text-[12px] text-muted mt-2">{item.rationale}</p>
              {item.escalate && (
                <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-warning bg-warning/10 border border-warning/30 px-2 py-1 rounded-full">
                  <AlertTriangle size={12} />
                  Escalate for supervisor review
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {payload && (
        <div className="rounded-xl bg-elevated border border-border p-3 text-[12px] text-muted">
          Generated at {new Date(payload.generatedAt).toLocaleTimeString()} with
          deterministic guardrails.
        </div>
      )}
    </div>
  );
}
