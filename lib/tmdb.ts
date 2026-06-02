/* Server-only module — do not import in client components */

import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/** Anon client for public reads — safe during build and SSR */
function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ── Types ──────────────────────────────────────────────────────────

interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  release_date: string;
  overview: string;
  poster_path: string | null;
  genre_ids?: number[];
}

interface TMDBMovieDetail {
  id: number;
  title: string;
  original_title: string;
  release_date: string;
  overview: string;
  poster_path: string | null;
  genres: { id: number; name: string }[];
}

interface TMDBCredits {
  crew: { job: string; name: string }[];
}

interface TMDBKeywords {
  keywords: { id: number; name: string }[];
}

interface TMDBExternalIds {
  imdb_id: string | null;
  wikidata_id: string | null;
}

export interface TMDBSearchResult {
  tmdb_id: number;
  title: string;
  original_title: string;
  year: number | null;
  poster_path: string | null;
  overview: string;
}

export interface FilmRow {
  id: string;
  tmdb_id: number;
  title: string;
  original_title: string | null;
  year: number | null;
  director: string | null;
  director_slug: string | null;
  poster_path: string | null;
  overview: string | null;
  slug: string;
  genres: string[];
  keywords: string[];
  imdb_id: string | null;
  wikidata_id: string | null;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────

const TMDB_BASE = "https://api.themoviedb.org/3";

function tmdbKey(): string {
  const key = process.env.TMDB_READ_TOKEN;
  if (!key) throw new Error("TMDB_READ_TOKEN is not set");
  return key;
}

async function tmdbGet<T>(path: string): Promise<T> {
  const url = `${TMDB_BASE}${path}${path.includes("?") ? "&" : "?"}api_key=${tmdbKey()}`;
  const res = await fetch(url, { next: { revalidate: 86400 } }); // cache 24h
  if (!res.ok) throw new Error(`TMDB ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function filmSlug(title: string, year: number): string {
  return `${slugify(title)}-${year}`;
}

export function posterUrl(
  posterPath: string | null,
  size: "w185" | "w342" | "w500" | "original" = "w500"
): string | null {
  if (!posterPath) return null;
  return `https://image.tmdb.org/t/p/${size}${posterPath}`;
}

// ── TMDB API calls ─────────────────────────────────────────────────

export async function searchTMDBMovies(
  query: string
): Promise<TMDBSearchResult[]> {
  const data = await tmdbGet<{ results: TMDBMovie[] }>(
    `/search/movie?query=${encodeURIComponent(query)}&include_adult=false`
  );
  return data.results.slice(0, 10).map((m) => ({
    tmdb_id: m.id,
    title: m.title,
    original_title: m.original_title,
    year: m.release_date ? parseInt(m.release_date.slice(0, 4), 10) : null,
    poster_path: m.poster_path,
    overview: m.overview,
  }));
}

/**
 * Fetch full film data from TMDB (movie detail + credits + keywords + external IDs).
 * Returns a normalized object ready for DB upsert.
 */
export async function fetchFilmFromTMDB(tmdbId: number) {
  const [detail, credits, keywords, externalIds] = await Promise.all([
    tmdbGet<TMDBMovieDetail>(`/movie/${tmdbId}`),
    tmdbGet<TMDBCredits>(`/movie/${tmdbId}/credits`),
    tmdbGet<TMDBKeywords>(`/movie/${tmdbId}/keywords`),
    tmdbGet<TMDBExternalIds>(`/movie/${tmdbId}/external_ids`),
  ]);

  const director =
    credits.crew.find((c) => c.job === "Director")?.name ?? null;
  const year = detail.release_date
    ? parseInt(detail.release_date.slice(0, 4), 10)
    : null;

  return {
    tmdb_id: tmdbId,
    title: detail.title,
    original_title: detail.original_title,
    year,
    director,
    director_slug: director ? slugify(director) : null,
    poster_path: detail.poster_path,
    overview: detail.overview,
    slug: filmSlug(detail.title, year ?? 0),
    genres: detail.genres.map((g) => g.name),
    keywords: keywords.keywords.map((k) => k.name),
    imdb_id: externalIds.imdb_id ?? null,
    wikidata_id: externalIds.wikidata_id ?? null,
  };
}

// ── DB operations ──────────────────────────────────────────────────

/**
 * Cache-first film upsert.
 * Returns the existing DB row if present; otherwise fetches from TMDB and upserts.
 */
export async function upsertFilm(tmdbId: number): Promise<FilmRow> {
  const supabase = createAdminClient();

  // Check cache first
  const { data: existing } = await supabase
    .from("films")
    .select("*")
    .eq("tmdb_id", tmdbId)
    .single();

  if (existing) return existing as FilmRow;

  // Fetch from TMDB and upsert
  const film = await fetchFilmFromTMDB(tmdbId);

  const { data, error } = await supabase
    .from("films")
    .upsert(film, { onConflict: "tmdb_id" })
    .select()
    .single();

  if (error) throw new Error(`Film upsert failed: ${error.message}`);
  return data as FilmRow;
}

/**
 * Get a film by its URL slug. Returns null if not found.
 */
export async function getFilmBySlug(slug: string): Promise<FilmRow | null> {
  const supabase = supabaseAnon();

  const { data } = await supabase
    .from("films")
    .select("*")
    .eq("slug", slug)
    .single();

  return (data as FilmRow) ?? null;
}

/**
 * Get all films (for index page / static params).
 */
export async function getAllFilms(): Promise<FilmRow[]> {
  const supabase = supabaseAnon();

  const { data } = await supabase
    .from("films")
    .select("*")
    .order("year", { ascending: true });

  return (data as FilmRow[]) ?? [];
}

/**
 * Backfill a film's TMDB data (for seed films that only have minimal metadata).
 */
export async function backfillFilm(tmdbId: number): Promise<FilmRow> {
  const supabase = createAdminClient();
  const film = await fetchFilmFromTMDB(tmdbId);

  const { data, error } = await supabase
    .from("films")
    .update({
      poster_path: film.poster_path,
      overview: film.overview,
      genres: film.genres,
      keywords: film.keywords,
      imdb_id: film.imdb_id,
      wikidata_id: film.wikidata_id,
      director_slug: film.director_slug,
    })
    .eq("tmdb_id", tmdbId)
    .select()
    .single();

  if (error) throw new Error(`Backfill failed: ${error.message}`);
  return data as FilmRow;
}
