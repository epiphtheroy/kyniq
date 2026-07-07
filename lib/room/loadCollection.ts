/** My Room v3 — shared server-side paged loaders (SERVER ONLY).
 *  PostgREST truncates every response — RPCs included — at 1000 rows (project
 *  invariant), so any big-list RPC must be pulled through a .range() chunk loop.
 *  This module is the enforceable form of that rule (spec §1 invariant 6).
 *
 *  Client components: import ONLY types (they live in lib/room/format.ts) —
 *  importing this module client-side pulls in next/headers and will not build. */
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { CollRow, WwiRow } from "@/lib/room/format";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Pull an RPC's full result through .range() chunks (1000/page, hard stop at maxRows).
 *  Throws on RPC error — surface it as the shared "Couldn't load — retry" card,
 *  never swallow it into `?? []` (spec §4 Loading/Error).
 *  keyOf (natural key) dedupes rows that straddle a chunk boundary — each chunk
 *  re-executes the RPC, so ties in its ORDER BY can re-order between requests
 *  (0043 adds deterministic tiebreakers; this guard covers races on top). */
export async function loadRanged<T>(
  supabase: ServerClient,
  fn: string,
  args: Record<string, unknown> = {},
  maxRows = 20000,
  keyOf?: (row: T) => string,
): Promise<T[]> {
  const CHUNK = 1000;
  const rows: T[] = [];
  const seen = new Set<string>();
  for (let i = 0; i * CHUNK < maxRows; i++) {
    const { data, error } = await supabase.rpc(fn, args).range(i * CHUNK, i * CHUNK + CHUNK - 1);
    if (error) throw new Error(`${fn}: ${error.message}`);
    const chunk = (data as T[] | null) ?? [];
    for (const row of chunk) {
      const k = keyOf?.(row);
      if (k !== undefined) { if (seen.has(k)) continue; seen.add(k); }
      rows.push(row);
    }
    if (chunk.length < CHUNK) break; // raw chunk length — dedupe must not terminate the loop early
  }
  return rows;
}

/** Full me_collection (every seen film). React-cached: Desk / Ledger / Holdings /
 *  Signature can all call this in one request and pay for one fetch. */
export const loadCollection = cache(async (): Promise<CollRow[]> => {
  const supabase = await createClient();
  return loadRanged<CollRow>(supabase, "me_collection", {}, 20000, (r) => r.slug);
});

/** me_recommend_wwi, deduped per request (Desk + Screener + Performance share one
 *  call when λ/limit match — spec §4 SessionStore note). Client-side λ re-dials go
 *  through the SessionStore cache instead, never this. */
export const loadWwi = cache(async (lambda = 1.0, limit = 24): Promise<WwiRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("me_recommend_wwi", { p_lambda: lambda, p_limit: limit });
  if (error) throw new Error(`me_recommend_wwi: ${error.message}`);
  return (data as WwiRow[] | null) ?? [];
});
