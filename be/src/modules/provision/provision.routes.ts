import { Router } from "express";
import { requirePermission } from "../../middleware/authz";
import { provisionController } from "./provision.controller";

export const provisionRouter = Router();

// Auth: a dashboard JWT whose `permissions` claim includes `provision:issue`
// (granted to super_admin role only). The admin UI calls this endpoint
// directly — no BFF proxy and no shared `x-admin-api-key` secret. The JWT
// permission check is the single gate.
provisionRouter.post(
  "/token",
  requirePermission("provision:issue"),
  provisionController.issueToken,
);
