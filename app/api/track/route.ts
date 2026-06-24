import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lazy-import a TMDB film into a user's list. Creates a lightweight Tier-2 films row
// (visible=false, is_analyzed=false) on first track, then upserts user_movies.
export async function POST(req: NextRequest) {
  let body: { tmdb_id?: number; status?: string; rating?: number | null; remove?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const tmdb_id = Number(body.tmdb_id);
  const status = body.status;
  const remove = !!body.remove;
  if (!tmdb_id || (!remove && status !== "watched" && status !== "watchlist"))
    return NextResponse.json({ error: "bad params" }, { status: 400 });

  const ssr = await createServerClient();
  const { data: auth } = await ssr.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const TMDB = process.env.TMDB_READ_TOKEN!;
  const v4 = TMDB.length > 40;

  // resolve (or lazily create) the film row by tmdb_id
  let { data: film } = await admin.from("films").select("id, slug").eq("tmdb_id", tmdb_id).maybeSingle();
  if (!film) {
    const det = `https://api.themoviedb.org/3/movie/${tmdb_id}?append_to_response=credits${v4 ? "" : `&api_key=${TMDB}`}&language=en-US`;
    const r = await fetch(det, { headers: v4 ? { Authorization: `Bearer ${TMDB}`, accept: "application/json" } : { accept: "application/json" } });
    if (!r.ok) return NextResponse.json({ error: "tmdb" }, { status: 502 });
    const m = await r.json();
    const director = (m.credits?.crew || []).find((c: { job?: string }) => c.job === "Director")?.name || null;
    const row = {
      id: crypto.randomUUID(), tmdb_id, title: m.title || m.original_title || `TMDB ${tmdb_id}`,
      year: Number((m.release_date || "").slice(0, 4)) || null, poster_path: m.poster_path || null,
      director, slug: `tmdb-${tmdb_id}`, is_analyzed: false, visible: false,
    };
    const { error } = await admin.from("films").insert(row);
    if (error) {
      const re = await admin.from("films").select("id, slug").eq("tmdb_id", tmdb_id).maybeSingle();
      if (!re.data) return NextResponse.json({ error: "insert" }, { status: 500 });
      film = re.data;
    } else {
      film = { id: row.id, slug: row.slug };
    }
  }

  if (remove) {
    await admin.from("user_movies").delete().eq("user_id", user.id).eq("film_id", film.id);
  } else {
    await admin.from("user_movies").upsert(
      { user_id: user.id, film_id: film.id, status, rating: body.rating ?? null },
      { onConflict: "user_id,film_id" });
  }
  return NextResponse.json({ film_id: film.id, slug: film.slug });
}
