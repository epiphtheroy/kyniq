import Link from "next/link";

/** /me — WWI (Worth-Weighted Index): the formal recommendation. A dashboard combiner
 *  that ranks UNSEEN films by  Confidence · (0.45 Utility + 0.35 Taste + 0.20 Standing):
 *   Utility  = TakeScore (Value − λ·Risk)   Taste = fit to your loved films
 *   Standing = canonical/critical worth      Confidence gates shaky scores out.
 *  One-way: taste & standing shape the RECOMMENDATION only, never the TakeScore itself. */
export type WwiRow = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  v: number | null; r: number | null; ts: number | null; prestige: number | null;
  conf: number | null; tier: string | null; sim: number;
  u_util: number; t_taste: number; s_standing: number; wwi: number;
};

const IMG = "https://image.tmdb.org/t/p/w185";
function tierDot(t: string | null) {
  const c = t === "High" ? "#0F6E56" : t === "Moderate" ? "#B8860B" : "#9AA0A6";
  return c;
}

export default function WWIRail({ rows }: { rows: WwiRow[] }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div className="wwi">
      <ul className="wwi-grid">
        {rows.map((f) => (
          <li className="wwi-card" key={f.slug}>
            <Link href={`/film/${f.slug}`}>
              <div className="wwi-top">
                {f.poster_path
                  ? // eslint-disable-next-line @next/next/no-img-element
                    <img className="wwi-th" src={`${IMG}${f.poster_path}`} alt="" loading="lazy" />
                  : <span className="wwi-th wwi-th--e" />}
                <span className="wwi-score"><b>{f.wwi}</b><i>WWI</i></span>
              </div>
              <div className="wwi-b">
                <div className="wwi-t">{f.title}</div>
                <div className="wwi-sub">{f.year ?? "?"}{f.director ? ` · ${f.director}` : ""}</div>
                <div className="wwi-bars">
                  <span className="wwi-brow"><em>Utility</em><span className="wwi-bar"><i style={{ width: `${f.u_util}%` }} /></span></span>
                  <span className="wwi-brow"><em>Taste</em><span className="wwi-bar wwi-bar--t"><i style={{ width: `${f.t_taste}%` }} /></span></span>
                  <span className="wwi-brow"><em>Standing</em><span className="wwi-bar wwi-bar--s"><i style={{ width: `${f.s_standing}%` }} /></span></span>
                </div>
                <div className="wwi-meta">
                  {f.ts != null ? <span className="wwi-chip">TS {f.ts}</span> : null}
                  <span className="wwi-chip">{Math.round(f.sim * 100)}% taste</span>
                  <span className="wwi-conf" title={`${f.tier} confidence`}>
                    <span className="wwi-cdot" style={{ background: tierDot(f.tier) }} />{f.tier ?? "—"}
                  </span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
