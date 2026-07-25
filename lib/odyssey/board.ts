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


// (tasteLayout — the "본 영화 중심" phyllotaxis spiral — was removed 2026-07-25.
//  Owner judgment: single-centroid distance + golden-angle spiral + outward
//  jitter reads as decorative noise; /journey's distance-band deal expresses
//  seen-centric taste legibly instead. Recover from git history if ever needed.)
