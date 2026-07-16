/** Locale registry — the SSOT for which languages exist on this site.
 *  (정본: HANDOFF-KO프로젝션-한국어사이트.md §-2.1)
 *
 *  Adding a language starts here and follows the 7-step checklist in §-2.2 of
 *  the work order. Nothing else in the codebase may hard-code a locale code:
 *  the only places a raw "ko" is allowed are this registry, the dictionary
 *  filename (dict/ko.ts), migration column names, the app/ko/** shell dirs and
 *  the per-locale cohort constants in lib/seo.ts. Everywhere else a `Locale`
 *  value flows through.
 *
 *  `live: false` locales are reserved: their entry pins the language's codes so
 *  the types and the design stay plural from day one, but they are absent from
 *  every surface (routes, hreflang, sitemaps, switcher, banner) until the
 *  language is actually built.
 */

export type LocaleConfig = {
  /** Rendered anywhere users or crawlers can reach it. Wave gate. */
  live: boolean;
  /** TMDB `language` parameter (worker/tmdb-i18n-backfill.py mirrors this map). */
  tmdb: string;
  /** BCP-47 tag for Intl.DateTimeFormat / NumberFormat. */
  intl: string;
  /** Open Graph og:locale. */
  ogLocale: string;
  /** Endonym — how the language names itself in the switcher. */
  label: string;
};

export const LOCALES = {
  en: { live: true, tmdb: "en-US", intl: "en-US", ogLocale: "en_US", label: "English" },
  ko: { live: true, tmdb: "ko-KR", intl: "ko-KR", ogLocale: "ko_KR", label: "한국어" }, // wave 1
  ja: { live: false, tmdb: "ja-JP", intl: "ja-JP", ogLocale: "ja_JP", label: "日本語" }, // reserved
  fr: { live: false, tmdb: "fr-FR", intl: "fr-FR", ogLocale: "fr_FR", label: "Français" }, // reserved
  es: { live: false, tmdb: "es-ES", intl: "es-ES", ogLocale: "es_ES", label: "Español" }, // reserved
} as const satisfies Record<string, LocaleConfig>;

export type Locale = keyof typeof LOCALES;

/** The source language. Every other locale is a projection of it, and every
 *  missing translation falls back to it. */
export const DEFAULT_LOCALE: Locale = "en";

export const ALL_LOCALES = Object.keys(LOCALES) as Locale[];

/** Locales that may appear on a surface. */
export const LIVE_LOCALES = ALL_LOCALES.filter((l) => LOCALES[l].live);

/** Live locales that are projections (i.e. everything except the source). */
export const PROJECTED_LOCALES = LIVE_LOCALES.filter((l) => l !== DEFAULT_LOCALE);

export function isLocale(v: string): v is Locale {
  return Object.prototype.hasOwnProperty.call(LOCALES, v);
}

/** True for a locale that is live AND a projection — i.e. one that owns a
 *  `/{locale}` URL space. Guards route shells and switcher entries. */
export function isProjectedLocale(v: string): v is Locale {
  return isLocale(v) && LOCALES[v].live && v !== DEFAULT_LOCALE;
}
