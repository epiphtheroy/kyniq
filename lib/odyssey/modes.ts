import type { OdyMap, OdyStation } from "./types";

/**
 * Destination proposal engine — pure client-side functions over the map
 * artifact plus the viewer's seen-set and availability overlay. The map
 * never asks for a destination; it proposes one per mode. All logic is
 * deterministic except "mystery" (browser-side random is fine here).
 */

export type ModeKey =
  | "continue"
  | "transfer"
  | "continent"
  | "ascent"
  | "summit"
  | "tonight"
  | "roots"
  | "mystery";

export type Proposal = {
  slug: string;
  reason: string;
  from?: string; // origin station for the drawn route, when one exists
  line?: string; // line context of the proposal
};

export const MODES: { key: ModeKey; label: string; hint: string }[] = [
  { key: "continue", label: "Continue the line", hint: "next stop on the line you ride most" },
  { key: "transfer", label: "Transfer", hint: "switch lines at a film you loved" },
  { key: "continent", label: "New continent", hint: "a gateway into unexplored territory" },
  { key: "ascent", label: "Bold ascent", hint: "one altitude band above your record" },
  { key: "summit", label: "Summit attempt", hint: "a canon peak you are ready for" },
  { key: "tonight", label: "Tonight, no-fail", hint: "low altitude, on your services" },
  { key: "roots", label: "Back to the roots", hint: "ride your favourite line backwards" },
  { key: "mystery", label: "Mystery train", hint: "fate picks the platform" },
];

type Ctx = {
  map: OdyMap;
  seen: ReadonlySet<string>;
  avail: Record<string, string[]> | null; // current country's availability, when loaded
};

const byPrestige = (a: OdyStation, b: OdyStation) => (b.pr ?? -1e9) - (a.pr ?? -1e9);

function stationIndex(map: OdyMap): Map<string, OdyStation> {
  return new Map(map.stations.map((s) => [s.s, s]));
}

function lineName(map: OdyMap, id: string): string {
  return map.lines.find((l) => l.id === id)?.name_en ?? id;
}

/** Highest altitude band the viewer has demonstrably cleared (1 if none). */
export function demonstratedAltitude(map: OdyMap, seen: ReadonlySet<string>): number {
  let max = 1;
  for (const st of map.stations) if (seen.has(st.s) && st.c > max) max = st.c;
  return max;
}

export function propose(mode: ModeKey, ctx: Ctx): Proposal | null {
  const { map, seen, avail } = ctx;
  const idx = stationIndex(map);
  const alt = demonstratedAltitude(map, seen);
  const unseen = (s: OdyStation) => !seen.has(s.s);

  // per-line ridden counts
  const ridden = map.lines.map((l) => ({
    line: l,
    seenN: l.stations.filter((s) => seen.has(s)).length,
  }));

  switch (mode) {
    case "continue": {
      const cands = ridden
        .filter((r) => r.seenN > 0 && r.seenN < r.line.stations.length)
        .sort((a, b) => b.seenN - a.seenN);
      for (const r of cands) {
        // advance by position along the (chronologically ordered) line, so a
        // same-year unseen stop never lands "behind" the last one you rode
        let lastSeenIdx = -1;
        r.line.stations.forEach((s, i) => {
          if (seen.has(s)) lastSeenIdx = i;
        });
        const next =
          r.line.stations.slice(lastSeenIdx + 1).find((s) => !seen.has(s)) ??
          r.line.stations.find((s) => !seen.has(s));
        if (next) {
          const from = r.line.stations.filter((s) => seen.has(s)).pop();
          return {
            slug: next,
            from,
            line: r.line.id,
            reason: `You are ${r.seenN} stations into the ${r.line.name_en} — this is the next stop.`,
          };
        }
      }
      return null;
    }
    case "transfer": {
      const transfers = map.stations.filter((s) => s.tf && seen.has(s.s));
      for (const t of transfers.sort(byPrestige)) {
        for (const lid of t.ln ?? []) {
          const line = map.lines.find((l) => l.id === lid);
          if (!line) continue;
          if (line.stations.some((s) => seen.has(s) && s !== t.s)) continue; // already ridden
          const near = line.stations
            .filter((s) => !seen.has(s))
            .sort(
              (a, b) =>
                Math.abs((idx.get(a)?.y ?? 0) - (t.y ?? 0)) -
                Math.abs((idx.get(b)?.y ?? 0) - (t.y ?? 0)),
            )[0];
          if (near)
            return {
              slug: near,
              from: t.s,
              line: lid,
              reason: `${t.t} is a transfer station — change here onto the ${lineName(map, lid)}, a line you have never ridden.`,
            };
        }
      }
      return null;
    }
    case "continent": {
      const perBand = map.bands.map((b, bi) => {
        const all = map.stations.filter((s) => s.b === bi);
        const seenN = all.filter((s) => seen.has(s.s)).length;
        return { bi, b, ratio: all.length ? seenN / all.length : 1 };
      });
      perBand.sort((a, b) => a.ratio - b.ratio);
      for (const cand of perBand) {
        const gate = map.stations
          .filter((s) => s.b === cand.bi && s.ln?.length && unseen(s) && s.c <= Math.max(2, alt))
          .sort((a, b) => a.c - b.c || byPrestige(a, b))[0];
        if (gate)
          return {
            slug: gate.s,
            reason: `${cand.b.label_en} is your least-explored territory — this is its gateway station (altitude ${gate.c}).`,
          };
      }
      return null;
    }
    case "ascent": {
      const target = Math.min(5, alt + 1);
      const cands = map.stations.filter((s) => unseen(s) && s.c === target).sort(byPrestige);
      const onKnownLine = (s: OdyStation) =>
        !!s.ln?.some((lid) => ridden.find((r) => r.line.id === lid && r.seenN > 0));
      const pick = cands.find(onKnownLine) ?? cands[0];
      if (!pick) return null;
      return {
        slug: pick.s,
        line: pick.ln?.[0],
        reason: `Your record altitude is ${alt}. This is a band-${target} climb${
          onKnownLine(pick) ? ` on a line you already know` : ""
        } — one step up, not a leap.`,
      };
    }
    case "summit": {
      const pick = map.stations
        .filter((s) => s.pk && unseen(s) && s.c <= Math.min(5, alt + 1))
        .sort(byPrestige)[0];
      if (!pick) return null;
      return {
        slug: pick.s,
        reason: `A canon peak within reach: altitude ${pick.c}, and you have already cleared band ${alt}.`,
      };
    }
    case "tonight": {
      const pool = map.stations
        .filter((s) => unseen(s) && s.c <= 2 && (!avail || (avail[s.s]?.length ?? 0) > 0))
        .sort(byPrestige);
      const pick = pool[0];
      if (!pick) return null;
      const on = avail?.[pick.s]?.slice(0, 2).join(", ");
      return {
        slug: pick.s,
        reason: `Altitude ${pick.c}${on ? `, streaming on ${on}` : ""} — a no-fail ride for tonight.`,
      };
    }
    case "roots": {
      const latest = map.stations
        .filter((s) => seen.has(s.s) && s.ln?.length)
        .sort((a, b) => (b.y ?? 0) - (a.y ?? 0))[0];
      const line = latest
        ? map.lines.find((l) => l.id === (latest.ln ?? [])[0])
        : map.lines.find((l) => l.id === "canon-express");
      if (!line) return null;
      const root = line.stations.find((s) => !seen.has(s));
      if (!root) return null;
      return {
        slug: root,
        from: latest?.s,
        line: line.id,
        reason: latest
          ? `Ride the ${line.name_en} backwards from ${latest.t} to where it began.`
          : `Start where the canon itself begins.`,
      };
    }
    case "mystery": {
      const pool = map.stations.filter((s) => unseen(s) && s.ln?.length);
      if (!pool.length) return null;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      return {
        slug: pick.s,
        line: pick.ln?.[0],
        reason: `Fate says: platform ${pick.c}, the ${lineName(map, (pick.ln ?? [])[0] ?? "")}.`,
      };
    }
  }
}
