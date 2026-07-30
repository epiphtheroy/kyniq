import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAndLog, API_CORS, TOO_MANY } from "@/lib/apiGuard";

/**
 * Mobile BFF — production-country list for Tonight's country filter (owner
 * 07-30). Ordered by film count so the picker leads with the countries that
 * actually yield something, and each row carries its count.
 *
 * The counts come from film_country_counts() (migration 0117) because the
 * counted column lives in `curation.film`, which PostgREST does not expose.
 * Same population the filter selects: cinecodex_ranked's p_country compares
 * against that very column, so the number beside a country is what choosing it
 * will draw from — before the viewer's own services/era/mood narrow it further.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: API_CORS });
}

export async function GET(req: Request) {
  const db = createAdminClient();
  if (await guardAndLog(db, req, "app_countries", null)) {
    return NextResponse.json(TOO_MANY, { status: 429, headers: API_CORS });
  }

  try {
    const { data, error } = await db.rpc("film_country_counts");
    if (error) throw error;
    const rows = ((data ?? []) as { country_code: string; film_count: number }[])
      .filter((r) => r.country_code && r.film_count > 0)
      .map((r) => ({ code: r.country_code.toLowerCase(), count: r.film_count }));
    return NextResponse.json(
      { v: 1, countries: rows },
      {
        headers: {
          ...API_CORS,
          // The catalogue moves in days, not minutes.
          "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      },
    );
  } catch (e) {
    console.error("[app_countries]", e);
    // Fail soft: an empty list simply hides the filter rather than breaking Tonight.
    return NextResponse.json({ v: 1, countries: [] }, { headers: API_CORS });
  }
}
