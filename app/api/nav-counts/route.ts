import { NextResponse } from "next/server";
import { getNavCounts } from "@/lib/navCounts";

/**
 * Nav counts for client-rendered pages (chat / ask / rag), which cannot call the
 * server helper directly.
 *
 * Before this route those pages called nav_counts() straight from each
 * visitor's browser with the anon key — one database round trip per page view,
 * for numbers that change on the order of days. Now the browser hits a CDN
 * response and the database sees at most one call an hour.
 */
export const runtime = "nodejs";

export async function GET() {
  try {
    const counts = await getNavCounts();
    return NextResponse.json(counts, {
      headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch {
    // The nav degrades to arrows without numbers — never a reason to error a page.
    return NextResponse.json({}, { headers: { "cache-control": "public, s-maxage=60" } });
  }
}
