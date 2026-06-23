"use client";

import { Fragment, type SyntheticEvent } from "react";
import Link from "next/link";
import CardDeck from "@/components/CardDeck";
import Catalogue, { type CatMode } from "@/components/Catalogue";

export type FilmFeat = {
  slug: string; title: string; year: number | null; dir: string | null; genre: string | null;
  runtime: string | null; rated: string | null; tagline: string | null; bd: string | null;
  figures: number; readings: number; tropes: number;
  readingList: { t: string; slug: string; fig: string }[];
  tropeList: { t: string; slug: string; fig: string }[];
  kin: { t: string; y: number | null; slug: string; n: number }[];
};
export type FilmCat = { slug: string; title: string; year: number | null; director: string | null; genre: string };

const HERO = (p: string | null) => (p ? `https://image.tmdb.org/t/p/w780${p}` : null);

function sortKey(t: string) { return t.toLowerCase().replace(/^(the|a|an)\s+/i, "").trim(); }
function letterOf(t: string) { const c = sortKey(t).charAt(0).toUpperCase(); return c >= "A" && c <= "Z" ? c : "#"; }
function decadeOf(y: number | null) { return y ? `${Math.floor(y / 10) * 10}s` : "Undated"; }

const fadeRef = (el: HTMLImageElement | null) => { if (el && el.complete) el.classList.add("idx-on"); };
const onImgLoad = (e: SyntheticEvent<HTMLImageElement>) => e.currentTarget.classList.add("idx-on");

function viaList(list: { t: string; slug: string; fig: string }[], base: string) {
  return list.map((x, i) => (
    <Link key={i} href={`${base}/${x.slug}`} className="idx-fpitem">
      <div className="it-t">{x.t}</div>
      <div className="it-via"><span className="v">via</span> {x.fig}</div>
    </Link>
  ));
}

function FilmCard(d: FilmFeat) {
  const bits = [d.genre, d.runtime, d.rated].filter(Boolean) as string[];
  return (
    <>
      <div className="idx-hero">
        {d.genre && <span className="idx-badge">{d.genre.split(" · ")[0]}</span>}
        {HERO(d.bd) && <img ref={fadeRef} onLoad={onImgLoad} src={HERO(d.bd) as string} alt={d.title} />}
        <div className="idx-htext">
          <h2><Link href={`/film/${d.slug}`}>{d.title}</Link> {d.year ? <span className="yr">{d.year}</span> : null}</h2>
          {d.dir && <div className="idx-dir">dir. {d.dir}</div>}
        </div>
      </div>
      <div className="idx-fbody">
        <div className="idx-fmeta">
          {bits.map((x, i) => (<Fragment key={i}>{i > 0 && <span className="sep">·</span>}<span>{x}</span></Fragment>))}
          {d.tagline && (<><span className="sep">·</span><span className="tl">“{d.tagline}”</span></>)}
        </div>
        <div className="idx-statrow">
          <div className="idx-stat"><div className="num">{d.figures}</div><div className="lab">Figures</div></div>
          <div className="idx-stat rd"><div className="num">{d.readings}</div><div className="lab">Readings</div></div>
          <div className="idx-stat tr"><div className="num">{d.tropes}</div><div className="lab">Tropes</div></div>
        </div>
        <div className="idx-viahint">Every reading and trope is carried by a <b>figure</b> in the film:</div>
        <div className="idx-fpcols">
          <div className="idx-fpcol">
            <div className="idx-fph"><i className="r" />Strong Misreadings <span className="n">{d.readings}</span></div>
            {d.readingList.length > 0 ? viaList(d.readingList, `/film/${d.slug}/figure`) : <div className="idx-fpempty">No readings yet.</div>}
          </div>
          <div className="idx-fpcol">
            <div className="idx-fph"><i className="t" />Tropes <span className="n">{d.tropes}</span></div>
            {d.tropeList.length > 0 ? viaList(d.tropeList, "/trope") : <div className="idx-fpempty">No tropes yet.</div>}
          </div>
        </div>
        {d.kin.length > 0 && (
          <>
            <div className="idx-seclbl">🎬 Movies like {d.title} <span className="hint">linked by shared readings, not genre</span></div>
            <div className="idx-kin">
              {d.kin.map((x, i) => (
                <Link key={i} href={`/movies-like/${d.slug}`} className="idx-kinchip">
                  {x.t} {x.y ? <span className="ky">’{String(x.y).slice(2)}</span> : null}<span className="kn">{x.n}</span>
                </Link>
              ))}
            </div>
          </>
        )}
        <Link href={`/film/${d.slug}`} className="idx-readmore">Open the film <span aria-hidden="true">→</span></Link>
      </div>
    </>
  );
}

const MODES: CatMode[] = [
  { key: "alpha", label: "A–Z", az: true },
  { key: "genre", label: "Genre" },
  { key: "year", label: "Year" },
];

export default function FilmsIndex({ featured, catalogue }: { featured: FilmFeat[]; catalogue: FilmCat[] }) {
  return (
    <>
      <CardDeck
        items={featured}
        keyOf={(d) => d.slug}
        renderCard={(d) => <FilmCard {...d} />}
        dieText="🎲 Films, at random"
        autoNote="turning · the deck reshuffles every 5 min"
        rollLabel="↻ reshuffle"
        tall
        cardClassName="idx-dcard--film"
      />
      <Catalogue<FilmCat>
        items={catalogue}
        modes={MODES}
        defaultMode="alpha"
        groupOf={(it, mode) => mode === "genre" ? it.genre : mode === "year" ? decadeOf(it.year) : letterOf(it.title)}
        orderGroups={(keys, mode, groups) => {
          if (mode === "genre") return keys.sort((a, b) => groups[b].length - groups[a].length || a.localeCompare(b));
          if (mode === "year") return keys.sort((a, b) => b.localeCompare(a));
          return keys.sort((a, b) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)));
        }}
        orderItems={(mode) => (a, b) => mode === "year"
          ? ((b.year ?? 0) - (a.year ?? 0) || sortKey(a.title).localeCompare(sortKey(b.title)))
          : sortKey(a.title).localeCompare(sortKey(b.title))}
        cell={(it) => ({
          href: `/film/${it.slug}`,
          title: <>{it.title} {it.year ? <span className="yr">({it.year})</span> : null}</>,
          meta: it.director ?? "—",
          text: `${it.title} ${it.director ?? ""}`.toLowerCase(),
        })}
        title="The full catalogue of films"
        sub="Every film on Metatake — each broken into its figures and the meanings it shares. Click a title to open it."
        tot={`${catalogue.length.toLocaleString()} films`}
        filterPlaceholder="Filter films by title or director…"
        emptyText="No film matches that."
      />
    </>
  );
}
