/**
 * /api/search/omni — the full /search result payload for one query.
 *
 * Exists because the /search results moved to a browser fetch on 2026-08-04 (the
 * reasoning lives in app/search/OmniResults.tsx). This is the same
 * loadOmniPayload the page used to call during SSR, so results are identical —
 * engine hits, KWIC excerpts, entity card, poster strip, related searches.
 *
 * Distinct from /api/search, which returns bare SearchHits for the nav typeahead
 * and the ⌘K palette. That one must stay lean; this one is the whole page.
 *
 * Cached at the edge for 5 minutes on top of loadOmniPayload's own 1-hour Data
 * Cache entry, so a term that two people (or two sweep passes) ask for inside
 * the window costs nothing at the origin.
 */
import { NextRequest, NextResponse } from "next/server";
import { loadOmniPayload } from "@/app/search/payload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const term = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);

  if (term.length < 2) {
    return NextResponse.json(
      { hits: [], semantic: false, took: 0, card: null, cardKey: null, strip: [], related: [] },
      { headers: { "cache-control": "public, max-age=60, s-maxage=300" } },
    );
  }

  try {
    const payload = await loadOmniPayload(term);
    return NextResponse.json(payload, {
      headers: { "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600" },
    });
  } catch {
    // The client renders its own error state — do not cache a failure.
    return NextResponse.json({ error: "search failed" }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
