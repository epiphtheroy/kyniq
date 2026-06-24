import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Live TMDB search for the "add a film to my list" picker. Token stays server-side.
// Flags which results already exist in our DB (Tier-1 analyzed → link to rich page).
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });
  const TMDB = process.env.TMDB_READ_TOKEN;
  if (!TMDB) return NextResponse.json({ results: [] });

  const v4 = TMDB.length > 40;
  const params = new URLSearchParams({ query: q, include_adult: "false", language: "en-US", page: "1" });
  if (!v4) params.set("api_key", TMDB);
  const url = `https://api.themoviedb.org/3/search/movie?${params.toString()}`;
  let arr: Array<{ tmdb_id: number; title: string; year: string; poster_path: string | null; in_db?: boolean; slug?: string | null; is_analyzed?: boolean }> = [];
  try {
    const r = await fetch(url, { headers: v4 ? { Authorization: `Bearer ${TMDB}`, accept: "application/json" } : { accept: "application/json" } });
    if (r.ok) {
      const d = await r.json();
      arr = (d.results || [])
        .filter((m: { title?: string }) => m.title)
        .slice(0, 10)
        .map((m: { id: number; title: string; release_date?: string; poster_path: string | null }) => ({
          tmdb_id: m.id, title: m.title, year: (m.release_date || "").slice(0, 4), poster_path: m.poster_path,
        }));
    }
  } catch { /* return what we have */ }

  if (arr.length) {
    try {
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const { data: rows } = await sb.from("films").select("tmdb_id, slug, is_analyzed").in("tmdb_id", arr.map((a) => a.tmdb_id));
      const m = new Map((rows || []).map((x: { tmdb_id: number; slug: string | null; is_analyzed: boolean }) => [x.tmdb_id, x]));
      arr = arr.map((a) => { const f = m.get(a.tmdb_id); return { ...a, in_db: !!f, slug: f?.slug ?? null, is_analyzed: f?.is_analyzed ?? false }; });
    } catch { /* flags optional */ }
  }
  return NextResponse.json({ results: arr });
}
