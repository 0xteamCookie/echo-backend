import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

const REQUIRED_VARS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
] as const;

/** Module-level singletons — avoid re-initializing across hot reloads in dev. */
let _db: Firestore | null = null;
let _auth: Auth | null = null;

/**
 * Returns true when the required NEXT_PUBLIC_FIREBASE_* env vars are present
 * and the code is executing in the browser. Callers should use this to decide
 * whether to take the Firebase path or a legacy/REST fallback.
 */
export function hasFirebaseConfig(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  );
}

function ensureApp(): FirebaseApp | null {
  if (typeof window === "undefined") return null;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!apiKey || !authDomain || !projectId) return null;

  return (
    getApps()[0] ??
    initializeApp({
      apiKey,
      authDomain,
      projectId,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
      messagingSenderId:
        process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
    })
  );
}

/**
 * Returns a client-side Firebase Auth instance, or `null` when the required
 * NEXT_PUBLIC_FIREBASE_* environment variables are not set. Callers that
 * receive `null` should fall back to the legacy login flow.
 */
export function getAuthClient(): Auth | null {
  if (typeof window === "undefined") return null;
  if (_auth) return _auth;
  const app = ensureApp();
  if (!app) return null;
  _auth = getAuth(app);
  return _auth;
}

/**
 * Returns a client-side Firestore instance, or `null` when the required
 * NEXT_PUBLIC_FIREBASE_* environment variables are not set.
 * Callers that receive `null` should fall back to existing REST polling.
 */
export function getFirestoreClient(): Firestore | null {
  // SSR guard – Firestore client SDK must only run in the browser.
  if (typeof window === "undefined") return null;

  if (_db) return _db;

  const app = ensureApp();
  if (!app) return null;

  _db = getFirestore(app);
  return _db;
}
