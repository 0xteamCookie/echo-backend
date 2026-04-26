import { Router } from "express";
import type { RequestHandler } from "express";
import { requireRescuerJwt } from "../../middleware/rescuer-jwt";
import { upsertRescuerToken } from "./fcm.service";

export const pushRouter = Router();

/**
 * POST /api/push/register
 *
 * Rescuers call this once after app launch (and whenever their FCM token
 * rotates) to register for agency-scoped push alerts. Auth is the rescuer
 * RS256 provisioning JWT verified by `requireRescuerJwt`. The doc id is the
 * rescuer `sub` from the token so one rescuer maps to exactly one token.
 *
 * Body: `{ fcmToken: string }`
 */
const registerHandler: RequestHandler = async (req, res) => {
  const rescuer = req.rescuer;
  if (!rescuer) {
    res.status(401).json({ error: "Unauthenticated" });
    return;
  }
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }
  const fcmToken = String(
    (body as Record<string, unknown>).fcmToken ?? "",
  ).trim();
  if (!fcmToken) {
    res.status(400).json({ error: "fcmToken is required" });
    return;
  }
  // Tight length guard so a misbehaving client can't write arbitrary blobs.
  if (fcmToken.length > 4096) {
    res.status(400).json({ error: "fcmToken is too long" });
    return;
  }
  const agency =
    rescuer.agency === "medical" ||
    rescuer.agency === "fire" ||
    rescuer.agency === "police"
      ? rescuer.agency
      : undefined;
  await upsertRescuerToken(rescuer.sub, fcmToken, agency);
  res.status(204).send();
};

pushRouter.post("/register", requireRescuerJwt, registerHandler);
