// Edition registry — the app's ONLY country list (HANDOFF §6.2).
// Country (availability scope) and locale (content/UI language) are separate axes;
// availability may use any country while content falls back to English until the
// web locale projection is live for that language.
// Adding a country = one entry here + one dict file. Anything more is a design smell.

export type UILocale = "en" | "ko" | "es" | "ja";

export type Edition = {
  code: string;
  country: string; // ISO 3166-1 alpha-2, drives film_provider_index queries
  locale: UILocale; // must stay in sync with the web locale registry (lib/i18n/locales.ts)
  live: boolean; // false = hidden from pickers (reserved, like web live:false locales)
  flag: string;
  label: string;
};

export const EDITIONS: Record<string, Edition> = {
  US: { code: "US", country: "US", locale: "en", live: true, flag: "🇺🇸", label: "United States" },
  KR: { code: "KR", country: "KR", locale: "ko", live: true, flag: "🇰🇷", label: "한국" },
  ES: { code: "ES", country: "ES", locale: "es", live: false, flag: "🇪🇸", label: "España" },
  JP: { code: "JP", country: "JP", locale: "ja", live: false, flag: "🇯🇵", label: "日本" },
};

export const LIVE_EDITIONS: Edition[] = Object.values(EDITIONS).filter((e) => e.live);
export const ALL_EDITIONS: Edition[] = Object.values(EDITIONS);

export const DEFAULT_EDITION = EDITIONS.US;

/**
 * The app's UI language. Owner directive (2026-07-30): **the app is English** —
 * signup and every other screen. Country stays a separate axis, so a Korean
 * viewer still gets Korean availability and a KR-scoped Tonight, just in English
 * chrome. The four dictionaries stay in the bundle (they cost ~30KB and the web
 * projection still needs the vocabulary), so re-enabling a language later is
 * this one constant plus the picker in You.
 */
export const UI_LOCALE: UILocale = "en";

/** Best edition for a device region; unknown regions fall back to US (EN content). */
export function editionForCountry(cc: string | null | undefined): Edition {
  if (!cc) return DEFAULT_EDITION;
  const hit = EDITIONS[cc.toUpperCase()];
  return hit && hit.live ? hit : DEFAULT_EDITION;
}
