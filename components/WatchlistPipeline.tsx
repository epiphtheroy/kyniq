"use client";

/** /me — Watchlist as a pipeline, ranked by TakeScore.
 *  Each queued film shows its TakeScore (TS = Value − λ·Risk) and a risk flag.
 *  A λ (risk-aversion) dial re-ranks; two callouts surface the safest high-value
 *  pick and the most ambitious one. Reads TakeScore only — a lean take on the
 *  "watch-next / risk filter" idea. Films without a score sink to the bottom. */
import { useMemo, useState } from "react";
import Link from "next/link";

export type WLRow = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  rating: number | null; added_at: string;
  v: number | null; c: number | null; r: number | null;
};

const IMG = "https://image.tmdb.org/t/p/w92";

function riskFlag(r: number | null) {
  if (r == null) return null;
  if (r <= 15) return { cls: "wp-safe", label: "Safe bet" };
  if (r <= 35) return { cls: "wp-mixed", label: "Divisive" };
  return { cls: "wp-risky", label: "Risky" };
}

export default function WatchlistPipeline({ rows }: { rows: WLRow[] }) {
  const [lam, setLam] = useState(1.0);

  const scored = useMemo(() => rows.filter((w) => w.v != null && w.r != null), [rows]);
  const ranked = useMemo(() => {
    const withU = rows.map((w) => ({ w, u: w.v != null && w.r != null ? w.v - lam * w.r : -Infinity }));
    withU.sort((a, b) => b.u - a.u);
    return withU;
  }, [rows, lam]);

  const safeBet = useMemo(() => {
    const cand = scored.filter((w) => (w.r ?? 99) <= 20);
    if (!cand.length) return null;
    return cand.reduce((best, w) => ((w.v! - w.r!) > (best.v! - best.r!) ? w : best));
  }, [scored]);
  const ambitious = useMemo(() => {
    if (!scored.length) return null;
    return scored.reduce((best, w) => (w.v! > best.v! ? w : best));
  }, [scored]);

  if (rows.length === 0) {
    return <p className="ui muted" style={{ fontSize: 14, fontStyle: "italic", margin: "8px 0 0" }}>Nothing queued yet.</p>;
  }

  return (
    <div className="wp">
      {(safeBet || ambitious) && (
        <div className="wp-callouts">
          {safeBet && (
            <Link className="wp-call wp-call--safe" href={`/film/${safeBet.slug}`}>
              <span className="wp-call-k">Tonight&apos;s safe bet</span>
              <span className="wp-call-t">{safeBet.title}</span>
              <span className="wp-call-m">TakeScore {Math.round(safeBet.v! - safeBet.r!)} · low risk</span>
            </Link>
          )}
          {ambitious && ambitious.slug !== safeBet?.slug && (
            <Link className="wp-call wp-call--amb" href={`/film/${ambitious.slug}`}>
              <span className="wp-call-k">The ambitious one</span>
              <span className="wp-call-t">{ambitious.title}</span>
              <span className="wp-call-m">Value {Math.round(ambitious.v!)} · higher risk</span>
            </Link>
          )}
        </div>
      )}

      {scored.length > 0 && (
        <div className="wp-dial">
          <span className="wp-dial-l">Risk aversion (λ)</span>
          <input type="range" min={0} max={2} step={0.1} value={lam} onChange={(e) => setLam(parseFloat(e.target.value))} />
          <b>{lam.toFixed(1)}</b>
          <span className="wp-dial-h">TakeScore = Value − λ·Risk. Raise λ to push risky films down.</span>
        </div>
      )}

      <ul className="wp-list">
        {ranked.map(({ w }) => {
          const ts = w.v != null && w.r != null ? Math.round(w.v - lam * w.r) : null;
          const flag = riskFlag(w.r);
          return (
            <li className="wp-row" key={w.slug}>
              {w.poster_path
                ? // eslint-disable-next-line @next/next/no-img-element
                  <img className="wp-th" src={`${IMG}${w.poster_path}`} alt="" loading="lazy" />
                : <span className="wp-th wp-th--e" />}
              <div className="wp-info">
                <div className="wp-t"><Link href={`/film/${w.slug}`}>{w.title}</Link> <span className="wp-yr">({w.year ?? "?"}{w.director ? `, ${w.director}` : ""})</span></div>
                <div className="wp-flags">
                  {flag ? <span className={`wp-flag ${flag.cls}`}>● {flag.label}</span> : <span className="wp-flag wp-none">not yet scored</span>}
                  {w.rating ? <span className="wp-mine">your ★ {Number(w.rating).toFixed(1)}</span> : null}
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
