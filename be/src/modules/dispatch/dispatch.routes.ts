import { Router } from "express";
import { requirePermission } from "../../middleware/authz";
import { dispatchController } from "./dispatch.controller";

export const dispatchRouter = Router();

dispatchRouter.get(
  "/recommendations",
  requirePermission("data:read"),
  dispatchController.recommendations,
);
