/**
 * One-off script: grants `super_admin` role + all agencies to a Firebase Auth
 * user, both as custom claims and as a `users/{uid}` Firestore doc.
 *
 * Usage (from `echo-backend/be`):
 *   npx tsx scripts/set-super-admin.ts admin@echo.com
 *
 * After running, the target user must sign out and sign back in for new
 * custom claims to appear in their ID token.
 */
import "dotenv/config";
import { getAdminAuth, getFirestoreDb } from "../src/lib/firebase";

async function main(): Promise<void> {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: tsx scripts/set-super-admin.ts <email>");
    process.exit(1);
  }

  const auth = getAdminAuth();
  const user = await auth.getUserByEmail(email);
  console.log(`Found user: ${user.uid} (${user.email})`);

  const claims = {
    role: "super_admin",
    agencies: ["medical", "fire", "police"],
  };

  await auth.setCustomUserClaims(user.uid, claims);
  console.log("✓ Custom claims set:", claims);

  await getFirestoreDb()
    .collection("users")
    .doc(user.uid)
    .set(
      {
        email: user.email,
        role: "super_admin",
        agencies: ["medical", "fire", "police"],
      },
      { merge: true },
    );
  console.log(`✓ Firestore users/${user.uid} written`);

  console.log("\nDone. Have the user sign out and sign back in.");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
