import type { ErrorRequestHandler } from "express";
import { config } from "../lib/config";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = typeof err.status === "number" ? err.status : 500;
  const message =
    status === 500 && config.nodeEnv === "production"
      ? "Internal Server Error"
      : err.message || "Internal Server Error";

  if (status === 500) {
    console.error(err);
  }

  res.status(status).json({ error: message });
};
