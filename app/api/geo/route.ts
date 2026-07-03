import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/geo?film=slug | ?director=slug | ?mode=overview (1 pin/film)
//   | ?bbox=w,s,e,n (viewport detail) | (none → full dump, kept as fallback)
// Returns located pins (lat/lng present) for the geographic Atlas.
// All jsonb-aggregating RPCs return one row, so PostgREST's 1000-row cap can't truncate them.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const film = u.searchParams.get("film");
  const director = u.searchParams.get("director");
  const bbox = u.searchParams.get("bbox");
  const mode = u.searchParams.get("mode");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  let rows: unknown = [];
  if (film) rows = (await db.rpc("film_geo", { p_slug: film })).data;
  else if (director) rows = (await db.rpc("director_geo", { p_slug: director })).data;
  else if (bbox) {
    const [w, s, e, n] = bbox.split(",").map(Number);
    if ([w, s, e, n].every(Number.isFinite)) rows = (await db.rpc("geo_bbox_json", { p_w: w, p_s: s, p_e: e, p_n: n, p_limit: 4000 })).data;
  } else if (mode === "overview") {
    rows = (await db.rpc("geo_overview_sample_json")).data;
  } else {
    rows = (await db.rpc("geo_overview_json", { p_limit: 20000 })).data;
    if (!Array.isArray(rows)) rows = (await db.rpc("geo_overview", { p_limit: 5000 })).data; // fallback
  }
  return NextResponse.json(rows ?? [], { headers: { "cache-control": "public, max-age=300, s-maxage=600, stale-while-revalidate=3600" } });
}
