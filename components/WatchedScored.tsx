"use client";

/** /me — Watched films with their TakeScore and your value gap (your ★ vs our Value).
 *  Sortable by TakeScore, your rating, or risk. Reuses the watchlist row styling. */
import { useMemo, useState } from "react";
import Link from "next/link";

export type WatchedRow = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  rating: number | null; v: number | null; c: number | null; r: number | null;
};

const IMG = "https://image.tmdb.org/t/p/w92";
const SORTS = [{ id: "ts", label: "TakeScore" }, { id: "mine", label: "Your rating" }, { id: "risk", label: "Riskiest" }];

export default function WatchedScored({ rows }: { rows: WatchedRow[] }) {
  const [sort, setSort] = useState("ts");
  const sorted = useMemo(() => {
    const a = [...rows];
    const u = (w: WatchedRow) => (w.v != null && w.r != null ? w.v - w.r : -Infinity);
    if (sort === "ts") a.sort((x, y) => u(y) - u(x));
    else if (sort === "mine") a.sort((x, y) => (y.rating ?? -1) - (x.rating ?? -1));
    else a.sort((x, y) => (y.r ?? -1) - (x.r ?? -1));
    return a;
  }, [rows, sort]);

  if (rows.length === 0) return <p className="ui muted" style={{ fontSize: 14, fontStyle: "italic", margin: "8px 0 0" }}>Nothing here yet.</p>;

  return (
    <div className="wp">
      <div className="mw-sort">
        {SORTS.map((s) => <button key={s.id} className={sort === s.id ? "on" : ""} onClick={() => setSort(s.id)}>{s.label}</button>)}
      </div>
      <ul className="wp-list">
        {sorted.map((w) => {
          const ts = w.v != null && w.r != null ? Math.round(w.v - w.r) : null;
          const gap = w.rating != null && w.v != null ? Math.round(w.rating * 20 - w.v) : null;
          return (
            <li className="wp-row" key={w.slug}>
              {w.poster_path
                ? // eslint-disable-next-line @next/next/no-img-element
                  <img className="wp-th" src={`${IMG}${w.poster_path}`} alt="" loading="lazy" />
                : <span className="wp-th wp-th--e" />}
              <div className="wp-info">
                <div className="wp-t"><Link href={`/film/${w.slug}`}>{w.title}</Link> <span className="wp-yr">({w.year ?? "?"}{w.director ? `, ${w.director}` : ""})</span></div>
                <div className="wp-flags">
                  {w.rating ? <span className="wp-mine" style={{ color: "var(--accent)" }}>★ {Number(w.rating).toFixed(1)}</span> : null}
                  {gap != null ? <span className={`mw-gap${gap > 0 ? " mw-gap--up" : gap < 0 ? " mw-gap--dn" : ""}`}>{gap === 0 ? "= our Value" : `${gap > 0 ? "▲" : "▼"} ${Math.abs(gap)} vs Value`}</span> : null}
                </div>
              </div>
              <span className={`wp-ts${ts == null ? " wp-ts--e" : ""}`}>{ts == null ? "—" : <><b>{ts}</b><i>TS</i></>}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
