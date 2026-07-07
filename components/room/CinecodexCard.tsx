import Link from "next/link";
import FilmContentHub from "./FilmContentHub";
import { STR } from "./strings";
/** S11 Cinecodex card (dark shell). The second objective axis beside Standing.
 *  Never blends: our V/R/U · external imdb/rt/meta · canon (Standing) sit in
 *  SEPARATE columns. Risk uses --risk (never --red). Confidence dims
 *  low-reliability tiers (but divisive ≠ unreliable). Verdict thresholds match
 *  lib/room/format.ts (Find ≥ +12 / Letdown ≤ −9). */
export type CcData = {
  v: number | null; c: number | null; r: number | null; u?: number | null;
  prestige?: number | null; discovery?: number | null; conf?: number | null; tier?: string | null;
  imdb?: number | null; rt?: number | null; meta?: number | null; votes?: number | null;
  ratingPct?: number | null; // for the 2-axis value badges (my ★ / 5 × 100)
};

function Bar({ v, cls }: { v: number | null; cls?: string }) {
  return <span className="bar"><i className={cls} style={{ width: `${Math.max(0, Math.min(100, v ?? 0))}%` }} /></span>;
}

export default function CinecodexCard({ d, showBadge = false, slug }: { d: CcData; showBadge?: boolean; slug?: string }) {
  if (d.v == null || d.r == null) {
    return <div className="icard cc-card"><h4><i className="ti ti-diamond" /> Cinecodex</h4><div className="ccempty">{STR.cc.unscored}</div></div>;
  }
  const v = d.v, c = d.c, r = d.r; // C (entry cost) null = unmeasured — never fabricate a 0
  const u = d.u ?? Math.round(v - r);
  const s = ((v - 50) / Math.max(r, 1)).toFixed(1);
  const riskCls = r <= 15 ? "lo" : r <= 25 ? "mid" : "hi";
  const tier = d.tier ?? null;
  const dim = tier === "Limited" ? " ccdim" : "";
  const rp = d.ratingPct;
  const mkt = rp != null && d.prestige != null ? Math.round(rp - d.prestige) : null; // market agreement (★ vs Standing)
  const ana = rp != null ? Math.round(rp - v) : null;                                // analysis agreement (★ vs V)
  const badge = (g: number | null) => g == null ? "" : g >= 12 ? STR.common.verdictFind : g <= -9 ? STR.common.verdictLetdown : STR.common.verdictAligned;

  return (
    <div className={`icard cc-card${dim}`}>
      <h4><i className="ti ti-diamond" /> Cinecodex <span style={{ marginLeft: "auto", fontSize: 9, color: "var(--sub)" }}>{STR.cc.fundamentals}</span></h4>
      <div className="ccaxes">
        <div className="ccbig"><div className="u">{u}</div><div className="ul">{STR.cc.uNetValue}</div><div className="s mono">S {s}</div></div>
        <div className="ccbars">
          <div className="ccbar"><span className="cl">V</span><Bar v={v} /><span className="vv">{v}</span></div>
          <div className="ccbar cost"><span className="cl">C</span><Bar v={c ?? 0} /><span className="vv">{c ?? "—"}</span></div>
          <div className="ccbar risk"><span className="cl">R</span><Bar v={r} /><span className="vv">{r}</span></div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", margin: "2px 0 6px" }}>
        <span className={`riskbadge ${riskCls}`}>{STR.cc.risk(r)}</span>
        {tier ? <span className="flagchip" title={STR.cc.confidenceTitle}>{STR.cc.confidence} {tier}{d.conf != null ? ` ${d.conf}` : ""}</span> : null}
      </div>

      {/* NEVER-BLEND side by side */}
      <div className="sbs">
        <div className="sc ours"><h5>{STR.cc.ours}</h5>
          <div className="r"><span>V</span><b>{v}</b></div>
          <div className="r"><span>R</span><b>{r}</b></div>
          <div className="r"><span>U</span><b>{u}</b></div>
        </div>
        <div className="sc ext"><h5>{STR.cc.external}</h5>
          <div className="r"><span>IMDb</span><b>{d.imdb ?? "—"}</b></div>
          <div className="r"><span>RT</span><b>{d.rt != null ? `${d.rt}%` : "—"}</b></div>
          <div className="r"><span>MC</span><b>{d.meta ?? "—"}</b></div>
        </div>
        <div className="sc canon"><h5>{STR.cc.canon}</h5>
          <div className="r"><span>{STR.cc.standing}</span><b>{d.prestige != null ? Math.round(d.prestige) : "—"}</b></div>
          <div className="r"><span>{STR.cc.discovery}</span><b>{d.discovery != null ? Math.round(d.discovery) : "—"}</b></div>
        </div>
      </div>

      {showBadge && rp != null ? (
        <div className="vpq">
          <div className="b"><div className="bn" style={{ color: mkt != null && mkt >= 12 ? "var(--safe)" : mkt != null && mkt <= -9 ? "var(--risk)" : "var(--mut)" }}>{mkt != null ? (mkt > 0 ? "+" : "") + mkt : "—"}</div><div className="bl">{STR.cc.market} {badge(mkt)} (★ − {STR.cc.standing})</div></div>
          <div className="b"><div className="bn" style={{ color: ana != null && ana >= 12 ? "var(--safe)" : ana != null && ana <= -9 ? "var(--risk)" : "var(--mut)" }}>{ana != null ? (ana > 0 ? "+" : "") + ana : "—"}</div><div className="bl">{STR.cc.analysis} {badge(ana)} (★ − V)</div></div>
        </div>
      ) : null}

      <div className="relcard" style={{ marginTop: 8 }}>{STR.cc.neverBlend}</div>
      {slug ? <Link href={`/room/film/${slug}`} className="actbtn" style={{ display: "block", textAlign: "center", marginTop: 8, fontSize: 11.5 }}>{STR.cc.fullCard}</Link> : null}
      {slug ? <FilmContentHub slug={slug} /> : null}
    </div>
  );
}
