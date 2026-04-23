// P2-6: Cloud Translation for announcements. Called fire-and-forget from the
// announcement service when `config.translationEnabled` is true. Returns a
// map of `{lang: translatedText}` for every successfully translated target.
import { v2 as TranslateV2 } from "@google-cloud/translate";
import { config } from "../../lib/config";
import { log } from "../../lib/logger";

let client: TranslateV2.Translate | null = null;

function getClient(): TranslateV2.Translate {
  if (!client) {
    client = new TranslateV2.Translate(
      config.googleCloudProjectId
        ? { projectId: config.googleCloudProjectId }
        : {},
    );
  }
  return client;
}

/**
 * Translate `source` into every language in `config.translationTargetLangs`.
 * Never throws: per-language failures are logged and skipped.
 */
export async function translateForAll(
  source: string,
): Promise<Record<string, string>> {
  if (!config.translationEnabled) return {};
  const text = source.trim();
  if (text === "") return {};

  const targets = config.translationTargetLangs;
  const out: Record<string, string> = {};
  const c = getClient();

  const results = await Promise.allSettled(
    targets.map(async (lang) => {
      const [translated] = await c.translate(text, lang);
      const value = Array.isArray(translated) ? translated[0] : translated;
      return { lang, value };
    }),
  );

  for (const r of results) {
    if (r.status === "fulfilled" && typeof r.value.value === "string") {
      out[r.value.lang] = r.value.value;
    } else if (r.status === "rejected") {
      log.warn("translation.target_failed", {
        reason: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  }

  return out;
}
