import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // headroom for a cold list/shelf build (cached after)

// GET /api/tv/watch              → shelves (playlists + all programs, light)
// GET /api/tv/watch?list=slug    → a playlist's full entries (film + segments/beats)
// GET /api/tv/watch?v=slug       → a single program's full entry
// GET /api/tv/watch?films=a,b,c  → entries for an ordered set of program slugs
//                                  (plays a user's personal list)
export async function GET(req: Request) {
  const u = new URL(req.url);
  const list = u.searchParams.get("list");
  const v = u.searchParams.get("v");
  const films = u.searchParams.get("films");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  if (films) {
    const slugs = films.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 60);
    const { data, error } = await db.rpc("tv_watch_films", { p_slugs: slugs, p_cap: 60 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? {}, {
      headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  }

  const { data, error } = await db.rpc("tv_watch", { p_list: list || null, p_program: v || null });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? {}, {
    headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
