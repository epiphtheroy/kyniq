"use client";

import { type SyntheticEvent } from "react";
import Catalogue, { type CatMode } from "@/components/Catalogue";
import IndexExplorer from "@/components/indexes/IndexExplorer";
import { foldDiacritics } from "@/lib/slug";

export type DirCat = { slug: string; name: string; country: string | null; films: number; sig: string | null; photo: string | null; has_intro?: boolean };

const THUMB = (p: string | null) => (p ? `https://image.tmdb.org/t/p/w92${p}` : null);

function firstLetter(s: string) { const c = foldDiacritics(s || "").charAt(0).toUpperCase(); return c >= "A" && c <= "Z" ? c : "#"; }

const fadeRef = (el: HTMLImageElement | null) => { if (el && el.complete) el.classList.add("idx-on"); };
const onImgLoad = (e: SyntheticEvent<HTMLImageElement>) => e.currentTarget.classList.add("idx-on");

const MODES: CatMode[] = [
  { key: "alpha", label: "A–Z", az: true },
  { key: "nat", label: "Nationality" },
  { key: "films", label: "Films" },
];

export default function DirectorsIndex({ catalogue, initialSlug }: { catalogue: DirCat[]; initialSlug: string | null }) {
  // random/spotlight pool = only directors with a written intro page
  const pool = catalogue.filter((d) => d.has_intro).map((d) => d.slug);

  const cat = (
    <>
      {/* country=null directors don't appear in the Nationality view (no
          "Unknown" group is ever exhibited); they stay reachable in A–Z. */}
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
          meta: (
            <>
              {it.films} {it.films === 1 ? "film" : "films"}
              {it.country ? <> · {it.country}</> : null}
              {it.sig ? <> — <em>{it.sig}</em></> : null}
            </>
          ),
          text: `${it.name} ${it.country ?? ""} ${it.sig ?? ""}`.toLowerCase(),
          thumb: (
            <span className="idx-th idx-th--round">
              {THUMB(it.photo) ? <img ref={fadeRef} onLoad={onImgLoad} src={THUMB(it.photo) as string} alt="" loading="lazy" />
                : <span className="idx-th-mono">{it.name.charAt(0)}</span>}
            </span>
          ),
        })}
        title="The full catalogue of directors"
        sub="Every director on Metatake. Click any name to open their filmography, signature readings and tropes."
        tot={`${catalogue.length.toLocaleString()} directors`}
        filterPlaceholder="Filter directors by name…"
        emptyText="No director matches that."
      />
    </>
  );

  return (
    <IndexExplorer
      searchKind="director"
      imgShape="round"
      basePath="/director"
      pool={pool}
      initialSlug={initialSlug}
      heroTitle="director search"
      placeholder="Search directors by name…"
      reshuffleLabel="random director"
      catalogue={cat}
    />
  );
}
