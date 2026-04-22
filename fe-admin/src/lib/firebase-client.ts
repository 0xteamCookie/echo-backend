import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

const REQUIRED_VARS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
] as const;

/** Module-level singleton — avoids re-initializing across hot reloads in dev. */
let _db: Firestore | null = null;

/**
 * Returns a client-side Firestore instance, or `null` when the required
 * NEXT_PUBLIC_FIREBASE_* environment variables are not set.
 * Callers that receive `null` should fall back to existing REST polling.
 */
export function getFirestoreClient(): Firestore | null {
  // SSR guard – Firestore client SDK must only run in the browser.
  if (typeof window === "undefined") return null;

  if (_db) return _db;

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (
    REQUIRED_VARS.some((k) => !process.env[k]) ||
    !apiKey ||
    !authDomain ||
    !projectId
  ) {
    return null;
  }

  const app: FirebaseApp =
    getApps()[0] ??
    initializeApp({
      apiKey,
      authDomain,
      projectId,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
      messagingSenderId:
        process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
    });

  _db = getFirestore(app);
  return _db;
}
