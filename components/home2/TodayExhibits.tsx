import Link from "next/link";
import type { Exhibits } from "@/lib/home2";
import { posterUrl, backdropUrl, tsQuadrant } from "./helpers";
import { displayTs } from "@/lib/cinecodex_dims";

/**
 * "Today at Metatake" — a day-seeded band that samples one item from each
 * content layer the main rails don't surface (a film, a reception reversal, a
 * curious question, a shooting place, a strong misreading, a counterpoint pair).
 * Data: home_daily_exhibits(YYYYMMDD). SSR'd (no flash, indexable); each tile is
 * a single link into that layer. Null tiles are skipped, so the band is 4–6 wide.
 */
export default function TodayExhibits({ ex }: { ex: Exhibits }) {
  if (!ex) return null;
  const tiles: React.ReactNode[] = [];

  if (ex.film) {
    const f = ex.film;
    const img = backdropUrl(f.backdrop) ?? posterUrl(f.poster);
    tiles.push(
      <Link className="hx-tile wide" href={`/film/${f.slug}`} key="film">
        {img ? <span className="hx-img" style={{ backgroundImage: `url(${img})` }} /> : <span className="hx-img" />}
        <span className="hx-body">
          <span className="hx-k">Film of the day</span>
          <span className="hx-t">{f.title}{f.year ? ` (${f.year})` : ""}</span>
          <span className="hx-d">
            {f.director ?? "on the map"}
            {f.ts != null ? (
              <span className="hx-ts" title={`TakeScore ${displayTs(f.ts)}${tsQuadrant(f.tsv, f.tsr) ? ` — ${tsQuadrant(f.tsv, f.tsr)}` : ""}`}>TakeScore&nbsp;{displayTs(f.ts)}</span>
            ) : null}
          </span>
        </span>
      </Link>
    );
  }

  if (ex.reversal) {
    const r = ex.reversal;
    const img = posterUrl(r.poster);
    const span = r.y2 - r.y1;
    tiles.push(
      <Link className="hx-tile" href={`/film/${r.slug}/reception`} key="rev">
        {img ? <span className="hx-thumb" style={{ backgroundImage: `url(${img})` }} /> : null}
        <span className="hx-body">
          <span className="hx-k">The reversal</span>
          <span className="hx-t">{r.title}</span>
          <span className="hx-d"><b>{r.y1}</b> → <b>{r.y2}</b> · reappraised over {span} years</span>
        </span>
      </Link>
    );
  }

  if (ex.question) {
    const q = ex.question;
    tiles.push(
      <Link className="hx-tile" href={`/film/${q.fslug}/q/${q.qslug}`} key="q">
        {posterUrl(q.poster) ? <span className="hx-thumb" style={{ backgroundImage: `url(${posterUrl(q.poster)})` }} /> : null}
        <span className="hx-body">
          <span className="hx-k">A question</span>
          <span className="hx-t">{q.title}</span>
          <span className="hx-d">on {q.film}{q.year ? ` (${q.year})` : ""}</span>
        </span>
      </Link>
    );
  }

  if (ex.place) {
    const p = ex.place;
    tiles.push(
      <Link className="hx-tile" href={`/film/locations/${p.fslug}`} key="place">
        {posterUrl(p.poster) ? <span className="hx-thumb" style={{ backgroundImage: `url(${posterUrl(p.poster)})` }} /> : null}
        <span className="hx-body">
          <span className="hx-k">Where it was shot</span>
          <span className="hx-t">{p.place}</span>
          <span className="hx-d">in {p.film}{p.year ? ` (${p.year})` : ""}</span>
        </span>
      </Link>
    );
  }

  if (ex.misreading) {
    const m = ex.misreading;
    tiles.push(
      <Link className="hx-tile" href={`/film/${m.slug}/misreadings`} key="mis">
        {posterUrl(m.poster) ? <span className="hx-thumb" style={{ backgroundImage: `url(${posterUrl(m.poster)})` }} /> : null}
        <span className="hx-body">
          <span className="hx-k">Strong misreading</span>
          <span className="hx-t">{m.title}</span>
          <span className="hx-d">{m.trope ?? "the readings, assembled"}</span>
        </span>
      </Link>
    );
  }

  if (ex.counterpoint) {
    const c = ex.counterpoint;
    tiles.push(
      <Link className="hx-tile" href={`/trope/${c.slug}`} key="cp">
        <span className="hx-body">
          <span className="hx-k">The counterpoint</span>
          <span className="hx-t">{c.a.f} <span className="hx-vs">⟷</span> {c.b.f}</span>
          <span className="hx-d">same figure, opposite readings · {c.trope}</span>
        </span>
      </Link>
    );
  }

  if (tiles.length === 0) return null;
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });

  return (
    <section className="hx-sec" aria-label="Today at Metatake">
      <div className="hx-head">
        <h2 className="hx-title">Today at Metatake</h2>
        <span className="hx-date">{today} · a sample from each layer</span>
      </div>
      <div className="hx-band">{tiles}</div>
    </section>
  );
}
