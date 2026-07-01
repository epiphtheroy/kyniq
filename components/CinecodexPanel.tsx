/** TakeScore evaluation card — durable Value, entry Cost, Risk, TakeScore (Value − Risk),
 *  Efficiency, the 13 sub-scores (always shown), and a MEASURED confidence (not luck).
 *  AI-estimated with stated limits. External metrics shown ALONGSIDE, never blended. */
export type Codex = {
  v: number; c: number; r: number; u: number; sharpe: number;
  sub: Record<string, number>;
  n_samples: number | null; sd_v: number | null; panel: string; flagged: boolean;
  conf: number | null; conf_tier: string | null; n_takes: number | null;
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
