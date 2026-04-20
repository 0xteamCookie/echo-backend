import { Router } from "express";
import { requirePermission } from "../../middleware/authz";
import { authController } from "./auth.controller";

export const authRouter = Router();

authRouter.post("/login", authController.login);
authRouter.get("/me", requirePermission("data:read"), authController.me);
