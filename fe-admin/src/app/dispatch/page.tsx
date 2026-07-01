"use client";

import React, { useMemo, useState } from "react";
import useSWR from "swr";
import { QRCodeSVG } from "qrcode.react";
import {
  BrainCircuit,
  Check,
  Copy,
  QrCode,
  RefreshCcw,
  UserPlus,
  Sparkles,
  Radar,
  ShieldCheck,
  Clock3,
  AlertTriangle,
  WandSparkles,
} from "lucide-react";
import { useAuth } from "../../lib/auth/provider";
import { apiUrl } from "../../lib/api";
import { can } from "../../lib/auth/permissions";
import PageHeader from "../../components/PageHeader";

type DispatchRecommendation = {
  incidentId: string;
  selectedResponderId: string;
  selectedResponderName: string;
  selectedResponderSourceSystem: string;
  summary: string;
  agency: "medical" | "fire" | "police";
  severity?: number;
  etaMinutes: number;
  confidenceLevel: 1 | 2 | 3;
  rationale: string;
  escalate: boolean;
  modelAssisted: boolean;
  provisioningPreset: {
    sub: string;
    name: string;
    role: "medical" | "fire" | "police";
    agency: "medical" | "fire" | "police";
    radiusM: number;
    lat: number;
    lng: number;
  };
};

type DispatchPayload = {
  generatedAt: string;
  meta: {
    totalIncidents: number;
    modelAssistedCount: number;
    fallbackCount: number;
  };
  recommendations: DispatchRecommendation[];
  error?: string;
};

type IssueResponse = {
  token?: string;
  expiresInSeconds?: number;
  error?: string;
};

type AssignResponse = {
  ok?: boolean;
  assignedAt?: string;
  error?: string;
};

export default function DispatchPage() {
  const { session, authHeader } = useAuth();
  const canIssue = can(session, "provision:issue");
  const authValue = authHeader.Authorization ?? "";
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState("");
  const [qrToken, setQrToken] = useState("");
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [selectedRec, setSelectedRec] = useState<DispatchRecommendation | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [assignState, setAssignState] = useState<{
    pending: boolean;
    okMsg: string;
    errMsg: string;
  }>({ pending: false, okMsg: "", errMsg: "" });
  const [agencyFilter, setAgencyFilter] = useState<
    "all" | "medical" | "fire" | "police"
  >("all");
  const [searchIncident, setSearchIncident] = useState("");

  const swrKey = authValue
    ? ([apiUrl("/api/dispatch/recommendations?limit=12"), authValue] as const)
    : null;
  const { data, error, isLoading, mutate } = useSWR<DispatchPayload>(
    swrKey,
    async ([url, authorization]: readonly [string, string]) => {
      const res = await fetch(url, {
        headers: { Authorization: authorization },
      });
      const out = (await res.json()) as DispatchPayload;
      if (!res.ok)
        throw new Error(out.error ?? "Failed to load recommendations");
      return out;
    },
    // 60s poll: each refresh can trigger billable Distance Matrix + Gemini work
    // server-side, so we poll conservatively (was 12s).
    { refreshInterval: 60000, revalidateOnFocus: false },
  );

  async function generateQrFromRecommendation(rec: DispatchRecommendation) {
    if (!canIssue) return;
    setIssuing(true);
    setIssueError("");
    setSelectedRec(rec);
    setCopied(false);
    setAssignState({ pending: false, okMsg: "", errMsg: "" });
    try {
      const preset = rec.provisioningPreset;
      const res = await fetch(apiUrl("/api/provision/token"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          sub: preset.sub,
          role: preset.role,
          agency: preset.agency,
          name: preset.name,
          radius_m: preset.radiusM,
          lat: preset.lat,
          lng: preset.lng,
        }),
      });
      const out = (await res.json()) as IssueResponse;
      if (!res.ok || !out.token)
        throw new Error(out.error ?? "Failed to issue token");
      setQrToken(out.token);
      setExpiresIn(
        typeof out.expiresInSeconds === "number" ? out.expiresInSeconds : null,
      );
    } catch (e) {
      setQrToken("");
      setExpiresIn(null);
      setIssueError(e instanceof Error ? e.message : "Failed to generate QR");
    } finally {
      setIssuing(false);
    }
  }

  async function assignSelectedRecommendation() {
    if (!selectedRec) return;
    setAssignState({ pending: true, okMsg: "", errMsg: "" });
    try {
      const res = await fetch(apiUrl("/api/dispatch/assign"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          messageId: selectedRec.incidentId,
          rescuerId: selectedRec.provisioningPreset.sub,
        }),
      });
      const out = (await res.json()) as AssignResponse;
      if (!res.ok || !out.ok)
        throw new Error(out.error ?? "Failed to assign responder");
      setAssignState({
        pending: false,
        okMsg: `Assigned ${selectedRec.selectedResponderName} to incident ${selectedRec.incidentId.slice(0, 8)}.`,
        errMsg: "",
      });
    } catch (e) {
      setAssignState({
        pending: false,
        okMsg: "",
        errMsg: e instanceof Error ? e.message : "Failed to assign responder",
      });
    }
  }

  async function seedDummyRescuers() {
    setSeedMsg("");
    try {
      const res = await fetch(apiUrl("/api/dispatch/dev/seed-rescuers"), {
        method: "POST",
        headers: authHeader,
      });
      const out = (await res.json()) as { seeded?: number; error?: string };
      if (!res.ok) throw new Error(out.error ?? "Failed to seed rescuers");
      setSeedMsg(`Seeded ${out.seeded ?? 0} dummy rescuers`);
      await mutate();
    } catch (e) {
      setSeedMsg(e instanceof Error ? e.message : "Failed to seed rescuers");
    }
  }

  async function copyToken() {
    if (!qrToken) return;
    await navigator.clipboard.writeText(qrToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const top = useMemo(() => data?.recommendations ?? [], [data]);
  const filtered = useMemo(() => {
    return top.filter((rec) => {
      if (agencyFilter !== "all" && rec.agency !== agencyFilter) return false;
      if (!searchIncident.trim()) return true;
      return rec.incidentId
        .toLowerCase()
        .includes(searchIncident.trim().toLowerCase());
    });
  }, [top, agencyFilter, searchIncident]);
  const qrOk = qrToken.length > 0 && qrToken.length <= 2800;
  const avgEta = filtered.length
    ? Math.round(
        filtered.reduce((sum, x) => sum + x.etaMinutes, 0) / filtered.length,
      )
    : 0;
  const escalations = filtered.filter((x) => x.escalate).length;

  return (
    <>
      <PageHeader
        title="Agentic Dispatch Console"
        icon={<BrainCircuit size={24} />}
        subtitle="Unified workflow: AI shortlist → operator validation → one-click rescuer credential QR."
        info={
          <>
            The end-to-end dispatch loop. Echo&apos;s agent ranks responders per
            incident (with deterministic guardrails and a fallback).{" "}
            <strong className="text-ink">Step 1</strong> — review and pick a
            recommendation; that auto-generates a credential.{" "}
            <strong className="text-ink">Step 2</strong> — validate the choice,
            issue the QR token, and assign the responder to the incident.{" "}
            <strong className="text-ink">Step 3</strong> — the field responder
            scans the QR in their app and begins sending heartbeats. The metric
            tiles summarize incidents in scope, AI-assisted picks, average ETA,
            and pending escalations.
          </>
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => void mutate()}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-muted hover:bg-elevated hover:text-ink"
            >
              <RefreshCcw size={14} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void seedDummyRescuers()}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-muted hover:bg-elevated hover:text-ink"
            >
              <UserPlus size={14} />
              Reseed dummy rescuers
            </button>
          </>
        }
      />
      <div className="mb-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            icon={<Radar size={14} />}
            label="Incidents in scope"
            value={String(data?.meta.totalIncidents ?? 0)}
          />
          <MetricCard
            icon={<Sparkles size={14} />}
            label="AI-assisted"
            value={String(data?.meta.modelAssistedCount ?? 0)}
          />
          <MetricCard
            icon={<Clock3 size={14} />}
            label="Avg ETA"
            value={avgEta ? `${avgEta}m` : "-"}
          />
          <MetricCard
            icon={<AlertTriangle size={14} />}
            label="Escalations"
            value={String(escalations)}
          />
        </div>
      </div>
      {seedMsg && (
        <div className="mb-4 rounded-xl border border-border bg-elevated p-3 text-[12px] text-muted">
          {seedMsg}
        </div>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1 items-start">
        <section className="xl:col-span-8 bg-surface rounded-2xl border border-border p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[16px] font-semibold text-ink flex items-center gap-2">
                <WandSparkles size={16} className="text-brand" />
                Step 1: Review Agentic Recommendations
              </h2>
              <p className="text-[12px] text-muted mt-1">
                Pick a recommendation to auto-generate credentials for that
                responder.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={searchIncident}
                onChange={(e) => setSearchIncident(e.target.value)}
                placeholder="Search incident id"
                className="w-40 rounded-full border border-border bg-elevated px-3 py-1.5 text-[12px] text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-brand/30"
              />
              {(["all", "medical", "fire", "police"] as const).map((agency) => (
                <button
                  key={agency}
                  type="button"
                  onClick={() => setAgencyFilter(agency)}
                  className={`rounded-full px-2.5 py-1 text-[11px] border ${
                    agencyFilter === agency
                      ? "border-brand bg-brand text-white"
                      : "border-border text-muted hover:bg-elevated"
                  }`}
                >
                  {agency}
                </button>
              ))}
            </div>
          </div>
          {isLoading && (
            <p className="text-[13px] text-muted">
              Loading recommendations...
            </p>
          )}
          {error && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-[13px] text-danger">
              {error.message}
            </div>
          )}
          {!isLoading && !error && filtered.length === 0 && (
            <div className="rounded-xl border border-border bg-elevated p-3 text-[13px] text-muted">
              No dispatch recommendations yet. Seed dummy rescuers and refresh
              to test.
            </div>
          )}
          {!isLoading && !error && filtered.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.map((rec) => (
                <button
                  key={`${rec.incidentId}-${rec.selectedResponderId}`}
                  type="button"
                  onClick={() => void generateQrFromRecommendation(rec)}
                  disabled={!canIssue || issuing}
                  className={`text-left rounded-xl border p-3 transition-colors disabled:opacity-60 ${
                    selectedRec?.incidentId === rec.incidentId
                      ? "border-brand bg-brand/10"
                      : "border-border hover:bg-elevated"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-elevated text-muted font-semibold">
                        {rec.agency.toUpperCase()}
                      </span>
                      <span className="text-[11px] text-muted">
                        Incident {rec.incidentId.slice(0, 8)}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted">
                      Confidence {rec.confidenceLevel}/3
                    </span>
                  </div>
                  <p className="text-[14px] font-semibold text-ink mt-2">
                    {rec.selectedResponderName}
                  </p>
                  <p className="text-[12px] text-muted mt-1">
                    {rec.selectedResponderSourceSystem} | ETA {rec.etaMinutes}m
                  </p>
                  <p className="text-[12px] text-muted mt-1">
                    {rec.summary}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-[11px]">
                    <span className="px-2 py-0.5 rounded-full border border-border text-muted">
                      Radius {rec.provisioningPreset.radiusM}m
                    </span>
                    {rec.escalate && (
                      <span className="px-2 py-0.5 rounded-full border border-warning/30 bg-warning/10 text-warning">
                        Escalate
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="xl:col-span-4 bg-surface rounded-2xl border border-border p-5 xl:sticky xl:top-4 max-h-[calc(100vh-7.5rem)] overflow-y-auto">
          <h2 className="text-[15px] font-semibold text-ink flex items-center gap-2">
            <ShieldCheck size={18} className="text-brand" />
            Step 2: Validate + Issue Credential
          </h2>
          {selectedRec && (
            <div className="mt-3 rounded-xl border border-border bg-elevated p-3">
              <p className="text-[11px] text-muted uppercase">
                Selected recommendation
              </p>
              <p className="text-[14px] font-semibold text-ink mt-1">
                {selectedRec.selectedResponderName}
              </p>
              <p className="text-[12px] text-muted mt-1">
                Incident {selectedRec.incidentId.slice(0, 8)} |{" "}
                {selectedRec.selectedResponderSourceSystem}
              </p>
              <p className="text-[12px] text-muted mt-1">
                {selectedRec.rationale}
              </p>
            </div>
          )}
          {!canIssue && (
            <p className="text-[12px] text-warning mt-3">
              Your role cannot issue provisioning tokens (`provision:issue`
              required).
            </p>
          )}
          {issueError && (
            <div className="mt-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-[12px] text-danger">
              {issueError}
            </div>
          )}
          {assignState.errMsg && (
            <div className="mt-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-[12px] text-danger">
              {assignState.errMsg}
            </div>
          )}
          {assignState.okMsg && (
            <div className="mt-3 rounded-xl border border-success/30 bg-success/10 p-3 text-[12px] text-success">
              {assignState.okMsg}
            </div>
          )}
          {!qrToken && !issueError && (
            <p className="text-[13px] text-muted mt-4">
              Click any recommendation to run one-click issuance and render QR.
            </p>
          )}
          {qrToken && (
            <div className="mt-4">
              {selectedRec && (
                <p className="text-[12px] text-muted mb-3">
                  Token for{" "}
                  <span className="font-semibold text-ink">
                    {selectedRec.selectedResponderName}
                  </span>
                </p>
              )}
              <div className="rounded-xl border border-border p-3 inline-block bg-white">
                {qrOk ? (
                  <QRCodeSVG
                    value={qrToken}
                    size={260}
                    level="M"
                    includeMargin
                  />
                ) : (
                  <p className="text-[12px] text-warning">
                    Token too long for QR. Copy JWT below.
                  </p>
                )}
              </div>
              {typeof expiresIn === "number" && (
                <p className="text-[12px] text-muted mt-3">
                  Expires in {expiresIn}s
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void assignSelectedRecommendation()}
                  disabled={!selectedRec || assignState.pending}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand text-white px-3 py-2 text-[12px] font-semibold hover:bg-brand-hover disabled:opacity-60"
                >
                  {assignState.pending ? "Assigning..." : "Assign To Incident"}
                </button>
                <button
                  type="button"
                  onClick={copyToken}
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-[12px] font-medium text-muted hover:bg-elevated hover:text-ink"
                >
                  {copied ? (
                    <Check size={14} className="text-success" />
                  ) : (
                    <Copy size={14} />
                  )}
                  {copied ? "Copied" : "Copy JWT"}
                </button>
              </div>
              <div>
                <textarea
                  readOnly
                  value={qrToken}
                  rows={5}
                  className="w-full mt-3 rounded-xl border border-border bg-elevated p-2 text-[11px] font-mono text-muted"
                />
              </div>
            </div>
          )}
          <div className="mt-5 rounded-xl border border-dashed border-border p-3">
            <p className="text-[11px] text-muted uppercase">Step 3</p>
            <p className="text-[12px] text-muted mt-1">
              Share QR with field responder app, then confirm heartbeat updates
              from the issued `sub`.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="text-brand">{icon}</div>
      <p className="text-[11px] text-muted mt-2 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-[20px] font-semibold text-ink mt-1">{value}</p>
    </div>
  );
}
