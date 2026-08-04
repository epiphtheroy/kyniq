"use client";

/**
 * Localized film titles for client list surfaces.
 * (Port of mobile/src/lib/titles.ts — migration 0121's film_titles_for_slugs.)
 *
 * Every ranked RPC on the site — cinecodex_ranked, film_availability's callers,
 * search — returns the English title and only the English title. Teaching each
 * one about language would be a dozen migrations and would still miss the next
 * one. So the language lives at the EDGE: a surface hands this hook the slugs it
 * is about to paint, gets back a lookup, and paints with it.
 *
 * Cheap by construction:
 *   · English short-circuits with no request at all (English IS the stored title)
 *   · the RPC returns only films that HAVE a title in that language, so a thin
 *     language costs one small empty response
 *   · results are memoized per (lang, slug) for the tab's lifetime
 *   · a failure is silent and leaves English standing, which is always correct
 *
 * 🔒 Server HTML is never personalized: the overlay only exists after mount, so
 * the crawlable markup stays the English original on every page.
 */
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useWatchPrefs } from "@/components/WatchPrefsProvider";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

/** lang -> slug -> localized title. Module scope: survives component remounts. */
const memo = new Map<string, Map<string, string>>();
/** Slugs already asked about, so a film with no translation isn't re-fetched. */
const asked = new Map<string, Set<string>>();

function bucket(lang: string): Map<string, string> {
  let m = memo.get(lang);
  if (!m) { m = new Map(); memo.set(lang, m); }
  return m;
}

function askedSet(lang: string): Set<string> {
  let s = asked.get(lang);
  if (!s) { s = new Set(); asked.set(lang, s); }
  return s;
}

export type TitleLookup = (slug: string, fallback: string) => string;

/**
 * Localized titles for a set of slugs.
 *
 * ```tsx
 * const titleOf = useLocalTitles(rows.map((r) => r.slug));
 * <span>{titleOf(row.slug, row.title)}</span>
 * ```
 *
 * The fallback is passed per call rather than stored, so a film with no title in
 * this language keeps whatever the row already had — never an empty string, and
 * never a stale title from another surface.
 */
export function useLocalTitles(slugs: string[]): TitleLookup {
  const { contentLang } = useWatchPrefs();
  // The identity of `slugs` changes every render; the CONTENT is what matters.
  const key = slugs.join(",");
  // Bumped when titles land, so the lookup below gets a NEW identity and the
  // surface repaints. (The cache itself is module-level and shared.)
  const [version, bump] = useState(0);

  useEffect(() => {
    if (contentLang === "en" || !key) return;
    const seen = askedSet(contentLang);
    const want = [...new Set(key.split(","))].filter((s) => s && !seen.has(s));
    if (!want.length) return;
    let alive = true;
    // Mark before the request so two surfaces mounting at once don't both ask.
    for (const s of want) seen.add(s);
    (async () => {
      const b = bucket(contentLang);
      let got = 0;
      for (let i = 0; i < want.length; i += 400) {
        const { data, error } = await sb.rpc("film_titles_for_slugs", {
          p_slugs: want.slice(i, i + 400),
          p_lang: contentLang,
        });
        if (error || !data) break;
        for (const r of data as { slug: string; title: string }[]) {
          if (r?.slug && r?.title) { b.set(r.slug, r.title); got++; }
        }
      }
      // Leave a failed language marked: it stays English rather than retrying on
      // every scroll.
      if (alive && got) bump((n) => n + 1); // repaint with what arrived
    })();
    return () => { alive = false; };
  }, [key, contentLang]);

  return useMemo(() => {
    if (contentLang === "en") return (_slug: string, fallback: string) => fallback;
    const b = bucket(contentLang);
    return (slug: string, fallback: string) => b.get(slug) || fallback;
    // `key` and `version` participate so a repaint after a fetch produces a NEW
    // function identity — otherwise memoized rows keep the old lookup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentLang, key, version]);
}

/** One title, for a single-film surface. Same cache as the list hook. */
export function useLocalTitle(slug: string | null | undefined, fallback: string): string {
  const lookup = useLocalTitles(slug ? [slug] : []);
  return slug ? lookup(slug, fallback) : fallback;
}
