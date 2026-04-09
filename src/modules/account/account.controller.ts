import type { RequestHandler } from "express";
import { accountService } from "./account.service";

export const accountController = {
  me: ((_req, res) => {
    res.json(accountService.getProfile());
  }) satisfies RequestHandler,
};
