// Two registries, two axes (owner directive 2026-08-03).
//
// Until now "edition" bundled three things into one choice: which country's
// streaming availability to query, which content language to read, and which UI
// dictionary to load. That is why the list was four entries with two of them
// greyed out — a country could not be offered until its language shipped.
//
// They are now independent:
//
//   EDITIONS       — WHERE you watch. Drives film_provider_index queries only.
//                    Any country with availability data can be offered, because
//                    picking it says nothing about what language you read in.
//   CONTENT_LANGS  — WHAT LANGUAGE the films are named in. Drives the TMDB title
//                    projection (films.title_<loc>, migration 0121) and the
//                    multilingual search RPC. Independent of country entirely.
//   UI_LOCALES     — the app's own chrome. Follows the device language, and
//                    Settings can override it. Separate from CONTENT_LANGS
//                    because reading buttons in Korean and recognising a film
//                    by its Korean title are different needs.
//
// Adding a country = one entry in EDITIONS. Adding a content language = one
// entry in CONTENT_LANGS + the `_<loc>` columns + a backfill run. Anything more
// is a design smell.

export type UILocale = "en" | "ko" | "es" | "ja";

export type Edition = {
  code: string;
  country: string; // ISO 3166-1 alpha-2, drives film_provider_index queries
  flag: string;
  label: string;
};

/**
 * Availability markets, ordered by how much of the catalogue each one actually
 * carries (measured against film_provider_index, 2026-08-03: US 4,818 films /
 * 198 services · CA 4,178 · FR 4,113 · GB 3,863 …). The English-speaking markets
 * lead because they are who the app is for.
 */
export const EDITIONS: Record<string, Edition> = {
  US: { code: "US", country: "US", flag: "🇺🇸", label: "United States" },
  GB: { code: "GB", country: "GB", flag: "🇬🇧", label: "United Kingdom" },
  CA: { code: "CA", country: "CA", flag: "🇨🇦", label: "Canada" },
  AU: { code: "AU", country: "AU", flag: "🇦🇺", label: "Australia" },
  IE: { code: "IE", country: "IE", flag: "🇮🇪", label: "Ireland" },
  NZ: { code: "NZ", country: "NZ", flag: "🇳🇿", label: "New Zealand" },
  KR: { code: "KR", country: "KR", flag: "🇰🇷", label: "South Korea" },
  JP: { code: "JP", country: "JP", flag: "🇯🇵", label: "Japan" },
  FR: { code: "FR", country: "FR", flag: "🇫🇷", label: "France" },
  DE: { code: "DE", country: "DE", flag: "🇩🇪", label: "Germany" },
  ES: { code: "ES", country: "ES", flag: "🇪🇸", label: "Spain" },
  IT: { code: "IT", country: "IT", flag: "🇮🇹", label: "Italy" },
  NL: { code: "NL", country: "NL", flag: "🇳🇱", label: "Netherlands" },
  SE: { code: "SE", country: "SE", flag: "🇸🇪", label: "Sweden" },
  IN: { code: "IN", country: "IN", flag: "🇮🇳", label: "India" },
  MX: { code: "MX", country: "MX", flag: "🇲🇽", label: "Mexico" },
  BR: { code: "BR", country: "BR", flag: "🇧🇷", label: "Brazil" },
};

export const ALL_EDITIONS: Edition[] = Object.values(EDITIONS);
export const DEFAULT_EDITION = EDITIONS.US;

/** The device's market if we carry it, else the US. */
export function editionForCountry(cc: string | null | undefined): Edition {
  if (!cc) return DEFAULT_EDITION;
  return EDITIONS[cc.toUpperCase()] ?? DEFAULT_EDITION;
}

// ---------------------------------------------------------------------------
// Content language.

/** The languages films can be NAMED in. Must match migration 0121's columns. */
export type ContentLang = "en" | "ko" | "es" | "ja" | "zh" | "fr" | "hi";

export type LangOption = {
  code: ContentLang;
  /** Endonym — a language picker is the one place you never translate. */
  label: string;
  /** English name, so an English-reading viewer can find it. */
  english: string;
};

/**
 * Owner 2026-08-03: "영어, 스페인어, 일본어, 중국어, 인도어, 프랑스어 정도".
 * English is the source language — every title exists in it, so it is also the
 * fallback whenever a film has no title in the chosen language.
 */
export const CONTENT_LANGS: LangOption[] = [
  { code: "en", label: "English", english: "English" },
  { code: "ko", label: "한국어", english: "Korean" },
  { code: "es", label: "Español", english: "Spanish" },
  { code: "ja", label: "日本語", english: "Japanese" },
  { code: "zh", label: "中文", english: "Chinese" },
  { code: "fr", label: "Français", english: "French" },
  { code: "hi", label: "हिन्दी", english: "Hindi" },
];

export const DEFAULT_CONTENT_LANG: ContentLang = "en";

export function isContentLang(v: string | null | undefined): v is ContentLang {
  return !!v && CONTENT_LANGS.some((l) => l.code === v);
}

export function langLabel(code: ContentLang): string {
  return CONTENT_LANGS.find((l) => l.code === code)?.label ?? "English";
}

/**
 * Fallback UI language when the device asks for one we do not ship.
 *
 * History: this constant used to pin the whole app to English (owner directive
 * 2026-08-03). That directive was reversed 2026-08-06 — one binary, localized at
 * runtime: the device language picks the dictionary, and Settings can override
 * it. See HANDOFF-한국어화-구독번역-실행.md §4.
 */
export const UI_LOCALE: UILocale = "en";

/** UI languages we actually ship a complete dictionary for. */
export const UI_LOCALES: { code: UILocale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ko", label: "한국어" },
  { code: "es", label: "Español" },
  { code: "ja", label: "日本語" },
];

export function isUILocale(v: string | null | undefined): v is UILocale {
  return !!v && UI_LOCALES.some((l) => l.code === v);
}

export function uiLocaleLabel(code: UILocale): string {
  return UI_LOCALES.find((l) => l.code === code)?.label ?? "English";
}
