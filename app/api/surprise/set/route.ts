import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/surprise/set?kind=&n=30 → array of N light cards for the wall.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const kind = u.searchParams.get("kind") || "any";
  const n = Math.min(60, Math.max(1, Number(u.searchParams.get("n") || 30)));
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await db.rpc("surprise_set", { p_kind: kind, p_n: n });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? [], { headers: { "cache-control": "no-store" } });
}
