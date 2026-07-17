/** TakeScore evaluation card — durable Value, entry Cost, Risk, TakeScore (Value − Risk),
 *  Efficiency, the deterministic verdict sentence, the overall-rank strip, and the
 *  13 sub-scores (always shown) with fixed category definitions. MEASURED confidence
 *  (not luck) is disclosed in the footer. AI-estimated with stated limits.
 *  External metrics shown ALONGSIDE, never blended. */
import type { CSSProperties, ReactNode } from "react";
import ScoreDonut from "@/components/ScoreDonut";
import { dimByKey, takescoreDimUrl, displayTs } from "@/lib/cinecodex_dims";
import { bandWord, verdictShort } from "@/lib/takescore_prose";
import { t, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

export type Codex = {
  v: number; c: number; r: number; u: number; sharpe: number;
  sub: Record<string, number>;
  n_samples: number | null; sd_v: number | null; panel: string; flagged: boolean;
  conf: number | null; conf_tier: string | null; n_takes: number | null; votes: number | null;
  ext: { imdb: number | null; rt: number | null; metascore: number | null };
  /** Overall U-rank among ALL scored films (~6,701; migration 0052 dropped the
   *  visible-only filter so Tier-2 catalog films get a real rank too) — optional:
   *  edge-cached pre-0047 payloads omit them; the rank strip renders only when present. */
  rank?: number | null; rank_total?: number | null;
};

/** Payload of public.cinecodex_film_subscores — raw sub-scores plus each dimension's
 *  percentile against all scored films. Null for unscored films. The panel no longer
 *  renders the percentiles (`pct`); its presence gates the crawlable tier-1 layer
 *  (dim links, "?" affordance, category definitions) and callers still pass it. */
export type FilmSubscores = {
  scores: Record<string, number>;
  pct: Record<string, number>;
  v: number; c: number; r: number;
  takescore: number; n_samples: number | null;
  flagged: boolean; total_scored: number;
};

const VALUE = ["Cognitive", "Affective", "Formal", "Moral", "Durability"];
const COST = ["Intertextual", "Formal radicalism", "Extratextual", "Auteur oeuvre"];
const RISK = ["Bankruptcy", "Insincerity", "Cowardice", "Polarization"];

// Panel display names → cinecodex.scores keys (registry: lib/cinecodex_dims.ts).
// "Bankruptcy" is this panel's historical label for the registry's "Hollowness" (key `bank`).
const NAME_KEY: Record<string, string> = {
  Cognitive: "cog", Affective: "aff", Formal: "form", Moral: "moral", Durability: "dur",
  Intertextual: "itx", "Formal radicalism": "fr", Extratextual: "etx", "Auteur oeuvre": "ctx",
  Bankruptcy: "bank", Insincerity: "insincere", Cowardice: "coward", Polarization: "polar",
};

// Highest-scoring dimension in a group (display value only — reads data.sub,
// never re-ranks or mutates the raw scores, R-R1). Returns the panel display
// name (the key data.sub is keyed by) and its clamped-for-display score.
function topDim(names: string[], sub: Record<string, number>): { name: string; score: number } {
  let best = names[0];
  let bestScore = sub[names[0]] ?? 0;
  for (const n of names) {
    const s = sub[n] ?? 0;
    if (s > bestScore) { best = n; bestScore = s; }
  }
  return { name: best, score: bestScore };
}

// The film's plain-word reading of each dimension, shown as a prominent,
// axis-coloured verdict line under each row — so the judgment reads at a glance
// instead of hiding at the end of a grey definition sentence (removed). The row's
// "?" still links to the full /takescore/[dim] explanation for anyone who wants it.
const GROUP_HEX: Record<string, string> = { value: "#0F6E56", cost: "#6b7280", risk: "#C8102E" };
const VERDICT_STYLE: CSSProperties = {
  fontFamily: "var(--font-ui)", fontSize: "13px", fontWeight: 700,
  lineHeight: 1.25, margin: "2px 0 12px",
};

// Compact circled "?" — an explicit "what is this?" affordance per dimension row,
// linking to the /takescore/[dim] explanation page. Muted palette; hover darkens
// via the .ccx-qm rule injected in the panel (server component — no JS handlers).
const QM_STYLE: CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: "14px", height: "14px", borderRadius: "50%", boxSizing: "border-box",
  border: "1px solid var(--hairline)", color: "var(--muted)",
  fontFamily: "var(--font-ui)", fontSize: "9.5px", fontWeight: 600, lineHeight: 1,
  textDecoration: "none", justifySelf: "end",
};

// Tier-1 rows get a 4th 16px column for the "?" circle (base grid is 112px 1fr 26px).
const SUBROW_QM_STYLE: CSSProperties = { gridTemplateColumns: "112px 1fr 26px 16px" };

function Bar({ v, tone }: { v: number; tone: string }) {
  return <span className="ccx-bar"><i className={tone} style={{ width: `${Math.max(0, Math.min(100, v))}%` }} /></span>;
}
function Sub({ names, sub, tone, rich, locale }: { names: string[]; sub: Record<string, number>; tone: string; rich?: boolean; locale: Locale }) {
  return (
    <div className="ccx-sub">
      {names.map((n) => {
        // Legacy (thin pages): markup unchanged for existing callers.
        if (!rich) {
          return (
            <div className="ccx-subrow" key={n}>
              <span className="ccx-subn">{t(locale, n)}</span><Bar v={sub[n] ?? 0} tone={tone} /><span className="ccx-subv">{sub[n] ?? 0}</span>
            </div>
          );
        }
        // Crawlable layer: the label links to its /takescore/[dim] page, a circled
        // "?" makes the explanation page an explicit affordance, and a fixed
        // one-line definition of the category sits under the row, closed by this
        // film's own band phrase for its score (same muted voice).
        const dim = dimByKey.get(NAME_KEY[n] ?? "");
        const score = sub[n] ?? 0;
        const qm = dim ? t(locale, "What is {label}? — full explanation and ranking", { label: t(locale, dim.label) }) : "";
        return (
          <div key={n}>
            <div className="ccx-subrow" style={dim ? SUBROW_QM_STYLE : undefined}>
              {dim
                ? <a className="ccx-subn" href={takescoreDimUrl(dim.slug)} title={dim.question}>{t(locale, n)}</a>
                : <span className="ccx-subn">{t(locale, n)}</span>}
              <Bar v={score} tone={tone} /><span className="ccx-subv">{score}</span>
              {dim
                ? <a className="ccx-qm" href={takescoreDimUrl(dim.slug)} aria-label={qm} title={qm} style={QM_STYLE}>?</a>
                : null}
            </div>
            {dim ? (
              <div style={{ ...VERDICT_STYLE, color: GROUP_HEX[dim.group] ?? "var(--ink)" }}>
                {t(locale, bandWord(dim.group, score))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Value vs Popularity 2×2 — the divergence IS the product. Our durable Value (y) against
 *  the crowd's attention (x, from log votes). The gap tells the story: high value + low reach
 *  = a hidden gem; high reach + low value = popular but thin. Never blended into the score. */
function ValuePop({ v, votes, title, locale }: { v: number; votes: number | null; title: string; locale: Locale }) {
  if (votes == null || votes < 50) return null;
  const val = Math.round(v);
  const pop = Math.round(Math.max(0, Math.min(1, (Math.log10(Math.max(votes, 1)) - 3.5) / 3)) * 100);
  const gap = val - pop;

  let head: string, note: string;
  if (val >= 60 && pop < 45) { head = t(locale, "Hidden gem"); note = t(locale, "{title} holds durable value {val} well above its audience reach {pop} — a cinephile's find.", { title, val, pop }); }
  else if (val >= 58 && pop >= 55) { head = t(locale, "Consensus classic"); note = t(locale, "{title} is widely seen and it holds up — value {val}, reach {pop}.", { title, val, pop }); }
  else if (val < 50 && pop >= 58) { head = t(locale, "Popular, lighter harvest"); note = t(locale, "{title} is enjoyed widely (reach {pop}) but holds less durable value ({val}) to re-mine.", { title, val, pop }); }
  else if (val < 48 && pop < 45) { head = t(locale, "A quiet minor work"); note = t(locale, "{title} pairs modest reach ({pop}) with a modest durable payoff ({val}).", { title, val, pop }); }
  else if (gap >= 15) { head = t(locale, "Under-seen for its value"); note = t(locale, "{title}'s durable value {val} outruns its audience reach {pop}.", { title, val, pop }); }
  else if (gap <= -15) { head = t(locale, "Loved beyond its durable value"); note = t(locale, "{title}'s audience reach {pop} outruns its durable value {val}.", { title, val, pop }); }
  else { head = t(locale, "Value and reach aligned"); note = t(locale, "{title}'s durable value {val} and audience reach {pop} track closely.", { title, val, pop }); }

  // plot geometry (viewBox 0 0 260 190). plot area x:34..248, y:14..150
  const px = 34 + (pop / 100) * (248 - 34);
  const py = 150 - (val / 100) * (150 - 14);
  const cx = 34 + 0.5 * (248 - 34); // center vertical (pop 50)
  const cy = 150 - 0.5 * (150 - 14); // center horizontal (value 50)

  return (
    <div className="ccx-vp">
      <div className="ccx-vp-head"><b>{head}</b><span>{t(locale, "Value × Popularity")}</span></div>
      <div className="ccx-vp-body">
        <svg className="ccx-vp-svg" viewBox="0 0 260 190" role="img" aria-label={`${head}: ${note}`}>
          {/* quadrant tints */}
          <rect x="34" y="14" width={cx - 34} height={cy - 14} fill="#0F6E56" opacity="0.06" />
          <rect x={cx} y="14" width={248 - cx} height={cy - 14} fill="#0F6E56" opacity="0.13" />
          <rect x={cx} y={cy} width={248 - cx} height={150 - cy} fill="#C8102E" opacity="0.07" />
          <rect x="34" y={cy} width={cx - 34} height={150 - cy} fill="#9AA0A6" opacity="0.08" />
          {/* axes */}
          <line x1="34" y1="150" x2="248" y2="150" stroke="var(--hairline-2,#ccc)" strokeWidth="1" />
          <line x1="34" y1="14" x2="34" y2="150" stroke="var(--hairline-2,#ccc)" strokeWidth="1" />
          <line x1={cx} y1="14" x2={cx} y2="150" stroke="var(--hairline,#e6e6e6)" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="34" y1={cy} x2="248" y2={cy} stroke="var(--hairline,#e6e6e6)" strokeWidth="1" strokeDasharray="3 3" />
          {/* corner labels */}
          <text className="ccx-vp-q" x="40" y="26">{t(locale, "Hidden gem")}</text>
          <text className="ccx-vp-q" x="244" y="26" textAnchor="end">{t(locale, "Consensus classic")}</text>
          <text className="ccx-vp-q" x="244" y="146" textAnchor="end">{t(locale, "Popular · lighter")}</text>
          <text className="ccx-vp-q" x="40" y="146">{t(locale, "Minor")}</text>
          {/* the film */}
          <circle cx={px} cy={py} r="9" fill="#0F6E56" opacity="0.16" />
          <circle cx={px} cy={py} r="5" fill="#0F6E56" stroke="#fff" strokeWidth="1.5" />
          {/* axis titles */}
          <text className="ccx-vp-ax" x="141" y="172" textAnchor="middle">{t(locale, "Popularity — audience reach →")}</text>
          <text className="ccx-vp-ax" x="14" y="82" textAnchor="middle" transform="rotate(-90 14 82)">{t(locale, "Durable value →")}</text>
        </svg>
        <div className="ccx-vp-side">
          <div className="ccx-vp-nums">
            <span><b>{val}</b> {t(locale, "our Value")}</span>
            <span><b>{pop}</b> {t(locale, "audience reach")}</span>
          </div>
          <p className="ccx-vp-note">{note}</p>
          <p className="ccx-vp-cap">{t(locale, "The gap is the point — our durable Value versus the crowd’s attention. Never blended into the score.")}</p>
        </div>
      </div>
    </div>
  );
}

// Axis hexes shared with the appraisal page (tsf-*) and the ccx-v/c/r bar fills
// in globals.css — value green / cost neutral gray / risk red, public light theme.
const AXIS_HEX = { v: "#0F6E56", c: "#8a8f98", r: "#C8102E" } as const;
const MONO = 'ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace';

/* Ring-gauge instrument card — scoped styles injected by the server component
 * (same idiom as the .ccx-qm hover rule below; this file owns no stylesheet).
 * Hairline card edge, uppercase micro-kickers, mono numerals — the TakeScore
 * design language of /takescore/film/[slug]. */
const GAUGE_CSS = `
.ccx-gauges{margin:6px 0 14px; padding:13px 16px 12px; border:1px solid var(--hairline-2,#ddd); border-radius:12px; background:var(--paper-2,#fafafa)}
.ccx-gk{display:flex; align-items:baseline; gap:10px; font-family:var(--font-ui); font-size:10.5px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:var(--ink); margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid var(--hairline)}
.ccx-gk span{margin-left:auto; font-family:${MONO}; font-size:9.5px; font-weight:400; letter-spacing:.05em; color:var(--muted); text-transform:none}
.ccx-grow{display:flex; flex-wrap:wrap; align-items:center; gap:14px 20px}
.ccx-gmid{flex:1 1 220px; min-width:220px; margin:0; align-self:center; font-family:var(--font-serif,Georgia,serif); font-size:14.5px; line-height:1.55; color:var(--ink)}
.ccx-gcell{display:flex; flex-direction:column; align-items:center; gap:3px; flex:0 0 auto; min-width:82px}
.ccx-gcell .sdonut-cap{text-transform:uppercase; letter-spacing:.08em}
.ccx-gcell .sdonut-note{text-transform:uppercase; letter-spacing:.06em; max-width:118px; text-align:center; line-height:1.35}
.ccx-ghint{font-family:var(--font-ui); font-size:9.5px; line-height:1.3; color:var(--muted); text-align:center; max-width:120px}
.ccx-gnet{display:flex; flex-direction:column; justify-content:center; gap:9px; flex:0 0 auto; min-width:150px}
.ccx-gnet-row{display:flex; align-items:baseline; gap:10px}
.ccx-gnet-n{font-family:${MONO}; font-size:40px; font-weight:600; line-height:.9; color:${AXIS_HEX.v}; font-variant-numeric:tabular-nums}
.ccx-gnet-lab{display:flex; flex-direction:column; gap:2px}
.ccx-gnet-lab .k{font-family:var(--font-ui); font-size:10.5px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:var(--ink)}
.ccx-gnet-lab .d{font-family:${MONO}; font-size:10px; color:var(--muted)}
.ccx-gnet-eff{font-family:var(--font-ui); font-size:10.5px; color:var(--muted); padding-top:8px; border-top:1px solid var(--hairline)}
.ccx-gnet-eff b{font-family:${MONO}; font-size:14px; font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums; margin-right:5px}
.ccx-gverdict{margin:12px 0 0; padding-top:11px; border-top:1px solid var(--hairline); font-family:var(--font-serif,Georgia,serif); font-size:14.5px; line-height:1.6; color:var(--ink)}
/* "Where it ranks" — overall-rank instrument strip; the position track echoes
   the appraisal page's .tsf-track (hairline bar, green dot, mono #labels). */
.ccx-rank{margin:2px 0 14px; padding:11px 13px 13px; border:1px solid var(--hairline); border-radius:8px; background:var(--paper,#fafafa)}
.ccx-rank-head{display:flex; flex-wrap:wrap; align-items:baseline; gap:10px}
.ccx-rank-lbl{font-family:var(--font-ui); font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted)}
.ccx-rank-n{font-family:var(--font-ui); font-size:12.5px; font-weight:600; color:var(--ink)}
.ccx-rank-pct{margin-left:auto; font-family:${MONO}; font-size:12px; font-weight:600; color:#0F6E56; font-variant-numeric:tabular-nums}
.ccx-rank-track{display:flex; align-items:center; gap:9px; padding-top:19px; font-family:${MONO}; font-size:10px; color:var(--muted); font-variant-numeric:tabular-nums}
.ccx-rank-bar{position:relative; flex:1; height:4px; border-radius:2px; background:var(--hairline)}
.ccx-rank-bar i{position:absolute; top:50%; transform:translate(-50%,-50%); width:11px; height:11px; border-radius:50%; background:#0F6E56; border:2px solid #fff; box-shadow:0 0 0 1px var(--hairline-2,#ddd)}
.ccx-rank-mark{position:absolute; bottom:9px; transform:translateX(-50%); font-family:${MONO}; font-size:9.5px; font-weight:600; color:#0F6E56; white-space:nowrap}
@media (max-width:600px){
  .ccx-grow{justify-content:center}
  .ccx-gmid{flex-basis:100%; min-width:0; order:3; text-align:left}
  .ccx-gnet{flex-direction:row; align-items:baseline; gap:16px; width:100%; order:1; padding-bottom:10px; border-bottom:1px solid var(--hairline)}
  .ccx-gnet-eff{padding-top:0; border-top:0; margin-left:auto}
  .ccx-gcell{order:2}
}
`;

export default function CinecodexPanel({ data, title, subscores, slug, headerAccessory, locale = DEFAULT_LOCALE }: { data: Codex | null; title: string; subscores?: FilmSubscores | null; slug?: string | null; headerAccessory?: ReactNode; locale?: Locale }) {
  if (!data) return null;
  const { ext } = data;
  const tier = data.conf_tier ?? null;
  const conf = data.conf ?? null;
  const takes = data.n_takes ?? 0;
  const evidence = takes >= 1
    ? (locale === DEFAULT_LOCALE
        ? `grounded in ${takes} critical take${takes === 1 ? "" : "s"} we hold on this film`
        : t(locale, "grounded in {takes} critical takes we hold on this film", { takes }))
    : (locale === DEFAULT_LOCALE
        ? `no written-criticism corpus yet on this film`
        : t(locale, "no written-criticism corpus yet on this film"));

  // Overall U-rank (migration 0047) — rendered only when the RPC provides both
  // numbers; never fabricated. "top N%" when in the upper half, else an honest
  // "bottom X%" (share of films at or below this one).
  const rank = data.rank ?? null;
  const rankTotal = data.rank_total ?? null;
  const hasRank = rank != null && rankTotal != null && rank >= 1 && rankTotal > 1;
  const rankPos = hasRank ? ((rank - 1) / (rankTotal - 1)) * 100 : 0;
  const topPct = hasRank ? Math.max(1, Math.round((rank / rankTotal) * 100)) : 0;
  const rankShare = hasRank
    ? topPct <= 50
      ? t(locale, "top {pct}%", { pct: topPct })
      : t(locale, "bottom {pct}%", { pct: Math.max(1, Math.round(((rankTotal - rank + 1) / rankTotal) * 100)) })
    : "";

  // Per-film TakeScore lead (#5): the film's strongest Value dimension and its
  // sharpest Risk dimension, read straight from data.sub. Presence-gated (R-C1):
  // no sub-scores → no one-liner, and the generic definition folds away below.
  const hasSub = !!data.sub && Object.keys(data.sub).length > 0;
  const topVal = hasSub ? topDim(VALUE, data.sub) : null;
  const topRisk = hasSub ? topDim(RISK, data.sub) : null;
  const valLabel = topVal ? (dimByKey.get(NAME_KEY[topVal.name] ?? "")?.label ?? topVal.name) : "";
  const riskLabel = topRisk ? (dimByKey.get(NAME_KEY[topRisk.name] ?? "")?.label ?? topRisk.name) : "";

  // The deterministic quadrant verdict. EN uses the canonical prose helper
  // (byte-identical); ko projects the same quadrant thresholds through t().
  const verdictText = locale === DEFAULT_LOCALE
    ? verdictShort(data.v, data.c, data.r, data.u, title)
    : (() => {
        const V = Math.round(data.v), R = Math.round(data.r);
        const hiV = V >= 72, loR = R <= 20;
        const key = hiV && loR
          ? "{title} sits at high value · low risk — a safe masterpiece."
          : hiV && !loR
            ? "{title} sits at high value · high risk — ambitious but divisive."
            : !hiV && loR
              ? "{title} is solid but not peak — a stable choice."
              : "{title} sits at mid value, mid risk — approach with care.";
        return t(locale, key, { title });
      })();

  return (
    <section className="df-sec ccx" id="df-codex">
      <h2 className="df-h2">TakeScore™ <a className="ccx-how" href="/takescore/about">{t(locale, "how it works →")}</a></h2>
      {headerAccessory}
      {topVal && topRisk ? (
        <p className="df-sub">
          {t(locale, "{title}’s strongest value is", { title })}{" "}<strong>{t(locale, valLabel)}</strong> ({t(locale, bandWord("value", topVal.score)).toLowerCase()});
          {" "}{t(locale, "its sharpest risk is")}{" "}<strong>{t(locale, riskLabel)}</strong> ({t(locale, bandWord("risk", topRisk.score)).toLowerCase()}).
        </p>
      ) : null}
      <details className="df-sub" style={{ margin: "0 0 12px" }}>
        <summary style={{ cursor: "pointer" }}>{t(locale, "What TakeScore measures")}</summary>
        <span style={{ display: "block", marginTop: 6 }}>
          {t(locale, "Our own estimate of the")}{" "}<strong>{t(locale, "durable value")}</strong>{" "}{t(locale, "a serious viewer gains from {title}, the", { title })}{" "}<strong>{t(locale, "cost")}</strong>{" "}{t(locale, "to unlock it, and the")}{" "}<strong>{t(locale, "risk")}</strong>{" "}{t(locale, "it disappoints — not popularity.")}
          {subscores ? <>{" "}{t(locale, "Scored on the thirteen")}{" "}<a href="/takescore">{t(locale, "TakeScore dimensions")}</a>{" "}{t(locale, "against a fixed anchor ruler.")}</> : null}
        </span>
      </details>

      {/* The three central scores as ring gauges — the same <ScoreDonut> instrument
          as the appraisal page and /takescore curtain, with the net TakeScore beside
          them. Same numbers the old bars carried; presentation only. */}
      <style>{GAUGE_CSS}</style>
      <div className="ccx-gauges">
        <div className="ccx-gk">{t(locale, "How {title} scores", { title })} <span>0–100</span></div>
        {/* TakeScore + verdict fill the width; the three rings sit together at the
            right (same reading order as the /takescore Screener card). */}
        <div className="ccx-grow">
          <div className="ccx-gnet">
            <div className="ccx-gnet-row">
              <span className="ccx-gnet-n">{displayTs(data.u)}</span>
              <span className="ccx-gnet-lab">
                <span className="k">TakeScore</span>
                <span className="d">{t(locale, "Value − Risk")}</span>
              </span>
            </div>
            <div className="ccx-gnet-eff"><b>{data.sharpe}</b>{t(locale, "Efficiency (value per risk)")}</div>
            {data.u < 0 ? (
              <p className="ccx-gnet-eff" style={{ fontSize: "10px", lineHeight: 1.4 }}>
                {t(locale, "The formula floors at zero for display here — Value minus weighted Risk lands below zero.")}{" "}
                <a href="/methodology#rankings" style={{ color: "var(--accent,#C8102E)", textDecoration: "none" }}>{t(locale, "Why →")}</a>
              </p>
            ) : null}
          </div>
          <p className="ccx-gmid">{verdictText}</p>
          <div className="ccx-gcell">
            <ScoreDonut val={data.v} color={AXIS_HEX.v} label={t(locale, "Value")} sub={t(locale, bandWord("value", data.v))} size={66} />
          </div>
          <div className="ccx-gcell">
            <ScoreDonut val={data.c} color={AXIS_HEX.c} label={t(locale, "Cost")} sub={t(locale, bandWord("cost", data.c))} size={66} />
          </div>
          <div className="ccx-gcell">
            <ScoreDonut val={data.r} color={AXIS_HEX.r} label={t(locale, "Risk")} sub={t(locale, bandWord("risk", data.r))} size={66} />
          </div>
        </div>
      </div>

      {/* Where it ranks — overall position by TakeScore among all scored films.
          Real numbers from the RPC or nothing; confidence now lives in the
          df-src disclosure footer below. */}
      {hasRank ? (
        <div className="ccx-rank">
          <div className="ccx-rank-head">
            <span className="ccx-rank-lbl">{t(locale, "Where {title} ranks", { title })}</span>
            <span className="ccx-rank-n">{t(locale, "#{rank} of {total} by TakeScore", { rank: rank.toLocaleString("en-US"), total: rankTotal.toLocaleString("en-US") })}</span>
            <span className="ccx-rank-pct">{rankShare}</span>
          </div>
          <div className="ccx-rank-track" aria-hidden="true">
            <span>#1</span>
            <span className="ccx-rank-bar">
              <span className="ccx-rank-mark" style={{ left: `clamp(16px, ${rankPos}%, calc(100% - 16px))` }}>#{rank.toLocaleString("en-US")}</span>
              <i style={{ left: `${rankPos}%` }} />
            </span>
            <span>#{rankTotal.toLocaleString("en-US")}</span>
          </div>
        </div>
      ) : null}

      <div className="ccx-eval">
        {/* Explicit CTA to the dimension index — the h2's "how it works" goes to /takescore/about,
            and the /takescore link above is buried in prose. Tier-1 only; hover rule for the
            circled "?" lives here too (server component, so no event handlers). */}
        {subscores ? <style>{`.ccx-qm:hover{color:var(--ink);border-color:var(--muted)}`}</style> : null}
        <div className="ccx-eval-h" style={subscores ? { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px" } : undefined}>
          {t(locale, "How {title} scores on the thirteen dimensions", { title })}
          {subscores ? (
            <a
              href="/takescore"
              style={{
                fontFamily: "var(--font-ui)", fontSize: "10.5px", fontWeight: 400,
                color: "var(--accent,#C8102E)", textDecoration: "none",
                textTransform: "none", letterSpacing: 0,
              }}
            >
              {t(locale, "What do these mean? →")}
            </a>
          ) : null}
        </div>
        <div className="ccx-cols">
          <div><div className="ccx-gl ccx-glv">{t(locale, "Value")}</div><Sub names={VALUE} sub={data.sub} tone="ccx-v" rich={!!subscores} locale={locale} /></div>
          <div><div className="ccx-gl ccx-glc">{t(locale, "Cost")}</div><Sub names={COST} sub={data.sub} tone="ccx-c" rich={!!subscores} locale={locale} /></div>
          <div><div className="ccx-gl ccx-glr">{t(locale, "Risk")}</div><Sub names={RISK} sub={data.sub} tone="ccx-r" rich={!!subscores} locale={locale} /></div>
        </div>
      </div>

      {/* Value × Popularity (the "hidden gem" read) — a secondary lens, so it sits
          below the score itself and its dimensional breakdown, not above them. */}
      <ValuePop v={data.v} votes={data.votes} title={title} locale={locale} />

      {(ext.imdb || ext.rt || ext.metascore) ? (
        <div className="ccx-ext">
          <span className="ccx-extl">{t(locale, "Shown alongside — not part of the TakeScore:")}</span>
          {ext.imdb ? <span className="ccx-chip">IMDb {ext.imdb}</span> : null}
          {ext.rt ? <span className="ccx-chip">Rotten Tomatoes {ext.rt}%</span> : null}
          {ext.metascore ? <span className="ccx-chip">Metascore {ext.metascore}</span> : null}
        </div>
      ) : null}

      <div className="df-src">
        {t(locale, "AI-estimated (TakeScore rubric), designed and calibrated by Wonwoo Yoon. A rubric-anchored judgment, not an objective fact; popularity metrics above are for comparison only.")}
        {conf != null ? (
          <> {t(locale, "Confidence")} {tier ? `${tier} ` : ""}({conf}/100) — {evidence}. {t(locale, "A measured reliability, not a claim of certainty.")}</>
        ) : null}
      </div>

      {/* Exit to the film's standalone appraisal page (/takescore/film/[slug]) —
          rendered only when the caller passes the slug, so the panel never
          fabricates a URL. Same accent-link idiom as the CTAs above. */}
      {slug ? (
        <p style={{ margin: "14px 0 0" }}>
          <a
            href={`/takescore/film/${slug}`}
            style={{
              fontFamily: "var(--font-ui)", fontSize: "13px", fontWeight: 600,
              color: "var(--accent,#C8102E)", textDecoration: "none",
            }}
          >
            {t(locale, "View the full appraisal →")}
          </a>
        </p>
      ) : null}
    </section>
  );
}
