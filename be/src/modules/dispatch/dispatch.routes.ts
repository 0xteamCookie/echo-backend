import { Router } from "express";
import { requirePermission } from "../../middleware/authz";
import { dispatchController } from "./dispatch.controller";

export const dispatchRouter = Router();

dispatchRouter.get(
  "/recommendations",
  requirePermission("data:read"),
  dispatchController.recommendations,
);

// List rescuers for the incident drawer's "assign rescuer" dropdown.
dispatchRouter.get(
  "/rescuers",
  requirePermission("data:read"),
  dispatchController.listRescuers,
);

// Persist an admin's decision to assign a rescuer to an incident.
dispatchRouter.post(
  "/assign",
  requirePermission("data:write"),
  dispatchController.assign,
);
