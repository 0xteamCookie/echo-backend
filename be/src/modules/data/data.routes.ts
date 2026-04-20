import { Router } from "express";
import { requirePermission } from "../../middleware/authz";
import { dataController } from "./data.controller";

export const dataRouter = Router();

dataRouter.post("/", dataController.create);
dataRouter.get("/heatmap", requirePermission("data:read"), dataController.heatmap);
dataRouter.get("/", requirePermission("data:read"), dataController.list);

