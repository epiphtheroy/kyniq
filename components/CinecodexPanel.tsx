/** TakeScore evaluation card — durable Value, entry Cost, Risk, TakeScore (Value − Risk),
 *  Efficiency, the 13 sub-scores (always shown), and a MEASURED confidence (not luck).
 *  AI-estimated with stated limits. External metrics shown ALONGSIDE, never blended. */
export type Codex = {
  v: number; c: number; r: number; u: number; sharpe: number;
  sub: Record<string, number>;
  n_samples: number | null; sd_v: number | null; panel: string; flagged: boolean;
  conf: number | null; conf_tier: string | null; n_takes: number | null; votes: number | null;
  ext: { imdb: number | null; rt: number | null; metascore: number | null };
};

const VALUE = ["Cognitive", "Affective", "Formal", "Moral", "Durability"];
const COST = ["Intertextual", "Formal radicalism", "Extratextual", "Auteur oeuvre"];
const RISK = ["Bankruptcy", "Insincerity", "Cowardice", "Polarization"];

function Bar({ v, tone }: { v: number; tone: string }) {
  return <span className="ccx-bar"><i className={tone} style={{ width: `${Math.max(0, Math.min(100, v))}%` }} /></span>;
}
function Sub({ names, sub, tone }: { names: string[]; sub: Record<string, number>; tone: string }) {
  return (
    <div className="ccx-sub">
      {names.map((n) => (
        <div className="ccx-subrow" key={n}>
          <span className="ccx-subn">{n}</span><Bar v={sub[n] ?? 0} tone={tone} /><span className="ccx-subv">{sub[n] ?? 0}</span>
        </div>
      ))}
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

export default function CinecodexPanel({ data, title }: { data: Codex | null; title: string }) {
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
        <div className="ccx-eval-h">The 13 sub-scores</div>
        <div className="ccx-cols">
          <div><div className="ccx-gl ccx-glv">Value</div><Sub names={VALUE} sub={data.sub} tone="ccx-v" /></div>
          <div><div className="ccx-gl ccx-glc">Cost</div><Sub names={COST} sub={data.sub} tone="ccx-c" /></div>
          <div><div className="ccx-gl ccx-glr">Risk</div><Sub names={RISK} sub={data.sub} tone="ccx-r" /></div>
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
    </section>
  );
}
