import type { OdyStation } from "./types";

/**
 * packBoard — lays the cinephile corpus into a goban: 40 columns of year
 * (left→right through the decades) × up to 50 rows of classification (a film's
 * taste tendency, kindred films near each other vertically). Columns are
 * equal-count year buckets so the board fills, and within a column each film
 * sits at the row nearest its tendency — so the year axis can "shift" a little
 * (as the owner allowed) while the classification axis reads across.
 */

export type BoardCell = { s: OdyStation; col: number; row: number };
export type Board = { cells: BoardCell[]; cols: number; rows: number };

export function packBoard(stations: OdyStation[], cols = 30, rows = 70): Board {
  const films = stations.filter((s) => s.y != null && s.p).slice();
  films.sort((a, b) => (a.y! - b.y!) || a.s.localeCompare(b.s));
  if (!films.length) return { cells: [], cols, rows };

  const tys = films.filter((f) => f.ty != null).map((f) => f.ty!);
  const tmin = tys.length ? Math.min(...tys) : 0;
  const tmax = tys.length ? Math.max(...tys) : 1;
  const tnorm = (ty?: number | null) => (ty == null ? 0.5 : (ty - tmin) / (tmax - tmin || 1));

  const per = Math.ceil(films.length / cols);
  const cells: BoardCell[] = [];
  for (let c = 0; c < cols; c++) {
    const colFilms = films.slice(c * per, (c + 1) * per);
    if (!colFilms.length) continue;
    const taken = new Array(rows).fill(false);
    const ordered = colFilms
      .map((f) => ({ f, target: Math.round(tnorm(f.ty) * (rows - 1)) }))
      .sort((a, b) => a.target - b.target || (a.f.ty ?? 0) - (b.f.ty ?? 0));
    for (const { f, target } of ordered) {
      let row = target;
      for (let d = 0; d < rows; d++) {
        const up = target - d, dn = target + d;
        if (up >= 0 && !taken[up]) { row = up; break; }
        if (dn < rows && !taken[dn]) { row = dn; break; }
      }
      taken[row] = true;
      cells.push({ s: f, col: c, row });
    }
  }
  const usedRows = cells.reduce((m, c) => Math.max(m, c.row + 1), 1);
  return { cells, cols, rows: usedRows };
}

/**
 * tasteLayout — the "본 영화 중심" arrangement. Films are sorted by how close
 * their taste is to the viewer's seen-film centroid; a phyllotaxis spiral then
 * places them from the centre out, so seen films pack the middle, kindred films
 * cluster near, and the further out a film is the looser (jittered) it sits.
 * When servicesCloser is on, films on the viewer's services are pulled inward.
 */
export type TastePos = { x: number; y: number; r: number; seen: boolean };
export type TasteLayout = { pos: Map<string, TastePos>; width: number; height: number; cx: number; cy: number; boundaryR: number };

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}

export function tasteLayout(
  stations: OdyStation[],
  seen: ReadonlySet<string>,
  avail: Record<string, string[]> | null,
  servicesCloser: boolean,
  boardW: number,
  cell: number,
): TasteLayout {
  const films = stations.filter((s) => s.y != null && s.p);
  // centroid of seen films in t-SNE space
  const seenPts = films.filter((s) => seen.has(s.s) && s.tx != null && s.ty != null);
  let cx0 = 0, cy0 = 0;
  if (seenPts.length) {
    for (const s of seenPts) { cx0 += s.tx!; cy0 += s.ty!; }
    cx0 /= seenPts.length; cy0 /= seenPts.length;
  }
  const dmaxRef = Math.max(1, ...films.filter((s) => s.tx != null).map((s) => Math.hypot((s.tx! - cx0), (s.ty! - cy0))));
  const eff = (s: OdyStation) => {
    if (seen.has(s.s)) return -1 + (hash(s.s) % 1000) / 1e6; // seen → dead centre, tiny spread
    let d = s.tx != null && s.ty != null ? Math.hypot(s.tx - cx0, s.ty - cy0) : dmaxRef * 1.1;
    if (servicesCloser && avail && (avail[s.s]?.length ?? 0) > 0) d *= 0.5; // pull services inward
    return d;
  };
  const sorted = [...films].sort((a, b) => eff(a) - eff(b));

  // spacing is clamped so the whole spiral fits the board width (a survey, not a scroll)
  const spacing = Math.min(cell * 0.62, boardW / (2.4 * Math.sqrt(Math.max(1, films.length))));
  const golden = Math.PI * (3 - Math.sqrt(5));
  const cx = boardW / 2;
  const pos = new Map<string, TastePos>();
  let maxR = 0, boundaryR = 0;
  const n = sorted.length;
  sorted.forEach((s, i) => {
    const R = spacing * Math.sqrt(i);
    const th = i * golden;
    const jitAmp = (R / (spacing * Math.sqrt(n) + 1)) * cell * 1.0; // grows outward
    const h = hash(s.s);
    const jx = (((h % 1000) / 1000) - 0.5) * 2 * jitAmp;
    const jy = ((((h >> 10) % 1000) / 1000) - 0.5) * 2 * jitAmp;
    const x = cx + R * Math.cos(th) + jx;
    const y = R * Math.sin(th) + jy; // relative to centre; shifted after we know maxR
    const isSeen = seen.has(s.s);
    if (isSeen) boundaryR = Math.max(boundaryR, R);
    pos.set(s.s, { x, y, r: R, seen: isSeen });
    if (R > maxR) maxR = R;
  });
  const cy = maxR + cell;
  for (const p of pos.values()) p.y += cy;
  return { pos, width: boardW, height: 2 * maxR + 2 * cell, cx, cy, boundaryR: boundaryR + cell * 0.9 };
}
