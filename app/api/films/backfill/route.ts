import { NextResponse } from "next/server";
import { upsertFilm } from "@/lib/tmdb";

/**
 * POST /api/films/backfill
 * Upserts a single film by TMDB ID.
 * Called from the ask flow when a user selects a film from search results.
 * Uses the service-role admin client internally (upsertFilm).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tmdbId = body.tmdb_id;

    if (!tmdbId || typeof tmdbId !== "number") {
      return NextResponse.json(
        { error: "tmdb_id (number) is required" },
        { status: 400 }
      );
    }

    const film = await upsertFilm(tmdbId);
    return NextResponse.json({ data: film });
  } catch (err) {
    console.error("Film backfill error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backfill failed" },
      { status: 500 }
    );
  }
}
