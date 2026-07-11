import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// GET /api/tv/reel?slugs=a,b,c&cap=12 — one clean trailer per film for the
// entity-hero fallback (when an entity has no compiled broadcast playlist).
export async function GET(req: Request) {
  const u = new URL(req.url);
  const slugs = (u.searchParams.get("slugs") || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 60);
  const cap = Math.min(Math.max(Number(u.searchParams.get("cap")) || 12, 1), 20);
  if (!slugs.length) return NextResponse.json({ reel: [] });
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await db.rpc("tv_reel", { p_slugs: slugs, p_cap: cap });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reel: data ?? [] }, {
    headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
