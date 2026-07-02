import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type ServiceAccount,
} from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

let db: FirebaseFirestore.Firestore | null = null;
let adminAuth: Auth | null = null;

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
export function ensureFirebaseApp(): void {
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

/**
 * Client options for the standalone `@google-cloud/*` libraries (BigQuery,
 * Pub/Sub, Cloud Translation).
 *
 * Those libraries authenticate via Application Default Credentials (ADC) and do
 * NOT see the Firebase Admin credential built from `FIREBASE_SERVICE_ACCOUNT_JSON`.
 * That split is a foot-gun: an env that sets only the SA JSON (no ADC) makes
 * Firestore/Auth work while BigQuery/Pub/Sub/Translation silently no-op.
 *
 * To make ONE credential drive every Google service, we parse the SA JSON once
 * and hand it to those clients as explicit `credentials`. When the SA JSON is
 * absent (e.g. Cloud Run with a roled runtime SA), we fall back to projectId-only,
 * i.e. pure ADC — the previous behaviour.
 */
type GcpClientOptions = {
  projectId?: string;
  credentials?: { client_email: string; private_key: string };
};

let gcpClientOptions: GcpClientOptions | null = null;

export function getGcpClientOptions(): GcpClientOptions {
  if (gcpClientOptions) return gcpClientOptions;

  const projectId = resolveProjectId();
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    try {
      const sa = JSON.parse(json) as {
        client_email?: string;
        private_key?: string;
        clientEmail?: string;
        privateKey?: string;
      };
      const clientEmail = sa.client_email ?? sa.clientEmail;
      const privateKey = sa.private_key ?? sa.privateKey;
      if (clientEmail && privateKey) {
        gcpClientOptions = {
          projectId,
          credentials: { client_email: clientEmail, private_key: privateKey },
        };
        return gcpClientOptions;
      }
    } catch {
      // Malformed JSON — fall through to ADC (projectId only).
    }
  }

  gcpClientOptions = projectId ? { projectId } : {};
  return gcpClientOptions;
}

/**
 * Firebase Admin Auth, used to verify Firebase ID tokens sent by the admin UI
 * when it is running in Firebase-Auth mode (`NEXT_PUBLIC_FIREBASE_*` set).
 */
export function getAdminAuth(): Auth {
  ensureFirebaseApp();
  if (!adminAuth) {
    adminAuth = getAuth();
  }
  return adminAuth;
}

export { FieldValue };
