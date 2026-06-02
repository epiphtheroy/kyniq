import { NextResponse } from "next/server";
import { searchTMDBMovies, posterUrl } from "@/lib/tmdb";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: "Query parameter 'q' must be at least 2 characters" },
      { status: 400 }
    );
  }

  try {
    const results = await searchTMDBMovies(query);

    // Enrich with full poster URLs for the client
    const enriched = results.map((r) => ({
      ...r,
      poster_url: posterUrl(r.poster_path, "w185"),
    }));

    return NextResponse.json(enriched);
  } catch (err) {
    console.error("Film search error:", err);
    return NextResponse.json(
      { error: "Failed to search films" },
      { status: 500 }
    );
  }
}
