"use client";

/**
 * EntityFinder — a scoped in-page typeahead for index/hub pages ("find one X
 * fast"), fronting the unified engine's lexical leg (/api/search?mode=lex)
 * restricted to the page's kind(s). Distinct from the site-wide search: the
 * label says what it covers, and a hint hands off to ⌘K for everything else.
 *
 * Fuzzy + Korean out of the box: the lexical RPC (search_all v4) does trigram
 * typo tolerance, word matches, and search_aliases (Wikidata ko labels).
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { tmdbUrl, type SearchHit } from "@/lib/search-shared";

export default function EntityFinder({
  kinds, placeholder, ariaLabel,
}: {
  kinds: string;            // comma-joined SearchKind list, e.g. "film" | "director"
  placeholder: string;
  ariaLabel?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]); setOpen(false);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const r = await fetch(
          `/api/search?mode=lex&kinds=${encodeURIComponent(kinds)}&limit=8&q=${encodeURIComponent(term)}`,
          { signal: ctrl.signal },
        );
        const d = (await r.json()) as { hits?: SearchHit[] };
        setHits(d.hits ?? []);
        setOpen(true);
        setActive(0);
      } catch {
        /* aborted or offline — keep whatever is shown */
      }
    }, 160);
    return () => clearTimeout(t);
  }, [q, kinds]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const go = (h: SearchHit) => {
    setOpen(false); setQ("");
    router.push(h.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Hangul/CJK IME: the keydown committing a composed syllable belongs to the IME.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (!open || hits.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % hits.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + hits.length) % hits.length); }
    else if (e.key === "Enter") { e.preventDefault(); if (hits[active]) go(hits[active]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <div className="efind" ref={boxRef}>
      <input
        className="efind-input"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => { if (hits.length) setOpen(true); }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      <span className="efind-hint">finds within this index — <kbd>⌘K</kbd> searches all of Metatake</span>
      {open && hits.length > 0 ? (
        <div className="efind-drop" role="listbox">
          {hits.map((h, i) => (
            <button
              key={`${h.kind}:${h.slug}`}
              type="button"
              role="option"
              aria-selected={i === active}
              data-active={i === active || undefined}
              className="efind-row"
              onMouseEnter={() => setActive(i)}
              onClick={() => go(h)}
            >
              {h.poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="efind-thumb" src={tmdbUrl(h.poster) ?? undefined} alt="" loading="lazy" width={22} height={33} />
              ) : (
                <span className="efind-mono" aria-hidden="true">{h.title.charAt(0)}</span>
              )}
              <span className="efind-main">
                <span className="efind-title">{h.title}{h.year ? <span className="efind-year"> {h.year}</span> : null}</span>
                {h.sub ? <span className="efind-sub">{h.sub}</span> : null}
              </span>
              {h.is_catalog ? <span className="efind-cat">catalog</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      <style>{`
        .efind{position:relative;max-width:520px;margin:14px auto 2px;display:flex;flex-direction:column;gap:3px}
        .efind-input{font-family:var(--font-ui);font-size:14px;color:var(--ink);background:var(--bg);border:1px solid var(--hairline-2,#ccc);border-radius:22px;padding:9px 16px;width:100%}
        .efind-input:focus{outline:none;border-color:var(--accent,#e3120b)}
        .efind-hint{font-family:var(--font-ui);font-size:10.5px;color:var(--subtle,#8f8f8f);padding-left:14px}
        .efind-hint kbd{font-family:inherit;font-size:9.5px;border:1px solid var(--hairline,#d8d8d8);border-radius:3px;padding:0 4px}
        .efind-drop{position:absolute;top:42px;left:0;right:0;z-index:60;background:var(--bg,#fff);border:1px solid var(--hairline,#d8d8d8);border-radius:10px;box-shadow:0 14px 44px -10px rgba(0,0,0,.28);padding:5px;max-height:340px;overflow-y:auto}
        .efind-row{display:flex;align-items:center;gap:9px;width:100%;text-align:left;border:0;background:transparent;padding:6px 9px;border-radius:7px;cursor:pointer;font-family:var(--font-ui);color:var(--ink)}
        .efind-row[data-active]{background:var(--surface-2,#f2f2f2)}
        .efind-thumb{flex:0 0 auto;width:22px;height:33px;object-fit:cover;border-radius:3px;background:var(--surface-2,#f2f2f2)}
        .efind-mono{flex:0 0 auto;width:22px;height:33px;display:flex;align-items:center;justify-content:center;border-radius:3px;background:var(--surface-2,#f2f2f2);color:var(--muted,#6b6b6b);font-size:12px;font-weight:600}
        .efind-main{flex:1;min-width:0;display:flex;flex-direction:column}
        .efind-title{font-size:13.5px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .efind-year{color:var(--muted,#6b6b6b);font-size:12px}
        .efind-sub{font-size:11.5px;color:var(--muted,#6b6b6b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .efind-cat{flex:0 0 auto;font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--subtle,#8f8f8f)}
        @media(max-width:640px){.efind-hint{display:none}}
      `}</style>
    </div>
  );
}
