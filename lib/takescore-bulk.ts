import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

/**
 * Bulk TakeScore lookup (2026-07-09). cinecodex_card(slug) recomputes a
 * corpus-wide rank on every call — a per-film loop over a filmography starves
 * Postgres into statement timeouts. cinecodex_ranked returns the whole ranking
 * (v/c/r/u per film) in one fast query, so we fetch it ONCE, globally, cached
 * a day, and both the director hub and /director/x/takescore look films up in
 * the resulting slug→scores map. Rank = global position; rank_total = corpus.
 */

export type BulkScore = { v: number; c: number; r: number; u: number; rank: number };

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type RankedRow = { slug: string; v: number; c: number; r: number; u: number };

export const cachedRankedScores = unstable_cache(
  async (): Promise<{ scores: Record<string, BulkScore>; total: number }> => {
    const supabase = db();
    const scores: Record<string, BulkScore> = {};
    let total = 0;
    for (let offset = 0; offset < 8000; offset += 1000) {
      const { data } = await supabase.rpc("cinecodex_ranked", { p_sort: "u", p_lambda: 1.0, p_limit: 1000, p_offset: offset });
      const payload = data as { total?: number; rows?: RankedRow[] } | null;
      const rows = payload?.rows ?? [];
      total = payload?.total ?? total;
      rows.forEach((row, i) => {
        if (row.slug && row.u != null && row.v != null) {
          scores[row.slug] = { v: row.v, c: row.c ?? 0, r: row.r ?? 0, u: row.u, rank: offset + i + 1 };
        }
      });
      if (rows.length < 1000) break;
    }
    return { scores, total };
  },
  ["takescore-ranked-bulk-1"],
  { revalidate: 86400 },
);
