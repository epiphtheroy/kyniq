import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/reel?n=5 → N films for the 30-second reel prototype:
// { title, year, director, slug, backdrop, line, framework, leap }.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const n = Math.min(8, Math.max(1, Number(u.searchParams.get("n") || 5)));
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await db.rpc("reel_cards", { p_n: n });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? [], { headers: { "cache-control": "no-store" } });
}
