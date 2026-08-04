// Localized film titles for list surfaces (owner 2026-08-03).
//
// Every list RPC in the app — me_collection, me_watchlist_scored, tonight,
// navigator, search_all — returns the English title and only the English title.
// Teaching each of them about language would mean a dozen migrations and a
// dozen redeploys, and would still miss the next one.
//
// So the language lives at the edge instead: a screen hands this hook the slugs
// it is about to render, gets back a lookup, and paints with it. One batched RPC
// (film_titles_for_slugs, migration 0121) per screenful.
//
// Cheap by construction:
//   - English short-circuits with no request at all (English IS the stored title)
//   - the RPC returns only films that HAVE a title in that language, so a thin
//     language costs one small empty response
//   - results are memoized per (lang, slug) for the process lifetime; scrolling
//     back through a grid never refetches
//   - a failure is silent and leaves English standing, which is always correct
import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { usePrefs } from "../state/prefs";

/** lang -> slug -> localized title. Module scope: survives screen remounts. */
const memo = new Map<string, Map<string, string>>();

function bucket(lang: string): Map<string, string> {
  let m = memo.get(lang);
  if (!m) {
    m = new Map();
    memo.set(lang, m);
  }
  return m;
}

/** Slugs we have already asked about, so a film with no translation isn't re-fetched. */
const asked = new Map<string, Set<string>>();

function askedSet(lang: string): Set<string> {
  let s = asked.get(lang);
  if (!s) {
    s = new Set();
    asked.set(lang, s);
  }
  return s;
}

export type TitleLookup = (slug: string, fallback: string) => string;

/**
 * Localized titles for a set of slugs.
 *
 * ```tsx
 * const titleOf = useLocalTitles(rows.map((r) => r.slug));
 * <Text>{titleOf(row.slug, row.title)}</Text>
 * ```
 *
 * The fallback is passed per call rather than stored, so a film with no title in
 * this language keeps whatever the row already had — never an empty string, and
 * never a stale title from another screen.
 */
export function useLocalTitles(slugs: string[]): TitleLookup {
  const { contentLang } = usePrefs();
  // Identity of `slugs` changes on every render; the CONTENT is what matters.
  const key = slugs.join(",");
  const [, bump] = useState(0);

  useEffect(() => {
    if (contentLang === "en" || !key) return;
    const seen = askedSet(contentLang);
    const want = key.split(",").filter((s) => s && !seen.has(s));
    if (!want.length) return;
    let alive = true;
    // Mark before the request so two screens mounting at once don't both ask.
    for (const s of want) seen.add(s);
    api
      .localTitles(want, contentLang)
      .then((m) => {
        if (!alive || !m.size) return;
        const b = bucket(contentLang);
        for (const [s, t] of m) b.set(s, t);
        bump((n) => n + 1); // repaint with what arrived
      })
      .catch(() => {
        // Leave them marked: a failed language stays English rather than
        // retrying on every scroll.
      });
    return () => {
      alive = false;
    };
  }, [key, contentLang]);

  return useMemo(() => {
    if (contentLang === "en") return (_slug: string, fallback: string) => fallback;
    const b = bucket(contentLang);
    return (slug: string, fallback: string) => b.get(slug) || fallback;
    // `key` participates so a repaint after a fetch produces a NEW function
    // identity — otherwise memoized rows would keep the old lookup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentLang, key, memo.get(contentLang)?.size]);
}

/** One title, for a single-film screen. Same cache as the list hook. */
export function useLocalTitle(slug: string | null | undefined, fallback: string): string {
  const lookup = useLocalTitles(slug ? [slug] : []);
  return slug ? lookup(slug, fallback) : fallback;
}
