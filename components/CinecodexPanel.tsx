/** Cinecodex panel — durable value (V), entry cost (C), risk (R), net (U), efficiency (Sharpe).
 *  AI-estimated with measured reliability. External metrics shown ALONGSIDE, never blended. */
export type Codex = {
  v: number; c: number; r: number; u: number; sharpe: number;
  sub: Record<string, number>;
  n_samples: number | null; sd_v: number | null; panel: string; flagged: boolean;
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
  return (
    <section className="df-sec ccx" id="df-codex">
      <h2 className="df-h2">Metatake Score <a className="ccx-how" href="/codex/about">how it works →</a></h2>
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
        <div><span className="ccx-big">{data.u}</span><span className="ccx-nl">Net value (V − R)</span></div>
        <div><span className="ccx-big">{data.sharpe}</span><span className="ccx-nl">Efficiency (value per risk)</span></div>
      </div>

      <details className="ccx-details">
        <summary>The 13 sub-scores</summary>
        <div className="ccx-cols">
          <div><div className="ccx-gl ccx-glv">Value</div><Sub names={VALUE} sub={data.sub} tone="ccx-v" /></div>
          <div><div className="ccx-gl ccx-glc">Cost</div><Sub names={COST} sub={data.sub} tone="ccx-c" /></div>
          <div><div className="ccx-gl ccx-glr">Risk</div><Sub names={RISK} sub={data.sub} tone="ccx-r" /></div>
        </div>
      </details>

      {(ext.imdb || ext.rt || ext.metascore) ? (
        <div className="ccx-ext">
          <span className="ccx-extl">Shown alongside — not part of the Codex score:</span>
          {ext.imdb ? <span className="ccx-chip">IMDb {ext.imdb}</span> : null}
          {ext.rt ? <span className="ccx-chip">RT {ext.rt}%</span> : null}
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
