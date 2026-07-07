/** TakeScore evaluation card — durable Value, entry Cost, Risk, TakeScore (Value − Risk),
 *  Efficiency, the 13 sub-scores (always shown), and a MEASURED confidence (not luck).
 *  AI-estimated with stated limits. External metrics shown ALONGSIDE, never blended. */
import type { CSSProperties } from "react";
import { dimByKey, takescoreDimUrl } from "@/lib/cinecodex_dims";

export type Codex = {
  v: number; c: number; r: number; u: number; sharpe: number;
  sub: Record<string, number>;
  n_samples: number | null; sd_v: number | null; panel: string; flagged: boolean;
  conf: number | null; conf_tier: string | null; n_takes: number | null; votes: number | null;
  ext: { imdb: number | null; rt: number | null; metascore: number | null };
};

/** Payload of public.cinecodex_film_subscores — raw sub-scores plus each dimension's
 *  percentile against all scored films. Null for unscored films. */
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

// Neutral, honest percentile phrasing per dimension group. Cost is a prerequisite
// (steeper), risk a hazard (riskier) — only value dims read as "higher is better".
function pctPhrase(group: "value" | "cost" | "risk", pct: number, total: number): string {
  if (group === "value") return `higher than ${pct}% of ${total.toLocaleString("en-US")} films`;
  if (group === "cost") return `steeper than ${pct}%`;
  return `riskier than ${pct}%`;
}

const PCT_STYLE: CSSProperties = {
  fontFamily: "var(--font-ui)", fontSize: "10px", color: "var(--muted)",
  lineHeight: 1.35, margin: "-2px 0 8px",
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
function Sub({ names, sub, tone, pct, total }: { names: string[]; sub: Record<string, number>; tone: string; pct?: Record<string, number>; total?: number }) {
  return (
    <div className="ccx-sub">
      {names.map((n) => {
        // Legacy (no percentile data passed): markup unchanged for existing callers.
        if (!pct || total == null) {
          return (
            <div className="ccx-subrow" key={n}>
              <span className="ccx-subn">{n}</span><Bar v={sub[n] ?? 0} tone={tone} /><span className="ccx-subv">{sub[n] ?? 0}</span>
            </div>
          );
        }
        // Crawlable layer: the label links to its /takescore/[dim] page, a circled
        // "?" makes the explanation page an explicit affordance, and a
        // server-rendered percentile line sits under the row (same muted voice).
        const dim = dimByKey.get(NAME_KEY[n] ?? "");
        const p = dim ? pct[dim.key] : undefined;
        const qm = dim ? `What is ${dim.label}? — full explanation and ranking` : "";
        return (
          <div key={n}>
            <div className="ccx-subrow" style={dim ? SUBROW_QM_STYLE : undefined}>
              {dim
                ? <a className="ccx-subn" href={takescoreDimUrl(dim.slug)} title={dim.question}>{n}</a>
                : <span className="ccx-subn">{n}</span>}
              <Bar v={sub[n] ?? 0} tone={tone} /><span className="ccx-subv">{sub[n] ?? 0}</span>
              {dim
                ? <a className="ccx-qm" href={takescoreDimUrl(dim.slug)} aria-label={qm} title={qm} style={QM_STYLE}>?</a>
                : null}
            </div>
            {dim && typeof p === "number" ? <div style={PCT_STYLE}>{pctPhrase(dim.group, p, total)}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

/** Value vs Popularity 2×2 — the divergence IS the product. Our durable Value (y) against
 *  the crowd's attention (x, from log votes). The gap tells the story: high value + low reach
 *  = a hidden gem; high reach + low value = popular but thin. Never blended into the score. */
function ValuePop({ v, votes }: { v: number; votes: number | null }) {
  if (votes == null || votes < 50) return null;
  const val = Math.round(v);
  const pop = Math.round(Math.max(0, Math.min(1, (Math.log10(Math.max(votes, 1)) - 3.5) / 3)) * 100);
  const gap = val - pop;

  let head: string, note: string;
  if (val >= 60 && pop < 45) { head = "Hidden gem"; note = `high durable value (${val}) well above its audience reach (${pop}) — a cinephile's find.`; }
  else if (val >= 58 && pop >= 55) { head = "Consensus classic"; note = `widely seen and it holds up — value ${val}, reach ${pop}.`; }
  else if (val < 50 && pop >= 58) { head = "Popular, lighter harvest"; note = `enjoyed widely (reach ${pop}) but less durable value (${val}) to re-mine.`; }
  else if (val < 48 && pop < 45) { head = "A quiet minor work"; note = `modest reach (${pop}) and a modest durable payoff (${val}).`; }
  else if (gap >= 15) { head = "Under-seen for its value"; note = `durable value ${val} outruns audience reach ${pop}.`; }
  else if (gap <= -15) { head = "Loved beyond its durable value"; note = `audience reach ${pop} outruns durable value ${val}.`; }
  else { head = "Value and reach aligned"; note = `durable value ${val} and audience reach ${pop} track closely.`; }

  // plot geometry (viewBox 0 0 260 190). plot area x:34..248, y:14..150
  const px = 34 + (pop / 100) * (248 - 34);
  const py = 150 - (val / 100) * (150 - 14);
  const cx = 34 + 0.5 * (248 - 34); // center vertical (pop 50)
  const cy = 150 - 0.5 * (150 - 14); // center horizontal (value 50)

  return (
    <div className="ccx-vp">
      <div className="ccx-vp-head"><b>{head}</b><span>Value × Popularity</span></div>
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
          <text className="ccx-vp-q" x="40" y="26">Hidden gem</text>
          <text className="ccx-vp-q" x="244" y="26" textAnchor="end">Consensus classic</text>
          <text className="ccx-vp-q" x="244" y="146" textAnchor="end">Popular · lighter</text>
          <text className="ccx-vp-q" x="40" y="146">Minor</text>
          {/* the film */}
          <circle cx={px} cy={py} r="9" fill="#0F6E56" opacity="0.16" />
          <circle cx={px} cy={py} r="5" fill="#0F6E56" stroke="#fff" strokeWidth="1.5" />
          {/* axis titles */}
          <text className="ccx-vp-ax" x="141" y="172" textAnchor="middle">Popularity — audience reach →</text>
          <text className="ccx-vp-ax" x="14" y="82" textAnchor="middle" transform="rotate(-90 14 82)">Durable value →</text>
        </svg>
        <div className="ccx-vp-side">
          <div className="ccx-vp-nums">
            <span><b>{val}</b> our Value</span>
            <span><b>{pop}</b> audience reach</span>
          </div>
          <p className="ccx-vp-note">{note}</p>
          <p className="ccx-vp-cap">The gap is the point — our durable Value versus the crowd&rsquo;s attention. Never blended into the score.</p>
        </div>
      </div>
    </div>
  );
}

export default function CinecodexPanel({ data, title, subscores, slug }: { data: Codex | null; title: string; subscores?: FilmSubscores | null; slug?: string | null }) {
  if (!data) return null;
  const { ext } = data;
  const tier = data.conf_tier ?? null;
  const conf = data.conf ?? null;
  const tierClass = tier === "High" ? "ccx-cf--hi" : tier === "Moderate" ? "ccx-cf--mid" : "ccx-cf--lo";
  const takes = data.n_takes ?? 0;
  const evidence = takes >= 1
    ? `grounded in ${takes} critical take${takes === 1 ? "" : "s"} we hold on this film`
    : `no written-criticism corpus yet — a single-pass model judgment`;

  return (
    <section className="df-sec ccx" id="df-codex">
      <h2 className="df-h2">TakeScore <a className="ccx-how" href="/takescore/about">how it works →</a></h2>
      <p className="df-sub">
        Our own estimate of the <strong>durable value</strong> a serious viewer gains from {title},
        the <strong>cost</strong> to unlock it, and the <strong>risk</strong> it disappoints — not popularity.
        {subscores ? <>{" "}Scored on the thirteen <a href="/takescore">CineCodex dimensions</a> against a fixed anchor ruler.</> : null}
      </p>

      <div className="ccx-axes">
        <div className="ccx-axis"><div className="ccx-al">Value <span>higher is better</span></div><Bar v={data.v} tone="ccx-v" /><b>{data.v}</b></div>
        <div className="ccx-axis"><div className="ccx-al">Cost <span>prerequisite, not a virtue</span></div><Bar v={data.c} tone="ccx-c" /><b>{data.c}</b></div>
        <div className="ccx-axis"><div className="ccx-al">Risk <span>higher = more likely to disappoint</span></div><Bar v={data.r} tone="ccx-r" /><b>{data.r}</b></div>
      </div>
      <div className="ccx-net">
        <div><span className="ccx-big">{data.u}</span><span className="ccx-nl">TakeScore (Value − Risk)</span></div>
        <div><span className="ccx-big">{data.sharpe}</span><span className="ccx-nl">Efficiency (value per risk)</span></div>
      </div>

      <ValuePop v={data.v} votes={data.votes} />

      {conf != null ? (
        <div className={`ccx-cf ${tierClass}`}>
          <div className="ccx-cf-head">
            <span className="ccx-cf-lbl">Confidence</span>
            <span className="ccx-cf-tier">{tier}</span>
            <span className="ccx-cf-pct">{conf}<i>/100</i></span>
          </div>
          <Bar v={conf} tone="ccx-cf-fill" />
          <p className="ccx-cf-note">How well-grounded this score is — {evidence}. A measured reliability, not a claim of certainty.</p>
        </div>
      ) : null}

      <div className="ccx-eval">
        {/* Explicit CTA to the dimension index — the h2's "how it works" goes to /takescore/about,
            and the /takescore link above is buried in prose. Tier-1 only; hover rule for the
            circled "?" lives here too (server component, so no event handlers). */}
        {subscores ? <style>{`.ccx-qm:hover{color:var(--ink);border-color:var(--muted)}`}</style> : null}
        <div className="ccx-eval-h" style={subscores ? { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px" } : undefined}>
          The 13 sub-scores
          {subscores ? (
            <a
              href="/takescore"
              style={{
                fontFamily: "var(--font-ui)", fontSize: "10.5px", fontWeight: 400,
                color: "var(--accent,#C8102E)", textDecoration: "none",
                textTransform: "none", letterSpacing: 0,
              }}
            >
              What do these mean? →
            </a>
          ) : null}
        </div>
        <div className="ccx-cols">
          <div><div className="ccx-gl ccx-glv">Value</div><Sub names={VALUE} sub={data.sub} tone="ccx-v" pct={subscores?.pct} total={subscores?.total_scored} /></div>
          <div><div className="ccx-gl ccx-glc">Cost</div><Sub names={COST} sub={data.sub} tone="ccx-c" pct={subscores?.pct} total={subscores?.total_scored} /></div>
          <div><div className="ccx-gl ccx-glr">Risk</div><Sub names={RISK} sub={data.sub} tone="ccx-r" pct={subscores?.pct} total={subscores?.total_scored} /></div>
        </div>
      </div>

      {(ext.imdb || ext.rt || ext.metascore) ? (
        <div className="ccx-ext">
          <span className="ccx-extl">Shown alongside — not part of the TakeScore:</span>
          {ext.imdb ? <span className="ccx-chip">IMDb {ext.imdb}</span> : null}
          {ext.rt ? <span className="ccx-chip">Rotten Tomatoes {ext.rt}%</span> : null}
          {ext.metascore ? <span className="ccx-chip">Metascore {ext.metascore}</span> : null}
        </div>
      ) : null}

      <div className="df-src">
        AI-estimated (Cinecodex rubric, {data.panel}{data.n_samples ? `, n=${data.n_samples}` : ""}
        {data.sd_v != null ? `, ±${Math.round(Number(data.sd_v))}` : ""}). A rubric-anchored judgment, not an objective fact;
        popularity metrics above are for comparison only.
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
            View the full appraisal &rarr;
          </a>
        </p>
      ) : null}
    </section>
  );
}
