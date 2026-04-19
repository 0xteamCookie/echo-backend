import { Router } from "express";
import { accountController } from "./account.controller";

export const accountRouter = Router();

accountRouter.get("/me", accountController.me);
accountRouter.patch("/me", accountController.updateMe);
