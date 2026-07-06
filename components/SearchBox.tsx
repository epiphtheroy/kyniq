"use client";

/**
 * SearchBox — instant typeahead over the unified hybrid search engine
 * (/api/search → lib/search: every entity kind, Tier-2 included, plus a
 * meaning/embedding leg). Progressive two-stage fetch via useSearchTypeahead:
 * lexical results render immediately, hybrid results replace them when ready.
 * Keyboard navigable ("/" to focus, ↑/↓ to move, Enter to open, Esc to close).
 * Enter with nothing selected → full /search page.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KIND_LABEL, tmdbUrl, useSearchTypeahead, type SearchHit } from "@/lib/useSearch";

/** One typeahead result row — also used by the home hero (BigSearch). */
export function SearchHitRow({
  hit,
  active,
  onPick,
  onHover,
}: {
  hit: SearchHit;
  active: boolean;
  onPick: () => void;
  onHover: () => void;
}) {
  const img = tmdbUrl(hit.poster);
  return (
    <button
      type="button"
      className={`sb-row${active ? " on" : ""}`}
      onMouseEnter={onHover}
      onClick={onPick}
      aria-label={`${KIND_LABEL[hit.kind]}: ${hit.title}`}
    >
      {img ? (
        <img className="sb-thumb" src={img} alt="" loading="lazy" />
      ) : (
        <span className={`sb-thumb sb-mono sb-c-${hit.kind}`} aria-hidden="true">
          {(hit.title || "?").slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="sb-main">
        <span className="sb-title">
          {hit.title}
          {hit.is_catalog === true ? <span className="t2-chip">catalog</span> : null}
          {hit.match === "meaning" ? (
            <span className="sb-sem" title="Found by meaning, not keywords">≈</span>
          ) : null}
        </span>
        {hit.sub ? <span className="sb-sub">{hit.sub}</span> : null}
      </span>
      <span className={`sb-kind sb-k-${hit.kind}`}>{KIND_LABEL[hit.kind]}</span>
    </button>
  );
}

export default function SearchBox({ variant = "nav" }: { variant?: "nav" | "hero" }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const { hits, loading } = useSearchTypeahead(q);

  useEffect(() => {
    setActive(-1);
    if (q.trim().length >= 2) setOpen(true);
    else setOpen(false);
  }, [q]);

  // The hybrid stage can replace/reorder the list under the cursor — a kept
  // index would point at a different (or missing) row, so re-anchor.
  useEffect(() => { setActive(-1); }, [hits]);

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

  const go = (h: SearchHit) => { setOpen(false); setQ(""); router.push(h.href); };
  const submitAll = () => { const t = q.trim(); if (t) { setOpen(false); router.push(`/search?q=${encodeURIComponent(t)}`); } };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Committing a Hangul/CJK syllable fires Enter with isComposing — that
    // keystroke belongs to the IME, not to us.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
    else if (e.key === "Enter") { if (active >= 0 && hits[active]) go(hits[active]); else submitAll(); }
    else if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
  };

  return (
    <div ref={boxRef} className={`sb sb--${variant}`}>
      <input
        ref={inputRef}
        className="sb-input"
        type="search"
        value={q}
        placeholder={variant === "hero" ? "A film, a director, an idea, a feeling — any language" : "Search everything… ( / )"}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => { if (q.trim().length >= 2) setOpen(true); }}
        aria-label="Search Metatake"
        autoComplete="off"
      />
      {open && q.trim().length >= 2 && (
        <div className="sb-drop">
          {hits.length === 0 ? (
            loading ? (
              <div className="sb-empty">Searching by meaning…</div>
            ) : (
              <>
                <div className="sb-empty">No quick matches for “{q.trim()}”.</div>
                <button type="button" className="sb-all" onClick={submitAll}>
                  Search everything for “{q.trim()}” →
                </button>
              </>
            )
          ) : (
            <>
              {hits.map((h, i) => (
                <SearchHitRow
                  key={`${h.kind}:${h.slug}:${h.film_slug ?? ""}`}
                  hit={h}
                  active={i === active}
                  onPick={() => go(h)}
                  onHover={() => setActive(i)}
                />
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
