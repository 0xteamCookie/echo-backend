"use client";

import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, QrCode } from "lucide-react";
import AccessDenied from "../../components/auth/AccessDenied";
import { can } from "../../lib/auth/permissions";
import { useAuth } from "../../lib/auth/provider";

type IssueResponse = {
  token?: string;
  expiresInSeconds?: number;
  tokenType?: string;
  error?: string;
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setCopied(false);

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

    try {
      const res = await fetch("/api/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as IssueResponse;
      setResult(data);
    } catch {
      setResult({ error: "Network error — is the admin app running?" });
    } finally {
      setLoading(false);
    }
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
            Issue a JWT (role, agent name, radius, location) and show it as a QR. The admin app proxies using{" "}
            <code className="text-[12px] bg-gray-100 px-1 rounded">ADMIN_API_KEY</code> in{" "}
            <code className="text-[12px] bg-gray-100 px-1 rounded">.env.local</code>.
          </p>
        </div>
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
