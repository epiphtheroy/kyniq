/** Localized place names for the atlas/locations surfaces.
 *  (정본: HANDOFF-KO프로젝션-한국어사이트.md §3.3)
 *
 *  Place names are DATA, not chrome — the locations surface is the one place a
 *  projected page is genuinely, fully in the language (not English prose under a
 *  Korean shell), which is why §6.5 flags it as the highest Korean-search value
 *  ("화양연화 촬영지"). Names are keyed by the existing city slug so the parallel
 *  file never has to touch lib/atlas_cities.json (which the factory/map scripts
 *  consume). A slug with no entry falls back to its English name.
 *
 *  A new language adds cities/<loc>.json in the same shape (§-2.2).
 */

import koCities from "./cities/ko.json";
import { DEFAULT_LOCALE, type Locale } from "./locales";

type CityEntry = { name?: string; country?: string };
const CITY_DICTS: Partial<Record<Locale, Record<string, CityEntry>>> = {
  ko: koCities as Record<string, CityEntry>,
};

/** cityName — a city's name in `locale`, by slug, falling back to `fallback`
 *  (the English name from atlas_cities.json). */
export function cityName(slug: string, locale: Locale, fallback: string): string {
  if (locale === DEFAULT_LOCALE) return fallback;
  return CITY_DICTS[locale]?.[slug]?.name ?? fallback;
}

/** countryNameFor — a city's country in `locale`, by slug, else `fallback`.
 *  (For a country name not tied to a city slug, prefer Intl.DisplayNames.) */
export function cityCountry(slug: string, locale: Locale, fallback: string): string {
  if (locale === DEFAULT_LOCALE) return fallback;
  return CITY_DICTS[locale]?.[slug]?.country ?? fallback;
}

/** Coverage for scripts/i18n-audit.mjs. */
export function cityCoverage(locale: Locale): { total: number; named: number } {
  const d = CITY_DICTS[locale];
  if (!d) return { total: 0, named: 0 };
  const vals = Object.values(d);
  return { total: vals.length, named: vals.filter((v) => v.name).length };
}
