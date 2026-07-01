"use client";

/** Unified Lineage hub: a global search across everything + film-page-style scroll navigation
 *  (all sections stacked; the sticky tab bar scrolls to each). */
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { codeToFlag } from "@/lib/lineageBodies";
import type { MvHub } from "@/app/movements/page";

const IMG = "https://image.tmdb.org/t/p/w154";
export type IdxRow = { facet: string; slug: string; label: string; parent_label: string | null; country: string | null; tier: string | null; film_count: number };

const KIND_LABEL: Record<string, string> = { national: "National cinema", movement: "Movement", award: "Award", canon: "Canon", auteur: "Auteur line", festival: "Festival", section: "Section", style: "Style" };

function HubCard({ h, flag }: { h: MvHub; flag: boolean }) {
  return (
    <Link className="mv-card" href={`/movements/${h.slug}`}>
      <div className="mv-thumbs" aria-hidden="true">
        {(h.thumbs || []).slice(0, 3).map((p, i) => (p ? <img key={i} className="mv-th" src={`${IMG}${p}`} alt="" loading="lazy" /> : null))}
        {(!h.thumbs || h.thumbs.length === 0) ? <div className="mv-th mv-th--empty" /> : null}
      </div>
      <div className="mv-cmeta">
        <div className="mv-cname">{flag && h.country_code ? <span className="mv-flag">{codeToFlag(h.country_code)} </span> : null}{h.label}</div>
        <div className="mv-csub">{h.region ? <span>{h.region}</span> : null}<span className="mv-cnt">{h.film_count} films</span></div>
      </div>
    </Link>
  );
}
function ListRows({ rows }: { rows: IdxRow[] }) {
  return (
    <div className="lh-list">
      {rows.map((r) => (
        <Link className="lh-row" href={`/lineage/${r.slug}`} key={r.slug}>
          <span className="lh-name">{r.country ? `${codeToFlag(r.country)} ` : ""}{r.label}</span>
          <span className="lh-n">{r.film_count}</span>
        </Link>
      ))}
    </div>
  );
}

type Uni = { key: string; label: string; kind: string; href: string; count: number; country?: string | null };

export default function LineageTabsClient({ national, movements, lists }: { national: MvHub[]; movements: MvHub[]; lists: IdxRow[] }) {
  const [q, setQ] = useState("");

  const nat = useMemo(() => national.filter((h) => h.film_count > 0), [national]);
  const mov = useMemo(() => movements.filter((h) => h.film_count > 0), [movements]);
  const byFacet = useMemo(() => {
    const m: Record<string, IdxRow[]> = {};
    for (const r of lists) if (r.film_count > 0) (m[r.facet] ??= []).push(r);
    for (const k in m) m[k].sort((a, b) => b.film_count - a.film_count || a.label.localeCompare(b.label));
    return m;
  }, [lists]);

  const universe = useMemo<Uni[]>(() => {
    const u: Uni[] = [];
    for (const h of nat) u.push({ key: "n" + h.slug, label: h.label, kind: "national", href: `/movements/${h.slug}`, count: h.film_count, country: h.country_code });
    for (const h of mov) u.push({ key: "m" + h.slug, label: h.label, kind: "movement", href: `/movements/${h.slug}`, count: h.film_count });
    for (const r of lists) if (r.film_count > 0) u.push({ key: "l" + r.slug, label: r.label, kind: r.facet, href: `/lineage/${r.slug}`, count: r.film_count, country: r.country });
    return u;
  }, [nat, mov, lists]);

  const searching = q.trim().length > 0;
  const results = useMemo(() => {
    if (!searching) return [];
    const s = q.trim().toLowerCase();
    return universe.filter((x) => x.label.toLowerCase().includes(s)).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [universe, q, searching]);

  // sections in scroll order (only those with content)
  const sections: { id: string; label: string; n: number; render: () => ReactNode }[] = [
    { id: "national", label: "National cinemas", n: nat.length, render: () => <div className="mv-grid">{nat.map((h) => <HubCard key={h.slug} h={h} flag />)}</div> },
    { id: "movements", label: "Movements", n: mov.length, render: () => <div className="mv-grid">{mov.map((h) => <HubCard key={h.slug} h={h} flag={false} />)}</div> },
    { id: "award", label: "Awards", n: (byFacet.award ?? []).length, render: () => <ListRows rows={byFacet.award ?? []} /> },
    { id: "canon", label: "Canons", n: (byFacet.canon ?? []).length, render: () => <ListRows rows={byFacet.canon ?? []} /> },
    { id: "auteur", label: "Auteur lines", n: (byFacet.auteur ?? []).length, render: () => <ListRows rows={byFacet.auteur ?? []} /> },
  ].filter((s) => s.n > 0);

  return (
    <>
      <input className="mv-search" style={{ margin: "16px 0 4px", width: "100%" }}
        placeholder="Search all of Lineage — a country, movement, award or canon…" value={q} onChange={(e) => setQ(e.target.value)} />

      {searching ? (
        <>
          <div className="lh-blurb" style={{ margin: "8px 0 12px" }}>{results.length} result{results.length === 1 ? "" : "s"} across Lineage</div>
          <div className="lh-list">
            {results.map((r) => (
              <Link className="lh-row" href={r.href} key={r.key}>
                <span className="lin-kind">{KIND_LABEL[r.kind] ?? r.kind}</span>
                <span className="lh-name">{r.country ? `${codeToFlag(r.country)} ` : ""}{r.label}</span>
                <span className="lh-n">{r.count}</span>
              </Link>
            ))}
            {results.length === 0 ? <p className="lh-blurb">Nothing matches “{q}”.</p> : null}
          </div>
        </>
      ) : (
        <>
          <div className="mvh-tabs">
            {sections.map((s) => <a key={s.id} href={`#lin-${s.id}`}>{s.label} <span style={{ opacity: .55 }}>{s.n}</span></a>)}
          </div>
          {sections.map((s) => (
            <section key={s.id} id={`lin-${s.id}`} className="mvh-sec">
              <h2 className="mvh-h2">{s.label} <span className="df-cnt">{s.n}</span></h2>
              {s.render()}
            </section>
          ))}
        </>
      )}
    </>
  );
}
