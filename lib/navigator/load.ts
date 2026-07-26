/**
 * The Navigator — server loader (P2.1): assemble a real Destination + Routes
 * from the live DB, reusing the exact proven data paths the mobile director BFF
 * uses (app/api/v1/app/director/[slug]/route.ts): films by director_slug +
 * film_availability(). Availability `kind` vocabulary (JustWatch monetization):
 * flatrate/free/ads = playable now (sub) · rent/buy = a toll (rent) · none.
 *
 * seenSlugs is passed IN by the caller (its authed context) — the loader stays
 * auth-agnostic and the chevron position remains ledger-derived (invariant §10-1).
 */
import type { createAdminClient } from "@/lib/supabase/admin";
import {
  directorDestination, canonDestination, decadeDestination, subscriptionDestination, type SourceFilm,
} from "./destinations";
import { buildRoute, tripStats, type Availability, type Destination, type Route, type TripStats } from "./route";

type Db = ReturnType<typeof createAdminClient>;

const SUB_KINDS = new Set(["flatrate", "free", "ads"]);
const RENT_KINDS = new Set(["rent", "buy"]);

/** Map a film's availability tiers to the engine's 3-state availability. */
export function availabilityOf(tiers: { kind: string }[] | null | undefined): Availability {
  const kinds = new Set((tiers ?? []).map((t) => t.kind));
  for (const k of kinds) if (SUB_KINDS.has(k)) return "sub";
  for (const k of kinds) if (RENT_KINDS.has(k)) return "rent";
  return "none";
}

export interface DriveLoad {
  destination: Destination;
  routes: Record<Route["pref"], Route>;
  stats: TripStats;
}

export interface LoadOpts {
  slug: string;
  name?: string;
  country?: string;
  /** ledger-derived seen set (caller-provided); absent = a not-yet-started drive */
  seenSlugs?: ReadonlySet<string>;
  /** films/week from the ledger; null → ETA hidden (§4.3) */
  pacePerWeek?: number | null;
}

/** Fetch the my-services availability map for a set of film slugs (one RPC). */
async function availabilityMap(db: Db, slugs: string[], country: string): Promise<Map<string, Availability>> {
  if (!slugs.length) return new Map();
  const { data } = await db.rpc("film_availability", {
    p_slugs: slugs, p_countries: [country], p_providers: null, p_include_us_library: false,
  });
  return new Map(((data ?? []) as { slug: string; tiers: { kind: string }[] }[]).map((r) => [r.slug, availabilityOf(r.tiers)]));
}

/** TakeScore per slug (bulk standard RPC) → map, for the map poster popup. */
async function takescoreMap(db: Db, slugs: string[]): Promise<Map<string, number>> {
  if (!slugs.length) return new Map();
  const { data } = await db.rpc("takescore_for_slugs", { p_slugs: slugs });
  return new Map(((data ?? []) as { slug: string; ts: number | null }[])
    .filter((r) => r.ts != null).map((r) => [r.slug, r.ts as number]));
}

/** Compose the 3 routes + trip stats from an assembled Destination. */
function assemble(dest: Destination, pacePerWeek: number | null): DriveLoad {
  return {
    destination: dest,
    routes: {
      fewest: buildRoute(dest, "fewest"),
      fastest: buildRoute(dest, "fastest"),
      no_tolls: buildRoute(dest, "no_tolls"),
    },
    stats: tripStats(dest, pacePerWeek),
  };
}

/** Director conquest: films by director_slug (chronological) + availability → routes. */
export async function loadDirectorDestination(db: Db, opts: LoadOpts): Promise<DriveLoad | null> {
  const country = (opts.country || "US").toUpperCase().slice(0, 2);
  const { data: filmRows } = await db
    .from("films")
    .select("slug, title, year, poster_path, runtime, director")
    .eq("director_slug", opts.slug)
    .eq("visible", true)
    .order("year");
  const films = (filmRows ?? []) as {
    slug: string; title: string; year: number | null; poster_path: string | null; runtime: number | null; director: string | null;
  }[];
  if (!films.length) return null;

  const slugs = films.map((f) => f.slug);
  const [availMap, tsMap] = await Promise.all([availabilityMap(db, slugs, country), takescoreMap(db, slugs)]);
  const seen = opts.seenSlugs ?? new Set<string>();
  const dest = directorDestination(
    opts.slug,
    opts.name ?? opts.slug,
    films.map((f) => ({
      slug: f.slug, title: f.title, year: f.year, poster_path: f.poster_path, runtime: f.runtime,
      seen: seen.has(f.slug), availability: availMap.get(f.slug) ?? "none",
      director: f.director ?? opts.name ?? null, takescore: tsMap.get(f.slug) ?? null,
    })),
  );
  return assemble(dest, opts.pacePerWeek ?? null);
}

export interface CanonLoadOpts {
  lineageSlug: string;
  label: string;
  country?: string;
  seenSlugs?: ReadonlySet<string>;
  pacePerWeek?: number | null;
}

/** Canon list: a lineage's member films (rank order) + runtime (films join) + availability. */
export async function loadCanonDestination(db: Db, opts: CanonLoadOpts): Promise<DriveLoad | null> {
  const country = (opts.country || "US").toUpperCase().slice(0, 2);
  const { data: memberRows } = await db.rpc("lineage_list_films", { p_slug: opts.lineageSlug });
  const members = ((memberRows ?? []) as {
    film_slug: string; film_title: string; film_year: number | null; poster_path: string | null; rank: number | null;
  }[]).filter((m) => m.film_slug);
  if (!members.length) return null;

  const slugs = members.map((m) => m.film_slug);
  // lineage_list_films carries no runtime/director — join films for them (chunked-safe under the 1000 cap).
  const { data: rtRows } = await db.from("films").select("slug, runtime, director").in("slug", slugs);
  const rtMap = new Map(((rtRows ?? []) as { slug: string; runtime: number | null; director: string | null }[]).map((r) => [r.slug, r]));
  const [availMap, tsMap] = await Promise.all([availabilityMap(db, slugs, country), takescoreMap(db, slugs)]);

  const seen = opts.seenSlugs ?? new Set<string>();
  const dest = canonDestination(
    opts.lineageSlug,
    opts.label,
    members.map((m) => ({
      slug: m.film_slug, title: m.film_title, year: m.film_year, poster_path: m.poster_path,
      runtime: rtMap.get(m.film_slug)?.runtime ?? null, seen: seen.has(m.film_slug),
      availability: availMap.get(m.film_slug) ?? "none", rank: m.rank,
      director: rtMap.get(m.film_slug)?.director ?? null, takescore: tsMap.get(m.film_slug) ?? null,
    })),
  );
  return assemble(dest, opts.pacePerWeek ?? null);
}

/** One row of cinecodex_ranked (the Screener/TakeScore engine) — `u`=TakeScore, `rank`=order. */
interface RankedRow {
  slug: string; title: string; year: number | null; poster_path: string | null;
  director: string | null; u: number | null; rank: number | null;
}

/** Pull the top rows of a cinecodex_ranked query (returns json `{ total, rows }`). */
async function rankedTop(db: Db, params: Record<string, unknown>): Promise<RankedRow[]> {
  const { data } = await db.rpc("cinecodex_ranked", params);
  return ((data as { rows?: RankedRow[] } | null)?.rows) ?? [];
}

/** Attach runtime (films join) + my-services availability + seen to ranked rows → SourceFilm[]. */
async function enrichRanked(db: Db, rows: RankedRow[], country: string, seen: ReadonlySet<string>): Promise<SourceFilm[]> {
  const slugs = rows.map((r) => r.slug);
  // cinecodex_ranked carries no runtime — join films for it (typical N ≤ ~120, well under the 1000 cap).
  const { data: rtRows } = await db.from("films").select("slug, runtime").in("slug", slugs);
  const rtMap = new Map(((rtRows ?? []) as { slug: string; runtime: number | null }[]).map((r) => [r.slug, r.runtime]));
  const availMap = await availabilityMap(db, slugs, country);
  return rows.map((r) => ({
    slug: r.slug, title: r.title, year: r.year, poster_path: r.poster_path,
    runtime: rtMap.get(r.slug) ?? null, seen: seen.has(r.slug),
    availability: availMap.get(r.slug) ?? "none", rank: r.rank,
    director: r.director ?? null, takescore: r.u ?? null,
  }));
}

export interface DecadeLoadOpts {
  decade: number;
  label?: string;
  country?: string;
  seenSlugs?: ReadonlySet<string>;
  pacePerWeek?: number | null;
}

/** Decade essentials: the top ~20 TakeScore films of a decade (cinecodex_ranked, year-filtered). */
export async function loadDecadeDestination(db: Db, opts: DecadeLoadOpts): Promise<DriveLoad | null> {
  const country = (opts.country || "US").toUpperCase().slice(0, 2);
  const d0 = Math.floor(opts.decade / 10) * 10;
  const rows = await rankedTop(db, {
    p_sort: "u", p_lambda: 1.0, p_year_min: d0, p_year_max: d0 + 9, p_limit: 20, p_offset: 0,
  });
  if (!rows.length) return null;
  const seen = opts.seenSlugs ?? new Set<string>();
  const films = await enrichRanked(db, rows, country, seen);
  const dest = decadeDestination(d0, films);
  if (opts.label) dest.label = opts.label;
  return assemble(dest, opts.pacePerWeek ?? null);
}

export interface SubLoadOpts {
  label?: string;
  country?: string;
  seenSlugs?: ReadonlySet<string>;
  pacePerWeek?: number | null;
}

/** My-subscription priority: top TakeScore films playable now on my services (flatrate/free/ads), ~15. */
export async function loadSubscriptionDestination(db: Db, opts: SubLoadOpts): Promise<DriveLoad | null> {
  const country = (opts.country || "US").toUpperCase().slice(0, 2);
  // Over-fetch the TakeScore head, then keep only the sub-playable — most top films aren't on flatrate.
  const rows = await rankedTop(db, { p_sort: "u", p_lambda: 1.0, p_limit: 120, p_offset: 0 });
  if (!rows.length) return null;
  const seen = opts.seenSlugs ?? new Set<string>();
  const enriched = await enrichRanked(db, rows, country, seen);
  const playable = enriched.filter((f) => f.availability === "sub").slice(0, 15);
  if (!playable.length) return null;
  const dest = subscriptionDestination(playable);
  if (opts.label) dest.label = opts.label;
  return assemble(dest, opts.pacePerWeek ?? null);
}
