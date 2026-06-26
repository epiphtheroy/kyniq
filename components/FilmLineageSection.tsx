import Link from "next/link";
import { awardBody, awardLabel, canonEmblem, codeToFlag } from "@/lib/lineageBodies";

/** Lineage section — awards/honours, canons/lists, auteur line. Shared by the full and catalog film pages. */
export type LinRow = { facet: string; list_slug: string; list_label: string; parent_label: string | null; result: string | null; rank: number | null; edition_year: number | null; rank_max: number | null; rep_type: string | null; country?: string | null };

function CC({ country }: { country?: string | null }) {
  if (!country) return null;
  const f = codeToFlag(country);
  return <span className="lin-cc"> · {f ? `${f} ` : ""}{country.toUpperCase()}</span>;
}

export default function FilmLineageSection({ lineage, title }: { lineage: LinRow[]; title: string }) {
  const linAwards = lineage.filter((l) => l.facet !== "auteur" && l.result !== "listed");
  const linCanons = lineage.filter((l) => l.facet !== "auteur" && l.result === "listed");
  const linAuteur = lineage.filter((l) => l.facet === "auteur");
  if (linAwards.length + linCanons.length + linAuteur.length === 0) return null;

  return (
    <section className="df-sec" id="df-lineage">
      <h2 className="df-h2">Lineage</h2>
      <p className="df-sub">Where {title} sits in cinema&apos;s record — the awards it won, the canons it belongs to, and the auteur line it extends.</p>
      {linAwards.length > 0 ? (
        <div className="df-lingrp">
          <div className="df-flabel">Awards &amp; honours <span className="df-cnt">{linAwards.length}</span></div>
          <div className="lin-list">
            {linAwards.map((l, i) => {
              const b = awardBody(l.list_slug);
              return (
                <div key={i} className="lin-row">
                  <span className="lin-em" aria-hidden="true">{b?.emblem ?? "🏆"}</span>
                  {b ? <><span className="lin-body">{b.name}</span><span className="lin-sep">·</span></> : (l.parent_label && l.parent_label !== l.list_label ? <><span className="lin-body">{l.parent_label}</span><span className="lin-sep">·</span></> : null)}
                  <Link className="lin-name" href={`/lineage/${l.list_slug}`}>{awardLabel(l.list_label, l.list_slug)}</Link>
                  {l.edition_year ? <span className="lin-meta"> · {l.edition_year}</span> : null}
                  {l.result && l.result !== "won" ? <span className="lin-res"> · {l.result}</span> : null}
                  <CC country={l.country} />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {linCanons.length > 0 ? (
        <div className="df-lingrp">
          <div className="df-flabel">Canons &amp; lists <span className="df-cnt">{linCanons.length}</span></div>
          <div className="lin-list">
            {linCanons.map((l, i) => (
              <div key={i} className="lin-row">
                <span className="lin-em" aria-hidden="true">{canonEmblem(l.list_slug)}</span>
                <Link className="lin-name" href={`/lineage/${l.list_slug}`}>{l.list_label}</Link>
                {l.rank ? <span className="lin-rank"> · #{l.rank}{l.rank_max ? ` of ${l.rank_max}` : ""}</span> : null}
                {l.edition_year ? <span className="lin-meta"> · {l.edition_year}</span> : null}
                <CC country={l.country} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {linAuteur.length > 0 ? (
        <div className="df-lingrp">
          <div className="df-flabel">Auteur lineage <span className="df-cnt">{linAuteur.length}</span></div>
          <div className="lin-list">
            {linAuteur.map((l, i) => (
              <div key={i} className="lin-row">
                <span className="lin-em" aria-hidden="true">🎬</span>
                <Link className="lin-name" href={`/lineage/${l.list_slug}`}>{l.list_label}</Link>
                {l.rep_type ? <span className="lin-meta"> · {l.rep_type === "both" ? "defining & recent" : l.rep_type} work</span> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="df-src">Lineage memberships from public awards records and critics&apos;/institutional canons. Movements &amp; style lines arrive in a later pass.</div>
    </section>
  );
}
