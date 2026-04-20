import type { RequestHandler } from "express";
import { config } from "../../lib/config";
import { signDashboardJwt } from "../../lib/jwt-dashboard";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export const authController = {
  login: (async (req, res) => {
    const body = req.body;
    if (!isRecord(body)) {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }
    if (email !== config.superAdminEmail || password !== config.superAdminPassword) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = await signDashboardJwt({
      sub: "super-admin",
      email: config.superAdminEmail,
      role: "super_admin",
      agencies: ["medical", "fire", "police"],
    });

    res.json({
      token,
      user: {
        id: "super-admin",
        email: config.superAdminEmail,
        role: "super_admin",
        agencies: ["medical", "fire", "police"],
      },
    });
  }) satisfies RequestHandler,

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
