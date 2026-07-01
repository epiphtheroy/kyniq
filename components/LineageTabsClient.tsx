"use client";

/** Unified Lineage hub: a global search across everything + tabs (National cinemas, Movements,
 *  Awards, Canons, Auteur lines). Search spans all facets/hubs; tabs are for browsing. */
import { useMemo, useState } from "react";
import Link from "next/link";
import { codeToFlag } from "@/lib/lineageBodies";
import type { MvHub } from "@/app/movements/page";

const IMG = "https://image.tmdb.org/t/p/w154";
export type IdxRow = { facet: string; slug: string; label: string; parent_label: string | null; country: string | null; tier: string | null; film_count: number };

type TabId = "national" | "movements" | "award" | "canon" | "auteur";
const TABS: { id: TabId; label: string; kind: "hub" | "list" }[] = [
  { id: "national", label: "National cinemas", kind: "hub" },
  { id: "movements", label: "Movements", kind: "hub" },
  { id: "award", label: "Awards", kind: "list" },
  { id: "canon", label: "Canons", kind: "list" },
  { id: "auteur", label: "Auteur lines", kind: "list" },
];
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

type Uni = { key: string; label: string; kind: string; href: string; count: number; country?: string | null };

export default function LineageTabsClient({ national, movements, lists }: { national: MvHub[]; movements: MvHub[]; lists: IdxRow[] }) {
  const [tab, setTab] = useState<TabId>("national");
  const [q, setQ] = useState("");

  const nat = useMemo(() => national.filter((h) => h.film_count > 0), [national]);
  const mov = useMemo(() => movements.filter((h) => h.film_count > 0), [movements]);
  const listsByFacet = useMemo(() => {
    const m: Record<string, IdxRow[]> = {};
    for (const r of lists) if (r.film_count > 0) (m[r.facet] ??= []).push(r);
    return m;
  }, [lists]);

  // one combined searchable index across everything
  const universe = useMemo<Uni[]>(() => {
    const u: Uni[] = [];
    for (const h of nat) u.push({ key: "n" + h.slug, label: h.label, kind: "national", href: `/movements/${h.slug}`, count: h.film_count, country: h.country_code });
    for (const h of mov) u.push({ key: "m" + h.slug, label: h.label, kind: "movement", href: `/movements/${h.slug}`, count: h.film_count });
    for (const r of lists) if (r.film_count > 0) u.push({ key: "l" + r.slug, label: r.label, kind: r.facet, href: `/lineage/${r.slug}`, count: r.film_count, country: r.country });
    return u;
  }, [nat, mov, lists]);

  const counts: Record<TabId, number> = {
    national: nat.length, movements: mov.length,
    award: (listsByFacet.award ?? []).length, canon: (listsByFacet.canon ?? []).length, auteur: (listsByFacet.auteur ?? []).length,
  };

  const searching = q.trim().length > 0;
  const results = useMemo(() => {
    if (!searching) return [];
    const s = q.trim().toLowerCase();
    return universe.filter((x) => x.label.toLowerCase().includes(s)).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [universe, q, searching]);

  const activeKind = TABS.find((t) => t.id === tab)!.kind;
  const hubShown = tab === "national" ? nat : mov;
  const listShown = (listsByFacet[tab] ?? []).slice().sort((a, b) => b.film_count - a.film_count || a.label.localeCompare(b.label));

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
          <div className="lin-tabs">
            {TABS.map((t) => counts[t.id] > 0 ? (
              <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>{t.label}<span>{counts[t.id]}</span></button>
            ) : null)}
          </div>
          {activeKind === "hub" ? (
            <div className="mv-grid" style={{ marginTop: 14 }}>
              {hubShown.map((h) => <HubCard key={h.slug} h={h} flag={tab === "national"} />)}
            </div>
          ) : (
            <div className="lh-list" style={{ marginTop: 14 }}>
              {listShown.map((r) => (
                <Link className="lh-row" href={`/lineage/${r.slug}`} key={r.slug}>
                  <span className="lh-name">{r.country ? `${codeToFlag(r.country)} ` : ""}{r.label}</span>
                  <span className="lh-n">{r.film_count}</span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
