import { getFirestoreDb } from "../../lib/firebase";
import type { AccountProfile, UpdateAccountBody } from "./account.schema";

const COLLECTION = "users";

export const accountService = {
  async upsertProfile(userId: string, patch: UpdateAccountBody): Promise<AccountProfile> {
    const db = getFirestoreDb();
    const ref = db.collection(COLLECTION).doc(userId);
    const fields: Record<string, unknown> = {};
    if (patch.email !== undefined) fields.email = patch.email;
    if (patch.device !== undefined) fields.device = patch.device;
    if (patch.location !== undefined) fields.location = patch.location;
    if (Object.keys(fields).length > 0) {
      await ref.set(fields, { merge: true });
    }
    return accountService.getProfile(userId);
  },

  async getProfile(userId: string): Promise<AccountProfile> {
    const db = getFirestoreDb();
    const snap = await db.collection(COLLECTION).doc(userId).get();
    if (!snap.exists) {
      return { id: userId, email: "demo@example.com" };
    }

    const data = snap.data() ?? {};
    const profile: AccountProfile = { id: userId };

    if (typeof data.email === "string") profile.email = data.email;
    if (data.device && typeof data.device === "object" && !Array.isArray(data.device)) {
      profile.device = data.device as Record<string, unknown>;
    }
    if (data.location && typeof data.location === "object" && !Array.isArray(data.location)) {
      profile.location = data.location as Record<string, unknown>;
    }

    return profile;
  },
};
