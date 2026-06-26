"use client";

/** Lineage hub list with a country filter (dropdown). Country = the awarding body's / auteur's nationality. */
import { useMemo, useState } from "react";
import Link from "next/link";
import { codeToFlag } from "@/lib/lineageBodies";

type IdxRow = { facet: string; slug: string; label: string; parent_label: string | null; country: string | null; tier: string | null; film_count: number };
type Group = { key: string; title: string; blurb: string };

let RN: Intl.DisplayNames | null = null;
function cname(cc: string): string {
  if (cc === "eu") return "Europe";
  try { RN = RN || new Intl.DisplayNames(["en"], { type: "region" }); return RN.of(cc.toUpperCase()) || cc.toUpperCase(); }
  catch { return cc.toUpperCase(); }
}

export default function LineageIndexClient({ rows, groups }: { rows: IdxRow[]; groups: Group[] }) {
  const [country, setCountry] = useState("");

  const countries = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.country && r.film_count > 0) m.set(r.country, (m.get(r.country) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || cname(a[0]).localeCompare(cname(b[0])));
  }, [rows]);

  const shown = country ? rows.filter((r) => r.country === country) : rows;
  const byFacet = new Map<string, IdxRow[]>();
  for (const r of shown) if (r.film_count > 0) { const a = byFacet.get(r.facet) ?? []; a.push(r); byFacet.set(r.facet, a); }

  return (
    <>
      <div className="lh-filter">
        <label htmlFor="lh-cc">Country of body</label>
        <select id="lh-cc" value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">All countries</option>
          {countries.map(([cc, n]) => <option key={cc} value={cc}>{codeToFlag(cc)} {cname(cc)} ({n})</option>)}
        </select>
        {country ? <button className="lh-clear" onClick={() => setCountry("")}>Clear</button> : null}
      </div>

      {groups.map((g) => {
        const items = byFacet.get(g.key) ?? [];
        if (!items.length) return null;
        return (
          <section className="lh-grp" key={g.key}>
            <h2 className="lh-h2">{g.title} <span className="lh-cnt">{items.length}</span></h2>
            <p className="lh-blurb">{g.blurb}</p>
            <div className="lh-list">
              {items.map((r) => (
                <Link className="lh-row" href={`/lineage/${r.slug}`} key={r.slug}>
                  <span className="lh-name">{r.label}</span>
                  {r.parent_label && r.parent_label !== r.label ? <span className="lh-meta"> · {r.parent_label}</span> : null}
                  {r.country ? <span className="lh-meta"> · {codeToFlag(r.country)} {r.country.toUpperCase()}</span> : null}
                  <span className="lh-n">{r.film_count}</span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      {[...byFacet.keys()].length === 0 ? <p className="lh-blurb" style={{ marginTop: 18 }}>No lists for that country.</p> : null}
    </>
  );
}
