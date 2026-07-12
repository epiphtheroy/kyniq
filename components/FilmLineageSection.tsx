import type { ReactNode } from "react";
import Link from "next/link";
import { awardBody, awardLabel, canonEmblem, codeToFlag } from "@/lib/lineageBodies";
import { lineageSource, wikidataUrl } from "@/lib/lineage";
import RecordToc from "@/components/read/RecordToc";

/**
 * Lineage section — the film's record, reworked 2026-07-08: a spelled-out
 * numeric summary + critic pull-quotes up top, the detailed per-facet row
 * lists behind counted curtains, and two large slates that SHOW how much
 * sits behind "see more" (the full honors record page and the reviews-&-
 * afterlife timeline). Shared by the full and catalog (Tier-2) film pages —
 * every new prop is optional, so Tier-2 renders exactly as before.
 */
export type LinRow = { facet: string; list_slug: string; list_label: string; parent_label: string | null; result: string | null; rank: number | null; edition_year: number | null; rank_max: number | null; rep_type: string | null; country?: string | null };
export type MvChip = { slug: string; label: string; kind: string; country_code: string | null };
export type ListMetaLite = { source: string | null; external_ref: { wikidata?: string; url?: string } | null };
export type LinQuote = { text: string; outlet: string; critic: string | null; year: number | null; url: string };
export type AfterlifeStats = { reviews: number; papers: number; releases: number; honors: number; y0: number | null; y1: number | null };

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
      {wd ? <a href={wd} target="_blank" rel="noopener">{src?.name ?? "Wikidata"} ↗</a>
        : src?.url ? <a href={src.url} target="_blank" rel="noopener">{src.name} ↗</a>
        : src?.name}
    </span>
  );
}

export default function FilmLineageSection({ lineage, title, slug, listMeta = {}, movements = [], quotes = [], afterlife = null, headerAccessory }: {
  lineage: LinRow[]; title: string; slug?: string; listMeta?: Record<string, ListMetaLite>; movements?: MvChip[];
  quotes?: LinQuote[]; afterlife?: AfterlifeStats | null; headerAccessory?: ReactNode;
}) {
  const linAwards = lineage.filter((l) => l.facet !== "auteur" && l.result !== "listed");
  const linNational = lineage.filter((l) => l.facet === "national" && l.result === "listed");
  const linCanons = lineage.filter((l) => l.facet !== "auteur" && l.facet !== "national" && l.result === "listed");
  const linAuteur = lineage.filter((l) => l.facet === "auteur");
  const nations = movements.filter((m) => m.kind !== "movement");
  const moves = movements.filter((m) => m.kind === "movement");
  if (linAwards.length + linCanons.length + linNational.length + linAuteur.length + movements.length === 0) return null;

  // Spelled-out numbers — deterministic, from the rows themselves.
  const wins = linAwards.filter((l) => l.result === "won").length;
  const noms = linAwards.length - wins;
  const canonsN = linCanons.length + linNational.length;
  const listsN = new Set(lineage.map((l) => l.list_slug)).size;
  const editionYears = lineage.map((l) => l.edition_year).filter((y): y is number => !!y && y > 1880);
  const eY0 = editionYears.length ? Math.min(...editionYears) : null;
  const eY1 = editionYears.length ? Math.max(...editionYears) : null;

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

  // Curtained facet group — the summary line carries the count and a preview,
  // so the scale is visible before opening (ReadingLedger grammar).
  const Curtain = ({ label, items, emblemFor, open }: {
    label: string; items: LinRow[]; emblemFor: (l: LinRow) => string; open?: boolean;
  }) => {
    if (!items.length) return null;
    const preview = [...new Set(items.map((l) => awardLabel(l.list_label, l.list_slug)))].slice(0, 3).join(" · ");
    return (
      <details className="vl-d" open={open}>
        <summary>
          <span className="vl-sum-d">{label}</span>
          <span className="vl-n">{items.length}</span>
          <span className="vl-sum-kw">{preview}{items.length > 3 ? " …" : ""}</span>
        </summary>
        <div className="lin-list" style={{ padding: "2px 18px 14px 20px" }}>
          {items.map((l, i) => <Row key={i} l={l} emblem={emblemFor(l)} />)}
        </div>
      </details>
    );
  };

  const showRecordSlate = !!slug && lineage.length >= HONORS_MIN;
  const showAfterlifeSlate = !!slug && !!afterlife && afterlife.reviews + afterlife.papers > 0;

  return (
    <section className="df-sec" id="df-lineage">
      <h2 className="df-h2">Lineage — the record</h2>
      {headerAccessory}
      <p className="df-sub">Where {title} comes from and sits in cinema&apos;s record — its national cinema and movement, the awards it won, the canons it belongs to, and the auteur line it extends. Sourced per entry.</p>

      {/* ── The record, spelled out — one glance at the scale ── */}
      <div className="lin-stats">
        {wins > 0 ? <span className="lin-stat" style={{ "--sc": "#B8863B" } as React.CSSProperties}>🏆 {wins} win{wins === 1 ? "" : "s"}</span> : null}
        {noms > 0 ? <span className="lin-stat" style={{ "--sc": "#C87A2C" } as React.CSSProperties}>◇ {noms} nomination{noms === 1 ? "" : "s"}</span> : null}
        {canonsN > 0 ? <span className="lin-stat" style={{ "--sc": "#12897A" } as React.CSSProperties}>📚 {canonsN} canon appearance{canonsN === 1 ? "" : "s"}</span> : null}
        {linAuteur.length > 0 ? <span className="lin-stat" style={{ "--sc": "#6B4E9E" } as React.CSSProperties}>🎬 auteur line ×{linAuteur.length}</span> : null}
        {listsN > 1 ? <span className="lin-stat" style={{ "--sc": "#5A6B86" } as React.CSSProperties}>{listsN} lists</span> : null}
        {eY0 && eY1 && eY1 > eY0 ? <span className="lin-stat" style={{ "--sc": "#2F6DB0" } as React.CSSProperties}>{eY0}–{eY1}</span> : null}
      </div>

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

      {/* ── What critics said — the pull-quotes worth reading in place ── */}
      {quotes.length > 0 ? (
        <div className="lin-quotes">
          <div className="df-flabel">What critics said</div>
          {quotes.map((q, i) => (
            <figure key={i} style={{ margin: "10px 0 0" }}>
              <blockquote className="afl-q" style={{ margin: 0 }}>“{q.text}”</blockquote>
              <figcaption className="lin-qsrc">
                — <a href={q.url} target="_blank" rel="noopener nofollow">{q.outlet}</a>
                {q.critic ? ` · ${q.critic}` : ""}{q.year ? ` · ${q.year}` : ""}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}

      {/* ── The detail, behind counted curtains — scale visible before opening ── */}
      <div style={{ margin: "14px 0 0" }}>
        <Curtain label="Awards & honours" items={linAwards.map((l) => ({ ...l, parent_label: awardBody(l.list_slug)?.name ?? l.parent_label }))} emblemFor={(l) => awardBody(l.list_slug)?.emblem ?? "🏆"} open={linAwards.length > 0 && linAwards.length <= 6} />
        <Curtain label="Canons & rankings" items={linCanons} emblemFor={(l) => canonEmblem(l.list_slug)} />
        <Curtain label="National canons" items={linNational} emblemFor={() => "🏛️"} />
        <Curtain label="Auteur lineage" items={linAuteur} emblemFor={() => "🎬"} />
      </div>

      {/* ── The doors: print-style index cards — the counts ARE the pitch ── */}
      {showRecordSlate || showAfterlifeSlate ? (
        <div className="rec-tocs">
          {showRecordSlate ? (
            <RecordToc
              href={`/film/lineage/${slug}`}
              kicker="The complete record"
              title={`Every award, canon and ranking ${title} holds — sourced per entry`}
              rows={[
                ...(wins > 0 ? [{ label: "Wins", value: wins }] : []),
                ...(noms > 0 ? [{ label: "Nominations", value: noms }] : []),
                ...(canonsN > 0 ? [{ label: "Canon appearances", value: canonsN }] : []),
                ...(linAuteur.length > 0 ? [{ label: "Auteur line", value: linAuteur.length }] : []),
                { label: "Lists cited", value: listsN },
                ...(eY0 && eY1 && eY1 > eY0 ? [{ label: "Years covered", value: `${eY0}–${eY1}` }] : []),
              ]}
              cta="Open the record"
            />
          ) : null}
          {showAfterlifeSlate && afterlife ? (
            <RecordToc
              href={`/film/${slug}/reception`}
              kicker="Reviews & afterlife"
              title={`What critics said about ${title} — and everything since, year by year`}
              rows={[
                { label: "Reviews", value: afterlife.reviews },
                ...(afterlife.papers > 0 ? [{ label: "Scholarship", value: afterlife.papers }] : []),
                ...(afterlife.releases > 0 ? [{ label: "Releases & revivals", value: afterlife.releases }] : []),
                ...(afterlife.honors > 0 ? [{ label: "Honors", value: afterlife.honors }] : []),
                ...(afterlife.y0 && afterlife.y1 && afterlife.y1 > afterlife.y0 ? [{ label: "Years covered", value: `${afterlife.y0}–${afterlife.y1}` }] : []),
              ]}
              cta="Open the timeline"
            />
          ) : null}
        </div>
      ) : null}

      <div className="df-src">Origin from TMDB; awards &amp; canons from public records and critics&apos;/institutional polls — cited per entry above; movements from auteur rosters.</div>
    </section>
  );
}
