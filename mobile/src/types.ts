// BFF payload contracts (mirror of app/api/v1/app/* on the web repo).
// Field names must stay in sync with the web routes — bump PAYLOAD_V on breaking change.

export type Availability = {
  kind: string; // flatrate | free | ads | rent | buy | library
  pid: number;
  name: string;
  logo: string | null; // TMDB logo path
  cc: string;
};

export type LineageRow = {
  facet: string;
  list_slug: string;
  list_label: string;
  result: string | null;
  rank: number | null;
  edition_year: number | null;
  rank_max: number | null;
};

export type GeoPin = {
  id: number | string;
  name: string;
  lat: number;
  lng: number;
  country: string | null;
  layer: string; // "filmed" | "setting"
};

export type LifeFact = { n: number; text: string; source?: string | null };

export type FilmCard = {
  v: number;
  film_id: string; // films.id uuid — needed for user_movies writes
  slug: string;
  title: string;
  original_title: string | null;
  year: number | null;
  director: string | null;
  director_slug: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  runtime: number | null;
  genres: string[] | null;
  ts: number | null;
  analyzed: boolean;
  invitation: string | null; // spoiler-free critical lead (takes.rationale, is_invitation)
  lead_fallback: string[]; // Embedding Fantasia sentences (EN only) when no invitation
  availability: Availability[];
  lineage: LineageRow[];
  locations: { count: number; pins: GeoPin[] };
  the_life: {
    name: string;
    slug: string;
    profile_path: string | null;
    intro: string | null;
    facts: LifeFact[];
  } | null;
};

export type DirectorFilm = {
  film_id: string;
  slug: string;
  title: string;
  year: number | null;
  poster_path: string | null;
  ts: number | null;
  tiers: string[]; // distinct availability kinds in the edition country
};

export type DirectorCard = {
  v: number;
  slug: string;
  name: string;
  profile_path: string | null;
  birthday: string | null;
  place_of_birth: string | null;
  portrait: string | null; // director_portrait.body
  name_meaning: string | null;
  intro: string | null;
  facts: LifeFact[];
  picks: {
    pos: number;
    film_slug: string | null;
    film_title: string | null;
    film_year: number | null;
    label: string | null;
    reason: string | null;
  }[];
  next: {
    pos: number;
    rec_name: string;
    reason: string | null;
    target_slug: string | null;
    profile_path: string | null;
  }[];
  films: DirectorFilm[];
  honors_count: number;
};

export type TonightRow = {
  film_id: string | null;
  slug: string;
  title: string;
  year: number | null;
  poster_path: string | null;
  director: string | null;
  director_slug: string | null;
  ts: number | null;
  tiers: string[];
  lead: string | null; // one-line invite when available
};

export type TonightPayload = {
  v: number;
  country: string;
  total: number;
  rows: TonightRow[];
};

export type Service = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  kinds: string[];
  label: "subscription" | "free" | "rent";
  library: boolean;
  n: number;
};

// search_all RPC row (direct anon call — see lib/search.ts on web)
export type SearchRow = {
  kind: string;
  slug: string;
  film_slug: string | null;
  title: string;
  sub: string;
  poster: string | null;
  year: number | null;
  score: number;
  is_catalog: boolean;
};

// TMDB search fallback row (Not-in-canon)
export type TmdbFallbackRow = {
  tmdb_id: number;
  title: string;
  year: number | null;
  poster_path: string | null;
};
