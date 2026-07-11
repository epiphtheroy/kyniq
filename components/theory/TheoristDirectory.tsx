"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

/**
 * TheoristDirectory — the browse pane for /theorist. A letter bar, two sort
 * modes (by films staged / A–Z), an inline filter, and a grid of thinkers.
 * Each card carries a square portrait (Wikidata/Commons, backfilled into
 * lib/theorist_portrait.json; monogram fallback when we have none), a one-line
 * gloss of the lens they give cinema, and the number of films read in their
 * light — the value signal: how many films stage what this thinker named.
 */
export type TheoristRow = { slug: string; name: string; blurb: string | null; n: number };

const sortKey = (s: string) => {
  const parts = s.trim().split(/\s+/);
  return (parts.length > 1 ? parts[parts.length - 1] : s).toLowerCase();
};
const letterOf = (s: string) => {
  const c = sortKey(s).charAt(0).toUpperCase();
  return c >= "A" && c <= "Z" ? c : "#";
};
const gloss = (blurb: string | null): string => {
  if (!blurb) return "";
  const first = blurb.split(/(?<=[.!?])\s/)[0] ?? blurb;
  return first.length > 120 ? first.slice(0, 117).trimEnd() + "…" : first;
};
const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

const btn: React.CSSProperties = { fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 999, border: "1px solid rgba(0,0,0,.12)", background: "transparent", cursor: "pointer" };
const btnOn: React.CSSProperties = { ...btn, background: "rgba(0,0,0,.08)" };

export default function TheoristDirectory({ rows, portraits }: { rows: TheoristRow[]; portraits: Record<string, string> }) {
  const [q, setQ] = useState("");
  const [letter, setLetter] = useState<string | null>(null);
  const [mode, setMode] = useState<"films" | "az">("films");

  const letters = useMemo(() => {
    const have = new Set(rows.map((r) => letterOf(r.name)));
    return [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ#"].filter((c) => have.has(c));
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows;
    if (needle) out = out.filter((r) => r.name.toLowerCase().includes(needle) || (r.blurb ?? "").toLowerCase().includes(needle));
    if (letter) out = out.filter((r) => letterOf(r.name) === letter);
    out = [...out];
    if (mode === "az") out.sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name)));
    else out.sort((a, b) => b.n - a.n || sortKey(a.name).localeCompare(sortKey(b.name)));
    return out;
  }, [rows, q, letter, mode]);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "6px 0 0" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter theorists…" aria-label="Filter theorists"
          style={{ flex: "1 1 220px", maxWidth: 340, fontSize: 14, padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,.18)", background: "transparent" }} />
        <span style={{ display: "flex", gap: 6 }}>
          <button type="button" style={mode === "films" ? btnOn : btn} onClick={() => setMode("films")}>By films</button>
          <button type="button" style={mode === "az" ? btnOn : btn} onClick={() => setMode("az")}>A–Z</button>
        </span>
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", margin: "10px 0 0", fontSize: 12 }}>
        <button type="button" style={letter === null ? btnOn : btn} onClick={() => setLetter(null)}>All</button>
        {letters.map((c) => (
          <button key={c} type="button" style={letter === c ? btnOn : btn} onClick={() => setLetter(letter === c ? null : c)}>{c}</button>
        ))}
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 13, opacity: 0.65 }}>
        {filtered.length.toLocaleString()} theorist{filtered.length !== 1 ? "s" : ""} · films staging their ideas shown at right
      </p>
      <div className="thx-cards" style={{ marginTop: 12 }}>
        {filtered.map((r) => {
          const img = portraits[r.slug];
          return (
            <Link className="thx-card" href={`/theorist/${r.slug}`} key={r.slug}>
              <span className="thx-thumb" aria-hidden="true">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt="" loading="lazy" />
                ) : <span className="thx-mono">{initials(r.name)}</span>}
              </span>
              <span className="thx-card-body">
                <span className="thx-card-top">
                  <span className="thx-card-name">{r.name}</span>
                  <span className="thx-card-n">{r.n.toLocaleString()}</span>
                </span>
                {r.blurb ? <span className="thx-card-gloss">{gloss(r.blurb)}</span> : null}
              </span>
            </Link>
          );
        })}
      </div>
      <style>{`
        .thx-cards{display:grid;grid-template-columns:1fr;gap:0;border-top:1px solid var(--hairline)}
        @media(min-width:720px){.thx-cards{grid-template-columns:1fr 1fr;column-gap:30px}}
        .thx-card{display:flex;gap:12px;padding:11px 0;border-bottom:1px solid var(--hairline);text-decoration:none;color:var(--ink)}
        .thx-thumb{flex:0 0 auto;width:52px;height:52px;border-radius:8px;overflow:hidden;background:var(--surface-2,#eee);border:1px solid var(--hairline);display:flex;align-items:center;justify-content:center}
        .thx-thumb img{width:100%;height:100%;object-fit:cover;display:block}
        .thx-mono{font-family:var(--font-display);font-weight:700;font-size:17px;color:var(--muted)}
        .thx-card-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;justify-content:center}
        .thx-card-top{display:flex;align-items:baseline;gap:10px}
        .thx-card-name{font-family:var(--font-display);font-size:16px;font-weight:600}
        .thx-card:hover .thx-card-name{color:var(--accent);text-decoration:underline}
        .thx-card-n{margin-left:auto;font-family:var(--font-ui);font-size:12px;font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums}
        .thx-card-gloss{font-family:var(--font-ui);font-size:12.5px;line-height:1.4;color:var(--muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      `}</style>
    </div>
  );
}
