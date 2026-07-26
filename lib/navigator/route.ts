/**
 * The Navigator — deterministic route engine (HANDOFF-내비게이터-시네필터바이턴.md §4, P2).
 *
 * INVARIANTS (§10):
 *  - LLM-0. Same input → same route, always. Every comparator ends in `slug`,
 *    so ordering is a total order (no ties left to engine/DB row order).
 *  - Position is DERIVED, never stored: a film's place in the drive is decided
 *    purely by `seen` here; the caller passes the ledger-derived seen flags.
 *  - No fabricated facts: `turnReason` states only server-computed values.
 *
 * Pure module — no I/O, no imports. Unit-checkable in isolation.
 */

export type Availability = "sub" | "rent" | "none"; // on my streaming services
export type RoutePref = "fewest" | "fastest" | "no_tolls";
export type DestFamily = "canon" | "director" | "takescore" | "decade" | "subscription" | "movement";

export interface NavFilm {
  slug: string;
  title: string;
  year: number | null;
  poster_path: string | null;
  runtime: number | null;          // minutes (null = unknown → excluded from sums)
  seen: boolean;                   // ledger-derived (invariant §10-1)
  availability: Availability;
  leavingSoon?: boolean;
  director?: string | null;        // for the map poster's info popup
  takescore?: number | null;       // TakeScore, for the popup (display only)
  /** intrinsic destination order — lineage rank or chronology (lower = earlier) */
  order?: number | null;
  /** 0..1 taste distance to the viewer's seen centroid (tie-break only) */
  tasteDist?: number | null;
}

export interface Destination {
  id: string;
  family: DestFamily;
  label: string;
  ordered: boolean;                // does the set carry an intrinsic order?
  films: NavFilm[];
}

export interface RouteStop {
  film: NavFilm;
  index: number;                   // 0-based position among the remaining
  toll: boolean;                   // under no_tolls: not playable on my services
}

export interface Route {
  pref: RoutePref;
  stops: RouteStop[];              // remaining (unseen) films, in drive order
  next: NavFilm | null;            // the turn: stops[0]
  tollCount: number;
}

export interface TripStats {
  total: number;
  seenCount: number;
  remaining: number;
  runtimeTraveled: number | null;  // minutes watched toward this destination
  runtimeRemaining: number | null; // minutes left = the trip's "time remaining"
  subCoverage: number;             // 0..1 of remaining playable on my services
  etaWeeks: number | null;         // ceil(remaining / pace); null when pace unknown
}

const AVAIL_RANK: Record<Availability, number> = { sub: 0, rent: 1, none: 2 };

function bySlug(a: NavFilm, b: NavFilm): number {
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}
function n(v: number | null | undefined, dflt: number): number {
  return v == null ? dflt : v;
}

/** fewest = the canonical path: intrinsic order → playable-now → taste → slug. */
function cmpFewest(a: NavFilm, b: NavFilm): number {
  const o = n(a.order, 1e9) - n(b.order, 1e9); if (o) return o;
  const av = AVAIL_RANK[a.availability] - AVAIL_RANK[b.availability]; if (av) return av;
  const t = n(a.tasteDist, 1) - n(b.tasteDist, 1); if (t) return t;
  return bySlug(a, b);
}
/** fastest = shortest runtime first (same set, re-sorted), then availability. */
function cmpFastest(a: NavFilm, b: NavFilm): number {
  const r = n(a.runtime, 1e9) - n(b.runtime, 1e9); if (r) return r;
  const av = AVAIL_RANK[a.availability] - AVAIL_RANK[b.availability]; if (av) return av;
  return bySlug(a, b);
}
/** no_tolls = my-subscriptions first (in canonical order); rentals/none sink last as tolls. */
function cmpNoTolls(a: NavFilm, b: NavFilm): number {
  const at = a.availability === "sub" ? 0 : 1;
  const bt = b.availability === "sub" ? 0 : 1;
  if (at !== bt) return at - bt;
  return cmpFewest(a, b);
}

const COMPARATORS: Record<RoutePref, (a: NavFilm, b: NavFilm) => number> = {
  fewest: cmpFewest,
  fastest: cmpFastest,
  no_tolls: cmpNoTolls,
};

/** Build the ordered route of remaining films for one preference. */
export function buildRoute(dest: Destination, pref: RoutePref): Route {
  const remaining = dest.films.filter((f) => !f.seen);
  const sorted = [...remaining].sort(COMPARATORS[pref]);
  const stops: RouteStop[] = sorted.map((film, index) => ({
    film,
    index,
    toll: pref === "no_tolls" && film.availability !== "sub",
  }));
  return { pref, stops, next: stops[0]?.film ?? null, tollCount: stops.filter((s) => s.toll).length };
}

function sumRuntime(xs: NavFilm[]): number | null {
  const known = xs.filter((f) => f.runtime != null);
  return known.length ? known.reduce((s, f) => s + (f.runtime as number), 0) : null;
}

/** Trip meter — traveled vs remaining, coverage, and pace-based ETA (weeks, never a date). */
export function tripStats(dest: Destination, pacePerWeek: number | null): TripStats {
  const seen = dest.films.filter((f) => f.seen);
  const remaining = dest.films.filter((f) => !f.seen);
  const playable = remaining.filter((f) => f.availability === "sub").length;
  return {
    total: dest.films.length,
    seenCount: seen.length,
    remaining: remaining.length,
    runtimeTraveled: sumRuntime(seen),
    runtimeRemaining: sumRuntime(remaining),
    subCoverage: remaining.length ? playable / remaining.length : 1,
    etaWeeks: pacePerWeek && pacePerWeek > 0 && remaining.length ? Math.ceil(remaining.length / pacePerWeek) : null,
  };
}

/** The turn card's "why this turn" — server-computed facts only, no invention.
 *  English is the engine's default language (site-canonical); the web + BFF
 *  render this as-is. (Per-locale reasons would need a structured contract.) */
export function turnReason(next: NavFilm, dest: Destination, stats: TripStats): string {
  const parts: string[] = [];
  if (dest.family === "director" || dest.family === "canon") {
    parts.push(`${dest.label} ${stats.seenCount + 1}/${stats.total}`);
  }
  if (next.leavingSoon) parts.push("Leaving soon");
  else if (next.availability === "sub") parts.push("Play now");
  else if (next.availability === "rent") parts.push("Rent");
  return parts.join(" · ");
}

/** Duration display, Google-Maps style ("11 hr 53 min"). */
export function fmtRuntimeK(min: number | null): string {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} hr ${m} min` : `${m} min`;
}
/** Compact meter display ("9:52"). */
export function fmtHM(min: number | null): string {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}
