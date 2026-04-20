import type { RequestHandler } from "express";
import { getAllowedAgencies } from "../../middleware/authz";
import { dispatchService } from "./dispatch.service";

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
};
