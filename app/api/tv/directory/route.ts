import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

type ProgRow = {
  slug: string; title: string; dek: string | null; seg_count: number | null; duration_ms: number | null;
  films: { title: string | null; year: number | null; backdrop_path: string | null } | null;
};

// GET /api/tv/directory?axis=&q=&offset=&limit= — a page of watch lists for the
// /tv browse UI plus the per-axis summary (counts) for the filter tabs. When a
// search query is present the response also carries `videos`: individual film
// broadcasts whose title matches, so the search covers programs as well as lists.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const axis = u.searchParams.get("axis") || null;
  const q = (u.searchParams.get("q") || "").trim() || null;
  const offset = Math.max(0, Number(u.searchParams.get("offset")) || 0);
  const limit = Math.min(Math.max(Number(u.searchParams.get("limit")) || 48, 1), 120);
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const [dir, sum, vids] = await Promise.all([
    db.rpc("tv_directory", { p_axis: axis, p_q: q, p_limit: limit, p_offset: offset }),
    db.rpc("tv_directory_summary"),
    q && offset === 0
      ? db.from("tv_programs")
          .select("slug,title,dek,seg_count,duration_ms,films!inner(title,year,backdrop_path)")
          .eq("status", "published")
          .ilike("title", `%${q.replaceAll("%", "").replaceAll(",", " ")}%`)
          .limit(24)
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (dir.error) return NextResponse.json({ error: dir.error.message }, { status: 500 });
  const data = (dir.data as { total?: number; lists?: unknown[] } | null) ?? {};
  const videos = ((vids.data as unknown as ProgRow[] | null) ?? []).map((p) => ({
    slug: p.slug, title: p.title, dek: p.dek, seg_count: p.seg_count, duration_ms: p.duration_ms,
    film: p.films ? { title: p.films.title, year: p.films.year, backdrop: p.films.backdrop_path } : null,
  }));
  return NextResponse.json(
    { total: data.total ?? 0, lists: data.lists ?? [], videos, summary: sum.data ?? [] },
    { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=1800" } },
  );
}
