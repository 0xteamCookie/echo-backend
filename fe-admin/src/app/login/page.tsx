"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Radio } from "lucide-react";
import { useAuth } from "../../lib/auth/provider";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, login } = useAuth();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState(searchParams.get("password") ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (session.authenticated) {
      router.replace("/");
    }
  }, [router, session.authenticated]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await login(email, password);
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "Invalid credentials");
      return;
    }
    router.replace("/");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-md bg-surface rounded-2xl border border-border p-6 flex flex-col gap-4 shadow-2xl shadow-black/40"
    >
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 bg-brand rounded-full flex items-center justify-center text-white shadow-lg shadow-brand/30">
          <Radio size={20} />
        </div>
        <div className="flex flex-col leading-none">
          <h1 className="text-[26px] font-semibold text-ink tracking-tight">
            Echo
          </h1>
          <span className="text-[10px] text-muted uppercase tracking-[0.2em]">
            Command Console
          </span>
        </div>
      </div>
      <p className="text-[13px] text-muted">
        Sign in as super admin to access the dashboard.
      </p>

      <div>
        <label className="block text-[12px] font-semibold text-muted mb-1">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-border bg-elevated px-3 py-2 text-[14px] text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-brand/30"
        />
      </div>

      <div>
        <label className="block text-[12px] font-semibold text-muted mb-1">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-border bg-elevated px-3 py-2 text-[14px] text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-brand/30"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-xl bg-brand text-white py-2.5 text-[14px] font-medium hover:bg-brand-hover disabled:opacity-50 transition-colors"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>

      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">
          {error}
        </div>
      )}
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
