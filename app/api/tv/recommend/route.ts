import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

// GET /api/tv/recommend?v=program-slug&cap=10 — "watch next" broadcasts with
// reasons (shared figure/trope titles + same-director), via tv_recommend
// (film_affinities, the movies-like engine, filtered to published programs).
export async function GET(req: Request) {
  const u = new URL(req.url);
  const v = (u.searchParams.get("v") || "").trim();
  const cap = Math.min(Math.max(Number(u.searchParams.get("cap")) || 10, 1), 24);
  if (!v) return NextResponse.json({ recs: [] });
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await db.rpc("tv_recommend", { p_program: v, p_cap: cap });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { recs: [] }, {
    headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=1800" },
  });
}
