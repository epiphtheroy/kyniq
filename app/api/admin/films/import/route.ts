import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/admin/films/import
 *
 * Accepts a CSV/text body of films to import into the pipeline.
 * Each line: tmdb_id, title, director (comma-separated)
 *
 * 1. Validates each row
 * 2. Resolves to TMDB if tmdb_id provided, or searches by title+year
 * 3. Upserts into `films` with in_pipeline=true, pipeline_status='queued'
 * 4. Returns summary of imported/skipped/errors
 */

interface ImportRow {
  tmdb_id?: number;
  title: string;
  director?: string;
  year?: number;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ line: number; text: string; reason: string }>;
  films: Array<{ tmdb_id: number; title: string; status: string }>;
}

const TMDB_BASE = "https://api.themoviedb.org/3";

async function tmdbFetch(path: string): Promise<Record<string, unknown> | null> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) throw new Error("Missing TMDB_READ_TOKEN");

  const separator = path.includes("?") ? "&" : "?";
  const res = await fetch(`${TMDB_BASE}${path}${separator}api_key=${token}`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) return null;
  return res.json() as Promise<Record<string, unknown>>;
}

async function resolveByTmdbId(tmdbId: number): Promise<Record<string, unknown> | null> {
  return tmdbFetch(`/movie/${tmdbId}?append_to_response=credits`);
}

async function searchByTitle(title: string, year?: number): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams({ query: title, include_adult: "false" });
  if (year) params.set("year", String(year));

  const result = await tmdbFetch(`/search/movie?${params.toString()}`);
  if (!result) return null;

  const results = result.results as Array<Record<string, unknown>>;
  if (!results || results.length === 0) return null;

  // Get full details for the first match
  const topMatch = results[0];
  return resolveByTmdbId(topMatch.id as number);
}

function extractDirector(movie: Record<string, unknown>): string {
  const credits = movie.credits as { crew?: Array<{ job: string; name: string }> } | undefined;
  if (!credits?.crew) return "";
  const director = credits.crew.find((c) => c.job === "Director");
  return director?.name ?? "";
}

import { slugify } from "@/lib/slug";

function parseCsvBody(body: string): ImportRow[] {
  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && !l.toLowerCase().startsWith("tmdb"));

  return lines.map((line) => {
    const parts = line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));

    // Try to detect format: tmdb_id, title, director OR title, year, director
    const first = parts[0];
    const tmdbId = /^\d+$/.test(first) ? parseInt(first) : undefined;

    if (tmdbId) {
      // Format: tmdb_id, title, director
      return {
        tmdb_id: tmdbId,
        title: parts[1] ?? "",
        director: parts[2] ?? "",
      };
    } else {
      // Format: title, year, director (or title, director)
      const second = parts[1] ?? "";
      const year = /^\d{4}$/.test(second) ? parseInt(second) : undefined;
      return {
        title: first,
        year,
        director: year ? parts[2] ?? "" : second,
      };
    }
  });
}

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  let csvText: string;

  if (contentType.includes("multipart/form-data") || contentType.includes("form")) {
    const formData = await request.formData();
    const file = formData.get("csv_file") as File | null;
    const textArea = formData.get("csv_text") as string | null;

    if (file && file.size > 0) {
      csvText = await file.text();
    } else if (textArea) {
      csvText = textArea;
    } else {
      return NextResponse.json({ error: "No CSV data provided" }, { status: 400 });
    }
  } else {
    csvText = await request.text();
  }

  const rows = parseCsvBody(csvText);

  if (rows.length === 0) {
    return NextResponse.json({ error: "No valid rows found in CSV" }, { status: 400 });
  }

  if (rows.length > 1500) {
    return NextResponse.json({ error: "Maximum 1500 films per upload" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const result: ImportResult = { imported: 0, skipped: 0, errors: [], films: [] };

  // Process in batches of 5 to avoid rate limits
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    try {
      // Resolve via TMDB
      let movie: Record<string, unknown> | null = null;

      if (row.tmdb_id) {
        movie = await resolveByTmdbId(row.tmdb_id);
      }

      if (!movie && row.title) {
        movie = await searchByTitle(row.title, row.year);
      }

      if (!movie) {
        result.errors.push({
          line: i + 1,
          text: row.title || String(row.tmdb_id),
          reason: "Could not resolve on TMDB",
        });
        continue;
      }

      const tmdbId = movie.id as number;
      const title = (movie.title as string) ?? row.title;
      const originalTitle = (movie.original_title as string) ?? title;
      const releaseDate = movie.release_date as string | undefined;
      const year = releaseDate ? parseInt(releaseDate.slice(0, 4)) : row.year;
      const director = extractDirector(movie);
      const directorSlug = director ? slugify(director) : null;
      const posterPath = movie.poster_path as string | null;
      const overview = movie.overview as string | null;
      const genres = ((movie.genres as Array<{ name: string }>) ?? []).map((g) => g.name);
      const slug = `${slugify(title)}-${year ?? "unknown"}`;

      // Upsert into films
      const { error: upsertErr } = await supabase
        .from("films")
        .upsert(
          {
            tmdb_id: tmdbId,
            title,
            original_title: originalTitle,
            year,
            director,
            director_slug: directorSlug,
            poster_path: posterPath,
            overview,
            genres,
            slug,
            in_pipeline: true,
            pipeline_status: "queued",
            questions_target: 10,
          },
          { onConflict: "tmdb_id" }
        );

      if (upsertErr) {
        // Try with unique slug
        const { error: retryErr } = await supabase
          .from("films")
          .upsert(
            {
              tmdb_id: tmdbId,
              title,
              original_title: originalTitle,
              year,
              director,
              director_slug: directorSlug,
              poster_path: posterPath,
              overview,
              genres,
              slug: `${slug}-${tmdbId}`,
              in_pipeline: true,
              pipeline_status: "queued",
              questions_target: 10,
            },
            { onConflict: "tmdb_id" }
          );

        if (retryErr) {
          result.errors.push({
            line: i + 1,
            text: title,
            reason: retryErr.message,
          });
          continue;
        }
      }

      result.imported++;
      result.films.push({ tmdb_id: tmdbId, title, status: "imported" });

      // Rate limit: pause every 5 rows (TMDB allows ~40 req/10s)
      if ((i + 1) % 5 === 0) {
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (err) {
      result.errors.push({
        line: i + 1,
        text: row.title || String(row.tmdb_id),
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  result.skipped = rows.length - result.imported - result.errors.length;

  // Redirect for form submissions
  const referer = request.headers.get("referer");
  if (referer && contentType.includes("form")) {
    const url = new URL(referer);
    url.searchParams.set("imported", String(result.imported));
    url.searchParams.set("errors", String(result.errors.length));
    return NextResponse.redirect(url.toString(), 303);
  }

  return NextResponse.json(result);
}
