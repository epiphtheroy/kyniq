"use client";

/** One tradition (national cinema or movement): sticky sub-tabs + Start here + filterable canon
 *  + auteurs + deep cuts + on-the-map. Fed by movement_detail(). */
import { useMemo, useState } from "react";
import Link from "next/link";
import LensQuickBar from "@/components/LensQuickBar";
import { slugify } from "@/lib/slug";
import type { MvDetail, MvFilm } from "@/app/movements/[slug]/page";

const IMG = "https://image.tmdb.org/t/p";
const decadeOf = (y: number | null) => (y ? `${Math.floor(y / 10) * 10}s` : "—");

function FilmCard({ f }: { f: MvFilm }) {
  return (
    <Link className="mvh-film" href={`/film/${f.slug}`}>
      {f.poster_path
        ? // eslint-disable-next-line @next/next/no-img-element
          <img className="mvh-poster" src={`${IMG}/w154${f.poster_path}`} alt={`${f.title}${f.year ? ` (${f.year})` : ""} poster`} loading="lazy" />
        : <div className="mvh-poster mvh-poster--empty" />}
      <div className="mvh-fmeta">
        <div className="mvh-ftitle">{f.title}{f.year ? <span className="mvh-yr"> ({f.year})</span> : null}</div>
        {f.director ? <div className="mvh-fdir">{f.director}</div> : null}
      </div>
    </Link>
  );
}

const TABS = [
  ["start", "Start here"], ["canon", "The canon"], ["auteurs", "Auteurs"],
  ["deep", "Deep cuts"], ["map", "On the map"],
] as const;

export default function MovementHubClient({ d }: { d: MvDetail }) {
  const films = d.films || [];
  const [decade, setDecade] = useState("");
  const [sort, setSort] = useState<"demand" | "year">("demand");

  const startHere = films.slice(0, 5);
  const deepCuts = useMemo(
    () => films.filter((f) => f.authority).slice().sort((a, b) => (a.demand ?? 0) - (b.demand ?? 0)).slice(0, 6),
    [films]
  );
  const decades = useMemo(() => [...new Set(films.map((f) => decadeOf(f.year)).filter((x) => x !== "—"))]
    .sort((a, b) => parseInt(b) - parseInt(a)), [films]);

  const canon = useMemo(() => {
    let b = films.slice();
    if (decade) b = b.filter((f) => decadeOf(f.year) === decade);
    b.sort(sort === "year" ? (x, y) => (y.year ?? 0) - (x.year ?? 0) : (x, y) => (y.demand ?? 0) - (x.demand ?? 0));
    return b;
  }, [films, decade, sort]);

  const kindLabel = d.kind === "national" ? "National cinema" : "Film movement";

  return (
    <>
      <h1 className="lh-h1">{d.hub.label}</h1>
      <div className="lh-kick">
        {kindLabel}{d.hub.region ? ` · ${d.hub.region}` : ""}<span className="lh-cnt">{films.length} films</span>
      </div>
      {d.hub.description ? <p className="lh-def">{d.hub.description}</p> : null}

      <LensQuickBar />

      <div className="mvh-tabs">
        {TABS.map(([id, label]) => {
          if (id === "auteurs" && !d.auteurs?.length) return null;
          if (id === "deep" && !deepCuts.length) return null;
          if (id === "map" && d.kind !== "national") return null;
          return <a key={id} href={`#mvh-${id}`}>{label}</a>;
        })}
      </div>

      <section id="mvh-start" className="mvh-sec">
        <h2 className="mvh-h2">Start here</h2>
        <div className="mvh-films">{startHere.map((f) => <FilmCard key={f.slug} f={f} />)}</div>
      </section>

      <section id="mvh-canon" className="mvh-sec">
        <h2 className="mvh-h2">The canon we hold</h2>
        <div className="mvh-filter">
          {decades.length ? (
            <select value={decade} onChange={(e) => setDecade(e.target.value)}>
              <option value="">All decades</option>
              {decades.map((dd) => <option key={dd} value={dd}>{dd}</option>)}
            </select>
          ) : null}
          <select value={sort} onChange={(e) => setSort(e.target.value as "demand" | "year")}>
            <option value="demand">Most known</option>
            <option value="year">Newest</option>
          </select>
          <span className="mvh-fcount">{canon.length}</span>
        </div>
        <div className="mvh-films">{canon.map((f) => <FilmCard key={f.slug} f={f} />)}</div>
      </section>

      {d.auteurs?.length ? (
        <section id="mvh-auteurs" className="mvh-sec">
          <h2 className="mvh-h2">Key auteurs</h2>
          <div className="mvh-auteurs">
            {d.auteurs.map((a) => (
              <Link key={a.director} className="mvh-aut" href={`/director/${slugify(a.director)}`}>
                {a.director}<span>{a.n}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {deepCuts.length ? (
        <section id="mvh-deep" className="mvh-sec">
          <h2 className="mvh-h2">Deep cuts</h2>
          <p className="mvh-note">High-authority, lesser-seen — the rewards.</p>
          <div className="mvh-films">{deepCuts.map((f) => <FilmCard key={f.slug} f={f} />)}</div>
        </section>
      ) : null}

      {d.kind === "national" ? (
        <section id="mvh-map" className="mvh-sec">
          <h2 className="mvh-h2">On the map</h2>
          <p className="mvh-note">See where these films are set and shot.</p>
          <Link className="mvh-maplink" href="/locations">Open the map →</Link>
        </section>
      ) : null}
    </>
  );
}
