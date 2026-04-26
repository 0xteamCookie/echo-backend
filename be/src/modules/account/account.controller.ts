import type { RequestHandler } from "express";
import type { UpdateAccountBody } from "./account.schema";
import { accountService } from "./account.service";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export const accountController = {
  me: (async (req, res) => {
    const userId = req.user?.id ?? "demo";
    const profile = await accountService.getProfile(userId);
    if (req.user) {
      res.json({
        ...profile,
        role: req.user.role,
        agencies: req.user.agencies,
      });
      return;
    }
    res.json(profile);
  }) satisfies RequestHandler,

  updateMe: (async (req, res) => {
    const body = req.body;
    if (!isRecord(body)) {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }

    const userId = req.user?.id ?? "demo";
    const patch: UpdateAccountBody = {};

    if (body.email !== undefined) {
      if (typeof body.email !== "string") {
        res.status(400).json({ error: "email must be a string" });
        return;
      }
      patch.email = body.email;
    }
    if (body.device !== undefined) {
      if (!isRecord(body.device)) {
        res.status(400).json({ error: "device must be an object" });
        return;
      }
      patch.device = body.device;
    }
    if (body.location !== undefined) {
      if (!isRecord(body.location)) {
        res.status(400).json({ error: "location must be an object" });
        return;
      }
      patch.location = body.location;
    }

    if (Object.keys(patch).length === 0) {
      res
        .status(400)
        .json({ error: "Provide at least one of email, device, location" });
      return;
    }

    const profile = await accountService.upsertProfile(userId, patch);
    res.json(profile);
  }) satisfies RequestHandler,
};
