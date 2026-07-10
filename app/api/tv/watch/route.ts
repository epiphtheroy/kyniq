import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/tv/watch            → shelves (playlists + all programs, light)
// GET /api/tv/watch?list=slug  → a playlist's full entries (film + segments/beats)
// GET /api/tv/watch?v=slug     → a single program's full entry
export async function GET(req: Request) {
  const u = new URL(req.url);
  const list = u.searchParams.get("list");
  const v = u.searchParams.get("v");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await db.rpc("tv_watch", { p_list: list || null, p_program: v || null });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? {}, {
    headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
