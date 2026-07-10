/**
 * /api/search — the one search endpoint every surface talks to
 * (nav typeahead, ⌘K palette, /search page client refinements, map search).
 *
 * GET /api/search?q=…&limit=20&mode=hybrid|lex&kinds=film,director
 *   mode=lex skips the embedding leg (fast path for early keystrokes);
 *   default hybrid = lexical + semantic fused via RRF in lib/search.
 *
 * CDN-cacheable: identical queries within 5 min are served from the edge,
 * on top of lib/search's in-process 10-min cache.
 */
import { NextRequest, NextResponse } from "next/server";
import { runSearch, type SearchKind } from "@/lib/search";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const hits = new Map<string, number[]>();
const RATE_KEYS_MAX = 5000; // cap distinct-IP keys — XFF is client-influencable
function rateLimited(ip: string): boolean {
  const now = Date.now();
  if (!hits.has(ip) && hits.size >= RATE_KEYS_MAX) {
    for (const [k, arr] of hits) {
      if (!arr.length || now - arr[arr.length - 1] > 60_000) hits.delete(k);
      if (hits.size < RATE_KEYS_MAX) break;
    }
    if (hits.size >= RATE_KEYS_MAX) hits.clear(); // rotating-IP flood — reset
  }
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  // Generous: the two-stage typeahead sends 2 requests per settled keystroke,
  // and dev/office NATs can share one IP bucket.
  return arr.length > 240;
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const limit = Math.min(Math.max(parseInt(sp.get("limit") ?? "20", 10) || 20, 1), 120);
  const semantic = sp.get("mode") !== "lex";
  const kinds = (sp.get("kinds") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as SearchKind[];

  if (q.length < 2) {
    return NextResponse.json({ q, semantic: false, hits: [], took: 0 });
  }

  try {
    const result = await runSearch(q, { limit, semantic, kinds: kinds.length ? kinds : undefined });
    logSearch(req, q, result.hits?.length ?? 0, semantic);
    return NextResponse.json(result, {
      headers: { "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600" },
    });
  } catch {
    return NextResponse.json({ q, semantic: false, hits: [], took: 0, error: "search failed" }, { status: 500 });
  }
}
