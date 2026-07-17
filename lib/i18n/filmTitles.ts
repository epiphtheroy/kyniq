/** Film-title projection — batch-reads films.title_<locale> for referenced films.
 *  (정본: HANDOFF-다국어프로젝션.md structural-wording layer)
 *
 *  The film DETAIL page localizes its own H1 via locVal(film,"title") because it
 *  fetches the film row (with title_ko) directly. But every surface that lists
 *  OTHER films — "Watch next"/kindred, "Recommended by", counterpoints, daily
 *  references, search results, a director's filmography — gets those titles from
 *  an RPC that returns only the English `title`. This batch loader fetches the
 *  localized title for a set of slugs in one query, so those references render in
 *  the reader's language too.
 *
 *  🔒 SEO SAFETY (owner hard rule): returns an empty map for the source locale
 *  (English pages never consult it → byte-identical) and on any error / missing
 *  column (a locale whose title_<loc> column doesn't exist yet). English fallback
 *  everywhere, never a crash.
 *
 *  USAGE — batch, then project:
 *    const titles = await loadFilmTitles("ko", slugs);   // one query
 *    filmTitle(titles, "ko", slug, row.title);           // per row
 */

import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { DEFAULT_LOCALE, type Locale } from "./locales";

export type TitleMap = Map<string, string>; // slug -> localized title

function anon() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

/**
 * loadFilmTitles — the localized `title_<locale>` for the given film slugs.
 * Empty map for the source locale or on any error (English fallback). The column
 * is `title_ko` today (migration 0105); a future locale without its column simply
 * errors → empty map → English, so callers never need to branch on locale support.
 */
export async function loadFilmTitles(locale: Locale, slugs: string[]): Promise<TitleMap> {
  if (locale === DEFAULT_LOCALE || slugs.length === 0) return new Map();
  const keys = [...new Set(slugs)].filter(Boolean);
  if (!keys.length) return new Map();
  const col = `title_${locale}`; // locale is a fixed enum (ko/ja/fr/es) — never user input
  return unstable_cache(
    async () => {
      try {
        const { data, error } = await anon()
          .from("films")
          .select(`slug, ${col}`)
          .in("slug", keys)
          .not(col, "is", null);
        if (error) return new Map<string, string>();
        const m: TitleMap = new Map();
        // Dynamic column select confuses PostgREST's type parser; cast via unknown.
        for (const r of (data ?? []) as unknown as Record<string, string | null>[]) {
          const v = r[col];
          if (typeof r.slug === "string" && v) m.set(r.slug, v);
        }
        return m;
      } catch {
        return new Map<string, string>();
      }
    },
    // Precise key: the sorted slug set (labels change rarely; 1h revalidate).
    [`film-titles-1`, locale, [...keys].sort().join(",")],
    { revalidate: 3600 },
  )();
}

/** filmTitle — the localized title for one slug, else `english`.
 *  Source locale always returns `english` (SEO safe). */
export function filmTitle(map: TitleMap, locale: Locale, slug: string | null, english: string | null): string | null {
  if (locale === DEFAULT_LOCALE || !slug) return english;
  return map.get(slug) ?? english;
}
