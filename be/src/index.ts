import "dotenv/config";
import { app } from "./app";
import { config, validateGoogleConfig } from "./lib/config";
import { log } from "./lib/logger";

const server = app.listen(config.port, () => {
  log.info("server.listen", { port: config.port });
  // Loud boot-time warnings for Google Cloud misconfiguration (silent-failure traps).
  validateGoogleConfig();
});

// Graceful shutdown for Cloud Run: on SIGTERM/SIGINT, stop accepting new
// connections and drain in-flight requests before exiting.
function shutdown(signal: string): void {
  log.info("server.shutdown", { signal });
  server.close((err) => {
    if (err) {
      log.warn("server.shutdown_error", {
        error: err instanceof Error ? err.message : String(err),
      });
      process.exit(1);
    }
    process.exit(0);
  });
  // Hard cap: don't hang forever if connections refuse to close.
  setTimeout(() => process.exit(0), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
