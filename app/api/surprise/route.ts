import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/surprise?kind=<one of 10>|any&mix=a,b,c → one random card payload.
// `mix` (comma-separated) narrows what "any" draws from (the user's chosen types).
export async function GET(req: Request) {
  const u = new URL(req.url);
  const kind = u.searchParams.get("kind") || "any";
  const mix = (u.searchParams.get("mix") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await db.rpc("surprise", { p_kind: kind, p_mix: mix.length ? mix : null });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? {}, { headers: { "cache-control": "no-store" } });
}
