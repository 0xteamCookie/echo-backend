import { getMessaging } from "firebase-admin/messaging";
import type { MulticastMessage } from "firebase-admin/messaging";
import { FieldValue, getFirestoreDb } from "../../lib/firebase";
import { config } from "../../lib/config";
import type { DeviceData } from "../data/data.schema";
import { categoriesFromTriageMeta, type TriageCategory } from "../triage/triage.schema";

/** Firestore collection storing per-rescuer FCM registrations. */
const RESCUER_TOKENS_COLLECTION = "rescuer_tokens";

export type RescuerTokenDoc = {
  fcmToken: string;
  agency?: "medical" | "fire" | "police";
  updatedAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
};

export type IncidentAlertPayload = {
  messageId: string;
  severity: number;
  summary: string;
  categories: string[];
  gps: { lat: number; lon: number } | null;
};

function isTruthyString(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

/**
 * Register (or refresh) a rescuer's FCM token. Doc id = rescuerId. The agency
 * column lets us multicast by agency without a fan-out query for tokens.
 */
export async function upsertRescuerToken(
  rescuerId: string,
  fcmToken: string,
  agency?: "medical" | "fire" | "police",
): Promise<void> {
  const db = getFirestoreDb();
  const doc: Record<string, unknown> = {
    fcmToken,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (agency) doc.agency = agency;
  await db.collection(RESCUER_TOKENS_COLLECTION).doc(rescuerId).set(doc, { merge: true });
}

/** Send a data+notification message to a single rescuer by id. */
export async function sendToRescuer(
  rescuerId: string,
  payload: IncidentAlertPayload,
): Promise<{ sent: boolean; reason?: string }> {
  if (!config.fcmEnabled) return { sent: false, reason: "fcm_disabled" };
  const db = getFirestoreDb();
  const snap = await db.collection(RESCUER_TOKENS_COLLECTION).doc(rescuerId).get();
  if (!snap.exists) return { sent: false, reason: "no_token_registered" };
  const data = snap.data() ?? {};
  const token = isTruthyString(data.fcmToken) ? data.fcmToken : "";
  if (!token) return { sent: false, reason: "empty_token" };
  await getMessaging().send({
    token,
    data: serializePayload(payload),
    notification: buildNotification(payload),
  });
  return { sent: true };
}

/**
 * Multicast alert to every rescuer registered under `agency`. Returns count
 * of successful sends and any invalid tokens (for future pruning).
 */
export async function sendToAgency(
  agency: "medical" | "fire" | "police",
  payload: IncidentAlertPayload,
): Promise<{ successCount: number; failureCount: number; invalidTokens: string[] }> {
  if (!config.fcmEnabled) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }
  const db = getFirestoreDb();
  const snap = await db
    .collection(RESCUER_TOKENS_COLLECTION)
    .where("agency", "==", agency)
    .get();

  const tokens: string[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    if (isTruthyString(data.fcmToken)) tokens.push(data.fcmToken);
  }
  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  const message: MulticastMessage = {
    tokens,
    data: serializePayload(payload),
    notification: buildNotification(payload),
  };
  const result = await getMessaging().sendEachForMulticast(message);
  const invalidTokens: string[] = [];
  result.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error?.code ?? "";
      if (
        code === "messaging/invalid-registration-token" ||
        code === "messaging/registration-token-not-registered"
      ) {
        const bad = tokens[i];
        if (bad) invalidTokens.push(bad);
      }
    }
  });
  return {
    successCount: result.successCount,
    failureCount: result.failureCount,
    invalidTokens,
  };
}

/**
 * After triage, notify the appropriate agency. The target agency is derived
 * from the first non-broadcast/unknown triage category, defaulting to
 * `medical` if nothing maps (matches legacy routing).
 */
export async function sendIncidentAlert(record: DeviceData): Promise<void> {
  if (!config.fcmEnabled) return;
  const triage = record.meta?.triage;
  if (!triage || typeof triage !== "object") return;
  const severity = (triage as { severity?: unknown }).severity;
  const sev = typeof severity === "number" ? severity : 0;
  if (sev < 3) return;

  const categories = categoriesFromTriageMeta(triage);
  const agency = pickAgencyFromCategories(categories);
  if (!agency) return;

  const summary = String((triage as { summary?: unknown }).summary ?? "").trim();
  const payload: IncidentAlertPayload = {
    messageId: record.id,
    severity: sev,
    summary: summary || "(no summary)",
    categories,
    gps: record.gps ? { lat: record.gps.lat, lon: record.gps.lon } : null,
  };
  await sendToAgency(agency, payload);
}

function pickAgencyFromCategories(
  categories: TriageCategory[],
): "medical" | "fire" | "police" | null {
  for (const c of categories) {
    if (c === "medical" || c === "fire" || c === "police") return c;
    if (c === "rescue") return "fire";
  }
  return null;
}

/** FCM `data` payloads must be string-keyed strings. */
function serializePayload(payload: IncidentAlertPayload): Record<string, string> {
  return {
    messageId: payload.messageId,
    severity: String(payload.severity),
    summary: payload.summary,
    categories: payload.categories.join(","),
    gps: payload.gps ? `${payload.gps.lat},${payload.gps.lon}` : "",
  };
}

function buildNotification(payload: IncidentAlertPayload): {
  title: string;
  body: string;
} {
  const head = `SEV ${payload.severity} \u2014 ${payload.categories.join(", ")}`;
  const body = payload.summary.length > 180 ? `${payload.summary.slice(0, 177)}...` : payload.summary;
  return { title: head, body };
}
