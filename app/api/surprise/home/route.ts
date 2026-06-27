import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/surprise/home → one random home-hero surprise card.
// Modes: misreading (weighted ≥1/3), film_map, director_map, figure_links,
// watch_next, recommended_by, why_watch, where_to_start. Film-anchored only
// (no concept/idea).
export async function GET() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await db.rpc("surprise_home");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? {}, { headers: { "cache-control": "no-store" } });
}
