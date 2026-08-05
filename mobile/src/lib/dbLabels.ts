// Localized DB prose for surfaces the BFF does not assemble (owner 2026-08-06).
//
// Sibling of titles.ts, same shape and the same reasoning: the language lives at
// the edge. A screen names the rows it is about to paint, gets a lookup back,
// and English stands wherever a translation is absent.
//
// The difference is the source. titles.ts reads films.title_<loc> through an RPC;
// this reads content_i18n directly (migration 0107, anon-selectable) — the SAME
// table the web reads, which is why translating once moves iOS, Android and the
// web together. See lib/i18n/appProjection.ts for the server-side twin.
//
// Cheap by construction: English short-circuits with no request, results are
// memoized per (lang, type, field, key) for the process lifetime, keys already
// asked about are never re-asked, and a failure is silent.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { usePrefs } from "../state/prefs";

const memo = new Map<string, string>();
const asked = new Set<string>();
const cacheKey = (lang: string, type: string, field: string, key: string) =>
  `${lang}|${type}|${field}|${key}`;

export type LabelLookup = (key: string, fallback: string | null) => string | null;

/**
 * Localized text for content_i18n rows.
 *
 * ```tsx
 * const towText = useDbLabels("tow_comment", "rationale", [slug]);
 * <Text>{towText(slug, tow.rationale)}</Text>
 * ```
 */
export function useDbLabels(entityType: string, field: string, keys: string[]): LabelLookup {
  // The UI locale, not contentLang: this is prose the reader reads, so it follows
  // the language the app speaks. contentLang governs film TITLES only — someone
  // can want English chrome and Korean titles, but not English chrome and Korean
  // paragraphs.
  const { locale } = usePrefs();
  const lang = locale;
  const wanted = useMemo(
    () => [...new Set(keys.filter(Boolean))].sort().join(","),
    [keys],
  );
  const [, bump] = useState(0);

  useEffect(() => {
    if (lang === "en" || !wanted) return;
    const missing = wanted
      .split(",")
      .filter((k) => k && !asked.has(cacheKey(lang, entityType, field, k)));
    if (!missing.length) return;
    let alive = true;
    (async () => {
      for (const k of missing) asked.add(cacheKey(lang, entityType, field, k));
      const { data, error } = await supabase
        .from("content_i18n")
        .select("entity_key, text")
        .eq("entity_type", entityType)
        .eq("field", field)
        .eq("lang", lang)
        .in("entity_key", missing);
      if (error || !alive) return;
      let got = 0;
      for (const r of (data ?? []) as { entity_key: string; text: string }[]) {
        if (!r.text) continue;
        memo.set(cacheKey(lang, entityType, field, r.entity_key), r.text);
        got++;
      }
      if (got) bump((n) => n + 1);
    })();
    return () => {
      alive = false;
    };
  }, [lang, entityType, field, wanted]);

  return useMemo(
    () => (key: string, fallback: string | null) =>
      (lang === "en" ? null : memo.get(cacheKey(lang, entityType, field, key))) ?? fallback,
    // `wanted` participates so the lookup identity changes when a fetch lands.
    [lang, entityType, field, wanted],
  );
}
