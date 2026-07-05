"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";

const AZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

export type CatMode = { key: string; label: string; az?: boolean };
export type CatCell = { href: string; title: ReactNode; meta: ReactNode; text: string };

function gid(k: string) {
  return "g-" + k.replace(/[^A-Za-z0-9]/g, "");
}

/* Generic catalogue — sort tabs, optional A–Z jump bar, live filter, 3-col grid.
   Grouping/sorting/cell rendering supplied by the caller per index. */
export default function Catalogue<T>({
  items,
  modes,
  defaultMode,
  groupOf,
  orderGroups,
  orderItems,
  headerOf,
  cell,
  title,
  sub,
  tot,
  filterPlaceholder,
  emptyText,
}: {
  items: T[];
  modes: CatMode[];
  defaultMode?: string;
  /** null = the item has no group in this mode and is omitted from it
   *  (e.g. unknown nationality — never exhibit an "Unknown" group). */
  groupOf: (it: T, mode: string) => string | null;
  orderGroups: (keys: string[], mode: string, groups: Record<string, T[]>) => string[];
  orderItems: (mode: string) => (a: T, b: T) => number;
  headerOf?: (key: string, mode: string) => string;
  cell: (it: T) => CatCell;
  title: string;
  sub: string;
  tot: string;
  filterPlaceholder: string;
  emptyText: string;
}) {
  const [mode, setMode] = useState<string>(defaultMode ?? modes[0]?.key ?? "alpha");
  const [q, setQ] = useState("");
  const azMode = modes.find((m) => m.key === mode)?.az ?? false;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? items.filter((it) => cell(it).text.includes(needle)) : items;
  }, [items, q, cell]);

  const groups = useMemo(() => {
    const m: Record<string, T[]> = {};
    for (const it of filtered) {
      const k = groupOf(it, mode);
      if (k == null) continue;
      (m[k] ||= []).push(it);
    }
    const keys = orderGroups(Object.keys(m), mode, m);
    const sorter = orderItems(mode);
    for (const k of keys) m[k].sort(sorter);
    return { keys, map: m };
  }, [filtered, mode, groupOf, orderGroups, orderItems]);

  const present = useMemo(() => new Set(groups.keys), [groups]);

  return (
    <>
      <div className="idx-listhead">
        <div className="t">{title}</div>
        <p className="sub">{sub}</p>
      </div>

      <div className="idx-tabs">
        <span className="l">Sort</span>
        {modes.map((m) => (
          <button key={m.key} data-on={mode === m.key ? "" : undefined} onClick={() => setMode(m.key)}>{m.label}</button>
        ))}
        <span className="tot">{tot}</span>
      </div>

      <input className="idx-filter" placeholder={filterPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />

      {azMode && (
        <div className="idx-azbar">
          {AZ.map((L) => (
            present.has(L)
              ? <a key={L} href={`#${gid(L)}`}>{L}</a>
              : <a key={L} className="off">{L}</a>
          ))}
        </div>
      )}

      {q.trim() !== "" && groups.keys.length === 0 && <p className="idx-empty" style={{ display: "block" }}>{emptyText}</p>}

      {groups.keys.map((key) => (
        <section key={key} id={gid(key)} className="idx-grp">
          <div className="idx-grph">{headerOf ? headerOf(key, mode) : key} <span className="gc">{groups.map[key].length}</span></div>
          <div className="idx-fcols">
            {groups.map[key].map((it) => {
              const c = cell(it);
              return (
                <Link key={c.href} href={c.href} className="idx-fcell">
                  <span className="ft">{c.title}</span>
                  <span className="fd">{c.meta}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
