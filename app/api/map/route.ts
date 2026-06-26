import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/map                       → map_overview() (the opening hub cloud)
// GET /api/map?type=film&key=slug    → map_ego(type, key, key2)
//   figure uses key=filmSlug & key2=figureSlug.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const type = u.searchParams.get("type");
  const key = u.searchParams.get("key");
  const key2 = u.searchParams.get("key2");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  const { data, error } = type && key
    ? await db.rpc("map_ego", { p_type: type, p_key: key, p_key2: key2 })
    : await db.rpc("map_overview");

  if (error) return NextResponse.json({ error: error.message, nodes: [], links: [] }, { status: 500 });
  return NextResponse.json(data ?? { nodes: [], links: [] }, { headers: { "cache-control": "no-store" } });
}
