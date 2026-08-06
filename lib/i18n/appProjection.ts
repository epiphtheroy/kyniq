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
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { dbLabel, type LabelMap } from "./dbLabel";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./locales";

/** Narrow an arbitrary `?locale=` query param to a locale we actually project. */
export function appLocale(raw: string | null | undefined): Locale {
  const v = (raw || "").toLowerCase().slice(0, 5);
  const base = v.split("-")[0];
  return isLocale(base) ? (base as Locale) : DEFAULT_LOCALE;
}

export const isProjected = (locale: Locale) => locale !== DEFAULT_LOCALE;

/**
 * One query per screen, not one per entity type.
 *
 * The obvious shape is a loadLabels() call per type, but a film payload needs
 * four and a director two, and this table is read on every localized request.
 * Every type on a screen keys off the film slug or the director slug, so a
 * single `entity_type IN (…) AND entity_key IN (…)` returns a small superset in
 * one round trip. After 2026-08-06 the database gets the cheaper shape by
 * default. Cached 1h like loadLabels, and every failure yields an empty map so
 * the caller falls back to English rather than breaking.
 */
async function screenLabels(locale: Locale, types: string[], keys: string[]): Promise<LabelMap> {
  if (!isProjected(locale) || !types.length || !keys.length) return new Map();
  const entries = await unstable_cache(
    async (): Promise<[string, string][]> => {
      try {
        const { data, error } = await anon()
          .from("content_i18n")
          .select("entity_type, entity_key, field, text")
          .eq("lang", locale)
          .in("entity_type", types)
          .in("entity_key", keys);
        if (error) return [];
        return ((data ?? []) as Row[]).map((r) => [
          `${r.entity_type}|${r.entity_key}|${r.field}`,
          r.text,
        ]);
      } catch {
        return [];
      }
    },
    ["content-i18n-screen-1", locale, types.join(","), keys[0] ?? "", String(keys.length)],
    { revalidate: 3600 },
  )();
  return new Map(Array.isArray(entries) ? entries : []);
}

type Row = { entity_type: string; entity_key: string; field: string; text: string };

const FILM_TYPES = ["invitation", "tow_comment", "director_portrait", "director_fact"];
const DIRECTOR_TYPES = ["director_portrait", "director_fact"];

/** Every label a film payload needs. One map — `pick` disambiguates by type. */
export async function filmLabels(locale: Locale, slug: string, directorSlug: string | null) {
  if (!isProjected(locale)) return null;
  const keys = directorSlug ? [slug, ...factKeys(directorSlug)] : [slug];
  const map = await screenLabels(locale, FILM_TYPES, keys);
  return { invitation: map, tow: map, portrait: map, facts: map };
}

/** Director-screen entity types. */
export async function directorLabels(locale: Locale, directorSlug: string) {
  if (!isProjected(locale)) return null;
  const map = await screenLabels(locale, DIRECTOR_TYPES, factKeys(directorSlug));
  return { portrait: map, facts: map };
}

function anon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/** director_fact rows are keyed `<slug>#<n>` so one bad fact can be re-queued
 *  alone; `intro` and `name_meaning` hang off the bare slug. 40 covers every
 *  director in the corpus (max observed: 24). */
function factKeys(slug: string): string[] {
  const keys = [slug];
  for (let n = 1; n <= 40; n++) keys.push(`${slug}#${n}`);
  return keys;
}

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
