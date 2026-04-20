"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { can } from "./permissions";
import { defaultSession, type AuthSession, type Permission } from "./types";

const STORAGE_KEY = "echo-admin-session";

type AuthContextValue = {
  session: AuthSession;
  ready: boolean;
  token: string;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  can: (permission: Permission) => boolean;
  authHeader: Record<string, string>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeSession(input: unknown): { session: AuthSession; token: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { session: defaultSession(), token: "" };
  }
  const raw = input as { token?: unknown; session?: Partial<AuthSession> };
  const token = typeof raw.token === "string" ? raw.token : "";
  const sessionRaw = raw.session ?? {};
  const role =
    sessionRaw.role === "super_admin" ||
    sessionRaw.role === "medical" ||
    sessionRaw.role === "fire" ||
    sessionRaw.role === "police"
      ? sessionRaw.role
      : "medical";
  const agencies = Array.isArray(sessionRaw.agencies)
    ? sessionRaw.agencies.filter((v): v is "medical" | "fire" | "police" =>
        v === "medical" || v === "fire" || v === "police",
      )
    : [];
  return {
    token,
    session: {
      authenticated: Boolean(token),
      userId: typeof sessionRaw.userId === "string" ? sessionRaw.userId : "",
      email: typeof sessionRaw.email === "string" ? sessionRaw.email : "",
      role,
      agencies,
    },
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initial = (() => {
    if (typeof window === "undefined") return { session: defaultSession(), token: "" };
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { session: defaultSession(), token: "" };
      return normalizeSession(JSON.parse(raw) as unknown);
    } catch {
      return { session: defaultSession(), token: "" };
    }
  })();

  const [session, setSession] = useState<AuthSession>(initial.session);
  const [token, setToken] = useState<string>(initial.token);
  const [ready] = useState(true);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ session, token }));
  }, [ready, session, token]);

  useEffect(() => {
    if (!token) return;
    const run = async () => {
      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setToken("");
          setSession(defaultSession());
          return;
        }
        const data = (await res.json()) as {
          id?: string;
          email?: string;
          role?: "super_admin" | "medical" | "fire" | "police";
          agencies?: Array<"medical" | "fire" | "police">;
        };
        if (!data.role) {
          setToken("");
          setSession(defaultSession());
          return;
        }
        setSession({
          authenticated: true,
          userId: data.id ?? "",
          email: data.email ?? "",
          role: data.role,
          agencies: data.agencies ?? [],
        });
      } catch {
        setToken("");
        setSession(defaultSession());
      }
    };
    void run();
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      ready,
      token,
      login: async (email, password) => {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = (await res.json()) as {
          token?: string;
          user?: {
            id?: string;
            email?: string;
            role?: "super_admin" | "medical" | "fire" | "police";
            agencies?: Array<"medical" | "fire" | "police">;
          };
          error?: string;
        };
        if (!res.ok || !data.token || !data.user?.role) {
          return { ok: false, error: data.error ?? "Login failed" };
        }
        setToken(data.token);
        setSession({
          authenticated: true,
          userId: data.user.id ?? "super-admin",
          email: data.user.email ?? "",
          role: data.user.role,
          agencies: data.user.agencies ?? ["medical", "fire", "police"],
        });
        return { ok: true };
      },
      logout: () => {
        setToken("");
        setSession(defaultSession());
      },
      can: (permission) => can(session, permission),
      authHeader: token
        ? { Authorization: `Bearer ${token}` }
        : ({} as Record<string, string>),
    }),
    [ready, session, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
