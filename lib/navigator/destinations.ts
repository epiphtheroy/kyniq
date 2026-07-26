/**
 * The Navigator — destination catalog assembly (HANDOFF §3, P2).
 *
 * Destinations are ASSEMBLED from data we already have, not produced: a canon
 * list is a lineage row set (intrinsic rank order), a director conquest is a
 * filmography (chronological). These builders normalize either shape into the
 * engine's Destination. Nothing here is stored — a destination is regenerable
 * from its source rows (invariant §10-6).
 */

import type { NavFilm, Destination, Availability } from "./route";

/** Row a caller passes per film — the union of what our film/availability RPCs give. */
export interface SourceFilm {
  slug: string;
  title: string;
  year: number | null;
  poster_path: string | null;
  runtime: number | null;
  seen: boolean;
  availability?: Availability;   // default "none" when unknown
  leavingSoon?: boolean;
  rank?: number | null;          // lineage rank (canon)
  tasteDist?: number | null;
}

function toNavFilm(f: SourceFilm, order: number): NavFilm {
  return {
    slug: f.slug,
    title: f.title,
    year: f.year,
    poster_path: f.poster_path,
    runtime: f.runtime,
    seen: f.seen,
    availability: f.availability ?? "none",
    leavingSoon: f.leavingSoon,
    order,
    tasteDist: f.tasteDist ?? null,
  };
}

/** Director conquest — chronological order is the intrinsic route. */
export function directorDestination(slug: string, name: string, films: SourceFilm[]): Destination {
  const ordered = [...films].sort(
    (a, b) => (a.year ?? 0) - (b.year ?? 0) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0),
  );
  return {
    id: `director:${slug}`,
    family: "director",
    label: name,
    ordered: true,
    films: ordered.map((f, i) => toNavFilm(f, i)),
  };
}

/** Canon list — the lineage's own rank is the intrinsic order (fallback: input order). */
export function canonDestination(id: string, label: string, films: SourceFilm[]): Destination {
  return {
    id: `canon:${id}`,
    family: "canon",
    label,
    ordered: true,
    films: films.map((f, i) => toNavFilm({ ...f }, f.rank ?? i)),
  };
}

/** Decade essentials — the TakeScore rank within the decade is the intrinsic order. */
export function decadeDestination(decade: number, films: SourceFilm[]): Destination {
  const d0 = Math.floor(decade / 10) * 10;
  return {
    id: `decade:${d0}`,
    family: "decade",
    label: `${d0}s essentials`,
    ordered: true,
    films: films.map((f, i) => toNavFilm({ ...f }, f.rank ?? i)),
  };
}

/** My-subscription priority — leaving-soon floats up, then TakeScore rank (the pre-sorted input order). */
export function subscriptionDestination(films: SourceFilm[]): Destination {
  const ordered = [...films].sort(
    (a, b) =>
      (a.leavingSoon === b.leavingSoon ? 0 : a.leavingSoon ? -1 : 1) ||
      (a.rank ?? 1e9) - (b.rank ?? 1e9) ||
      (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0),
  );
  return {
    id: "subscription:mine",
    family: "subscription",
    label: "Best on your subscriptions",
    ordered: true,
    films: ordered.map((f, i) => toNavFilm({ ...f }, i)),
  };
}

/** Guard for the size rule (§3): destinations should be 8–40 films; larger canons split. */
export function isShippableSize(dest: Destination): boolean {
  return dest.films.length >= 8 && dest.films.length <= 40;
}
