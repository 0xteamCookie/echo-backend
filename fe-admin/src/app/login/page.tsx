"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
      className="w-full max-w-md bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-4"
    >
      <h1 className="text-[28px] font-semibold text-gray-900 tracking-tight">
        DisasterOps Login
      </h1>
      <p className="text-[13px] text-gray-500">
        Sign in as super admin to access the dashboard.
      </p>

      <div>
        <label className="block text-[12px] font-semibold text-gray-600 mb-1">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-black/10"
        />
      </div>

      <div>
        <label className="block text-[12px] font-semibold text-gray-600 mb-1">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-black/10"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-xl bg-black text-white py-2.5 text-[14px] font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
          {error}
        </div>
      )}
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F7F7] p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
