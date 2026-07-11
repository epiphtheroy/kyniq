"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

/**
 * TraditionDirectory — the browse pane for /tradition. Schools of thought,
 * grouped by the domain they sit in, each carrying its concept + film counts.
 * Traditions with no film yet on screen (26 of ~180) are hidden by default —
 * a school with zero staged films is an empty shelf, of no use to a reader
 * looking for "the films that carry post-structuralism" and thin for SEO — but
 * a toggle reveals them so the full scholarly map stays reachable/crawlable.
 */
export type TraditionRow = { slug: string; name: string; parts: string[] | null; concepts: number; films: number };

const btn: React.CSSProperties = { fontSize: 12, fontWeight: 700, padding: "4px 11px", borderRadius: 999, border: "1px solid rgba(0,0,0,.14)", background: "transparent", cursor: "pointer" };
const btnOn: React.CSSProperties = { ...btn, background: "rgba(0,0,0,.08)" };

export default function TraditionDirectory({ rows }: { rows: TraditionRow[] }) {
  const [q, setQ] = useState("");
  const [showEmpty, setShowEmpty] = useState(false);

  const { groups, emptyCount } = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows;
    if (needle) out = out.filter((r) => r.name.toLowerCase().includes(needle) || (r.parts ?? []).some((p) => p.toLowerCase().includes(needle)));
    const emptyCount = out.filter((r) => r.films === 0).length;
    if (!showEmpty) out = out.filter((r) => r.films > 0);

    const byDomain = new Map<string, TraditionRow[]>();
    for (const r of out) {
      const dom = r.parts && r.parts.length ? r.parts[0] : "Other";
      const g = byDomain.get(dom) ?? [];
      g.push(r);
      byDomain.set(dom, g);
    }
    // domains ordered by total staged films; traditions inside by films desc
    const groups = [...byDomain.entries()]
      .map(([dom, g]) => [dom, g.sort((a, b) => b.films - a.films || a.name.localeCompare(b.name))] as const)
      .sort((a, b) => b[1].reduce((s, r) => s + r.films, 0) - a[1].reduce((s, r) => s + r.films, 0));
    return { groups, emptyCount };
  }, [rows, q, showEmpty]);

  const shown = groups.reduce((s, [, g]) => s + g.length, 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "6px 0 14px" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter traditions…" aria-label="Filter traditions"
          style={{ flex: "1 1 220px", maxWidth: 340, fontSize: 14, padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,.18)", background: "transparent" }} />
        {emptyCount > 0 || showEmpty ? (
          <button type="button" style={showEmpty ? btnOn : btn} onClick={() => setShowEmpty((v) => !v)}>
            {showEmpty ? "Hide" : "Show"} {emptyCount} with no films yet
          </button>
        ) : null}
        <span style={{ fontSize: 13, opacity: 0.6, marginLeft: "auto" }}>{shown} tradition{shown !== 1 ? "s" : ""}</span>
      </div>

      {groups.map(([domain, list]) => (
        <section key={domain} style={{ marginTop: 20 }}>
          <h2 className="thx-domhead">{domain}</h2>
          <div className="thx-trad-grid">
            {list.map((r) => (
              <Link className="thx-trad" href={`/tradition/${r.slug}`} key={r.slug}>
                <span className="thx-trad-name">{r.name}</span>
                <span className="thx-trad-meta">
                  {r.concepts.toLocaleString()} concept{r.concepts !== 1 ? "s" : ""}
                  {r.films > 0 ? <> · <b>{r.films.toLocaleString()}</b> film{r.films !== 1 ? "s" : ""}</> : <> · not yet on screen</>}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <style>{`
        .thx-domhead{font-family:var(--font-ui);font-size:11px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:var(--muted);margin:0 0 10px;border-bottom:1px solid var(--hairline);padding-bottom:6px}
        .thx-trad-grid{display:grid;grid-template-columns:1fr;gap:0}
        @media(min-width:680px){.thx-trad-grid{grid-template-columns:1fr 1fr;column-gap:30px}}
        @media(min-width:1040px){.thx-trad-grid{grid-template-columns:1fr 1fr 1fr;column-gap:26px}}
        .thx-trad{display:flex;flex-direction:column;gap:2px;padding:10px 0;border-bottom:1px solid var(--hairline);text-decoration:none;color:var(--ink)}
        .thx-trad-name{font-family:var(--font-display);font-size:15.5px;font-weight:600}
        .thx-trad:hover .thx-trad-name{color:var(--accent);text-decoration:underline}
        .thx-trad-meta{font-family:var(--font-ui);font-size:12px;color:var(--muted)}
        .thx-trad-meta b{color:var(--accent);font-weight:700}
      `}</style>
    </div>
  );
}
