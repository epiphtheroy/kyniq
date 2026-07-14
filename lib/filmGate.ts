import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { filmIndexBar, SITE_INDEXABLE, type FilmIndexSignals } from "./seo";

// SEO consolidation gate plumbing (2026-07-14, HANDOFF §2). The whole roster comes
// from ONE RPC (film_index_signals_json, migration 0097 — jsonb_agg single-row,
// bypasses the PostgREST 1,000-row cap), so the film main page, every subpage, and
// the sitemap decide indexability from the identical predicate (filmIndexBar).

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

async function loadIndexRoster(): Promise<Record<string, FilmIndexSignals>> {
  const { data, error } = await db().rpc("film_index_signals_json");
  if (error) throw new Error(`film_index_signals_json: ${error.message}`);
  const rows = (data ?? []) as FilmIndexSignals[];
  const out: Record<string, FilmIndexSignals> = {};
  for (const r of rows) out[r.slug] = r;
  return out;
}

/** Cached signal roster (all films), keyed by slug. Sitemap builders read this
 *  directly; pages go through filmMainIndexable(). Revalidates hourly. */
export function filmIndexRoster(): Promise<Record<string, FilmIndexSignals>> {
  return unstable_cache(loadIndexRoster, ["film-index-signals-1"], { revalidate: 3600 })();
}

/**
 * Whether a film's MAIN page is indexable under the consolidation gate.
 * Subpages gate on (await filmMainIndexable(slug, { visible })) && ownBar.
 *
 * `hint.visible === true` short-circuits WITHOUT touching the RPC: a visible film
 * is always Tier-1 (there are zero visible+unanalyzed films; visible ⇔ ≥3 approved
 * figures via the DB trigger), so it is indexable regardless of the roster — this
 * keeps a transient RPC error from de-indexing a live film's established subpages.
 * Everything else consults the cached roster and fails CLOSED (noindex, follow) on
 * any error, so a flaky RPC never accidentally indexes a thin Tier-2 page.
 */
export async function filmMainIndexable(
  slug: string,
  hint?: { visible?: boolean | null },
): Promise<boolean> {
  if (slug.startsWith("tmdb-")) return false;
  if (hint?.visible) return SITE_INDEXABLE; // visible ⟹ Tier-1: never RPC-dependent
  try {
    const roster = await filmIndexRoster();
    const sig = roster[slug];
    return sig ? filmIndexBar(sig) : false;
  } catch {
    return false; // fail closed: unknown → noindex (follow)
  }
}
