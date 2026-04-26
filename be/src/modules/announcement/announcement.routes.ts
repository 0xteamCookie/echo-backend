import { Router } from "express";
import { requirePermission } from "../../middleware/authz";
import { announcementController } from "./announcement.controller";

export const announcementRouter = Router();

announcementRouter.get("/", announcementController.listNearby);
announcementRouter.post(
  "/",
  requirePermission("data:write"),
  announcementController.create,
);
