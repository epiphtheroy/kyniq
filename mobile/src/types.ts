// BFF payload contracts (mirror of app/api/v1/app/* on the web repo).
// Field names must stay in sync with the web routes — bump PAYLOAD_V on breaking change.

export type Availability = {
  kind: string; // flatrate | free | ads | rent | buy | library
  pid: number;
  name: string;
  logo: string | null; // TMDB logo path
  cc: string;
};

/** Metatake TV — the film's own program, plus the lists it rides in. */
export type TvProgram = {
  slug: string;
  title: string;
  dek: string | null;
  segments: number | null;
  duration_ms: number | null;
  lists: { slug: string; title: string; kind: string | null }[];
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
  /** Absent on servers that predate the TV shelf; the app hides it then. */
  tv?: TvProgram | null;
  // v4 judgment signals (PAYLOAD_V 2 — additive; an older server simply omits them)
  rank?: number | null;
  rank_total?: number | null;
  vcr?: { v: number; c: number; r: number } | null;
  /** TMDB backdrop paths for the hero pager + mid-page figures (additive). */
  images?: string[] | null;
  standing?: number | null; // canon prestige — the verdict comparator (NOT TakeScore)
  dims?: { key: string; label: string; val: number }[] | null; // 13-dim expectation chips
  kindred?: { slug: string; title: string; year: number | null; shared: number }[] | null;
};

/** tow_comment RPC — the curator's letter (mirror of web components/read/TowCard.tsx). */
export type TowComment = {
  verdict: string;
  verdict_label: string | null;
  authority_label: string | null;
  rationale: string | null;
  director?: string | null;
  auteur?: boolean | null;
  rec_date?: string | null;
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
  /** Echo of the applied production-country filter. Absent on servers that
   *  predate it — which is how the app knows not to offer the chip. */
  countries?: string[];
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

// ---------------------------------------------------------------------------
// v4 personal RPC rows — the `me_*` family (auth.uid()-scoped SECURITY DEFINER,
// called directly with the user's JWT; the same lineage /room uses client-side).
// NOT the `*_mine` service-role family, which the app must never call (§13-4).

/** me_recommend_wwi(p_lambda, p_limit) — personal ranked candidates + reason chips. */
export type WwiRow = {
  slug: string;
  title: string;
  year: number | null;
  poster_path: string | null;
  director: string | null;
  v: number | null;
  r: number | null;
  ts: number | null;
  prestige: number | null;
  conf: number | null;
  tier: string | null;
  sim: number | null;
  u_util: number | null;
  t_taste: number | null;
  s_standing: number | null;
  wwi: number | null;
  disc: number | null;
  reasons: string[] | null; // server-supplied chips — render only these (§13-17)
  avail: unknown;
  delta: number | null;
  in_watchlist: boolean | null;
};

/** me_watchlist_scored() — the Shelf queue (watchlist × scores × availability). */
export type WatchlistScoredRow = {
  slug: string;
  title: string;
  year: number | null;
  poster_path: string | null;
  director: string | null;
  rating: number | null;
  added_at: string | null; // → AgeBadge (Fresh/Aging/Stale)
  v: number | null;
  c: number | null;
  r: number | null;
  avail: unknown;
};

/** me_collection() — seen positions; rating + prestige drive the verdict recap. */
export type CollectionRow = {
  slug: string;
  title: string;
  year: number | null;
  poster_path: string | null;
  director: string | null;
  rating: number | null;
  v: number | null;
  c: number | null;
  r: number | null;
  u: number | null;
  prestige: number | null;
  discovery: number | null;
  conf: number | null;
  tier: string | null;
  imdb: number | null;
  rt: number | null;
  meta: number | null;
  votes: number | null;
  added_at: string | null;
  facets: string[] | null;
};

/** me_coverage(p_min_total, p_limit) — lineage conquest rows. */
export type CoverageRow = {
  list_id: string;
  slug: string;
  label: string;
  facet: string;
  aw: number | null;
  seen: number;
  total: number;
  pct: number;
  state: string;
};

/** me_blindspots(p_limit, p_min_total, p_min_aw). */
export type BlindspotRow = {
  list_id: string;
  slug: string;
  label: string;
  facet: string;
  aw: number | null;
  seen: number;
  total: number;
  ratio: number | null;
  productivity: number | null;
  opportunity: number | null;
  gap_reason: string | null;
};

/** me_rate_stats() — one-row personal counters. */
export type RateStats = {
  rated: number;
  loved: number;
  seen: number;
  watchlist: number;
  session_new: number;
  forming: boolean;
  loved_target: number;
};

// Tonight situation preset chips (§5.2). Three reuse the screener registry
// (lib/takescore_presets.ts: safe / gems / century); three are app-defined.
export type PresetKey = "services" | "safe" | "gems" | "century" | "ninety" | "bold";

// ---------------------------------------------------------------------------
// The Navigator (HANDOFF-navigator) — drive-view BFF payload,
// mirror of app/api/v1/app/navigator/route.ts. Route ordering is deterministic
// (LLM-0); the chevron position is ledger-derived server-side (seen), never stored.

export type NavAvailability = "sub" | "rent" | "none";
export type NavPref = "fewest" | "fastest" | "no_tolls";

/** The next (or then) turn — the green maneuver card. */
export type NavTurn = {
  slug: string;
  title: string;
  year: number | null;
  poster_path: string | null;
  runtime: number | null;
  availability: NavAvailability;
  leavingSoon: boolean;
  director: string | null; // for the map poster's info card
  takescore: number | null; // TakeScore, for the info card
  reason: string; // server-computed facts only (§10-2) — render as-is
};

/** A signpost standing along the road (remaining) or a passed grey marker. */
export type NavStop = {
  slug: string;
  title: string;
  year: number | null;
  poster_path: string | null;
  runtime: number | null;
  availability: NavAvailability;
  director: string | null; // for the map poster's info card
  takescore: number | null; // TakeScore, for the info card
  toll: boolean; // under no_tolls: not playable on my services
};

/** One preference's rendered route — the app switches these with no refetch. */
export type NavRouteBlock = {
  pref: NavPref;
  next: NavTurn | null;
  then: NavTurn | null;
  stops: NavStop[]; // remaining films, in this pref's order
  tollCount: number;
  runtimeRemaining: number | null;
  etaWeeks: number | null;
};

export type NavigatorPayload = {
  v: number;
  dir: string;
  country: string;
  label: string; // destination name (e.g. "Stanley Kubrick")
  family: string; // "director" | "canon" | …
  defaultPref: NavPref;
  // Trip meter (shared across prefs) — the bottom sheet.
  seenCount: number;
  total: number;
  remaining: number;
  runtimeTraveled: number | null; // minutes traveled toward the destination
  runtimeRemaining: number | null; // minutes left (time remaining)
  subCoverage: number; // 0..1 of remaining playable on my services
  etaWeeks: number | null; // ceil(remaining / pace); null when pace unknown
  seen: NavStop[]; // the passed segment (grey), chronological
  // Selected-pref convenience (mirrors routes[defaultPref]).
  next: NavTurn | null;
  then: NavTurn | null;
  stops: NavStop[];
  routes: Record<NavPref, NavRouteBlock>;
};

// The Navigator map v3 — the odyssey plane artifact (public/odyssey/map.v1.json on
// the web), slimmed to the fields buildScene needs to idealise the hero lane + faded
// world. The full artifact carries far more (bands, decades, t-SNE, …) we don't read.
export type OdyStationLite = {
  s: string; // slug
  x?: number; // odyssey plane x (unused by the lane, kept for completeness)
  yy?: number; // vertical position on the odyssey plane — drives the lane's gentle drift
  v?: number; // TakeScore value axis (ranks the faded background posters)
  p?: string; // poster_path
  d?: string | null; // director
  ln?: string[]; // line (lineage) memberships
  // Deal fields (the "For you — nine films" draw, ported from web lib/odyssey/deal.ts).
  // map.v1.json always carried these; the Lite type simply didn't read them before.
  t?: string; // title
  y?: number | null; // year
  c?: number; // altitude band 1..5 (starter-deal fallback axis)
  pr?: number; // prestige score (canon weight inside a band)
  tx?: number; // t-SNE x (taste-distance space)
  ty?: number; // t-SNE y
};
export type OdyLineLite = {
  id: string;
  name_en: string; // English lineage name (the faded cross-street signs)
  color?: string;
  stations?: string[];
};
export type OdyMapLite = {
  v: number;
  lines: OdyLineLite[];
  stations: OdyStationLite[];
};

/** me_auteur_conquest() row — used to pick the mid-conquest default destination. */
export type AuteurConquestRow = {
  slug: string;
  name: string | null;
  seen: number | string | null;
  total: number | string | null;
  pct: number | string | null;
};

/**
 * One row in the Navigator's "Where to?" picker (§5.1) — a destination the viewer
 * is mid-journey on. Assembled client-side from me_auteur_conquest (directors) +
 * me_coverage (canon lineages), mirroring /room/navigator's picker filters.
 */
export type NavPickDest = {
  kind: "dir" | "lineage";
  key: string; // director slug or lineage slug
  label: string;
  facet?: string; // lineage facet (canon | critics | festival | award | national | …)
  seen: number;
  total: number;
  pct: number; // 0..100
};

/** Picker payload — the two families the app lists as onward destinations. */
export type NavDestinations = { directors: NavPickDest[]; canon: NavPickDest[] };

/** A browsable catalog entry — ALL directors + ALL lineages/lists (not just the
 * viewer's in-progress ones), each a NavPickDest plus a lowercased `search` string
 * (label + parent + facet + country) for the Navigator tab's list search (owner 07-29). */
export type NavCatalogEntry = NavPickDest & { search: string };
export type NavCatalog = { directors: NavCatalogEntry[]; lineages: NavCatalogEntry[] };

/** A drive destination descriptor passed to api.navigator(). */
export type NavDest = { dir?: string; lineage?: string; label?: string };

/**
 * me_nav_active() — the member's single active drive (or none), so the picker can
 * offer a "Resume" card. Position/progress stay ledger-derived (§10-1); only WHICH
 * destination + pref is persisted (me_nav_start on drive open, me_nav_arrive on
 * arrival). Mirror of app/room/navigator/page.tsx's ActiveDrive row.
 */
export type NavActive = {
  dest_kind: string; // "dir" | "lineage" | "decade" | "sub"
  dest_key: string;
  dest_label: string | null;
  route_pref: string | null;
  started_at: string | null;
  skipped: boolean | null;
};
