import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type ServiceAccount,
} from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

let db: FirebaseFirestore.Firestore | null = null;

function resolveProjectId(sa?: ServiceAccount): string | undefined {
  return (
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    process.env.GCLOUD_PROJECT?.trim() ||
    sa?.projectId
  );
}

/**
 * Initializes the default Firebase app once. Supports, in order:
 * - Firestore emulator (`FIRESTORE_EMULATOR_HOST`, optional `FIREBASE_PROJECT_ID`)
 * - Service account JSON in `FIREBASE_SERVICE_ACCOUNT_JSON`
 * - Application Default Credentials (`GOOGLE_APPLICATION_CREDENTIALS`, GCE, etc.)
 */
function ensureFirebaseApp(): void {
  if (getApps().length > 0) return;

  const envProjectId = resolveProjectId();

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    initializeApp({ projectId: envProjectId || "demo-echo" });
    return;
  }

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    const sa = JSON.parse(json) as ServiceAccount;
    initializeApp({
      credential: cert(sa),
      projectId: resolveProjectId(sa) || sa.projectId,
    });
    return;
  }

  initializeApp({
    credential: applicationDefault(),
    projectId: envProjectId,
  });
}

export function getFirestoreDb(): FirebaseFirestore.Firestore {
  ensureFirebaseApp();
  if (!db) {
    db = getFirestore();
  }
  return db;
}

export { FieldValue };
