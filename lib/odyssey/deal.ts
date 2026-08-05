import type { OdyMap, OdyStation } from "./types";

/**
 * The Metatake deal — the actual navigation. Given the viewer's taste (the
 * films they've seen) and their filters, it deals three axes of three unseen
 * films each:
 *   - stable   (the Stable axis): dead-centre of your taste — a near-certain hit.
 *   - adventure(the Adventure axis): a step past the familiar — you'll likely grow into it.
 *   - frontier (the Frontier axis): a different world entirely — the leap that
 *              widens a cinephile's eye.
 *
 * With ≥3 seen films the axes are distance-from-your-taste bands over the t-SNE
 * space; with fewer, they fall back to altitude (how much a film asks of you),
 * which makes a sensible starter deal for a newcomer.
 */

export type Axis = "stable" | "adventure" | "frontier";

export const AXES: { key: Axis; title: string; sub: string; color: string; glow: string }[] = [
  { key: "stable", title: "Stable", sub: "Dead-centre of your taste · a safe bet", color: "#0d9488", glow: "13,148,136" },
  { key: "adventure", title: "Adventure", sub: "A step past the familiar", color: "#d97706", glow: "217,119,6" },
  { key: "frontier", title: "Frontier", sub: "Into a different world entirely", color: "#E3120B", glow: "227,18,11" },
];

export type DealFilters = {
  yearMin: number;
  yearMax: number;
  genre: number | null; // index into map.genres, or null for all
  servicesOnly: boolean;
  country: "KR" | "US";
};

export type DealResult = Record<Axis, OdyStation[]> & { basis: "taste" | "starter" };

// deterministic-ish shuffle seeded by a number, so re-deals vary but are testable
function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function dealJourney(
  map: OdyMap,
  seen: ReadonlySet<string>,
  filters: DealFilters,
  avail: Record<string, string[]> | null,
  seed: number,
  perAxis = 3,
): DealResult {
  const { yearMin, yearMax, genre, servicesOnly } = filters;

  const eligible = map.stations.filter((s) => {
    if (seen.has(s.s)) return false;
    const y = s.y ?? 0;
    if (y < yearMin || y > yearMax) return false;
    if (genre != null && !(s.gi ?? []).includes(genre)) return false;
    if (servicesOnly && avail && (avail[s.s]?.length ?? 0) === 0) return false;
    return true;
  });

  // taste centroid from seen films that carry a position
  const seenPts = map.stations.filter((s) => seen.has(s.s) && s.tx != null && s.ty != null);
  const useTaste = seenPts.length >= 3;

  let cx = 0, cy = 0;
  if (useTaste) {
    for (const s of seenPts) { cx += s.tx!; cy += s.ty!; }
    cx /= seenPts.length; cy /= seenPts.length;
  }

  // score each eligible film: taste distance (or altitude), plus a canon weight
  type Scored = { s: OdyStation; d: number };
  const scored: Scored[] = [];
  for (const s of eligible) {
    let d: number;
    if (useTaste && s.tx != null && s.ty != null) {
      d = Math.hypot(s.tx - cx, s.ty - cy);
    } else {
      // starter: altitude 1..5 mapped to a 0..1 "distance"
      d = ((s.c ?? 3) - 1) / 4;
    }
    scored.push({ s, d });
  }
  scored.sort((a, b) => a.d - b.d);

  const n = scored.length;
  // Films already dealt to a nearer axis. On tiny eligible sets the floored band
  // boundaries collide, so without this the same poster could land in two or three
  // columns; excluding what's taken keeps every card distinct.
  const chosen = new Set<string>();
  const bandPick = (lo: number, hi: number, seedOffset: number): OdyStation[] => {
    const band = scored.slice(Math.floor(n * lo), Math.max(Math.floor(n * hi), Math.floor(n * lo) + 1));
    // within the band prefer canon/prestige, but shuffle for variety on re-deal
    const ranked = band.sort((a, b) => (b.s.pr ?? 0) - (a.s.pr ?? 0));
    const head = ranked.slice(0, Math.min(ranked.length, perAxis * 4));
    const pick = shuffle(head, seed + seedOffset)
      .map((x) => x.s)
      .filter((s) => !chosen.has(s.s))
      .slice(0, perAxis);
    for (const s of pick) chosen.add(s.s);
    return pick;
  };

  // Deal nearest axis first so its picks claim priority; farther axes then draw
  // from what's left. (Band definitions are unchanged — only the overlap is removed.)
  const stable = bandPick(0, 0.18, 1);
  const adventure = bandPick(0.4, 0.62, 2);
  const frontier = bandPick(0.85, 1.0, 3);

  return { basis: useTaste ? "taste" : "starter", stable, adventure, frontier };
}
