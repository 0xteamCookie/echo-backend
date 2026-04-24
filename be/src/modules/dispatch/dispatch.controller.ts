import type { RequestHandler } from "express";
import { getAllowedAgencies } from "../../middleware/authz";
import { config } from "../../lib/config";
import { dispatchService } from "./dispatch.service";

function parseAgency(value: unknown): "medical" | "fire" | "police" | undefined {
  return value === "medical" || value === "fire" || value === "police" ? value : undefined;
}

export const dispatchController = {
  recommendations: (async (req, res) => {
    const limitRaw =
      typeof req.query.limit === "string" && req.query.limit.trim() !== ""
        ? Number(req.query.limit)
        : undefined;
    const recommendations = await dispatchService.recommend({
      agencies: req.user?.role === "super_admin" ? undefined : getAllowedAgencies(req),
      maxIncidents: typeof limitRaw === "number" && Number.isFinite(limitRaw) ? limitRaw : undefined,
    });
    res.json(recommendations);
  }) satisfies RequestHandler,

  listRescuers: (async (req, res) => {
    const agency = parseAgency(req.query.agency);
    const onDuty = req.query.onDuty === undefined
      ? undefined
      : String(req.query.onDuty).toLowerCase() === "true";
    const allowedAgencies = req.user?.role === "super_admin"
      ? undefined
      : getAllowedAgencies(req);
    const rescuers = await dispatchService.listRescuers({
      agency,
      onDuty,
      allowedAgencies,
    });
    res.json({ rescuers });
  }) satisfies RequestHandler,

  assign: (async (req, res) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthenticated" });
      return;
    }
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
    const messageId = typeof (body as Record<string, unknown>).messageId === "string"
      ? ((body as Record<string, unknown>).messageId as string).trim()
      : "";
    const rescuerId = typeof (body as Record<string, unknown>).rescuerId === "string"
      ? ((body as Record<string, unknown>).rescuerId as string).trim()
      : "";
    if (!messageId || !rescuerId) {
      res.status(400).json({ error: "messageId and rescuerId are required" });
      return;
    }
    try {
      const out = await dispatchService.assignRescuer({
        messageId,
        rescuerId,
        assignedBy: req.user.id,
        assignedByEmail: req.user.email,
      });
      res.json(out);
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode ?? 500;
      const message = err instanceof Error ? err.message : "Assignment failed";
      res.status(status).json({ error: message });
    }
  }) satisfies RequestHandler,

  seedDummyRescuers: (async (_req, res) => {
    if (config.nodeEnv === "production") {
      res.status(403).json({ error: "Disabled in production" });
      return;
    }
    try {
      const out = await dispatchService.seedDummyRescuers();
      res.json(out);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Seeding failed";
      res.status(500).json({ error: message });
    }
  }) satisfies RequestHandler,
};
