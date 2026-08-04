/**
 * /api/bots/blocklist — the live blocklist the edge middleware enforces.
 *
 * Returns { prefixes: string[], ua: string[] } from bot_blocks (active,
 * non-expired). Non-sensitive (CIDRs + UA tokens only).
 *
 * CDN-cached 5 minutes, and the middleware module-caches it for the same window
 * with a shared in-flight promise. Both numbers were 60s until 2026-08-03, when
 * this route turned out to be running ~5x/minute — ~7,700 database round-trips a
 * day for a table with two rows — and cost more than every AI surface combined.
 * The list it serves changes on the order of a day, so a minute bought nothing.
 *
 * stale-while-revalidate is deliberately NOT much longer than s-maxage: every
 * request landing in that window triggers a background revalidation, which is an
 * origin hit, which is the thing being reduced.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY = { prefixes: [], ua: [] };

export async function GET() {
  try {
    const { data } = await createAdminClient().rpc("bot_blocklist_json");
    return NextResponse.json(data ?? EMPTY, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch {
    // fail-open: an empty list means "block nothing", never break the site
    return NextResponse.json(EMPTY, {
      headers: { "Cache-Control": "public, s-maxage=30" },
    });
  }
}
