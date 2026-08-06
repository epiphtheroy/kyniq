import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

/**
 * Which films have a published Metatake TV broadcast.
 *
 * This used to be a per-film `tv_programs` probe run on every render of every
 * film read surface — ReadHero's watch pill (one uncached round trip, awaited
 * alone so it blocked the hero) and ReadPlates' TV gate, asking the identical
 * question twice on the same page. Per-film is the wrong shape here: the URL
 * space is ~38,000 and a crawler sweep never repeats a slug, so a per-slug cache
 * can never get the second visit it needs to pay off. Every swept page paid the
 * round trip.
 *
 * There are only 1,794 published broadcasts, so the whole answer fits in ONE
 * global entry (~35 kB newline-joined, far under Vercel's 2 MB per-entry Data
 * Cache ceiling) and each page becomes a set membership test. Same shape, and
 * the same reasoning, as the indexable-slug set in lib/filmGate.ts.
 */

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const PAGE = 1000; // PostgREST caps every response at 1,000 rows

async function loadBroadcastSlugs(): Promise<string> {
  const out: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db()
      .from("tv_programs")
      .select("slug")
      .eq("status", "published")
      .order("slug")
      .range(from, from + PAGE - 1);
    if (error) throw error; // a timeout must never be cached as "no broadcasts"
    const rows = (data ?? []) as { slug: string }[];
    out.push(...rows.map((r) => r.slug));
    if (rows.length < PAGE) break;
  }
  return out.join("\n");
}

const TTL_MS = 60 * 60 * 1000;
let memo: { at: number; value: Promise<Set<string>> } | null = null;
let parsed: { raw: string; set: Set<string> } | null = null;

/**
 * The slug set, per-instance memo checked BEFORE the Data Cache.
 *
 * The memo is not an optimisation, it is the point: these callers run inside
 * other unstable_cache callbacks (ReadPlates caches per slug), and Next
 * deliberately bypasses a nested unstable_cache read — see the
 * `isNestedUnstableCache` branch in next/dist/server/web/spec-extension/
 * unstable-cache.js. Same guard as lib/lineage.ts and lib/locations.ts.
 */
export function publishedBroadcastSlugs(): Promise<Set<string>> {
  const now = Date.now();
  if (memo && now - memo.at < TTL_MS) return memo.value;
  const value = (async () => {
    const raw = await unstable_cache(loadBroadcastSlugs, ["tv-broadcast-slugs-1"], { revalidate: 3600 })();
    if (parsed?.raw !== raw) parsed = { raw, set: new Set(raw ? raw.split("\n") : []) };
    return parsed.set;
  })().catch((e) => {
    memo = null; // never hold a failure for an hour
    throw e;
  });
  memo = { at: now, value };
  return value;
}

/** Decorative gate: a failure must neither remove the watch link loudly nor
 *  take the page down. Absent link on error is the old behaviour, preserved. */
export function hasBroadcast(slug: string): Promise<boolean> {
  return publishedBroadcastSlugs().then((s) => s.has(slug)).catch(() => false);
}
