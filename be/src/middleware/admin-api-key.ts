import type { RequestHandler } from "express";
import { config } from "../lib/config";

/** Protects admin-only routes (e.g. token provisioning). */
export const requireAdminApiKey: RequestHandler = (req, res, next) => {
  if (!config.adminApiKey) {
    res.status(503).json({ error: "ADMIN_API_KEY is not configured" });
    return;
  }
  const sent = String(req.header("x-admin-api-key") ?? "").trim();
  if (sent !== config.adminApiKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
};
