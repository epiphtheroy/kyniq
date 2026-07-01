"use client";

/** Unified Lineage hub: tabs over National cinemas + Movements (curation hubs) and
 *  Awards / Canons / Auteur lines (lineage lists). One page, five tabs. */
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

  const counts: Record<TabId, number> = {
    national: nat.length, movements: mov.length,
    award: (listsByFacet.award ?? []).length, canon: (listsByFacet.canon ?? []).length, auteur: (listsByFacet.auteur ?? []).length,
  };

  const filt = (s: string) => s.toLowerCase().includes(q.trim().toLowerCase());
  const hubShown = (tab === "national" ? nat : mov).filter((h) => !q.trim() || filt(h.label));
  const listShown = (listsByFacet[tab] ?? []).filter((r) => !q.trim() || filt(r.label))
    .sort((a, b) => b.film_count - a.film_count || a.label.localeCompare(b.label));
  const activeKind = TABS.find((t) => t.id === tab)!.kind;

  return (
    <>
      <div className="lin-tabs">
        {TABS.map((t) => counts[t.id] > 0 ? (
          <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => { setTab(t.id); setQ(""); }}>
            {t.label}<span>{counts[t.id]}</span>
          </button>
        ) : null)}
      </div>

      <input className="mv-search" style={{ margin: "14px 0", width: "100%" }}
        placeholder={activeKind === "hub" ? "Search…" : "Search a list…"} value={q} onChange={(e) => setQ(e.target.value)} />

      {activeKind === "hub" ? (
        <div className="mv-grid">
          {hubShown.map((h) => <HubCard key={h.slug} h={h} flag={tab === "national"} />)}
        </div>
      ) : (
        <div className="lh-list">
          {listShown.map((r) => (
            <Link className="lh-row" href={`/lineage/${r.slug}`} key={r.slug}>
              <span className="lh-name">{r.label}</span>
              {r.country ? <span className="lh-meta"> · {codeToFlag(r.country)} {r.country.toUpperCase()}</span> : null}
              <span className="lh-n">{r.film_count}</span>
            </Link>
          ))}
        </div>
      )}
      {(activeKind === "hub" ? hubShown.length : listShown.length) === 0 ? <p className="lh-blurb" style={{ marginTop: 16 }}>Nothing matches that filter.</p> : null}
    </>
  );
}
