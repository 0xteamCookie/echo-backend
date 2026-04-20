import { Router } from "express";
import { requireAdminApiKey } from "../../middleware/admin-api-key";
import { requirePermission } from "../../middleware/authz";
import { provisionController } from "./provision.controller";

export const provisionRouter = Router();

provisionRouter.post(
  "/token",
  requireAdminApiKey,
  requirePermission("provision:issue"),
  provisionController.issueToken,
);
