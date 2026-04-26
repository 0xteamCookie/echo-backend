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
import { getAuthClient } from "../firebase-client";
import { apiUrl } from "../api";

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
  const [session, setSession] = useState<AuthSession>(defaultSession());
  const [token, setToken] = useState<string>("");
  const [ready, setReady] = useState<boolean>(false);
  const meFetchIdRef = useRef(0);

  useEffect(() => {
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
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      ready,
      token,
      login: async (email, password) => {
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
      },
      logout: async () => {
        const auth = getAuthClient();
        if (auth) {
          try {
            await signOut(auth);
          } catch {
            // ignore — state is cleared below regardless
          }
        }
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
