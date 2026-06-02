import { NextResponse } from "next/server";
import { backfillFilm } from "@/lib/tmdb";

/**
 * POST /api/films/backfill
 * Backfills seed films with full TMDB data (poster, genres, keywords, external IDs).
 * Protected by a simple secret check — for admin/dev use only.
 */
export async function POST(request: Request) {
  // Simple secret guard for dev/admin use
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (secret !== process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 16)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The 5 seed film TMDB IDs (corrected)
  const seedTmdbIds = [1018, 62, 963, 1398, 491584];
  const results = [];

  for (const tmdbId of seedTmdbIds) {
    try {
      const film = await backfillFilm(tmdbId);
      results.push({
        tmdb_id: tmdbId,
        title: film.title,
        poster_path: film.poster_path,
        genres: film.genres,
        keywords: film.keywords?.slice(0, 5),
        imdb_id: film.imdb_id,
        wikidata_id: film.wikidata_id,
        status: "ok",
      });
    } catch (err) {
      results.push({
        tmdb_id: tmdbId,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ backfilled: results });
}
