"use client";

import React, { useEffect, useState } from "react";
import { apiUrl } from "../../lib/api";
import { useAuth } from "../../lib/auth/provider";
import PageHeader from "../../components/PageHeader";

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
        setHealth({
          status: "error",
          message: err instanceof Error ? err.message : "Request failed",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3000";

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Read-only view of the current runtime configuration and connected services."
        info={
          <>
            A diagnostics surface. The{" "}
            <strong className="text-ink">Session</strong> card shows who you are
            signed in as and which agencies your role can see; the{" "}
            <strong className="text-ink">Backend</strong> card pings the API{" "}
            <code className="text-accent">/healthz</code> endpoint so you can
            confirm Echo is connected to its services. Nothing here is editable.
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
        <div className="bg-surface rounded-2xl p-6 border border-border">
          <h2 className="font-semibold text-[14px] text-ink mb-4">Session</h2>
          <dl className="text-[13px] text-muted space-y-2">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">User</dt>
              <dd className="font-medium text-ink truncate">
                {session?.email ?? session?.userId ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Role</dt>
              <dd className="font-medium text-ink">{session?.role ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Agencies</dt>
              <dd className="font-medium text-ink">
                {session?.agencies && session.agencies.length > 0
                  ? session.agencies.join(", ")
                  : "—"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-surface rounded-2xl p-6 border border-border">
          <h2 className="font-semibold text-[14px] text-ink mb-4">Backend</h2>
          <dl className="text-[13px] text-muted space-y-2">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">URL</dt>
              <dd className="font-mono text-[12px] text-ink truncate">
                {backendUrl}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Health</dt>
              <dd className="font-medium">
                {health.status === "loading" && (
                  <span className="text-muted">Checking…</span>
                )}
                {health.status === "ok" && (
                  <span className="text-success">Online</span>
                )}
                {health.status === "error" && (
                  <span className="text-danger" title={health.message}>
                    Offline
                  </span>
                )}
              </dd>
            </div>
            {health.status === "ok" && (
              <div className="mt-3 pt-3 border-t border-border">
                <pre className="text-[11px] text-muted overflow-x-auto">
                  {JSON.stringify(health.raw, null, 2)}
                </pre>
              </div>
            )}
            {health.status === "error" && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-[11px] text-danger">{health.message}</p>
              </div>
            )}
          </dl>
        </div>
      </div>
    </>
  );
}
