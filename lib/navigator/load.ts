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
import { directorDestination } from "./destinations";
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

  const slugs = films.map((f) => f.slug);
  const { data: availRows } = await db.rpc("film_availability", {
    p_slugs: slugs, p_countries: [country], p_providers: null, p_include_us_library: false,
  });
  const availMap = new Map(
    ((availRows ?? []) as { slug: string; tiers: { kind: string }[] }[]).map((r) => [r.slug, availabilityOf(r.tiers)]),
  );

  const seen = opts.seenSlugs ?? new Set<string>();
  const dest = directorDestination(
    opts.slug,
    opts.name ?? opts.slug,
    films.map((f) => ({
      slug: f.slug, title: f.title, year: f.year, poster_path: f.poster_path, runtime: f.runtime,
      seen: seen.has(f.slug),
      availability: availMap.get(f.slug) ?? "none",
    })),
  );

  return {
    destination: dest,
    routes: {
      fewest: buildRoute(dest, "fewest"),
      fastest: buildRoute(dest, "fastest"),
      no_tolls: buildRoute(dest, "no_tolls"),
    },
    stats: tripStats(dest, opts.pacePerWeek ?? null),
  };
}
