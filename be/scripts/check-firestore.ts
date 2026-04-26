import "dotenv/config";
import { getFirestoreDb } from "../src/lib/firebase";

async function main(): Promise<void> {
  const db = getFirestoreDb();
  const snap = await db
    .collection("device_entries")
    .orderBy("receivedAt", "desc")
    .limit(5)
    .get();
  console.log("Total docs (limit 5):", snap.size);
  snap.forEach((d) => {
    const data = d.data();
    console.log("---", d.id);
    console.log({
      macAddress: data.macAddress,
      agency: data.agency,
      message: data.message?.toString().slice(0, 80),
      time: data.time,
      receivedAt:
        data.receivedAt?.toDate?.()?.toISOString?.() ?? data.receivedAt,
      gps: data.gps,
      isSos: data.meta?.isSos,
      hasMeta: Boolean(data.meta),
      triageSeverity: data.meta?.triage?.severity,
    });
  });
  if (snap.size === 0) {
    console.log("No documents in device_entries collection.");
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
