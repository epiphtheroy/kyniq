"use client";

/** Movements index: two groups (National cinemas / Waves & movements) with search, region facet, sort. */
import { useMemo, useState } from "react";
import Link from "next/link";
import { codeToFlag } from "@/lib/lineageBodies";
import type { MvHub } from "@/app/movements/page";

const IMG = "https://image.tmdb.org/t/p/w154";

let RN: Intl.DisplayNames | null = null;
function cname(cc?: string | null): string {
  if (!cc) return "";
  try { RN = RN || new Intl.DisplayNames(["en"], { type: "region" }); return RN.of(cc.toUpperCase()) || cc.toUpperCase(); }
  catch { return cc.toUpperCase(); }
}

type Tab = "national" | "movements";
type Sort = "covered" | "az";

function Card({ h, national }: { h: MvHub; national: boolean }) {
  const flag = national && h.country_code ? codeToFlag(h.country_code) : "";
  return (
    <Link className="mv-card" href={`/movements/${h.slug}`}>
      <div className="mv-thumbs" aria-hidden="true">
        {(h.thumbs || []).slice(0, 3).map((p, i) =>
          p ? <img key={i} className="mv-th" src={`${IMG}${p}`} alt="" loading="lazy" /> : null
        )}
        {(!h.thumbs || h.thumbs.length === 0) ? <div className="mv-th mv-th--empty" /> : null}
      </div>
      <div className="mv-cmeta">
        <div className="mv-cname">{flag ? <span className="mv-flag">{flag} </span> : null}{h.label}</div>
        <div className="mv-csub">
          {national && h.region ? <span>{h.region}</span> : null}
          <span className="mv-cnt">{h.film_count} films</span>
        </div>
      </div>
    </Link>
  );
}

export default function MovementsIndexClient({ national, movements }: { national: MvHub[]; movements: MvHub[] }) {
  const nat = useMemo(() => national.filter((h) => h.film_count > 0), [national]);
  const mov = useMemo(() => movements.filter((h) => h.film_count > 0), [movements]);

  const [tab, setTab] = useState<Tab>(nat.length ? "national" : "movements");
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const [sort, setSort] = useState<Sort>("covered");
  const bothGroups = nat.length > 0 && mov.length > 0;

  const regions = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of nat) if (h.region) m.set(h.region, (m.get(h.region) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [nat]);

  const list = useMemo(() => {
    let base = (tab === "national" ? nat : mov).slice();
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      base = base.filter((h) => h.label.toLowerCase().includes(s) || cname(h.country_code).toLowerCase().includes(s));
    }
    if (tab === "national" && region) base = base.filter((h) => h.region === region);
    base.sort(sort === "az" ? (a, b) => a.label.localeCompare(b.label) : (a, b) => b.film_count - a.film_count || a.label.localeCompare(b.label));
    return base;
  }, [tab, nat, mov, q, region, sort]);

  return (
    <>
      <div className="mv-controls">
        {bothGroups ? (
          <div className="mv-seg">
            <button className={tab === "national" ? "on" : ""} onClick={() => setTab("national")}>National cinemas <span>{nat.length}</span></button>
            <button className={tab === "movements" ? "on" : ""} onClick={() => setTab("movements")}>Waves &amp; movements <span>{mov.length}</span></button>
          </div>
        ) : (
          <div className="mv-onegroup">{tab === "national" ? "National cinemas" : "Waves & movements"} <span>{(tab === "national" ? nat : mov).length}</span></div>
        )}
        <input className="mv-search" placeholder={tab === "national" ? "Search a country…" : "Search a movement…"} value={q} onChange={(e) => setQ(e.target.value)} />
        {tab === "national" && regions.length ? (
          <select className="mv-sel" value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">All regions</option>
            {regions.map(([r, n]) => <option key={r} value={r}>{r} ({n})</option>)}
          </select>
        ) : null}
        <select className="mv-sel" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="covered">Most covered</option>
          <option value="az">A–Z</option>
        </select>
      </div>

      <div className="mv-grid">
        {list.map((h) => <Card key={h.slug} h={h} national={tab === "national"} />)}
      </div>
      {!list.length ? <p className="lh-blurb" style={{ marginTop: 18 }}>Nothing matches that filter yet.</p> : null}
    </>
  );
}
