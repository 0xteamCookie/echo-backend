"use client";

import React, { useMemo } from "react";
import { AlertTriangle, BrainCircuit, RefreshCcw, Siren, Timer } from "lucide-react";
import useSWR from "swr";
import { useAuth } from "../lib/auth/provider";

type DispatchRecommendation = {
  incidentId: string;
  selectedResponderId: string;
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
  if (agency === "medical") return "bg-blue-100 text-blue-700";
  if (agency === "fire") return "bg-orange-100 text-orange-700";
  return "bg-gray-200 text-gray-800";
}

export default function AgenticDispatchPanel() {
  const { authHeader } = useAuth();
  const authValue = authHeader.Authorization ?? "";
  const swrKey = authValue
    ? (["/api/dispatch/recommendations?limit=12", authValue] as const)
    : null;
  const { data: payload, error, isLoading, mutate } = useSWR<DispatchPayload>(
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

  const top = useMemo(() => payload?.recommendations.slice(0, 6) ?? [], [payload]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[16px] font-semibold text-gray-900 flex items-center gap-2">
            <BrainCircuit size={18} className="text-[#E63946]" />
            Agentic Dispatch Recommendations
          </h3>
          <p className="text-[12px] text-gray-500 mt-1">
            Per-incident Gemini decisions with deterministic guardrails and fallback.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void mutate()}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-[12px] font-medium hover:bg-gray-50"
        >
          <RefreshCcw size={14} />
          Refresh
        </button>
      </div>

      {payload && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-[#FAFAFA] border border-gray-100 p-3">
            <p className="text-[11px] text-gray-500 uppercase">Incidents</p>
            <p className="text-[20px] font-semibold text-gray-900 mt-1">
              {payload.meta.totalIncidents}
            </p>
          </div>
          <div className="rounded-xl bg-[#FAFAFA] border border-gray-100 p-3">
            <p className="text-[11px] text-gray-500 uppercase">AI recommended</p>
            <p className="text-[20px] font-semibold text-gray-900 mt-1">
              {payload.meta.modelAssistedCount}
            </p>
          </div>
          <div className="rounded-xl bg-[#FAFAFA] border border-gray-100 p-3">
            <p className="text-[11px] text-gray-500 uppercase">Fallback assigned</p>
            <p className="text-[20px] font-semibold text-[#E63946] mt-1">
              {payload.meta.fallbackCount}
            </p>
          </div>
        </div>
      )}

      {isLoading && <p className="text-[13px] text-gray-500">Computing dispatch recommendations...</p>}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">
          {error.message}
        </div>
      )}

      {!isLoading && !error && top.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-[13px] text-gray-600">
          No actionable incidents found yet. As new events are triaged, dispatch suggestions will appear here.
        </div>
      )}

      {!isLoading && !error && top.length > 0 && (
        <div className="flex flex-col gap-3">
          {top.map((item) => (
            <div key={`${item.incidentId}-${item.agency}`} className="rounded-xl border border-gray-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${agencyBadge(item.agency)}`}>
                    {item.agency.toUpperCase()}
                  </span>
                  <span className="text-[11px] text-gray-500">Incident {item.incidentId.slice(0, 8)}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      item.modelAssisted ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {item.modelAssisted ? "AI recommended" : "Auto-assigned"}
                  </span>
                </div>
                <div className="text-[11px] text-gray-600">
                  Confidence <span className="font-semibold">{item.confidenceLevel}/3</span>
                </div>
              </div>

              <p className="text-[13px] font-semibold text-gray-900 mt-2">{item.summary}</p>
              <div className="mt-3 rounded-lg bg-[#FAFAFA] border border-gray-100 p-2.5">
                <div className="flex items-center justify-between gap-2 text-[12px]">
                  <div className="flex items-center gap-2">
                    <Siren size={14} className="text-gray-500" />
                    <span className="font-medium text-gray-800">{item.selectedResponderId}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Timer size={13} />
                    <span>ETA {item.etaMinutes}m</span>
                  </div>
                </div>
              </div>
              <p className="text-[12px] text-gray-600 mt-2">{item.rationale}</p>
              {item.escalate && (
                <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                  <AlertTriangle size={12} />
                  Escalate for supervisor review
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {payload && (
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-[12px] text-gray-600">
          Generated at {new Date(payload.generatedAt).toLocaleTimeString()} with deterministic guardrails.
        </div>
      )}
    </div>
  );
}
