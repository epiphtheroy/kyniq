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

// Last roster that loaded cleanly, kept for the lifetime of the lambda instance.
// The signal set moves on the order of days, so a stale roster is a far better
// answer than a wrong one — see filmMainIndexable's error path.
let lastGoodRoster: Record<string, FilmIndexSignals> | null = null;

async function loadIndexRoster(): Promise<Record<string, FilmIndexSignals>> {
  const { data, error } = await db().rpc("film_index_signals_json");
  if (error) throw new Error(`film_index_signals_json: ${error.message}`);
  const rows = (data ?? []) as FilmIndexSignals[];
  const out: Record<string, FilmIndexSignals> = {};
  for (const r of rows) out[r.slug] = r;
  return out;
}

/** Cached signal roster (all films), keyed by slug. Sitemap builders read this
 *  directly; pages go through filmMainIndexable(). Revalidates hourly.
 *
 *  lastGoodRoster is recorded HERE, outside the unstable_cache callback: on a
 *  Data Cache hit the callback never runs, so assigning it inside loadIndexRoster
 *  left the safety net unarmed on any instance that had only ever served hits. */
export async function filmIndexRoster(): Promise<Record<string, FilmIndexSignals>> {
  const roster = await unstable_cache(loadIndexRoster, ["film-index-signals-1"], { revalidate: 3600 })();
  lastGoodRoster = roster;
  return roster;
}

/**
 * Whether a film's MAIN page is indexable under the consolidation gate.
 * Subpages gate on (await filmMainIndexable(slug, { visible })) && ownBar.
 *
 * `hint.visible === true` short-circuits WITHOUT touching the RPC: a visible film
 * is always Tier-1 (there are zero visible+unanalyzed films; visible ⇔ ≥3 approved
 * figures via the DB trigger), so it is indexable regardless of the roster — this
 * keeps a transient RPC error from de-indexing a live film's established subpages.
 *
 * ERROR POLICY (changed 2026-08-03). This used to `catch { return false }` — a
 * flaky RPC therefore stamped `noindex` into the ISR HTML of every caller without
 * a visible hint (Tier-2 mains, film lineage, film reception, film Q&A pages),
 * and that baked-in directive outlives the outage that caused it. An error is not
 * evidence that a page should leave the index. So: serve the last roster that
 * loaded cleanly; if there has never been one, rethrow and let the request 5xx.
 * Google retries a 5xx and keeps the URL; it acts on a noindex immediately.
 */
export async function filmMainIndexable(
  slug: string,
  hint?: { visible?: boolean | null },
): Promise<boolean> {
  if (slug.startsWith("tmdb-")) return false;
  if (hint?.visible) return SITE_INDEXABLE; // visible ⟹ Tier-1: never RPC-dependent
  let roster: Record<string, FilmIndexSignals>;
  try {
    roster = await filmIndexRoster();
  } catch (e) {
    if (!lastGoodRoster) throw e; // no safe answer exists — 5xx beats a wrong robots tag
    roster = lastGoodRoster;
  }
  const sig = roster[slug];
  return sig ? filmIndexBar(sig) : false;
}
