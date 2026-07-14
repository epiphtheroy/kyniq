"use client";

import { type SyntheticEvent } from "react";
import Link from "next/link";
import Catalogue, { type CatMode } from "@/components/Catalogue";
import IndexExplorer from "@/components/indexes/IndexExplorer";
import { foldDiacritics } from "@/lib/slug";

export type FilmCat = { slug: string; title: string; year: number | null; director: string | null; genre: string; poster: string | null; rich?: boolean };

const THUMB = (p: string | null) => (p ? `https://image.tmdb.org/t/p/w92${p}` : null);

function sortKey(t: string) { return t.toLowerCase().replace(/^(the|a|an)\s+/i, "").trim(); }
function letterOf(t: string) { const c = foldDiacritics(sortKey(t)).charAt(0).toUpperCase(); return c >= "A" && c <= "Z" ? c : "#"; }
function decadeOf(y: number | null) { return y ? `${Math.floor(y / 10) * 10}s` : "Undated"; }

const fadeRef = (el: HTMLImageElement | null) => { if (el && el.complete) el.classList.add("idx-on"); };
const onImgLoad = (e: SyntheticEvent<HTMLImageElement>) => e.currentTarget.classList.add("idx-on");

const MODES: CatMode[] = [
  { key: "alpha", label: "A–Z", az: true },
  { key: "genre", label: "Genre" },
  { key: "year", label: "Year" },
];

export default function FilmsIndex({ catalogue, inventoryTotal, initialSlug }: {
  catalogue: FilmCat[]; inventoryTotal?: number; initialSlug: string | null;
}) {
  // random/spotlight pool = data-rich films only (the A–Z index shows all)
  const pool = catalogue.filter((f) => f.rich).map((f) => f.slug);

  const cat = (
    <>
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
          title: <>{it.title} {it.year ? <span className="yr">({it.year})</span> : null}{it.rich === false ? <span className="t2-chip">catalog</span> : null}</>,
          meta: it.director ?? "—",
          text: `${it.title} ${it.director ?? ""}`.toLowerCase(),
          // only data-rich films carry a poster thumbnail; the 5,040 Tier-2
          // catalog films render as lighter text rows (keeps the 6,975-row
          // index from getting heavy)
          thumb: it.rich === false ? undefined : (
            <span className="idx-th idx-th--poster">
              {THUMB(it.poster) ? <img ref={fadeRef} onLoad={onImgLoad} src={THUMB(it.poster) as string} alt={`${it.title}${it.year ? ` (${it.year})` : ""} poster`} loading="lazy" />
                : <span className="idx-th-mono">{it.title.charAt(0)}</span>}
            </span>
          ),
        })}
        title="The full catalogue of films"
        sub="Every film on Metatake — each broken into its figures and the meanings it shares. Click a title to open it."
        tot={`${catalogue.length.toLocaleString()} films`}
        filterPlaceholder="Filter films by title or director…"
        emptyText="No film matches that."
      />
      {inventoryTotal && inventoryTotal > catalogue.length ? (
        <div className="idx-tabs" style={{ marginTop: 18 }}>
          <Link className="vtab" href="/film?view=all">
            Browse the full inventory — all {inventoryTotal.toLocaleString()} films →
          </Link>
        </div>
      ) : null}
    </>
  );

  return (
    <IndexExplorer
      searchKind="film"
      imgShape="poster"
      basePath="/film"
      pool={pool}
      initialSlug={initialSlug}
      heroTitle="film search"
      placeholder="Search films by title or director…"
      reshuffleLabel="random movie"
      catalogue={cat}
    />
  );
}
