// Languages the backend pre-translates announcements into (Cloud Translation).
// Must stay in sync with the backend default TRANSLATION_TARGET_LANGS
// ("en,es,fr,de,zh,hi,ar,pt,ja,ko" in be/src/lib/config.ts). The dashboard
// requests a translated body by appending ?lang=<code> to announcement fetches.
export type LanguageOption = { code: string; label: string };

export const ANNOUNCEMENT_LANGUAGES: LanguageOption[] = [
  { code: "", label: "Original" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "zh", label: "中文" },
  { code: "hi", label: "हिन्दी" },
  { code: "ar", label: "العربية" },
  { code: "pt", label: "Português" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
];
