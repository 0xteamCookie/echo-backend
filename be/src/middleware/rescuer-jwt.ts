import type { RequestHandler } from "express";
import {
  verifyRescuerJwt,
  type VerifiedRescuerPayload,
} from "../lib/jwt-provisioning";

declare global {
  // eslint-disable-next-line no-var
  namespace Express {
    interface Request {
      /** Set by `requireRescuerJwt` after a valid Bearer token. */
      rescuer?: VerifiedRescuerPayload;
    }
  }
}

/**
 * Requires `Authorization: Bearer <jwt>` and verifies with the same rules as rescuer clients.
 * Use on routes that should only accept provisioned rescuer tokens.
 */
export const requireRescuerJwt: RequestHandler = async (req, res, next) => {
  const auth = String(req.header("authorization") ?? "").trim();
  const m = /^Bearer\s+(\S+)/i.exec(auth);
  if (!m?.[1]) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }
  try {
    req.rescuer = await verifyRescuerJwt(m[1]);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};
