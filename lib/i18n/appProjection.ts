/** Locale projection for the mobile BFF (app/api/v1/app/*).
 *  정본: HANDOFF-한국어화-구독번역-실행.md §3
 *
 *  The app is one binary localized at runtime, so its payloads carry translated
 *  prose rather than the app shipping any. Everything here reads content_i18n —
 *  the SAME table the web reads — which is what makes iOS, Android and a future
 *  /ko web page share one corpus: fill the table once, all three surfaces move.
 *
 *  Fallback is always English (P2): a missing row, an unknown locale, or a dead
 *  table yields the English value, never a blank.
 */
import { loadLabels, dbLabel, type LabelMap } from "./dbLabel";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./locales";

/** Narrow an arbitrary `?locale=` query param to a locale we actually project. */
export function appLocale(raw: string | null | undefined): Locale {
  const v = (raw || "").toLowerCase().slice(0, 5);
  const base = v.split("-")[0];
  return isLocale(base) ? (base as Locale) : DEFAULT_LOCALE;
}

export const isProjected = (locale: Locale) => locale !== DEFAULT_LOCALE;

/** Batch-load every entity type a film payload needs, in one pass. */
export async function filmLabels(locale: Locale, slug: string, directorSlug: string | null) {
  if (!isProjected(locale)) return null;
  const [invitation, tow, portrait, facts] = await Promise.all([
    loadLabels(locale, "invitation", [slug]),
    loadLabels(locale, "tow_comment", [slug]),
    directorSlug ? loadLabels(locale, "director_portrait", [directorSlug]) : emptyMap(),
    directorSlug ? loadLabels(locale, "director_fact", factKeys(directorSlug)) : emptyMap(),
  ]);
  return { invitation, tow, portrait, facts };
}

/** Director-screen entity types. */
export async function directorLabels(locale: Locale, directorSlug: string) {
  if (!isProjected(locale)) return null;
  const [portrait, facts] = await Promise.all([
    loadLabels(locale, "director_portrait", [directorSlug]),
    loadLabels(locale, "director_fact", factKeys(directorSlug)),
  ]);
  return { portrait, facts };
}

/** director_fact rows are keyed `<slug>#<n>` so one bad fact can be re-queued
 *  alone; `intro` and `name_meaning` hang off the bare slug. 40 covers every
 *  director in the corpus (max observed: 24). */
function factKeys(slug: string): string[] {
  const keys = [slug];
  for (let n = 1; n <= 40; n++) keys.push(`${slug}#${n}`);
  return keys;
}

const emptyMap = async (): Promise<LabelMap> => new Map();

/** Project one field, English in / localized out. */
export function pick(
  map: LabelMap | undefined,
  locale: Locale,
  entityType: string,
  entityKey: string,
  field: string,
  en: string | null,
): string | null {
  if (!map || !en) return en;
  return dbLabel(map, locale, entityType, entityKey, field, en);
}
