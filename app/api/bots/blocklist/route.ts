/**
 * /api/bots/blocklist — the live blocklist the edge middleware enforces.
 *
 * Returns { prefixes: string[], ua: string[] } from bot_blocks (active,
 * non-expired). Non-sensitive (CIDRs + UA tokens only). CDN-cached 60s and the
 * middleware also module-caches it, so this is hit at most ~once/minute/region.
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
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch {
    // fail-open: an empty list means "block nothing", never break the site
    return NextResponse.json(EMPTY, {
      headers: { "Cache-Control": "public, s-maxage=30" },
    });
  }
}
