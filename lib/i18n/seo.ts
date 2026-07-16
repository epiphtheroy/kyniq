/** hreflang wiring for the locale projection.
 *  (정본: HANDOFF-KO프로젝션-한국어사이트.md §6.1)
 *
 *  The rule that matters: a page advertises a locale twin ONLY when that twin is
 *  itself indexable (§6.2). Google requires hreflang targets to be indexable;
 *  thousands of links pointing at noindex Korean pages are broken pairs that dilute
 *  the signal. So the EN page emits a `ko` alternate for a film only once that
 *  film has a real Korean title AND synopsis — the same gate the Korean page uses
 *  to decide its own robots. The two are computed from one row, so there is no
 *  extra query and no way for them to disagree.
 */

import type { Metadata } from "next";
import { locPath, DEFAULT_LOCALE, PROJECTED_LOCALES, type Locale } from "./index";

/**
 * localeAlternates — the `alternates` block for a page at English path `enPath`,
 * rendering in `locale`, whose indexable projected twins are `indexableLocales`.
 *
 * - canonical is ALWAYS self. Pointing a projected page's canonical at EN would
 *   delete it from the index; this is the one rule with no exceptions (§6.1).
 * - `languages` lists en + x-default + every indexable projected twin. When no
 *   twin qualifies, only the canonical is emitted (mirrors the existing
 *   `data.hasKo ? {...} : {}` idiom at app/film/[slug]/[desk]/page.tsx:189).
 * - Cross-locale pairs (ko↔ja) fall out of the same map for free once both are
 *   indexable — no per-language wiring.
 */
export function localeAlternates(
  enPath: string,
  locale: Locale,
  indexableLocales: Locale[],
): NonNullable<Metadata["alternates"]> {
  const self = locPath(locale, enPath);
  if (indexableLocales.length === 0) return { canonical: self };
  const languages: Record<string, string> = { [DEFAULT_LOCALE]: enPath, "x-default": enPath };
  for (const l of indexableLocales) languages[l] = locPath(l, enPath);
  return { canonical: self, languages };
}

/** The `_<loc>` columns for one film row, as returned by loadLocaleCols. */
export type LocaleCols = Partial<Record<string, string | null>>;

/**
 * indexableLocales — which projected locales clear the §6.2 v1 gate for this row.
 *
 * v1 gate: `title_<loc>` AND `overview_<loc>` both present. A locale with only a
 * title is a half-page (Korean head, English body) that Google folds back into
 * the English original, so it does not qualify.
 *
 * `cols` is null before migration 0105 is applied (the columns don't exist);
 * then no locale qualifies, every projected page noindexes, and EN advertises no
 * twins — the site is exactly as it is today until the data lands.
 */
export function indexableLocales(cols: LocaleCols | null): Locale[] {
  if (!cols) return [];
  return PROJECTED_LOCALES.filter((l) => {
    const title = cols[`title_${l}`];
    const overview = cols[`overview_${l}`];
    return typeof title === "string" && title.trim().length > 0
      && typeof overview === "string" && overview.trim().length > 0;
  });
}
