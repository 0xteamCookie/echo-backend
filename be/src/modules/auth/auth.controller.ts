import type { RequestHandler } from "express";

export const authController = {
  me: ((req, res) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthenticated" });
      return;
    }
    res.json({
      id: req.user.id,
      email: req.user.email ?? "",
      role: req.user.role,
      agencies: req.user.agencies,
    });
  }) satisfies RequestHandler,
};
