// The Metatake deal, ported from web lib/odyssey/deal.ts — the "For you — nine films"
// draw at the bottom of Explore's browse (owner 07-29). Given the viewer's taste (seen
// films from the ledger) it deals three axes of three unseen films each over the same
// /odyssey/map.v1.json the Navigator already fetches:
//   stable    — dead-centre of your taste, a near-certain hit
//   adventure — a step past the familiar
//   frontier  — a different world entirely
// With ≥3 seen films the axes are taste-distance bands over the t-SNE space; with fewer
// they fall back to altitude (how much a film asks of you) — a sensible starter deal.
// Pure + seeded, so a re-deal varies but stays testable (invariant: LLM-0, random via seed).
import type { OdyMapLite, OdyStationLite } from "../types";

export type Axis = "stable" | "adventure" | "frontier";

export const AXES: { key: Axis; color: string }[] = [
  { key: "stable", color: "#0d9488" },
  { key: "adventure", color: "#d97706" },
  { key: "frontier", color: "#E3120B" },
];

export type DealResult = Record<Axis, OdyStationLite[]> & { basis: "taste" | "starter" };

// deterministic-ish shuffle seeded by a number (mirrors web)
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

export function dealNine(map: OdyMapLite, seen: ReadonlySet<string>, seed: number, perAxis = 3): DealResult {
  // Eligible = unseen stations that can actually render a card (title + poster).
  const eligible = map.stations.filter((s) => !seen.has(s.s) && !!s.t && !!s.p);

  // Taste centroid from seen films that carry a t-SNE position.
  const seenPts = map.stations.filter((s) => seen.has(s.s) && s.tx != null && s.ty != null);
  const useTaste = seenPts.length >= 3;
  let cx = 0,
    cy = 0;
  if (useTaste) {
    for (const s of seenPts) {
      cx += s.tx!;
      cy += s.ty!;
    }
    cx /= seenPts.length;
    cy /= seenPts.length;
  }

  // Score: taste distance (or altitude for starters).
  const scored = eligible
    .map((s) => ({
      s,
      d:
        useTaste && s.tx != null && s.ty != null
          ? Math.hypot(s.tx - cx, s.ty - cy)
          : ((s.c ?? 3) - 1) / 4,
    }))
    .sort((a, b) => a.d - b.d);

  const n = scored.length;
  const bandPick = (lo: number, hi: number, seedOffset: number): OdyStationLite[] => {
    const band = scored.slice(Math.floor(n * lo), Math.max(Math.floor(n * hi), Math.floor(n * lo) + 1));
    // within the band prefer canon/prestige, but shuffle for variety on re-deal
    const ranked = band.sort((a, b) => (b.s.pr ?? 0) - (a.s.pr ?? 0));
    const head = ranked.slice(0, Math.min(ranked.length, perAxis * 4));
    return shuffle(head, seed + seedOffset)
      .slice(0, perAxis)
      .map((x) => x.s);
  };

  return {
    basis: useTaste ? "taste" : "starter",
    stable: bandPick(0, 0.18, 1),
    adventure: bandPick(0.4, 0.62, 2),
    frontier: bandPick(0.85, 1.0, 3),
  };
}
