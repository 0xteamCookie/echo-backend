"use client";

import { getAuthClient } from "./firebase-client";

/**
 * Lazily obtain a fresh Firebase ID token. Returns empty string when no user
 * is signed in or Firebase is not configured (callers should then fall back
 * to the legacy header path). We avoid caching manually — the Firebase SDK
 * already caches and auto-refreshes tokens internally.
 */
export async function getIdToken(forceRefresh = false): Promise<string> {
  const auth = getAuthClient();
  const user = auth?.currentUser ?? null;
  if (!user) return "";
  try {
    return await user.getIdToken(forceRefresh);
  } catch {
    return "";
  }
}

/**
 * Returns the Authorization header dict using the current Firebase ID token,
 * or an empty object when no token is available.
 */
export async function getAuthHeader(): Promise<Record<string, string>> {
  const token = await getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Thin `fetch` wrapper that injects `Authorization: Bearer <IdToken>` using a
 * freshly resolved Firebase ID token. If `init.headers` already has an
 * `Authorization` header (e.g. legacy path), it is preserved.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("Authorization")) {
    const token = await getIdToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}
