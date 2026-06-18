"use client";

import { type SyntheticEvent } from "react";
import Link from "next/link";
import CardDeck from "@/components/CardDeck";
import Catalogue, { type CatMode } from "@/components/Catalogue";

type DirSig = { t: string; slug: string; n: number; fig: string };
export type DirFeat = {
  slug: string; name: string; photo: string | null; place: string | null; born: number | null;
  films: number; mt: number; tropes: number;
  rep: { t: string; y: number | null; bd: string | null } | null;
  readings: DirSig[]; tropesList: DirSig[];
  filmography: { t: string; y: number | null; s: string }[];
};
export type DirCat = { slug: string; name: string; country: string; films: number };

const PHOTO = (p: string | null) => (p ? `https://image.tmdb.org/t/p/w185${p}` : null);
const BACKDROP = (p: string | null) => (p ? `https://image.tmdb.org/t/p/w500${p}` : null);

function firstLetter(s: string) { const c = (s || "").charAt(0).toUpperCase(); return c >= "A" && c <= "Z" ? c : "#"; }

const fadeRef = (el: HTMLImageElement | null) => { if (el && el.complete) el.classList.add("idx-on"); };
const onImgLoad = (e: SyntheticEvent<HTMLImageElement>) => e.currentTarget.classList.add("idx-on");

function sigList(list: DirSig[], cls: "r" | "t", base: string) {
  return list.map((s, i) => (
    <Link key={i} href={`${base}/${s.slug}`} className="idx-fpitem">
      <div className="idx-fphd"><span className="idx-fpn">{s.t}</span>{s.n > 1 && <span className={`idx-pill ${cls}`}>×{s.n}</span>}</div>
      <div className="idx-fpvia"><span className="v">via</span> {s.fig}</div>
    </Link>
  ));
}

function DirectorCard(d: DirFeat) {
  return (
    <>
      <div className="idx-dtop">
        {PHOTO(d.photo) && <img className="idx-dphoto" src={PHOTO(d.photo) as string} alt={d.name} loading="lazy" />}
        <div className="idx-dmeta">
          <h2><Link href={`/director/${d.slug}`}>{d.name}</Link></h2>
          <div className="idx-place">{[d.place, d.born ? `b.${d.born}` : null].filter(Boolean).join(" · ")}</div>
          <div className="idx-statrow">
            <div className="idx-stat"><div className="num">{d.films}</div><div className="lab">Films</div></div>
            <div className="idx-stat mt"><div className="num">{d.mt}</div><div className="lab">Meta takes</div></div>
            <div className="idx-stat tr"><div className="num">{d.tropes}</div><div className="lab">Tropes</div></div>
          </div>
        </div>
      </div>

      {d.rep && (
        <div className="idx-repbanner">
          <span className="idx-rb-tx">Each signature traced through <b>{d.rep.t}</b> {d.rep.y ? <span className="yr">({d.rep.y})</span> : null} — the figure that carries it:</span>
          {BACKDROP(d.rep.bd) && <span className="idx-rb-thumb"><img ref={fadeRef} onLoad={onImgLoad} src={BACKDROP(d.rep.bd) as string} alt={d.rep.t} /></span>}
        </div>
      )}

      <div className="idx-fpcols">
        <div className="idx-fpcol">
          <div className="idx-fph"><i className="r" />Signature readings</div>
          {d.readings.length > 0 ? sigList(d.readings, "r", "/take") : <div className="idx-fpempty">No signature readings yet.</div>}
        </div>
        <div className="idx-fpcol">
          <div className="idx-fph"><i className="t" />Signature tropes</div>
          {d.tropesList.length > 0 ? sigList(d.tropesList, "t", "/trope") : <div className="idx-fpempty">No signature tropes yet.</div>}
        </div>
      </div>

      <div className="idx-lbl2">Filmography</div>
      <div className="idx-filmchips">
        {d.filmography.map((f, i) => (
          <Link key={i} href={`/film/${f.s}`} className="idx-fchip">
            {f.t} {f.y ? <span className="yr">’{String(f.y).slice(2)}</span> : null}
          </Link>
        ))}
      </div>

      <Link href={`/director/${d.slug}`} className="idx-readmore">Open the director <span aria-hidden="true">→</span></Link>
    </>
  );
}

const MODES: CatMode[] = [
  { key: "alpha", label: "A–Z", az: true },
  { key: "nat", label: "Nationality" },
  { key: "films", label: "Films" },
];

export default function DirectorsIndex({ featured, catalogue }: { featured: DirFeat[]; catalogue: DirCat[] }) {
  return (
    <>
      <CardDeck
        items={featured}
        keyOf={(d) => d.slug}
        renderCard={(d) => <DirectorCard {...d} />}
        dieText="🎲 Directors, at random"
        autoNote="turning · the deck reshuffles every 5 min"
        rollLabel="↻ reshuffle"
        tall
      />
      <Catalogue<DirCat>
        items={catalogue}
        modes={MODES}
        defaultMode="alpha"
        groupOf={(it, mode) => mode === "nat" ? it.country : mode === "films" ? "Most films" : firstLetter(it.name)}
        orderGroups={(keys, mode, groups) => {
          if (mode === "nat") return keys.sort((a, b) => groups[b].length - groups[a].length || a.localeCompare(b));
          if (mode === "films") return ["Most films"];
          return keys.sort((a, b) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)));
        }}
        orderItems={(mode) => (a, b) => mode === "films"
          ? (b.films - a.films || a.name.localeCompare(b.name))
          : a.name.localeCompare(b.name)}
        headerOf={(key, mode) => mode === "films" ? "Most films first" : key}
        cell={(it) => ({
          href: `/director/${it.slug}`,
          title: it.name,
          meta: `${it.films} ${it.films === 1 ? "film" : "films"} · ${it.country}`,
          text: `${it.name} ${it.country}`.toLowerCase(),
        })}
        title="The full catalogue of directors"
        sub="Every director on Metatake. Click any name to open their filmography, signature readings and tropes."
        tot={`${catalogue.length.toLocaleString()} directors`}
        filterPlaceholder="Filter directors by name…"
        emptyText="No director matches that."
      />
    </>
  );
}
