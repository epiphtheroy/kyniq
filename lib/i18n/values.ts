/** DB value projection — the locale-generic accessor for `_<loc>` columns.
 *  (정본: HANDOFF-KO프로젝션-한국어사이트.md §2.3)
 *
 *  The translation of a DB text value lives in a sibling nullable column on the
 *  same row: films.title -> films.title_ko, film_locations.name -> name_ko.
 *  That is why this file is three lines of logic and why the English site can
 *  keep changing shape underneath it: a new English column needs no change here,
 *  and a new language needs no change either (P3, §-2.2 step 4).
 *
 *  Longform prose (takes, essays, figures, reception bodies) does NOT come
 *  through here — that layer is the content_i18n side table owned by
 *  HANDOFF-한국어화-i18n-마스터.md §6. Never store the same field in both.
 */

import { DEFAULT_LOCALE, type Locale } from "./locales";

/**
 * locVal — the row's value for `field` in `locale`, falling back to English (P2).
 *
 * Returns null only when the English value itself is absent/non-text, so callers
 * keep their existing `?? null` shape:
 *   locVal(film, "title", locale)     // films.title_ko ?? films.title
 *   locVal(loc, "name", locale)       // film_locations.name_ko ?? name
 *
 * A whitespace-only translation counts as absent — the backfill writes NULL for
 * "TMDB has no localized value", but a stray "" from any other writer must not
 * blank out a title.
 */
export function locVal<T extends Record<string, unknown>>(
  row: T,
  field: keyof T & string,
  locale: Locale,
): string | null {
  if (locale !== DEFAULT_LOCALE) {
    const v = row[`${field}_${locale}` as keyof T];
    if (typeof v === "string" && v.trim()) return v;
  }
  const en = row[field];
  return typeof en === "string" && en.trim() ? en : null;
}

/** hasLocVal — does this row carry a real translation for `field` in `locale`?
 *  Distinct from locVal, which answers "what do I render". This one answers
 *  "is this page substantively in the language" and so drives the §6.2 index
 *  gate and the §6.1 conditional hreflang. Always false for the source locale. */
export function hasLocVal<T extends Record<string, unknown>>(
  row: T,
  field: keyof T & string,
  locale: Locale,
): boolean {
  if (locale === DEFAULT_LOCALE) return false;
  const v = row[`${field}_${locale}` as keyof T];
  return typeof v === "string" && v.trim().length > 0;
}
