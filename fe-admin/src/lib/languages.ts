// Languages the backend pre-translates announcements into (Cloud Translation).
// Must stay in sync with the backend default TRANSLATION_TARGET_LANGS
// ("en,hi,bn,ta,te,mr,gu,kn,ml,pa" in be/src/lib/config.ts). The dashboard
// requests a translated body by appending ?lang=<code> to announcement fetches.
// India-focused: English + Hindi + major regional languages.
export type LanguageOption = { code: string; label: string };

export const ANNOUNCEMENT_LANGUAGES: LanguageOption[] = [
  { code: "", label: "Original" },
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" }, // Hindi
  { code: "bn", label: "বাংলা" }, // Bengali
  { code: "ta", label: "தமிழ்" }, // Tamil
  { code: "te", label: "తెలుగు" }, // Telugu
  { code: "mr", label: "मराठी" }, // Marathi
  { code: "gu", label: "ગુજરાતી" }, // Gujarati
  { code: "kn", label: "ಕನ್ನಡ" }, // Kannada
  { code: "ml", label: "മലയാളം" }, // Malayalam
  { code: "pa", label: "ਪੰਜਾਬੀ" }, // Punjabi
];
