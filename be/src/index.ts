import "dotenv/config";
import { app } from "./app";
import { config } from "./lib/config";
import { log } from "./lib/logger";
import { getAdminAuth, getFirestoreDb } from "./lib/firebase";

async function ensureSuperAdmin(): Promise<void> {
  try {
    const existing = await getAdminAuth().getUserByEmail(config.superAdminEmail);
    const ref = getFirestoreDb().collection("users").doc(existing.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        email: config.superAdminEmail,
        role: "super_admin",
        agencies: ["medical", "fire", "police"],
      });
      log.info("server.super_admin_profile_created", { uid: existing.uid });
    }
  } catch (err: unknown) {
    if ((err as { code?: string }).code !== "auth/user-not-found") {
      log.warn("server.super_admin_check_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }
    try {
      const user = await getAdminAuth().createUser({
        email: config.superAdminEmail,
        password: config.superAdminPassword,
        emailVerified: true,
      });
      await getFirestoreDb().collection("users").doc(user.uid).set({
        email: config.superAdminEmail,
        role: "super_admin",
        agencies: ["medical", "fire", "police"],
      });
      log.info("server.super_admin_created", { email: config.superAdminEmail, uid: user.uid });
    } catch (createErr) {
      log.warn("server.super_admin_create_failed", {
        error: createErr instanceof Error ? createErr.message : String(createErr),
      });
    }
  }
}

app.listen(config.port, () => {
  log.info("server.listen", { port: config.port });
  void ensureSuperAdmin();
});
