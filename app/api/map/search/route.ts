import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/map/search?q= → fuzzy results across films, directors, tropes, ideas,
// theorists, figures. Each row: {type, key, key2, label, sub, score}.
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json([], { headers: { "cache-control": "no-store" } });
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await db.rpc("map_search", { p_q: q, p_n: 10 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? [], { headers: { "cache-control": "no-store" } });
}
