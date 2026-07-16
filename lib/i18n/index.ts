/** i18n core — string projection and locale-aware paths.
 *  (정본: HANDOFF-KO프로젝션-한국어사이트.md §2.1)
 *
 *  The English site is the single source of truth; every other language is a
 *  projection of it. Two invariants live in this file:
 *
 *  P2 — fallback: a missing translation renders the English original. Never a
 *       blank, never a key.
 *  P4 — the dictionary key IS the English string. So when English copy changes,
 *       the lookup misses and the page silently falls back to the new English
 *       while scripts/i18n-audit.mjs reports the string as untranslated. A stale
 *       translation can never outlive its source.
 */

import { LOCALES, DEFAULT_LOCALE, isLocale, isProjectedLocale, type Locale } from "./locales";
import { KO } from "./dict/ko";

export type { Locale } from "./locales";
export { LOCALES, DEFAULT_LOCALE, LIVE_LOCALES, PROJECTED_LOCALES, ALL_LOCALES, isLocale, isProjectedLocale } from "./locales";

/** Per-locale dictionaries. Adding a language = one import + one entry here
 *  (§-2.2 step 3). The key set is shared across languages — i18n-audit checks
 *  parity, so a key present in one dictionary and missing in another is a
 *  reported gap, not a silent hole. */
const DICTS: Partial<Record<Locale, Record<string, string>>> = { ko: KO };

/** Separator for a context-qualified key (see `ctx` on t()). Chosen because it
 *  cannot occur inside an English UI string. */
export const CTX_SEP = "##";

/** ctxKey — the dictionary key for an English string in a disambiguating context. */
export function ctxKey(en: string, ctx: string): string {
  return `${en}${CTX_SEP}${ctx}`;
}

/**
 * t — project a user-facing English string into `locale`.
 *
 * `en` must be the literal English string as it appears in the UI (P4), not a
 * symbolic key. Params interpolate as {name}: t(l, "{n} min read", { n: 4 }).
 * An unknown locale, an untranslated string, or the source locale itself all
 * return the English original (P2).
 *
 * `ctx` disambiguates a homograph — English collapses senses that Korean does
 * not. "Locations" is the site's filming-locations corner (촬영지) in the nav and
 * a figure kind meaning places inside the film (장소) on a film page; both would
 * hash to the same key. Passing a context looks up the qualified key first and
 * falls back to the bare one, so adding a context never breaks an existing
 * translation.
 */
export function t(
  locale: Locale,
  en: string,
  vars?: Record<string, string | number>,
  ctx?: string,
): string {
  const d = DICTS[locale];
  const s = (ctx ? d?.[ctxKey(en, ctx)] : undefined) ?? d?.[en] ?? en;
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_m, k: string) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : `{${k}}`,
  );
}

/** locPath — the English path as it appears under `locale`.
 *  locPath("ko", "/film/alien-1979") === "/ko/film/alien-1979"
 *  locPath("en", "/film/alien-1979") === "/film/alien-1979"  (source has no prefix) */
export function locPath(locale: Locale, path: string): string {
  if (locale === DEFAULT_LOCALE) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** stripLocale — split a pathname into its locale prefix and the English path.
 *  "/ko/film/x" -> { locale: "ko", path: "/film/x" }
 *  "/ko"        -> { locale: "ko", path: "/" }
 *  "/film/x"    -> { locale: "en", path: "/film/x" }
 *  Only prefixes that are real locale codes split — "/frames" stays "/frames". */
export function stripLocale(pathname: string): { locale: Locale; path: string } {
  const m = /^\/([a-z]{2})(?=\/|$)/.exec(pathname);
  if (m && isLocale(m[1]) && m[1] !== DEFAULT_LOCALE) {
    const rest = pathname.slice(m[0].length);
    return { locale: m[1], path: rest === "" ? "/" : rest };
  }
  return { locale: DEFAULT_LOCALE, path: pathname };
}

/**
 * LOCALIZED_PATTERNS — the English paths that have locale shells today.
 *
 * The switcher and the suggest banner consult this: a page type that is not
 * listed has no twin, so the switcher hides rather than linking into a 404.
 * Each phase appends its routes here as the shells land (work order §4.2), and
 * the sitemap/hreflang wiring keys off the same list — there is no second
 * registry of "what is translated".
 */
const LOCALIZED_PATTERNS: RegExp[] = [
  /^\/film\/[^/]+$/, // Phase 2 — film main
];

export function isLocalizedPath(enPath: string): boolean {
  return LOCALIZED_PATTERNS.some((re) => re.test(enPath));
}

/** The legacy Korean essay surface: /film/{slug}/{desk}/ko.
 *  It predates the /{locale} prefix scheme and is load-bearing SEO (indexed,
 *  hreflang'd, in essays-ko.xml), so it keeps its suffix URL forever. That makes
 *  the site's URL space deliberately dual, and locTwin below is the only place
 *  that knows it. */
const KO_ESSAY_SUFFIX = /^\/film\/[^/]+\/[^/]+$/;

/**
 * locTwin — the URL of `pathname`'s twin in `locale`, or null when this page
 * type has no twin there (caller hides the switcher).
 *
 * Handles both URL schemes:
 *   1. prefix (new surfaces):  /film/x        <-> /{locale}/film/x
 *   2. suffix (legacy ko essays): /film/x/{desk} <-> /film/x/{desk}/ko
 *
 * `isEssayDesk` is injected rather than imported so this module stays free of
 * the desk registry (and of the markdown renderer it drags in).
 */
export function locTwin(
  locale: Locale,
  pathname: string,
  isEssayDesk?: (desk: string) => boolean,
): string | null {
  // Legacy ko essay: /film/x/{desk}/ko -> its English twin, and back.
  const koEssay = /^\/film\/([^/]+)\/([^/]+)\/ko$/.exec(pathname);
  if (koEssay) {
    if (locale === "ko") return pathname;
    if (locale === DEFAULT_LOCALE) return `/film/${koEssay[1]}/${koEssay[2]}`;
    return null; // no ja/fr/es essay surface exists
  }
  const { locale: cur, path } = stripLocale(pathname);
  if (locale === cur) return pathname;

  if (isEssayDesk && cur === DEFAULT_LOCALE && KO_ESSAY_SUFFIX.test(path)) {
    const [, slug, desk] = path.split("/");
    if (isEssayDesk(desk)) return locale === "ko" ? `/film/${slug}/${desk}/ko` : null;
  }

  if (!isLocalizedPath(path)) return null;
  if (locale !== DEFAULT_LOCALE && !isProjectedLocale(locale)) return null;
  return locPath(locale, path);
}

/** Intl formatter tag for a locale — never hard-code "ko-KR" at a call site. */
export function intlTag(locale: Locale): string {
  return LOCALES[locale].intl;
}
