"use client";

/**
 * SearchBox — instant typeahead over films / meta-takes / figures / directors
 * (search_site RPC, migration 0019). Debounced, grouped, entity-colour-coded,
 * keyboard navigable ("/" to focus, ↑/↓ to move, Enter to open, Esc to close).
 * Enter with nothing selected → full /search page.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type Kind = "film" | "reading" | "figure" | "director" | "trope";
// is_catalog: optional — set (true) on Tier-2 catalog film rows once the RPC ships it; absent today.
interface Row { kind: Kind; slug: string; film_slug: string | null; title: string; sub: string; score: number; is_catalog?: boolean | null }

const KIND_LABEL: Record<Kind, string> = { film: "Film", reading: "Reading", figure: "Figure", director: "Director", trope: "Trope" };
function hrefOf(r: Row): string {
  if (r.kind === "film") return `/film/${r.slug}`;
  if (r.kind === "trope") return `/trope/${r.slug}`;
  if (r.kind === "reading" || r.kind === "figure") return `/film/${r.film_slug}/figure/${r.slug}`;
  return `/director/${r.slug}`;
}

export default function SearchBox({ variant = "nav" }: { variant?: "nav" | "hero" }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const sb = useRef(createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!));

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setRows([]); setOpen(false); return; }
    const id = setTimeout(async () => {
      const { data } = await sb.current.rpc("search_site", { p_q: term, p_limit: 8 });
      setRows((data as Row[]) ?? []); setActive(-1); setOpen(true);
    }, 160);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (r: Row) => { setOpen(false); setQ(""); router.push(hrefOf(r)); };
  const submitAll = () => { const t = q.trim(); if (t) { setOpen(false); router.push(`/search?q=${encodeURIComponent(t)}`); } };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, rows.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
    else if (e.key === "Enter") { if (active >= 0 && rows[active]) go(rows[active]); else submitAll(); }
    else if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
  };

  return (
    <div ref={boxRef} className={`sb sb--${variant}`}>
      <input
        ref={inputRef}
        className="sb-input"
        type="search"
        value={q}
        placeholder={variant === "hero" ? "Search films, figures, readings, tropes…" : "Search… ( / )"}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => { if (rows.length) setOpen(true); }}
        aria-label="Search Metatake"
        autoComplete="off"
      />
      {open && q.trim().length >= 2 && (
        <div className="sb-drop">
          {rows.length === 0 ? (
            <div className="sb-empty">No matches for “{q.trim()}”.</div>
          ) : (
            <>
              {rows.map((r, i) => (
                <button
                  key={`${r.kind}:${r.slug}:${i}`}
                  type="button"
                  className={`sb-row${i === active ? " on" : ""}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r)}
                >
                  <span className={`sb-kind sb-k-${r.kind}`}>{KIND_LABEL[r.kind]}</span>
                  <span className="sb-title">{r.title}{r.is_catalog === true ? <span className="t2-chip">catalog</span> : null}</span>
                  {r.sub ? <span className="sb-sub">{r.sub}</span> : null}
                </button>
              ))}
              <button type="button" className="sb-all" onClick={submitAll}>
                See all results for “{q.trim()}” →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
