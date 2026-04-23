// P2-8: Pub/Sub push endpoint for the Cloud Run triage worker. The worker is
// subscribed to `beacon-ingest`; Pub/Sub POSTs the envelope here with a shared
// secret header. Verified requests trigger triage by record id.
import crypto from "node:crypto";
import type { RequestHandler } from "express";
import { Router } from "express";
import { config } from "../../lib/config";
import { log } from "../../lib/logger";
import { triageAfterIngestSafe } from "../triage/triage-agent.service";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function constantTimeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

const triagePush: RequestHandler = async (req, res) => {
  const expected = config.pubsubPushToken;
  if (!expected) {
    res.status(503).json({ error: "pubsub push not configured" });
    return;
  }
  // GCP Pub/Sub push can't set custom headers, so accept the token from either
  // a URL query param (?token=...) or the X-Pubsub-Token header (used in tests).
  const tokenRaw =
    (typeof req.query.token === "string" ? req.query.token : "") ||
    (req.header("X-Pubsub-Token") ?? "");
  if (!constantTimeEq(tokenRaw, expected)) {
    res.status(401).json({ error: "invalid pubsub token" });
    return;
  }

  const body = req.body;
  if (!isRecord(body) || !isRecord(body.message)) {
    res.status(400).json({ error: "invalid Pub/Sub envelope" });
    return;
  }

  const msg = body.message;
  let recordId = "";
  const attributes = msg.attributes;
  if (isRecord(attributes) && typeof attributes.id === "string") {
    recordId = attributes.id;
  }
  if (!recordId && typeof msg.data === "string" && msg.data.trim() !== "") {
    try {
      const decoded = Buffer.from(msg.data, "base64").toString("utf8");
      const parsed = JSON.parse(decoded) as unknown;
      if (isRecord(parsed) && typeof parsed.id === "string") {
        recordId = parsed.id;
      }
    } catch {
      // fall through; recordId remains empty
    }
  }

  if (!recordId) {
    // Ack the message (204) so Pub/Sub doesn't keep redelivering a malformed payload.
    res.status(204).end();
    return;
  }

  try {
    await triageAfterIngestSafe(recordId);
  } catch (err) {
    log.warn("pubsub.triage_push_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  res.status(204).end();
};

export const pubsubRouter = Router();
pubsubRouter.post("/triage-push", triagePush);
