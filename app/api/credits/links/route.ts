import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * Bridges the client-side Credits explorer (TMDB ids/names) to Metatake's own
 * pages: ?film=<tmdbId> → catalog film + director slugs; ?person=<name> →
 * director slug. Edge-cached; misses return nulls (film not in catalog).
 */
export async function GET(req: NextRequest) {
  const filmId = req.nextUrl.searchParams.get("film");
  const person = (req.nextUrl.searchParams.get("person") || "").trim().slice(0, 120);
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const out: { filmSlug: string | null; filmTitle: string | null; directorSlug: string | null; directorName: string | null } = {
    filmSlug: null, filmTitle: null, directorSlug: null, directorName: null,
  };

  if (filmId && /^\d+$/.test(filmId)) {
    const { data } = await supabase
      .from("films")
      .select("slug, title, director, director_slug")
      .eq("tmdb_id", Number(filmId))
      .eq("visible", true)
      .maybeSingle();
    if (data) {
      out.filmSlug = data.slug;
      out.filmTitle = data.title;
      out.directorSlug = data.director_slug;
      out.directorName = data.director;
    }
  } else if (person) {
    const { data } = await supabase
      .from("films")
      .select("director, director_slug")
      .ilike("director", person)
      .eq("visible", true)
      .not("director_slug", "is", null)
      .limit(1);
    if (data?.length) {
      out.directorSlug = data[0].director_slug;
      out.directorName = data[0].director;
    }
  } else {
    return NextResponse.json({ error: "pass ?film=<tmdbId> or ?person=<name>" }, { status: 400 });
  }

  return NextResponse.json(out, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
