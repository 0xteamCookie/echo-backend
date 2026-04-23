"use client";

import React, { useEffect, useState } from "react";
import { apiUrl } from "../../lib/api";
import { useAuth } from "../../lib/auth/provider";

type HealthState =
  | { status: "loading" }
  | { status: "ok"; raw: Record<string, unknown> }
  | { status: "error"; message: string };

export default function SettingsPage() {
  const { session } = useAuth();
  const [health, setHealth] = useState<HealthState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl("/healthz"), { cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) {
          setHealth({ status: "error", message: `HTTP ${res.status}` });
          return;
        }
        const data = (await res.json()) as Record<string, unknown>;
        setHealth({ status: "ok", raw: data });
      } catch (err) {
        if (cancelled) return;
        setHealth({ status: "error", message: err instanceof Error ? err.message : "Request failed" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3000";

  return (
    <>
      <div className="flex justify-between items-center bg-white mb-2 pb-4">
        <div>
          <h1 className="text-[28px] font-semibold text-gray-900 tracking-tight">Settings</h1>
          <p className="text-[13px] text-gray-500 mt-1">
            Read-only view of the current runtime configuration and connected services.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
        <div className="bg-[#FAFAFA] rounded-2xl p-6 border border-[#FAFAFA]">
          <h2 className="font-semibold text-[14px] text-gray-800 mb-4">Session</h2>
          <dl className="text-[13px] text-gray-700 space-y-2">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">User</dt>
              <dd className="font-medium truncate">{session?.email ?? session?.userId ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Role</dt>
              <dd className="font-medium">{session?.role ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Agencies</dt>
              <dd className="font-medium">
                {session?.agencies && session.agencies.length > 0 ? session.agencies.join(", ") : "—"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-[#FAFAFA] rounded-2xl p-6 border border-[#FAFAFA]">
          <h2 className="font-semibold text-[14px] text-gray-800 mb-4">Backend</h2>
          <dl className="text-[13px] text-gray-700 space-y-2">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">URL</dt>
              <dd className="font-mono text-[12px] truncate">{backendUrl}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Health</dt>
              <dd className="font-medium">
                {health.status === "loading" && <span className="text-gray-500">Checking…</span>}
                {health.status === "ok" && <span className="text-emerald-600">Online</span>}
                {health.status === "error" && (
                  <span className="text-red-600" title={health.message}>
                    Offline
                  </span>
                )}
              </dd>
            </div>
            {health.status === "ok" && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <pre className="text-[11px] text-gray-600 overflow-x-auto">
                  {JSON.stringify(health.raw, null, 2)}
                </pre>
              </div>
            )}
            {health.status === "error" && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-[11px] text-red-600">{health.message}</p>
              </div>
            )}
          </dl>
        </div>
      </div>
    </>
  );
}
