import { Router } from "express";
import { requireIngestAuth, requirePermission } from "../../middleware/authz";
import { requireAppCheck } from "../../middleware/app-check";
import { dataController } from "./data.controller";

export const dataRouter = Router();

// P0-8: POST /api/data now requires either a dashboard JWT with `data:write`
// or the shared mobile ingest bearer token (BEACON_INGEST_TOKEN).
// P2-4: Mobile ingest is additionally gated by Firebase App Check
// (`X-Firebase-AppCheck` header). App Check runs before auth so forged
// tokens are rejected without ever reaching bearer comparison.
dataRouter.post("/", requireAppCheck, requireIngestAuth, dataController.create);
// P2-12: batch ingest for relayers draining a queue after an outage.
dataRouter.post("/batch", requireAppCheck, requireIngestAuth, dataController.createBatch);
dataRouter.get("/heatmap", requirePermission("data:read"), dataController.heatmap);
dataRouter.get("/", requirePermission("data:read"), dataController.list);
// Admin UI incident drawer: mark a beacon record as acknowledged / resolved.
dataRouter.post("/:id/status", requirePermission("data:write"), dataController.updateStatus);

