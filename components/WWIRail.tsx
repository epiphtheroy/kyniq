"use client";

/** /me — WWI (Worth-Weighted Index): the formal recommendation. A dashboard combiner
 *  ranking UNSEEN films by  Confidence · (0.45 Utility + 0.35 Taste + 0.20 Standing):
 *   Utility  = TakeScore (Value − λ·Risk)   Taste = fit to your loved films
 *   Standing = canonical/critical worth      Confidence gates shaky scores out.
 *  The λ dial is YOUR risk appetite: raise it to punish risk (safer picks rise),
 *  lower it to chase the boldest high-value work. Recomputed live from the pool.
 *  One-way: taste & standing shape the RECOMMENDATION only, never the TakeScore itself. */
import { useMemo, useState } from "react";
import Link from "next/link";

export type WwiRow = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  v: number | null; r: number | null; ts: number | null; prestige: number | null;
  conf: number | null; tier: string | null; sim: number;
  u_util: number; t_taste: number; s_standing: number; wwi: number;
};

const IMG = "https://image.tmdb.org/t/p/w185";
const clamp = (x: number) => Math.max(0, Math.min(1, x));
function tierColor(t: string | null) {
  return t === "High" ? "#0F6E56" : t === "Moderate" ? "#B8860B" : "#9AA0A6";
}

export default function WWIRail({ rows, top = 12 }: { rows: WwiRow[]; top?: number }) {
  const [lam, setLam] = useState(1.0);

  const ranked = useMemo(() => {
    return rows
      .map((f) => {
        const hasVR = f.v != null && f.r != null;
        const u01 = hasVR ? clamp((f.v! - lam * f.r!) / 100) : f.u_util / 100;
        const t01 = f.t_taste / 100;
        const s01 = f.s_standing / 100;
        const c01 = (f.conf ?? 40) / 100;
        const wwi = Math.round(100 * c01 * (0.45 * u01 + 0.35 * t01 + 0.20 * s01));
        const ts = hasVR ? Math.round(f.v! - lam * f.r!) : f.ts;
        return { f, wwi, ts, u: Math.round(u01 * 100) };
      })
      .sort((a, b) => b.wwi - a.wwi)
      .slice(0, top);
  }, [rows, lam, top]);

  if (!rows || rows.length === 0) return null;
  const mood = lam <= 0.4 ? "adventurous" : lam >= 1.5 ? "cautious" : "balanced";

  return (
    <div className="wwi">
      <div className="wwi-dial">
        <span className="wwi-dial-l">Risk appetite (λ)</span>
        <input type="range" min={0} max={2} step={0.1} value={lam} onChange={(e) => setLam(parseFloat(e.target.value))} />
        <b>{lam.toFixed(1)}</b>
        <span className="wwi-dial-mood">{mood}</span>
        <span className="wwi-dial-h">Utility = Value − λ·Risk. Raise λ to favor safer films; lower it to chase bold, high-value ones.</span>
      </div>

      <ul className="wwi-grid">
        {ranked.map(({ f, wwi, ts, u }) => (
          <li className="wwi-card" key={f.slug}>
            <Link href={`/film/${f.slug}`}>
              <div className="wwi-top">
                {f.poster_path
                  ? // eslint-disable-next-line @next/next/no-img-element
                    <img className="wwi-th" src={`${IMG}${f.poster_path}`} alt="" loading="lazy" />
                  : <span className="wwi-th wwi-th--e" />}
                <span className="wwi-score"><b>{wwi}</b><i>WWI</i></span>
              </div>
              <div className="wwi-b">
                <div className="wwi-t">{f.title}</div>
                <div className="wwi-sub">{f.year ?? "?"}{f.director ? ` · ${f.director}` : ""}</div>
                <div className="wwi-bars">
                  <span className="wwi-brow"><em>Utility</em><span className="wwi-bar"><i style={{ width: `${u}%` }} /></span></span>
                  <span className="wwi-brow"><em>Taste</em><span className="wwi-bar wwi-bar--t"><i style={{ width: `${f.t_taste}%` }} /></span></span>
                  <span className="wwi-brow"><em>Standing</em><span className="wwi-bar wwi-bar--s"><i style={{ width: `${f.s_standing}%` }} /></span></span>
                </div>
                <div className="wwi-meta">
                  {ts != null ? <span className="wwi-chip">TS {ts}</span> : null}
                  <span className="wwi-chip">{Math.round(f.sim * 100)}% taste</span>
                  <span className="wwi-conf" title={`${f.tier} confidence`}>
                    <span className="wwi-cdot" style={{ background: tierColor(f.tier) }} />{f.tier ?? "—"}
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
