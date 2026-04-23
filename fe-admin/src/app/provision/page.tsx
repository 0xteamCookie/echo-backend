"use client";

import React, { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, QrCode } from "lucide-react";
import AccessDenied from "../../components/auth/AccessDenied";
import { can } from "../../lib/auth/permissions";
import { useAuth } from "../../lib/auth/provider";
import { apiUrl } from "../../lib/api";

type IssueResponse = {
  token?: string;
  expiresInSeconds?: number;
  tokenType?: string;
  error?: string;
};

type DispatchRecommendation = {
  incidentId: string;
  selectedResponderId: string;
  selectedResponderName: string;
  selectedResponderSourceSystem: string;
  agency: "medical" | "fire" | "police";
  severity: number;
  confidenceLevel: 1 | 2 | 3;
  summary: string;
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

type DispatchResponse = {
  recommendations: DispatchRecommendation[];
};

const DEFAULT_EXPIRES = 60 * 60 * 24 * 365 * 10;
export default function ProvisionPage() {
  const { session, authHeader } = useAuth();
  const canIssue = can(session, "provision:issue");
  const [sub, setSub] = useState("");
  const [role, setRole] = useState("medical");
  const [agency, setAgency] = useState("medical");
  const [name, setName] = useState("");
  const [radiusM, setRadiusM] = useState("500");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [expiresInSeconds, setExpiresInSeconds] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IssueResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedRescuerSub, setSelectedRescuerSub] = useState("");
  const [dispatchRecs, setDispatchRecs] = useState<DispatchRecommendation[]>([]);
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [dispatchError, setDispatchError] = useState("");

  useEffect(() => {
    async function loadDispatchRecommendations() {
      if (!canIssue) return;
      setDispatchLoading(true);
      setDispatchError("");
      try {
        const res = await fetch(apiUrl("/api/dispatch/recommendations?limit=8"), {
          headers: authHeader,
        });
        const data = (await res.json()) as DispatchResponse & { error?: string };
        if (!res.ok) {
          setDispatchError(data.error ?? "Failed to fetch dispatch recommendations");
          setDispatchRecs([]);
          return;
        }
        setDispatchRecs(data.recommendations ?? []);
      } catch {
        setDispatchError("Failed to fetch dispatch recommendations");
        setDispatchRecs([]);
      } finally {
        setDispatchLoading(false);
      }
    }
    void loadDispatchRecommendations();
  }, [authHeader, canIssue]);

  async function issueToken(payload: Record<string, string | number>) {
    setLoading(true);
    setResult(null);
    setCopied(false);

    try {
      const res = await fetch(apiUrl("/api/provision/token"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as IssueResponse;
      setResult(data);
    } catch {
      setResult({ error: "Network error \u2014 is the backend API reachable?" });
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, string | number> = {
      sub: sub.trim(),
      role: role.trim(),
      agency: agency.trim(),
      name: name.trim(),
      radius_m: Number(radiusM),
      lat: Number(lat),
      lng: Number(lng),
    };
    const exp = expiresInSeconds.trim();
    if (exp !== "" && Number.isFinite(Number(exp))) {
      payload.expiresInSeconds = Math.floor(Number(exp));
    }
    await issueToken(payload);
  }

  async function onUseDispatchRecommendation(rec: DispatchRecommendation) {
    if (!canIssue) return;
    const preset = rec.provisioningPreset;
    setSelectedRescuerSub(preset.sub);
    setSub(preset.sub);
    setRole(preset.role);
    setAgency(preset.agency);
    setName(preset.name);
    setRadiusM(String(preset.radiusM));
    setLat(String(preset.lat));
    setLng(String(preset.lng));
    await issueToken({
      sub: preset.sub,
      role: preset.role,
      agency: preset.agency,
      name: preset.name,
      radius_m: preset.radiusM,
      lat: preset.lat,
      lng: preset.lng,
    });
  }

  async function copyToken() {
    if (!result?.token) return;
    await navigator.clipboard.writeText(result.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const token = result?.token;
  const err = result?.error;
  const qrOk = Boolean(token && token.length <= 2800);

  return (
    <>
      {!canIssue && (
        <AccessDenied
          title="Provisioning is super-admin only"
          detail="Your role can work with incident data but cannot mint rescuer JWT credentials."
        />
      )}
      <div className="flex justify-between items-center bg-white mb-2 pb-4">
        <div>
          <h1 className="text-[28px] font-semibold text-gray-900 tracking-tight flex items-center gap-2">
            <QrCode className="text-[#E63946]" size={28} strokeWidth={2} />
            Rescuer credentials
          </h1>
          <p className="text-[13px] text-gray-500 mt-1 max-w-xl">
            Issue a JWT (role, agent name, radius, location) and show it as a QR. Calls the backend
            {" "}
            <code className="text-[12px] bg-gray-100 px-1 rounded">POST /api/provision/token</code>
            {" "}
            directly; super-admin permission (<code className="text-[12px] bg-gray-100 px-1 rounded">provision:issue</code>) is required.
          </p>
        </div>
      </div>

      <div className="bg-white border border-[#EBEBEB] rounded-2xl p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="text-[16px] font-semibold text-gray-900">
            Agentic dispatch -&gt; one-click rescuer QR
          </h2>
          <span className="text-[12px] text-gray-500">
            Uses dispatch suggestions to prefill role, radius and incident coordinates.
          </span>
        </div>
        {dispatchLoading && <p className="text-[12px] text-gray-500">Loading recommendations...</p>}
        {dispatchError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800 mb-3">
            {dispatchError}
          </div>
        )}
        {!dispatchLoading && !dispatchError && dispatchRecs.length === 0 && (
          <p className="text-[12px] text-gray-500 mb-3">
            No dispatch recommendations available yet.
          </p>
        )}
        {dispatchRecs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
            {dispatchRecs.slice(0, 8).map((rec) => (
              <button
                key={`${rec.incidentId}-${rec.selectedResponderId}`}
                type="button"
                onClick={() => void onUseDispatchRecommendation(rec)}
                disabled={!canIssue || loading}
                className="text-left rounded-xl border border-gray-200 bg-white hover:bg-gray-50 px-3 py-3 transition-colors disabled:opacity-50"
              >
                <p className="text-[11px] uppercase tracking-wide text-gray-500">
                  Incident {rec.incidentId.slice(0, 8)}
                </p>
                <p className="text-[14px] font-semibold text-gray-900 mt-1">
                  {rec.selectedResponderName}
                </p>
                <p className="text-[12px] text-gray-600 mt-1">
                  {rec.selectedResponderSourceSystem} | {rec.agency}
                </p>
                <p className="text-[11px] text-gray-500 mt-1">
                  Radius {rec.provisioningPreset.radiusM}m | {rec.provisioningPreset.lat.toFixed(4)},{" "}
                  {rec.provisioningPreset.lng.toFixed(4)}
                </p>
              </button>
            ))}
          </div>
        )}

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={onSubmit}
          className="lg:col-span-5 bg-[#FAFAFA] rounded-2xl p-6 border border-[#EBEBEB] flex flex-col gap-4"
        >
          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1">Subject ID *</label>
            <input
              required
              value={sub}
              onChange={(e) => setSub(e.target.value)}
              placeholder="e.g. badge-042"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[#E63946]/30 focus:border-[#E63946]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1">Role *</label>
            <select
              required
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={!canIssue}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[#E63946]/30 focus:border-[#E63946]"
            >
              <option value="medical">Medical</option>
              <option value="fire">Fire</option>
              <option value="police">Police</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1">Agency *</label>
            <select
              required
              value={agency}
              onChange={(e) => setAgency(e.target.value)}
              disabled={!canIssue}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[#E63946]/30 focus:border-[#E63946]"
            >
              <option value="medical">Medical</option>
              <option value="fire">Fire</option>
              <option value="police">Police</option>
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1">Agent name *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canIssue}
              placeholder="Full name or call sign"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[#E63946]/30 focus:border-[#E63946]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1">Radius (metres) *</label>
            <input
              required
              value={radiusM}
              onChange={(e) => setRadiusM(e.target.value)}
              disabled={!canIssue}
              type="text"
              inputMode="decimal"
              placeholder="e.g. 500"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[#E63946]/30 focus:border-[#E63946]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-gray-600 mb-1">Latitude *</label>
              <input
                required
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                disabled={!canIssue}
                type="text"
                inputMode="decimal"
                placeholder="-37.81"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[14px] font-mono outline-none focus:ring-2 focus:ring-[#E63946]/30 focus:border-[#E63946]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-600 mb-1">Longitude *</label>
              <input
                required
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                disabled={!canIssue}
                type="text"
                inputMode="decimal"
                placeholder="144.96"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[14px] font-mono outline-none focus:ring-2 focus:ring-[#E63946]/30 focus:border-[#E63946]"
              />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1">Expires in (seconds)</label>
            <input
              value={expiresInSeconds}
              onChange={(e) => setExpiresInSeconds(e.target.value)}
              disabled={!canIssue}
              type="text"
              inputMode="numeric"
              placeholder={`Optional — backend default (~${DEFAULT_EXPIRES}s)`}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[14px] font-mono outline-none focus:ring-2 focus:ring-[#E63946]/30 focus:border-[#E63946]"
            />
            <p className="text-[11px] text-gray-400 mt-1">Leave blank for the server default TTL.</p>
          </div>

          <button
            type="submit"
            disabled={loading || !canIssue}
            className="mt-2 rounded-xl bg-black text-white py-2.5 text-[14px] font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {loading ? "Issuing…" : "Generate QR"}
          </button>

          {err && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
              {err}
            </div>
          )}
        </form>

        <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-[#EBEBEB] flex flex-col items-center justify-start min-h-[320px]">
          {!token && !err && (
            <p className="text-[14px] text-gray-400 text-center py-16">Fill the form and generate to see the QR code.</p>
          )}

          {token && (
            <>
              <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-4 self-start">Scan this QR on the rescuer device</p>
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                {qrOk ? (
                  <QRCodeSVG value={token} size={280} level="M" includeMargin />
                ) : (
                  <p className="text-[13px] text-amber-800 max-w-md">
                    Token is too long for a standard QR ({token.length} chars). Use “Copy JWT” below or shorten claims.
                  </p>
                )}
              </div>
              {typeof result?.expiresInSeconds === "number" && (
                <p className="text-[12px] text-gray-500 mt-3">
                  Expires in <span className="font-mono">{result.expiresInSeconds}</span> seconds
                </p>
              )}
              <div className="w-full mt-6 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copyToken}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-[13px] font-medium hover:bg-gray-50"
                  >
                    {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                    {copied ? "Copied" : "Copy JWT"}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={token}
                  rows={6}
                  className="w-full rounded-xl border border-gray-200 bg-[#FAFAFA] p-3 text-[11px] font-mono text-gray-700 resize-y min-h-[120px]"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
