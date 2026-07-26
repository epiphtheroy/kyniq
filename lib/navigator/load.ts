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
import { directorDestination, canonDestination } from "./destinations";
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
    .select("slug, title, year, poster_path, runtime")
    .eq("director_slug", opts.slug)
    .eq("visible", true)
    .order("year");
  const films = (filmRows ?? []) as {
    slug: string; title: string; year: number | null; poster_path: string | null; runtime: number | null;
  }[];
  if (!films.length) return null;

  const availMap = await availabilityMap(db, films.map((f) => f.slug), country);
  const seen = opts.seenSlugs ?? new Set<string>();
  const dest = directorDestination(
    opts.slug,
    opts.name ?? opts.slug,
    films.map((f) => ({
      slug: f.slug, title: f.title, year: f.year, poster_path: f.poster_path, runtime: f.runtime,
      seen: seen.has(f.slug), availability: availMap.get(f.slug) ?? "none",
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
  // lineage_list_films carries no runtime — join films for it (chunked-safe under the 1000 cap for typical lists).
  const { data: rtRows } = await db.from("films").select("slug, runtime").in("slug", slugs);
  const rtMap = new Map(((rtRows ?? []) as { slug: string; runtime: number | null }[]).map((r) => [r.slug, r.runtime]));
  const availMap = await availabilityMap(db, slugs, country);

  const seen = opts.seenSlugs ?? new Set<string>();
  const dest = canonDestination(
    opts.lineageSlug,
    opts.label,
    members.map((m) => ({
      slug: m.film_slug, title: m.film_title, year: m.film_year, poster_path: m.poster_path,
      runtime: rtMap.get(m.film_slug) ?? null, seen: seen.has(m.film_slug),
      availability: availMap.get(m.film_slug) ?? "none", rank: m.rank,
    })),
  );
  return assemble(dest, opts.pacePerWeek ?? null);
}
