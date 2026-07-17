/** DB-label projection — reads content_i18n for a non-English locale.
 *  (정본: HANDOFF-다국어프로젝션.md structural-wording layer)
 *
 *  Structural wordings stored in the DB (taxonomy labels/definitions, concept
 *  one-liners, trope titles, theorist blurbs, figure labels, invitations, enum
 *  words…) get their translations from the content_i18n side table (migration
 *  0107), keyed by (entity_type, entity_key, field, lang).
 *
 *  🔒 SEO SAFETY (owner hard rule): for the source locale this NEVER touches
 *  content_i18n and always returns the English value — so English pages are
 *  byte-identical and the English SEO surface is untouched. The table is only
 *  consulted for a projected locale.
 *
 *  USAGE PATTERN — batch, then project:
 *    const i18n = await loadLabels("ko", "figure", figureSlugs);   // one query
 *    dbLabel(i18n, "ko", "figure", slug, "label", f.label);         // per row
 *  Loading once per render (not per row) keeps it to a single round-trip.
 */

import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { DEFAULT_LOCALE, type Locale } from "./locales";

export type LabelMap = Map<string, string>; // `${entity_type}|${entity_key}|${field}` -> text

function anon() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const keyOf = (entityType: string, entityKey: string, field: string) => `${entityType}|${entityKey}|${field}`;

/**
 * loadLabels — every content_i18n translation for `locale` of the given
 * (entityType, entityKeys). Returns an empty map for the source locale (so
 * callers can call it unconditionally) or on any error / pre-migration (the
 * table doesn't exist yet) — English fallback everywhere, never a crash.
 */
export async function loadLabels(
  locale: Locale,
  entityType: string,
  entityKeys: string[],
): Promise<LabelMap> {
  if (locale === DEFAULT_LOCALE || entityKeys.length === 0) return new Map();
  const keys = [...new Set(entityKeys)].filter(Boolean);
  if (!keys.length) return new Map();
  // ⚠️ unstable_cache serializes its result — a Map does NOT survive (comes back a
  // plain {} with no .get on a cache HIT → "x.get is not a function"). Cache a
  // plain [key, text] array and build the Map OUTSIDE the cache boundary.
  const entries = await unstable_cache(
    async (): Promise<[string, string][]> => {
      try {
        const { data, error } = await anon()
          .from("content_i18n")
          .select("entity_key, field, text")
          .eq("entity_type", entityType)
          .eq("lang", locale)
          .in("entity_key", keys);
        if (error) return [];
        const out: [string, string][] = [];
        for (const r of (data ?? []) as { entity_key: string; field: string; text: string }[]) {
          out.push([keyOf(entityType, r.entity_key, r.field), r.text]);
        }
        return out;
      } catch {
        return [];
      }
    },
    // Cache key includes the locale, entityType and a stable hash of the key set
    // (labels change rarely; 1h revalidate). Never cache under the same key for a
    // different key set.
    // v2: key bump abandons v1 entries poisoned by the Map-serialization bug.
    [`content-i18n-2`, locale, entityType, String(keys.length), keys.slice(0, 3).join(",")],
    { revalidate: 3600 },
  )();
  return new Map(Array.isArray(entries) ? entries : []);
}

/** dbLabel — the translation for one (entityType, key, field), else `english`.
 *  Source locale always returns `english` (SEO safe). */
export function dbLabel(
  map: LabelMap,
  locale: Locale,
  entityType: string,
  entityKey: string,
  field: string,
  english: string | null,
): string | null {
  if (locale === DEFAULT_LOCALE) return english;
  return map.get(keyOf(entityType, entityKey, field)) ?? english;
}

/**
 * enumLabel — for fixed enum words (figure kinds, tiers, aesthetic labels,
 * verdict categories…). These use entity_type='enum', entity_key = the English
 * value itself, field='v'. Preload with loadLabels("ko","enum", englishValues).
 */
export function enumLabel(map: LabelMap, locale: Locale, english: string | null): string | null {
  if (locale === DEFAULT_LOCALE || !english) return english;
  return map.get(keyOf("enum", english, "v")) ?? english;
}
