// P2-8: Pub/Sub fan-out for ingested beacon records. Publishers (the ingest
// controller) call `publishIngest(record)` after a successful non-dedup write;
// a Cloud Run worker subscribed to `beacon-ingest` performs triage/BigQuery/etc.
import { PubSub } from "@google-cloud/pubsub";
import { config } from "../../lib/config";
import type { DeviceData } from "../data/data.schema";

let client: PubSub | null = null;

function getClient(): PubSub {
  if (!client) {
    client = new PubSub(
      config.googleCloudProjectId
        ? { projectId: config.googleCloudProjectId }
        : {},
    );
  }
  return client;
}

/**
 * Publish a device record to the ingest topic. Fire-and-forget: any error is
 * swallowed (console.warn) so Pub/Sub outages never block HTTP ingest.
 */
export async function publishIngest(record: DeviceData): Promise<void> {
  if (!config.pubsubEnabled) return;
  try {
    const topic = getClient().topic(config.pubsubTopicIngest);
    const payload = {
      id: record.id,
      macAddress: record.macAddress,
      agency: record.agency ?? null,
      time: record.time,
      receivedAt: record.receivedAt,
      gps: record.gps ?? null,
      messageLen: record.message.length,
    };
    await topic.publishMessage({
      data: Buffer.from(JSON.stringify(payload)),
      attributes: {
        id: record.id,
        macAddress: record.macAddress,
        agency: record.agency ?? "",
      },
    });
  } catch (err) {
    console.warn(
      "[pubsub] publishIngest failed:",
      err instanceof Error ? err.message : err,
    );
  }
}
