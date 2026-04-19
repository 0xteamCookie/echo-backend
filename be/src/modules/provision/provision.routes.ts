import { Router } from "express";
import { requireAdminApiKey } from "../../middleware/admin-api-key";
import { provisionController } from "./provision.controller";

export const provisionRouter = Router();

provisionRouter.post("/token", requireAdminApiKey, provisionController.issueToken);
