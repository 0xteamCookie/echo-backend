import type { RequestHandler } from "express";
import type { IssueTokenBody } from "./provision.schema";
import { provisionService } from "./provision.service";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export const provisionController = {
  issueToken: (async (req, res) => {
    const body = req.body;
    if (!isRecord(body)) {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }

    const sub = body.sub;
    const role = body.role;
    if (typeof sub !== "string" || !sub.trim()) {
      res.status(400).json({ error: "sub is required and must be a non-empty string" });
      return;
    }
    if (typeof role !== "string" || !role.trim()) {
      res.status(400).json({ error: "role is required and must be a non-empty string" });
      return;
    }

    const patch: IssueTokenBody = { sub: sub.trim(), role: role.trim() };
    if (body.org !== undefined) {
      if (typeof body.org !== "string") {
        res.status(400).json({ error: "org must be a string" });
        return;
      }
      patch.org = body.org;
    }
    if (body.name !== undefined) {
      if (typeof body.name !== "string") {
        res.status(400).json({ error: "name must be a string" });
        return;
      }
      patch.name = body.name;
    }
    if (body.expiresInSeconds !== undefined) {
      if (typeof body.expiresInSeconds !== "number" || !Number.isFinite(body.expiresInSeconds)) {
        res.status(400).json({ error: "expiresInSeconds must be a finite number" });
        return;
      }
      patch.expiresInSeconds = body.expiresInSeconds;
    }

    try {
      const result = await provisionService.issueToken(patch);
      res.json({
        token: result.token,
        expiresInSeconds: result.expiresInSeconds,
        tokenType: "Bearer",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to issue token";
      if (message.includes("JWT_PRIVATE_KEY")) {
        res.status(503).json({ error: "JWT provisioning is not configured (missing JWT_PRIVATE_KEY)" });
        return;
      }
      throw e;
    }
  }) satisfies RequestHandler,
};
