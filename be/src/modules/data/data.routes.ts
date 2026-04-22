import { Router } from "express";
import { requireIngestAuth, requirePermission } from "../../middleware/authz";
import { dataController } from "./data.controller";

export const dataRouter = Router();

// P0-8: POST /api/data now requires either a dashboard JWT with `data:write`
// or the shared mobile ingest bearer token (BEACON_INGEST_TOKEN).
dataRouter.post("/", requireIngestAuth, dataController.create);
dataRouter.get("/heatmap", requirePermission("data:read"), dataController.heatmap);
dataRouter.get("/", requirePermission("data:read"), dataController.list);

