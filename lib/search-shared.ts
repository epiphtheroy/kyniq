/**
 * lib/search-shared.ts — tiny isomorphic module shared by the search engine
 * (lib/search.ts, server), the client hook (lib/useSearch.ts), the ⌘K palette,
 * and the /search page. Deliberately dependency-free so importing it from a
 * client component costs nothing (lib/search.ts drags in atlas JSON + supabase).
 */

export type SearchKind =
  | "film" | "director" | "trope" | "reading" | "figure" | "theorist"
  | "idea" | "tradition" | "lineage" | "movement" | "archetype"
  | "country" | "city" | "genre" | "essay" | "now";

export interface SearchHit {
  kind: SearchKind;
  /** figure/reading: parent film slug · archetype: taxonomy kind · city: country slug */
  film_slug: string | null;
  slug: string;
  title: string;
  sub: string;
  /** TMDB poster_path / profile_path (relative) — use tmdbUrl() to prefix */
  poster: string | null;
  year: number | null;
  score: number;
  is_catalog: boolean;
  match: "text" | "meaning" | "both";
  href: string;
}

export const KIND_LABEL: Record<SearchKind, string> = {
  film: "Film",
  director: "Director",
  trope: "Trope",
  reading: "Reading",
  figure: "Figure",
  theorist: "Theorist",
  idea: "Idea",
  tradition: "Tradition",
  lineage: "List",
  movement: "Movement",
  archetype: "Archetype",
  country: "Place",
  city: "Place",
  genre: "Genre",
  essay: "Essay",
  now: "Now Playing",
};

export const TMDB_IMG = "https://image.tmdb.org/t/p";
/** hit.poster is a TMDB-relative path (poster_path / profile_path) */
export function tmdbUrl(poster: string | null, size: "w92" | "w185" = "w92"): string | null {
  return poster ? `${TMDB_IMG}/${size}${poster}` : null;
}
