"use client";
import { useMemo, useState } from "react";
import Link from "next/link";

/**
 * ConceptDirectory — client-side browsing for the concept index.
 * Search (name + theorist), A–Z letter bar, and three sort modes:
 * by film count (default), alphabetical, and by theorist (name — concept).
 * Display convention (terminology charter 2026-07-08): concept names render
 * with a leading capital, no quotes/italics in lists; counts always visible.
 */
export type DirRow = { slug: string; name: string; films: number; theorist?: string | null };

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const sortKey = (s: string) => s.replace(/^the\s+/i, "").trim();
const letterOf = (s: string) => {
  const c = sortKey(s).charAt(0).toUpperCase();
  return c >= "A" && c <= "Z" ? c : "#";
};

const btn: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 999,
  border: "1px solid rgba(0,0,0,.12)", background: "transparent", cursor: "pointer",
};
const btnOn: React.CSSProperties = { ...btn, background: "rgba(0,0,0,.08)" };

export default function ConceptDirectory({ rows }: { rows: DirRow[] }) {
  const [q, setQ] = useState("");
  const [letter, setLetter] = useState<string | null>(null);
  const [mode, setMode] = useState<"films" | "az" | "theorist">("films");

  const letters = useMemo(() => {
    const have = new Set(rows.map((r) => letterOf(r.name)));
    return [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ#"].filter((c) => have.has(c));
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows;
    if (needle) out = out.filter((r) => r.name.toLowerCase().includes(needle) || (r.theorist ?? "").toLowerCase().includes(needle));
    if (letter) out = out.filter((r) => letterOf(r.name) === letter);
    if (mode === "az") out = [...out].sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name)));
    else if (mode === "theorist") out = [...out].filter((r) => r.theorist).sort((a, b) => (a.theorist ?? "").localeCompare(b.theorist ?? "") || b.films - a.films);
    else out = [...out].sort((a, b) => b.films - a.films || sortKey(a.name).localeCompare(sortKey(b.name)));
    return out;
  }, [rows, q, letter, mode]);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "16px 0 0" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter concepts or theorists…"
          aria-label="Filter concepts"
          style={{ flex: "1 1 220px", maxWidth: 340, fontSize: 14, padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,.18)", background: "transparent" }}
        />
        <span style={{ display: "flex", gap: 6 }}>
          <button type="button" style={mode === "films" ? btnOn : btn} onClick={() => setMode("films")}>By films</button>
          <button type="button" style={mode === "az" ? btnOn : btn} onClick={() => setMode("az")}>A–Z</button>
          <button type="button" style={mode === "theorist" ? btnOn : btn} onClick={() => setMode("theorist")}>By theorist</button>
        </span>
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", margin: "10px 0 0", fontSize: 12 }}>
        <button type="button" style={letter === null ? btnOn : btn} onClick={() => setLetter(null)}>All</button>
        {letters.map((c) => (
          <button key={c} type="button" style={letter === c ? btnOn : btn} onClick={() => setLetter(letter === c ? null : c)}>{c}</button>
        ))}
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 13, opacity: 0.65 }}>
        {filtered.length.toLocaleString()} concept{filtered.length !== 1 ? "s" : ""}
        {mode === "theorist" ? " with a named theorist" : ""} · film counts shown at right
      </p>
      <div className="th-grid" style={{ marginTop: 10 }}>
        {filtered.map((r) => (
          <Link className="th-row" href={`/concept/${r.slug}`} key={r.slug}>
            <span className="th-name">
              {mode === "theorist" ? (
                <>{r.theorist} — {cap(r.name)}</>
              ) : (
                <>{cap(r.name)}{r.theorist ? <span className="th-by"> — {r.theorist}</span> : null}</>
              )}
            </span>
            {r.films > 0 ? <span className="th-n">{r.films}</span> : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
