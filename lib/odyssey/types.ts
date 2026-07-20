/** Odyssey map artifact (public/odyssey/map.v1.json) — see worker/odyssey-build.py */

export type OdyBand = {
  id: string;
  label: string;
  label_en: string;
  y0: number;
  y1: number;
};

export type OdyLine = {
  id: string;
  name: string; // Korean line name (ko projection)
  name_en: string;
  cls: "movement" | "theme" | "express";
  color: string;
  band: number; // home band index, -1 = cross-band
  desc: string;
  desc_en: string;
  stations: string[]; // slugs in riding order
};

export type OdyStation = {
  s: string; // slug
  t: string; // title
  tk?: string; // korean title when it differs
  y: number | null;
  d: string | null; // director
  x: number;
  yy: number;
  b: number; // band index
  c: number; // altitude band 1..5 (cinecodex C quintile)
  p?: string; // poster_path
  pr?: number; // prestige score
  pk?: 1; // canon peak (prestige top 100)
  ln?: string[]; // line memberships
  tf?: 1; // transfer station (2+ lines)
  tx?: number; // t-SNE x (similarity-galaxy layout)
  ty?: number; // t-SNE y
  cl?: number; // taste cluster id
  gi?: number[]; // genre indices into OdyMap.genres
  v?: number; // TakeScore value axis
  u?: number; // TakeScore U (value − risk)
};

export type OdyMap = {
  v: number;
  w: number;
  h: number;
  bands: OdyBand[];
  decades: { y: number; x: number }[];
  genres?: string[];
  lines: OdyLine[];
  stations: OdyStation[];
};

export type OdyAvail = Record<"KR" | "US", Record<string, string[]>>;

/**
 * Metro path through ordered points. Level runs stay straight lines; lane
 * changes are drawn as smooth S-curves with horizontal tangents, so lines
 * that weave between shared stations read as a braid instead of a scribble.
 */
export function elbowPath(pts: Array<[number, number]>): string {
  if (!pts.length) return "";
  const first = pts[0];
  let d = `M${first[0]} ${first[1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [xa, ya] = pts[i - 1];
    const [xb, yb] = pts[i];
    if (yb === ya) {
      d += ` L${xb} ${yb}`;
      continue;
    }
    const mx = xa + (xb - xa) / 2;
    d += ` C${mx} ${ya} ${mx} ${yb} ${xb} ${yb}`;
  }
  return d;
}
