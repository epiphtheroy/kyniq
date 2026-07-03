import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveNative } from "@/lib/nativeName";

export const runtime = "nodejs";

/**
 * Bridges the client-side Credits explorer (TMDB ids/names) to Metatake's own
 * pages: ?film=<tmdbId> → catalog film + director slugs; ?person=<name> →
 * director slug. Edge-cached; misses return nulls (film not in catalog).
 */
export async function GET(req: NextRequest) {
  const filmId = req.nextUrl.searchParams.get("film");
  const person = (req.nextUrl.searchParams.get("person") || "").trim().slice(0, 120);
  const nativeFor = req.nextUrl.searchParams.get("native");
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const out: { filmSlug: string | null; filmTitle: string | null; directorSlug: string | null; directorName: string | null; native: string | null } = {
    filmSlug: null, filmTitle: null, directorSlug: null, directorName: null, native: null,
  };

  if (nativeFor && /^\d+$/.test(nativeFor)) {
    // Native-script name for a TMDB person — same resolution the server pages
    // use (expected-script alias → Wikidata label), exposed for the explorer.
    const token = process.env.TMDB_READ_TOKEN;
    if (token) {
      const v4 = token.length > 40;
      const r = await fetch(`https://api.themoviedb.org/3/person/${nativeFor}${v4 ? "" : `?api_key=${token}`}`, {
        headers: v4 ? { Authorization: `Bearer ${token}`, accept: "application/json" } : { accept: "application/json" },
        next: { revalidate: 604800 },
      }).catch(() => null);
      if (r?.ok) {
        const p = (await r.json()) as { name: string; also_known_as?: string[]; place_of_birth?: string | null };
        out.native = await resolveNative({ tmdbId: Number(nativeFor), name: p.name, aliases: p.also_known_as, place: p.place_of_birth });
      }
    }
  } else if (filmId && /^\d+$/.test(filmId)) {
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
