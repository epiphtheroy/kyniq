/**
 * GET /api/v1/locations?film=&country=&limit=  — filming-location geodata
 * (name, role, layer, country, lat, lng, precision) for a film or country.
 *
 * This is the OPEN geodata channel (owner decision 2026-07-13): the filming-
 * location coordinates — a dataset that does not exist elsewhere — are published
 * openly (CC BY-NC 4.0, attribution required) as a discovery/citation asset, not
 * hoarded as a paid edge. The PACK product stays coordinate-free; coordinates
 * leave only here and in the open dataset export. See the AI-visibility handoff.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAndLog, API_CORS, TOO_MANY } from "@/lib/apiGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: API_CORS });
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const film = (u.searchParams.get("film") || "").trim().slice(0, 200) || null;
  const country = (u.searchParams.get("country") || "").trim().slice(0, 80) || null;
  const limit = Math.min(Math.max(Number(u.searchParams.get("limit")) || 50, 1), 200);

  if (!film && !country) {
    return NextResponse.json(
      { error: "Give ?film=<slug> or ?country=<name>. For the whole dataset (CC BY), see https://metatake.net/data." },
      { status: 400, headers: API_CORS }
    );
  }

  const db = createAdminClient();
  if (await guardAndLog(db, req, "locations", film ?? country)) {
    return NextResponse.json(TOO_MANY, { status: 429, headers: API_CORS });
  }

  const { data, error } = await db.rpc("api_locations_json", { p_film: film, p_country: country, p_limit: limit });
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: API_CORS });

  const payload = (data ?? { count: 0, locations: [] }) as { count: number; locations: unknown[] };
  return NextResponse.json(
    {
      ...(film ? { film } : {}),
      ...(country ? { country } : {}),
      count: payload.count,
      limit,
      locations: payload.locations,
      license: "CC BY 4.0 (attribution required)",
      note: "Filming-location geodata by Metatake (metatake.net), CC BY 4.0 — free to reuse (incl. commercially) with attribution. (Metatake's written criticism elsewhere is CC BY-NC.) Full open dataset: https://metatake.net/data.",
    },
    { headers: { ...API_CORS, "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800" } }
  );
}
