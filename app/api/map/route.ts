import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// The Map data. Three modes:
//   (default) critical web  — ?type=&key=&key2=  → map_ego / map_overview
//   films                   — ?mode=films&key=slug      → map_film_ego / map_film_overview
//   directors               — ?mode=directors&key=slug  → map_director_ego / map_director_overview
export async function GET(req: Request) {
  const u = new URL(req.url);
  const mode = u.searchParams.get("mode") || "critical";
  const key = u.searchParams.get("key");
  const key2 = u.searchParams.get("key2");
  const type = u.searchParams.get("type");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  let res;
  if (mode === "films") {
    res = key ? await db.rpc("map_film_ego", { p_slug: key }) : await db.rpc("map_film_overview");
  } else if (mode === "directors") {
    res = key ? await db.rpc("map_director_ego", { p_slug: key }) : await db.rpc("map_director_overview");
  } else {
    res = type && key
      ? await db.rpc("map_ego", { p_type: type, p_key: key, p_key2: key2 })
      : await db.rpc("map_overview");
  }

  if (res.error) return NextResponse.json({ error: res.error.message, nodes: [], links: [] }, { status: 500 });
  return NextResponse.json(res.data ?? { nodes: [], links: [] }, { headers: { "cache-control": "no-store" } });
}
