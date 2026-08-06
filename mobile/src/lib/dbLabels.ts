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
 * ⚠️ entity_key is NOT always a slug.
 *
 * Two corpora were extracted keyed on their ENGLISH TEXT rather than an id:
 *   lineage_list (label, description) — "Palme d'Or", "KOFA 100 Korean Films"
 *   frame        (label, definition)
 * Every other corpus keys on a slug ("abbas-kiarostami", "solaris-1972").
 *
 * So a lineage list must be looked up by `l.label`, not `l.key`. Getting this
 * wrong is silent — the lookup simply returns the fallback, and the screen keeps
 * rendering correct English forever. It cost one QA pass to notice.
 */
export const LABEL_KEYED = new Set(["lineage_list", "frame"]);

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
  // `tick` is not cosmetic: it participates in the returned lookup's identity, so
  // a caller that memoizes DOWNSTREAM of the lookup recomputes when rows land.
  // Without it the fetch re-renders the screen but a `useMemo([…, labelOf])` keeps
  // its English result forever — which is exactly how the Explore search examples
  // stayed English while the cards next to them were Korean.
  const [tick, bump] = useState(0);

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
    [lang, entityType, field, wanted, tick],
  );
}
