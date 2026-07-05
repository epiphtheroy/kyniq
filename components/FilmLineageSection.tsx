import Link from "next/link";
import { awardBody, awardLabel, canonEmblem, codeToFlag } from "@/lib/lineageBodies";
import { lineageSource, wikidataUrl } from "@/lib/lineage";

/**
 * Lineage section — the film's honours record (awards, canons & rankings,
 * national canons, auteur line), each row citing its list's source. Shared by
 * the full and catalog (Tier-2) film pages; this IS the "Lineage" tab's
 * content, mirroring the standalone /film/lineage/[slug] record page.
 */
export type LinRow = { facet: string; list_slug: string; list_label: string; parent_label: string | null; result: string | null; rank: number | null; edition_year: number | null; rank_max: number | null; rep_type: string | null; country?: string | null };
export type MvChip = { slug: string; label: string; kind: string; country_code: string | null };
export type ListMetaLite = { source: string | null; external_ref: { wikidata?: string; url?: string } | null };

const HONORS_MIN = 3; // mirrors FILM_HONORS_MIN in lib/lineage.ts — /film/lineage/[slug] 404 bar

function CC({ country }: { country?: string | null }) {
  if (!country) return null;
  const f = codeToFlag(country);
  return <span className="lin-cc"> · {f ? `${f} ` : ""}{country.toUpperCase()}</span>;
}

function SourceTag({ meta }: { meta: ListMetaLite | undefined }) {
  if (!meta) return null;
  const src = lineageSource(meta.source);
  const wd = wikidataUrl(meta.external_ref);
  if (!src && !wd) return null;
  return (
    <span className="lin-meta" style={{ opacity: 0.6 }}>
      {" · via "}
      {wd ? <a href={wd} target="_blank" rel="noopener noreferrer">{src?.name ?? "Wikidata"} ↗</a>
        : src?.url ? <a href={src.url} target="_blank" rel="noopener noreferrer">{src.name} ↗</a>
        : src?.name}
    </span>
  );
}

export default function FilmLineageSection({ lineage, title, slug, listMeta = {}, movements = [] }: { lineage: LinRow[]; title: string; slug?: string; listMeta?: Record<string, ListMetaLite>; movements?: MvChip[] }) {
  const linAwards = lineage.filter((l) => l.facet !== "auteur" && l.result !== "listed");
  const linNational = lineage.filter((l) => l.facet === "national" && l.result === "listed");
  const linCanons = lineage.filter((l) => l.facet !== "auteur" && l.facet !== "national" && l.result === "listed");
  const linAuteur = lineage.filter((l) => l.facet === "auteur");
  const nations = movements.filter((m) => m.kind !== "movement");
  const moves = movements.filter((m) => m.kind === "movement");
  if (linAwards.length + linCanons.length + linNational.length + linAuteur.length + movements.length === 0) return null;

  const Row = ({ l, emblem }: { l: LinRow; emblem: string }) => (
    <div className="lin-row">
      <span className="lin-em" aria-hidden="true">{emblem}</span>
      {l.parent_label && l.parent_label !== l.list_label
        ? <><span className="lin-body">{l.parent_label}</span><span className="lin-sep">·</span></>
        : null}
      <Link className="lin-name" href={`/lineage/${l.list_slug}`}>{awardLabel(l.list_label, l.list_slug)}</Link>
      {l.result && l.result !== "won" && l.result !== "listed" ? <span className="lin-res"> · {l.result}</span> : null}
      {l.edition_year ? <span className="lin-meta"> · {l.edition_year}</span> : null}
      {l.rank ? <span className="lin-rank"> · #{l.rank}{l.rank_max ? ` of ${l.rank_max}` : ""}</span> : null}
      {l.rep_type ? <span className="lin-meta"> · {l.rep_type === "both" ? "defining & recent" : l.rep_type} work</span> : null}
      <CC country={l.country} />
      <SourceTag meta={listMeta[l.list_slug]} />
    </div>
  );

  return (
    <section className="df-sec" id="df-lineage">
      <h2 className="df-h2">Lineage</h2>
      <p className="df-sub">Where {title} comes from and sits in cinema&apos;s record — its national cinema and movement, the awards it won, the canons it belongs to, and the auteur line it extends. Sourced per entry.</p>
      {movements.length > 0 ? (
        <div className="df-lingrp">
          <div className="df-flabel">National cinema &amp; movements <span className="df-cnt">{movements.length}</span></div>
          <div className="lin-list">
            {nations.map((m, i) => (
              <div key={`n${i}`} className="lin-row">
                <span className="lin-em" aria-hidden="true">{m.country_code ? codeToFlag(m.country_code) : "🌍"}</span>
                <Link className="lin-name" href={`/movements/${m.slug}`}>{m.label}</Link>
              </div>
            ))}
            {moves.map((m, i) => (
              <div key={`m${i}`} className="lin-row">
                <span className="lin-em" aria-hidden="true">🎞️</span>
                <Link className="lin-name" href={`/movements/${m.slug}`}>{m.label}</Link>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {linAwards.length > 0 ? (
        <div className="df-lingrp">
          <div className="df-flabel">Awards &amp; honours <span className="df-cnt">{linAwards.length}</span></div>
          <div className="lin-list">
            {linAwards.map((l, i) => {
              const b = awardBody(l.list_slug);
              return <Row key={`a${i}`} l={{ ...l, parent_label: b?.name ?? l.parent_label }} emblem={b?.emblem ?? "🏆"} />;
            })}
          </div>
        </div>
      ) : null}
      {linCanons.length > 0 ? (
        <div className="df-lingrp">
          <div className="df-flabel">Canons &amp; rankings <span className="df-cnt">{linCanons.length}</span></div>
          <div className="lin-list">
            {linCanons.map((l, i) => <Row key={`c${i}`} l={l} emblem={canonEmblem(l.list_slug)} />)}
          </div>
        </div>
      ) : null}
      {linNational.length > 0 ? (
        <div className="df-lingrp">
          <div className="df-flabel">National canons <span className="df-cnt">{linNational.length}</span></div>
          <div className="lin-list">
            {linNational.map((l, i) => <Row key={`t${i}`} l={l} emblem="🏛️" />)}
          </div>
        </div>
      ) : null}
      {linAuteur.length > 0 ? (
        <div className="df-lingrp">
          <div className="df-flabel">Auteur lineage <span className="df-cnt">{linAuteur.length}</span></div>
          <div className="lin-list">
            {linAuteur.map((l, i) => <Row key={`u${i}`} l={l} emblem="🎬" />)}
          </div>
        </div>
      ) : null}
      {slug && lineage.length >= HONORS_MIN ? (
        <p style={{ margin: "12px 0 0", fontSize: 15 }}>
          <Link href={`/film/lineage/${slug}`}>The complete record — every award, canon and ranking, with sources →</Link>
        </p>
      ) : null}
      <div className="df-src">Origin from TMDB; awards &amp; canons from public records and critics&apos;/institutional polls — cited per entry above; movements from auteur rosters.</div>
    </section>
  );
}
