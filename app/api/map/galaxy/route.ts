import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Galaxy payload: every visible film's precomputed 2D taste coordinate + cluster
// labels (worker/galaxy-build.py). Single jsonb RPC — PostgREST 1000-row cap bypass.
// Coordinates change only when the map is rebuilt, so cache hard at the edge.
export const revalidate = 3600;

export async function GET() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await db.rpc("galaxy_json");
  if (error) return NextResponse.json({ points: [], clusters: [] }, { status: 500 });
  return NextResponse.json(data ?? { points: [], clusters: [] }, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
