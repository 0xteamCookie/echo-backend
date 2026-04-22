/**
 * P3-10: tiny structured logger. Emits a single JSON line per event so Cloud
 * Logging / Looker can parse them without log-based ingestion sidecars.
 *
 * Keeps `console.error` free for uncaught exception handlers where losing the
 * native stack formatting would be unhelpful.
 */

type Fields = Record<string, unknown>;
type Level = "info" | "warn" | "error";

function emit(level: Level, msg: string, fields?: Fields): void {
  const record: Record<string, unknown> = {
    level,
    msg,
    ts: new Date().toISOString(),
  };
  if (fields) {
    for (const [k, v] of Object.entries(fields)) {
      if (k === "level" || k === "msg" || k === "ts") continue;
      record[k] = v;
    }
  }
  const line = JSON.stringify(record);
  // Route warn/error to stderr so Cloud Run splits severity correctly.
  if (level === "error" || level === "warn") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const log = {
  info: (msg: string, fields?: Fields) => emit("info", msg, fields),
  warn: (msg: string, fields?: Fields) => emit("warn", msg, fields),
  error: (msg: string, fields?: Fields) => emit("error", msg, fields),
};
