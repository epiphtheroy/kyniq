import Link from "next/link";

/**
 * TrendingSections — the four ranked trending blocks (Meta takes · Takes · Tropes
 * · Films), shown through the films & figures that carry them. Pure render: pass in
 * a `pool` from the `trending_pool` RPC. Used by /trending (full page, with window
 * toggle chrome) and embedded at the bottom of the home page. One source of truth.
 */

const W342 = "https://image.tmdb.org/t/p/w342";
const REGC: Record<string, string> = {
  psychoanalytic: "#A8434F", formal: "#5B8FB9", mythic: "#A9743B", existential: "#546E7A",
  philosophical: "#7E57C2", ideological: "#C0392B", semiotic: "#B8860B", politico_economic: "#2E7D5B",
  genealogical: "#2E86C1", reception: "#159A8A",
};
const REGL: Record<string, string> = {
  psychoanalytic: "Psychoanalytic", formal: "Formal", mythic: "Mythic", existential: "Existential",
  philosophical: "Philosophical", ideological: "Ideological", semiotic: "Semiotic", politico_economic: "Politico-economic",
  genealogical: "Film-historical", reception: "Reception",
};

export type TCase = { f: string; y: number | null; fs: string; fig: string; bd: string | null };
export type TMeta = { t: string; slug: string; n: number; cases: TCase[] };
export type TTrope = { t: string; slug: string; fg: number; n: number; cases: TCase[] };
export type TFilm = { t: string; slug: string; y: number | null; dir: string | null; bd: string | null; n: number; vias: { fig: string; mt: string; mtslug: string }[] };
export type TTake = { reg: string | null; fig: string; figslug: string | null; f: string; fs: string; y: number | null; mt: string; mtslug: string; snip: string; bd: string | null };
export type TrendPool = { metas: TMeta[]; takes: TTake[]; tropes: TTrope[]; films: TFilm[] };

function Strip({ cases }: { cases: TCase[] }) {
  return (
    <div className="tg-strip">
      {cases.map((c, i) => (
        <Link key={i} href={`/film/${c.fs}`} className="tg-film">
          <span className="tg-th">{c.bd && <img src={`${W342}${c.bd}`} alt="" loading="lazy" />}</span>
          <div className="tf">{c.f} {c.y ? <span className="yr">({c.y})</span> : null}</div>
          <div className="tvia"><span className="v">via</span> {c.fig}</div>
        </Link>
      ))}
    </div>
  );
}

function Section({ color, name, sub, more, moreHref, children }: { color: string; name: string; sub: string; more: string; moreHref: string; children: React.ReactNode }) {
  return (
    <section className="tg-sec">
      <div className="tg-head">
        <h2 className="tg-h"><span className="tg-badge" style={{ background: color }}>{name}</span> <span className="tg-ths">{sub}</span></h2>
        <Link className="tg-more" href={moreHref}>{more}</Link>
      </div>
      {children}
    </section>
  );
}

export default function TrendingSections({ pool }: { pool: TrendPool }) {
  return (
    <>
      <Section color="#E3120B" name="Meta takes" sub="recurring readings" more="All meta takes →" moreHref="/meta-takes">
        {pool.metas.map((m, i) => (
          <div className="tg-card" key={m.slug}>
            <span className="tg-rk">{i + 1}</span>
            <div className="tg-body">
              <Link className="tg-tt" href={`/take/${m.slug}`}>{m.t}</Link>
              <div className="tg-tc">{m.n} films share this reading</div>
              {m.cases.length > 0 && <Strip cases={m.cases} />}
            </div>
          </div>
        ))}
      </Section>

      <Section color="#A8434F" name="Takes" sub="individual readings" more="More readings →" moreHref="/latest">
        {pool.takes.map((t, i) => {
          const reg = t.reg ?? "formal";
          return (
            <div className="tg-card take" key={i}>
              <span className="tg-rk">{i + 1}</span>
              <div className="tg-body">
                <span className="tg-reg" style={{ background: REGC[reg] ?? "#5B8FB9" }}>{REGL[reg] ?? reg}</span>
                <Link className="tg-tt" href={t.figslug ? `/film/${t.fs}/figure/${t.figslug}` : `/film/${t.fs}`}>{t.fig}</Link>
                <div className="tg-tc">{t.f} · {t.y}</div>
                <p className="tg-snip">{t.snip}</p>
                <Link className="tg-takevia" href={`/take/${t.mtslug}`}>→ {t.mt}</Link>
              </div>
              {t.bd && <Link className="tg-tkthumb" href={t.figslug ? `/film/${t.fs}/figure/${t.figslug}` : `/film/${t.fs}`}><img src={`${W342}${t.bd}`} alt="" loading="lazy" /></Link>}
            </div>
          );
        })}
      </Section>

      <Section color="#167C6B" name="Tropes" sub="figure-types" more="All tropes →" moreHref="/tropes">
        {pool.tropes.map((tr, i) => (
          <div className="tg-card tr" key={tr.slug}>
            <span className="tg-rk">{i + 1}</span>
            <div className="tg-body">
              <Link className="tg-tt" href={`/trope/${tr.slug}`}>{tr.t}</Link>
              <div className="tg-tc">{tr.fg} figures · {tr.n} films</div>
              {tr.cases.length > 0 && <Strip cases={tr.cases} />}
            </div>
          </div>
        ))}
      </Section>

      <Section color="#26303B" name="Films" sub="most read closely" more="All films →" moreHref="/film">
        {pool.films.map((f, i) => (
          <div className="tg-card film" key={f.slug}>
            <span className="tg-rk">{i + 1}</span>
            {f.bd && <Link className="tg-fthumb" href={`/film/${f.slug}`}><img src={`${W342}${f.bd}`} alt="" loading="lazy" /></Link>}
            <div className="tg-body">
              <Link className="tg-tt" href={`/film/${f.slug}`}>{f.t} {f.y ? <span className="yr">({f.y})</span> : null}</Link>
              <div className="tg-tc">{f.dir ? `dir. ${f.dir} · ` : ""}{f.n} readings</div>
              <ul className="tg-vias">
                {f.vias.map((v, j) => <li key={j}><span className="vfig">{v.fig}</span><span className="va">→</span><b>{v.mt}</b></li>)}
              </ul>
            </div>
          </div>
        ))}
      </Section>
    </>
  );
}
