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

/* -------------------------------------------------------------------------
 * The page path caches the ANSWER, not the evidence.
 *
 * MEASURED (2026-08-04, pg_stat_statements): film_index_signals_json ran 4,405
 * times in a 20.5-hour window at 727 ms a call — 11.6% of all database time —
 * against a 1-hour revalidate that should have produced about 21. The cache was
 * not holding at all, on the critical path of the very film subpages that were
 * returning 504.
 *
 * INFERRED cause: the entry is too big to store. The RPC returns 1.86 MB of JSON
 * over 7,158 films, and the Record<slug, …> shape Next actually caches
 * re-serialises larger still (every slug appears twice, once as the key), which
 * puts it at or over Vercel's documented 2 MB per-entry Data Cache ceiling —
 * where the write is dropped silently.
 *
 * A page only ever needs one bit ("is this slug indexable"), so cache exactly
 * that: the passing slugs, newline-joined into one string. Measured the same
 * day: 3,148 slugs, 63 kB — 30x under the ceiling, with room to grow. The full
 * roster stays for the sitemap, which needs the raw counts and runs rarely.
 * ------------------------------------------------------------------------- */

/** Last slug set that loaded cleanly — same safety net as lastGoodRoster. */
let lastGoodSet: Set<string> | null = null;
/** Per-instance memo so the string is split into a Set once, not once per call. */
let setCache: { raw: string; set: Set<string> } | null = null;

async function loadIndexableSlugs(): Promise<string> {
  const roster = await loadIndexRoster();
  return Object.values(roster).filter(filmIndexBar).map((s) => s.slug).join("\n");
}

/* Per-instance memo, checked BEFORE the Data Cache.
 *
 * The docblock above blamed the 2 MB entry ceiling for the cache "not holding at
 * all", and shrinking the entry to 63 kB was necessary — but it was not the whole
 * story, because a small entry is still not READ when unstable_cache runs nested
 * inside another unstable_cache callback. That is this gate's hottest path:
 * components/read/ReadPlates.tsx caches per slug across ~38,000 URLs and calls
 * filmMainIndexable inside that callback. Tier-1 films short-circuit on the
 * `visible` hint, but Tier-2 — precisely the long tail crawlers walk — falls
 * through to the RPC on every single miss. That matches the measurement above:
 * 4,405 executions in 20.5 hours against a revalidate that should give 21.
 *
 * Holding the promise here short-circuits the nested call for the life of the
 * instance. Same pattern as lib/locations.ts and lib/lineage.ts.
 */
const SLUG_SET_TTL_MS = 60 * 60 * 1000;
let slugSetMemo: { at: number; value: Promise<Set<string>> } | null = null;

function indexableSlugSet(): Promise<Set<string>> {
  const now = Date.now();
  if (slugSetMemo && now - slugSetMemo.at < SLUG_SET_TTL_MS) return slugSetMemo.value;
  const value = (async () => {
    const raw = await unstable_cache(loadIndexableSlugs, ["film-indexable-slugs-1"], { revalidate: 3600 })();
    if (setCache?.raw !== raw) setCache = { raw, set: new Set(raw ? raw.split("\n") : []) };
    lastGoodSet = setCache.set;
    return setCache.set;
  })().catch((e) => {
    slugSetMemo = null; // never hold a failure for an hour
    throw e;
  });
  slugSetMemo = { at: now, value };
  return value;
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
  try {
    return (await indexableSlugSet()).has(slug);
  } catch (e) {
    // Fall back through both safety nets before giving up: either cache may be
    // the one this instance happens to have warmed.
    if (lastGoodSet) return lastGoodSet.has(slug);
    if (lastGoodRoster) {
      const sig = lastGoodRoster[slug];
      return sig ? filmIndexBar(sig) : false;
    }
    throw e; // no safe answer exists — 5xx beats a wrong robots tag
  }
}
