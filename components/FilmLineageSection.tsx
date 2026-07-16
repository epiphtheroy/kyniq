import type { ReactNode } from "react";
import Link from "next/link";
import { awardBody, awardLabel, canonEmblem, codeToFlag } from "@/lib/lineageBodies";
import { lineageSource, wikidataUrl } from "@/lib/lineage";
import RecordToc from "@/components/read/RecordToc";
import { t, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

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

function SourceTag({ meta, locale = DEFAULT_LOCALE }: { meta: ListMetaLite | undefined; locale?: Locale }) {
  if (!meta) return null;
  const src = lineageSource(meta.source);
  const wd = wikidataUrl(meta.external_ref);
  if (!src && !wd) return null;
  return (
    <span className="lin-meta" style={{ opacity: 0.6 }}>
      {` · ${t(locale, "via")} `}
      {wd ? <a href={wd} target="_blank" rel="noopener">{src?.name ?? "Wikidata"} ↗</a>
        : src?.url ? <a href={src.url} target="_blank" rel="noopener">{src.name} ↗</a>
        : src?.name}
    </span>
  );
}

export default function FilmLineageSection({ lineage, title, slug, listMeta = {}, movements = [], quotes = [], afterlife = null, headerAccessory, recordUpdated = null, locale = DEFAULT_LOCALE }: {
  lineage: LinRow[]; title: string; slug?: string; listMeta?: Record<string, ListMetaLite>; movements?: MvChip[];
  quotes?: LinQuote[]; afterlife?: AfterlifeStats | null; headerAccessory?: ReactNode; recordUpdated?: string | null; locale?: Locale;
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

  // ── Per-film lead, assembled deterministically from the counts already in
  // scope (#8). Every clause is gated on presence — an empty facet drops its
  // clause, never renders a self-negating line (R-C1). It names national
  // cinema / movement / auteur (absent from the digest) and reports honour and
  // canon counts, not the specific award labels the digest already spells out,
  // so it does not repeat the digest's wording (R-D).
  const joinProse = (parts: string[]): string =>
    parts.length <= 1 ? (parts[0] ?? "")
      : locale !== DEFAULT_LOCALE ? parts.join(", ")
      : parts.length === 2 ? `${parts[0]} and ${parts[1]}`
      : `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;

  const originBits = [...nations.map((m) => m.label), ...moves.map((m) => m.label)];
  const honorBits: string[] = [];
  if (wins > 0) honorBits.push(locale === DEFAULT_LOCALE ? `${wins} win${wins === 1 ? "" : "s"}` : t(locale, "{n} wins", { n: wins }));
  if (noms > 0) honorBits.push(locale === DEFAULT_LOCALE ? `${noms} nomination${noms === 1 ? "" : "s"}` : t(locale, "{n} nominations", { n: noms }));

  const leadPreds: string[] = [];
  if (originBits.length) leadPreds.push(t(locale, "comes out of {origin}", { origin: joinProse(originBits) }));
  if (honorBits.length) leadPreds.push(t(locale, "carries {honors}", { honors: joinProse(honorBits) }));
  if (canonsN > 0) leadPreds.push(locale === DEFAULT_LOCALE ? `is cited in ${canonsN} canon${canonsN === 1 ? "" : "s"}` : t(locale, "is cited in {n} canons", { n: canonsN }));
  if (linAuteur.length > 0) leadPreds.push(linAuteur.length === 1 ? t(locale, "extends its director's auteur line") : (locale === DEFAULT_LOCALE ? `extends ${linAuteur.length} auteur lines` : t(locale, "extends {n} auteur lines", { n: linAuteur.length })));
  const leadSpan = eY0 && eY1 && eY1 > eY0 ? ` ${t(locale, "— a record spanning {y0}–{y1}", { y0: eY0, y1: eY1 })}` : "";

  // ── Sources for this record (#9). Distinct display names per facet group,
  // drawn from the SourceTag data already in scope (listMeta → lineageSource).
  const srcNamesFor = (rows: LinRow[]): string[] => {
    const names = new Set<string>();
    for (const l of rows) {
      const s = lineageSource(listMeta[l.list_slug]?.source);
      if (s?.name) names.add(s.name);
    }
    return [...names];
  };
  const awardSrc = srcNamesFor(linAwards);
  const canonRows = [...linCanons, ...linNational];
  const canonSrc = srcNamesFor(canonRows);
  const updatedAt = recordUpdated ? new Date(recordUpdated) : null;
  const updatedFmt = updatedAt && !isNaN(updatedAt.getTime())
    ? updatedAt.toLocaleDateString(locale === DEFAULT_LOCALE ? "en-US" : "ko-KR", { year: "numeric", month: "short", day: "numeric" })
    : null;

  const Row = ({ l, emblem }: { l: LinRow; emblem: string }) => (
    <div className="lin-row">
      <span className="lin-em" aria-hidden="true">{emblem}</span>
      {l.parent_label && l.parent_label !== l.list_label
        ? <><span className="lin-body">{l.parent_label}</span><span className="lin-sep">·</span></>
        : null}
      <Link className="lin-name" href={`/lineage/${l.list_slug}`}>{awardLabel(l.list_label, l.list_slug)}</Link>
      {l.result && l.result !== "won" && l.result !== "listed" ? <span className="lin-res"> · {l.result}</span> : null}
      {l.edition_year ? <span className="lin-meta"> · {l.edition_year}</span> : null}
      {l.rank ? <span className="lin-rank"> · #{l.rank}{l.rank_max ? ` ${t(locale, "of {max}", { max: l.rank_max })}` : ""}</span> : null}
      {l.rep_type ? <span className="lin-meta"> · {t(locale, "{type} work", { type: l.rep_type === "both" ? t(locale, "defining & recent") : l.rep_type })}</span> : null}
      <CC country={l.country} />
      <SourceTag meta={listMeta[l.list_slug]} locale={locale} />
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
      <h2 className="df-h2">{t(locale, "Lineage — the record")}</h2>
      {headerAccessory}
      {leadPreds.length > 0 ? (
        <p className="df-sub">{title} {joinProse(leadPreds)}{leadSpan}.</p>
      ) : null}

      {/* ── The record, spelled out — one glance at the scale ── */}
      <div className="lin-stats">
        {wins > 0 ? <span className="lin-stat" style={{ "--sc": "#B8863B" } as React.CSSProperties}>🏆 {locale === DEFAULT_LOCALE ? `${wins} win${wins === 1 ? "" : "s"}` : t(locale, "{n} wins", { n: wins })}</span> : null}
        {noms > 0 ? <span className="lin-stat" style={{ "--sc": "#C87A2C" } as React.CSSProperties}>◇ {locale === DEFAULT_LOCALE ? `${noms} nomination${noms === 1 ? "" : "s"}` : t(locale, "{n} nominations", { n: noms })}</span> : null}
        {canonsN > 0 ? <span className="lin-stat" style={{ "--sc": "#12897A" } as React.CSSProperties}>📚 {locale === DEFAULT_LOCALE ? `${canonsN} canon appearance${canonsN === 1 ? "" : "s"}` : t(locale, "{n} canon appearances", { n: canonsN })}</span> : null}
        {linAuteur.length > 0 ? <span className="lin-stat" style={{ "--sc": "#6B4E9E" } as React.CSSProperties}>🎬 {t(locale, "auteur line ×{n}", { n: linAuteur.length })}</span> : null}
        {listsN > 1 ? <span className="lin-stat" style={{ "--sc": "#5A6B86" } as React.CSSProperties}>{t(locale, "{n} lists", { n: listsN })}</span> : null}
        {eY0 && eY1 && eY1 > eY0 ? <span className="lin-stat" style={{ "--sc": "#2F6DB0" } as React.CSSProperties}>{eY0}–{eY1}</span> : null}
      </div>

      {movements.length > 0 ? (
        <div className="df-lingrp">
          <div className="df-flabel">{t(locale, "National cinema & movements")} <span className="df-cnt">{movements.length}</span></div>
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
          <div className="df-flabel">{t(locale, "What critics said")}</div>
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
        <Curtain label={t(locale, "Awards & honours")} items={linAwards.map((l) => ({ ...l, parent_label: awardBody(l.list_slug)?.name ?? l.parent_label }))} emblemFor={(l) => awardBody(l.list_slug)?.emblem ?? "🏆"} open={linAwards.length > 0 && linAwards.length <= 6} />
        <Curtain label={t(locale, "Canons & rankings")} items={linCanons} emblemFor={(l) => canonEmblem(l.list_slug)} />
        <Curtain label={t(locale, "National canons")} items={linNational} emblemFor={() => "🏛️"} />
        <Curtain label={t(locale, "Auteur lineage")} items={linAuteur} emblemFor={() => "🎬"} />
      </div>

      {/* ── The doors: print-style index cards — the counts ARE the pitch ── */}
      {showRecordSlate || showAfterlifeSlate ? (
        <div className="rec-tocs">
          {showRecordSlate ? (
            <RecordToc
              href={`/film/lineage/${slug}`}
              kicker={t(locale, "The complete record")}
              title={t(locale, "Every award, canon and ranking {title} holds — sourced per entry", { title })}
              rows={[
                ...(wins > 0 ? [{ label: t(locale, "Wins"), value: wins }] : []),
                ...(noms > 0 ? [{ label: t(locale, "Nominations"), value: noms }] : []),
                ...(canonsN > 0 ? [{ label: t(locale, "Canon appearances"), value: canonsN }] : []),
                ...(linAuteur.length > 0 ? [{ label: t(locale, "Auteur line"), value: linAuteur.length }] : []),
                { label: t(locale, "Lists cited"), value: listsN },
                ...(eY0 && eY1 && eY1 > eY0 ? [{ label: t(locale, "Years covered"), value: `${eY0}–${eY1}` }] : []),
              ]}
              cta={t(locale, "Open the record")}
            />
          ) : null}
          {showAfterlifeSlate && afterlife ? (
            <RecordToc
              href={`/film/${slug}/reception`}
              kicker={t(locale, "Reviews & afterlife")}
              title={t(locale, "What critics said about {title} — and everything since, year by year", { title })}
              rows={[
                { label: t(locale, "Reviews"), value: afterlife.reviews },
                ...(afterlife.papers > 0 ? [{ label: t(locale, "Scholarship"), value: afterlife.papers }] : []),
                ...(afterlife.releases > 0 ? [{ label: t(locale, "Releases & revivals"), value: afterlife.releases }] : []),
                ...(afterlife.honors > 0 ? [{ label: t(locale, "Honors"), value: afterlife.honors }] : []),
                ...(afterlife.y0 && afterlife.y1 && afterlife.y1 > afterlife.y0 ? [{ label: t(locale, "Years covered"), value: `${afterlife.y0}–${afterlife.y1}` }] : []),
              ]}
              cta={t(locale, "Open the timeline")}
            />
          ) : null}
        </div>
      ) : null}

      <div className="df-src" style={{ marginTop: 18, fontSize: 12, color: "var(--muted)" }}>
        <div className="df-flabel">{t(locale, "Sources for this record")}</div>
        <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "grid", gap: 4 }}>
          <li><b>{t(locale, "Origin")}</b> — TMDB</li>
          {linAwards.length > 0 ? (
            <li><b>{t(locale, "Awards & honours")}</b> — {awardSrc.length ? joinProse(awardSrc) : t(locale, "public records and critics’ polls")} <span className="lin-meta">({linAwards.length})</span></li>
          ) : null}
          {canonRows.length > 0 ? (
            <li><b>{t(locale, "Canon")}</b> — {canonSrc.length ? joinProse(canonSrc) : t(locale, "institutional & critics’ polls")} <span className="lin-meta">({canonRows.length})</span></li>
          ) : null}
          {movements.length > 0 ? (
            <li><b>{t(locale, "Movements & auteur line")}</b> — {t(locale, "auteur rosters")} <span className="lin-meta">({movements.length + linAuteur.length})</span></li>
          ) : null}
        </ul>
        {updatedFmt ? <div className="lin-meta" style={{ marginTop: 6 }}>{t(locale, "Record updated {date}", { date: updatedFmt })}</div> : null}
      </div>
    </section>
  );
}
