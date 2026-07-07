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
 *  never swallow it into `?? []` (spec §4 Loading/Error). */
export async function loadRanged<T>(
  supabase: ServerClient,
  fn: string,
  args: Record<string, unknown> = {},
  maxRows = 20000,
): Promise<T[]> {
  const CHUNK = 1000;
  const rows: T[] = [];
  for (let i = 0; i * CHUNK < maxRows; i++) {
    const { data, error } = await supabase.rpc(fn, args).range(i * CHUNK, i * CHUNK + CHUNK - 1);
    if (error) throw new Error(`${fn}: ${error.message}`);
    const chunk = (data as T[] | null) ?? [];
    rows.push(...chunk);
    if (chunk.length < CHUNK) break;
  }
  return rows;
}

/** Full me_collection (every seen film). React-cached: Desk / Ledger / Holdings /
 *  Signature can all call this in one request and pay for one fetch. */
export const loadCollection = cache(async (): Promise<CollRow[]> => {
  const supabase = await createClient();
  return loadRanged<CollRow>(supabase, "me_collection");
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
