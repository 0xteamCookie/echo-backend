"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { can } from "./permissions";
import { defaultSession, type Agency, type AuthSession, type Permission, type Role } from "./types";
import { getAuthClient, hasFirebaseConfig } from "../firebase-client";
import { apiUrl } from "../api";

const STORAGE_KEY = "echo-admin-session";

type AuthContextValue = {
  session: AuthSession;
  ready: boolean;
  token: string;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  can: (permission: Permission) => boolean;
  authHeader: Record<string, string>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const ROLES: readonly Role[] = ["super_admin", "medical", "fire", "police"] as const;
const AGENCIES: readonly Agency[] = ["medical", "fire", "police"] as const;

function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}
function isAgency(v: unknown): v is Agency {
  return typeof v === "string" && (AGENCIES as readonly string[]).includes(v);
}

function normalizeLegacySession(input: unknown): { session: AuthSession; token: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { session: defaultSession(), token: "" };
  }
  const raw = input as { token?: unknown; session?: Partial<AuthSession> };
  const token = typeof raw.token === "string" ? raw.token : "";
  const sessionRaw = raw.session ?? {};
  const role: Role = isRole(sessionRaw.role) ? sessionRaw.role : "medical";
  const agencies: Agency[] = Array.isArray(sessionRaw.agencies)
    ? sessionRaw.agencies.filter(isAgency)
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

/** Best-effort decode of the payload portion of a JWT. Returns empty object on failure. */
function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return {};
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = atob(padded);
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function sessionFromClaims(user: User, token: string): AuthSession {
  const claims = decodeJwtPayload(token);
  const role: Role = isRole(claims.role) ? claims.role : "medical";
  const rawAgencies = claims.agencies;
  const agencies: Agency[] = Array.isArray(rawAgencies)
    ? rawAgencies.filter(isAgency)
    : isAgency(claims.agency)
      ? [claims.agency]
      : [];
  return {
    authenticated: true,
    userId: user.uid,
    email: user.email ?? "",
    role,
    agencies,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const firebaseEnabled = hasFirebaseConfig();

  // Legacy bootstrap from localStorage only if Firebase is NOT configured.
  const initial = (() => {
    if (typeof window === "undefined" || firebaseEnabled) {
      return { session: defaultSession(), token: "" };
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { session: defaultSession(), token: "" };
      return normalizeLegacySession(JSON.parse(raw) as unknown);
    } catch {
      return { session: defaultSession(), token: "" };
    }
  })();

  const [session, setSession] = useState<AuthSession>(initial.session);
  const [token, setToken] = useState<string>(initial.token);
  // When firebase is enabled we aren't "ready" until the first onIdTokenChanged fires.
  const [ready, setReady] = useState<boolean>(!firebaseEnabled);
  const meFetchIdRef = useRef(0);

  // ─── Firebase: subscribe to ID token changes ──────────────────────────────
  useEffect(() => {
    if (!firebaseEnabled) return;
    const auth = getAuthClient();
    if (!auth) {
      setReady(true);
      return;
    }

    const unsub = onIdTokenChanged(auth, async (user) => {
      if (!user) {
        setToken("");
        setSession(defaultSession());
        setReady(true);
        return;
      }
      let idToken = "";
      try {
        idToken = await user.getIdToken();
      } catch {
        idToken = "";
      }
      setToken(idToken);

      // Resolve role/agencies: prefer /api/auth/me, fall back to custom claims.
      const reqId = ++meFetchIdRef.current;
      let resolved: AuthSession | null = null;
      try {
        const res = await fetch(apiUrl("/api/auth/me"), {
          headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
        });
        if (res.ok) {
          const data = (await res.json()) as {
            id?: string;
            email?: string;
            role?: unknown;
            agencies?: unknown;
          };
          if (isRole(data.role)) {
            const agencies: Agency[] = Array.isArray(data.agencies)
              ? data.agencies.filter(isAgency)
              : [];
            resolved = {
              authenticated: true,
              userId: typeof data.id === "string" && data.id ? data.id : user.uid,
              email: typeof data.email === "string" ? data.email : user.email ?? "",
              role: data.role,
              agencies,
            };
          }
        }
      } catch {
        // fall through to claim-based session
      }
      if (meFetchIdRef.current !== reqId) return; // stale — another change already fired
      setSession(resolved ?? sessionFromClaims(user, idToken));
      setReady(true);
    });

    return () => unsub();
  }, [firebaseEnabled]);

  // ─── Legacy: persist localStorage session (only when firebase is off) ─────
  useEffect(() => {
    if (firebaseEnabled) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ session, token }));
  }, [firebaseEnabled, session, token]);

  // ─── Legacy: hydrate session from stored token via /api/auth/me ───────────
  useEffect(() => {
    if (firebaseEnabled) return;
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/auth/me"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (!res.ok) {
          setToken("");
          setSession(defaultSession());
          return;
        }
        const data = (await res.json()) as {
          id?: string;
          email?: string;
          role?: unknown;
          agencies?: unknown;
        };
        if (!isRole(data.role)) {
          setToken("");
          setSession(defaultSession());
          return;
        }
        const agencies: Agency[] = Array.isArray(data.agencies)
          ? data.agencies.filter(isAgency)
          : [];
        setSession({
          authenticated: true,
          userId: typeof data.id === "string" ? data.id : "",
          email: typeof data.email === "string" ? data.email : "",
          role: data.role,
          agencies,
        });
      } catch {
        if (!cancelled) {
          setToken("");
          setSession(defaultSession());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [firebaseEnabled, token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      ready,
      token,
      login: async (email, password) => {
        if (firebaseEnabled) {
          const auth = getAuthClient();
          if (!auth) return { ok: false, error: "Firebase Auth not initialized" };
          try {
            await signInWithEmailAndPassword(auth, email, password);
            // onIdTokenChanged will populate session/token.
            return { ok: true };
          } catch (e) {
            const msg =
              e instanceof Error
                ? e.message.replace(/^Firebase:\s*/, "")
                : "Login failed";
            return { ok: false, error: msg };
          }
        }

        // ── Legacy custom-JWT login ───────────────────────────────────────
        const res = await fetch(apiUrl("/api/auth/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = (await res.json()) as {
          token?: string;
          user?: {
            id?: string;
            email?: string;
            role?: unknown;
            agencies?: unknown;
          };
          error?: string;
        };
        if (!res.ok || !data.token || !data.user || !isRole(data.user.role)) {
          return { ok: false, error: data.error ?? "Login failed" };
        }
        const agencies: Agency[] = Array.isArray(data.user.agencies)
          ? data.user.agencies.filter(isAgency)
          : ["medical", "fire", "police"];
        setToken(data.token);
        setSession({
          authenticated: true,
          userId: typeof data.user.id === "string" ? data.user.id : "super-admin",
          email: typeof data.user.email === "string" ? data.user.email : "",
          role: data.user.role,
          agencies,
        });
        return { ok: true };
      },
      logout: async () => {
        if (firebaseEnabled) {
          const auth = getAuthClient();
          if (auth) {
            try {
              await signOut(auth);
            } catch {
              // ignore — state is cleared below regardless
            }
          }
        }
        setToken("");
        setSession(defaultSession());
        if (!firebaseEnabled && typeof window !== "undefined") {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      },
      can: (permission) => can(session, permission),
      authHeader: token
        ? { Authorization: `Bearer ${token}` }
        : ({} as Record<string, string>),
    }),
    [firebaseEnabled, ready, session, token],
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
