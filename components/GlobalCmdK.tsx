"use client";
/**
 * GlobalCmdK — site-wide command palette (⌘K / Ctrl+K).
 *
 * Fronts the unified hybrid search engine (/api/search → lib/search.ts):
 * progressive lex→hybrid fetch, page shortcuts, recent searches, full
 * keyboard nav. Self-contained (own <style> tag, .gcmdk-* namespace).
 *
 * Not bound inside /room — the room has its own palette (components/room/CmdK).
 * The nav search trigger opens it via `window.dispatchEvent(new CustomEvent("metatake:cmdk"))`.
 * "/" is owned by SearchBox and deliberately NOT bound here.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { KIND_LABEL, tmdbUrl, type SearchHit } from "@/lib/search-shared";
import { useSearchTypeahead } from "@/lib/useSearch";

const OPEN_EVENT = "metatake:cmdk";
const RECENT_KEY = "mt:recent-searches";
const RECENT_MAX = 5;

const PAGES: { label: string; href: string }[] = [
  { label: "Search", href: "/search" },
  { label: "Films", href: "/film" },
  { label: "Directors", href: "/director" },
  { label: "Tropes", href: "/tropes" },
  { label: "Archetypes", href: "/catalog" },
  { label: "Strong Misreadings", href: "/strong-misreadings" },
  { label: "Concepts", href: "/concept" },
  { label: "Theorists", href: "/theorist" },
  { label: "Traditions", href: "/tradition" },
  { label: "Lineage", href: "/lineage" },
  { label: "Atlas", href: "/atlas" },
  { label: "Movements", href: "/movements" },
  { label: "TakeScore", href: "/takescore" },
  { label: "Connections", href: "/map" },
  { label: "Where to watch", href: "/where-to-watch" },
  { label: "Credits", href: "/credits" },
  { label: "Latest", href: "/latest" },
  { label: "Trending", href: "/trending" },
  { label: "METATAKE TV", href: "/tv" },
  { label: "My Room", href: "/room" },
  { label: "Ask metatake AI", href: "/ask-ai" },
  { label: "Blog — The Daily", href: "/blog" },
  { label: "Curious", href: "/curious" },
];

type Row =
  | { type: "hit"; hit: SearchHit }
  | { type: "page"; label: string; href: string }
  | { type: "recent"; q: string }
  | { type: "action"; label: string; href: string };

// Result sections — the dropdown groups hits under these headers instead of one
// interleaved list (kind chips per row read as clutter; a header reads as a map).
// Order is editorial: entities → ideas → writing → places. Fused (relevance)
// order is preserved within each section.
const SECTIONS: { label: string; kinds: SearchHit["kind"][]; cap: number }[] = [
  { label: "Films", kinds: ["film"], cap: 5 },
  { label: "People", kinds: ["director", "theorist"], cap: 4 },
  { label: "Now Playing", kinds: ["now"], cap: 2 },
  { label: "Metatake TV", kinds: ["tv", "tv_list"], cap: 3 },
  { label: "Ideas & Patterns", kinds: ["trope", "idea", "tradition", "archetype", "movement", "genre"], cap: 4 },
  { label: "Writing", kinds: ["essay", "reading", "figure"], cap: 4 },
  { label: "Places & Lists", kinds: ["country", "city", "lineage"], cap: 3 },
];

function groupHits(hits: SearchHit[]): { label: string; hits: SearchHit[] }[] {
  return SECTIONS.map((s) => ({
    label: s.label,
    hits: hits.filter((h) => s.kinds.includes(h.kind)).slice(0, s.cap),
  })).filter((s) => s.hits.length > 0);
}

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr)
      ? arr.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
}

function pushRecent(q: string) {
  const t = q.trim();
  if (t.length < 2) return;
  try {
    const next = [t, ...readRecent().filter((s) => s.toLowerCase() !== t.toLowerCase())].slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode etc. — recents are best-effort */
  }
}

export default function GlobalCmdK() {
  const router = useRouter();
  const pathname = usePathname();
  const inRoom = pathname?.startsWith("/room") ?? false;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  // Shared progressive lex→hybrid fetch — same engine, same race guards as
  // SearchBox/BigSearch (components/SearchBox.tsx). `loading` stays true
  // until the meaning leg settles.
  const { hits, loading: pending } = useSearchTypeahead(open ? query : "", 10, 160);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* ---------------------------------------------------------- open/close */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        if (inRoom) return; // the room has its own palette
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onEvt = () => setOpen(true); // nav trigger
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onEvt);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onEvt);
    };
  }, [inRoom]);

  useEffect(() => {
    if (!open) return;
    setRecent(readRecent());
    setActiveIdx(0);
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 20);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const close = useCallback(() => {
    setOpen(false); // the hook aborts in-flight fetches when `open ? query : ""` flips
  }, []);

  /* ------------------------------------------------------------ row model */

  // Rows stay a FLAT array (keyboard nav walks indices); `sections` carries the
  // group headers over contiguous index ranges so the render can label them.
  const { rows, sections } = useMemo<{ rows: Row[]; sections: { label: string; start: number; count: number }[] }>(() => {
    const q = query.trim();
    if (q.length < 2) {
      return {
        rows: [
          ...PAGES.map<Row>((p) => ({ type: "page", ...p })),
          ...recent.map<Row>((r) => ({ type: "recent", q: r })),
        ],
        sections: [],
      };
    }
    const ql = q.toLowerCase();
    const grouped = groupHits(hits);
    const rows: Row[] = [];
    const sections: { label: string; start: number; count: number }[] = [];
    for (const g of grouped) {
      sections.push({ label: g.label, start: rows.length, count: g.hits.length });
      for (const hit of g.hits) rows.push({ type: "hit", hit });
    }
    // Page shortcuts while typing: top 2 only — the 22-link grid belongs to the
    // empty state, not under search results.
    const pageMatches = PAGES.filter((p) => p.label.toLowerCase().includes(ql)).slice(0, 2);
    if (pageMatches.length) {
      sections.push({ label: "Pages", start: rows.length, count: pageMatches.length });
      for (const p of pageMatches) rows.push({ type: "page", ...p });
    }
    // "See all results" leads the actions: Enter before hits land must go to
    // /search (the old nav form's muscle memory), never surprise-route to /ask.
    rows.push({ type: "action", label: `See all results for “${q}”`, href: `/search?q=${encodeURIComponent(q)}` });
    rows.push({ type: "action", label: `Ask metatake AI: “${q}”`, href: `/ask-ai?q=${encodeURIComponent(q)}` });
    return { rows, sections };
  }, [query, hits, recent]);

  const active = Math.min(activeIdx, Math.max(rows.length - 1, 0));

  useEffect(() => {
    setActiveIdx(0);
  }, [query, hits]); // hybrid swap can reorder the list — re-anchor the cursor

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  /* ----------------------------------------------------------- navigation */

  const go = useCallback(
    (row: Row) => {
      const q = query.trim();
      let href: string;
      if (row.type === "recent") {
        pushRecent(row.q);
        href = `/search?q=${encodeURIComponent(row.q)}`;
      } else {
        if (q.length >= 2) pushRecent(q);
        href = row.type === "hit" ? row.hit.href : row.href;
      }
      close();
      setQuery("");
      router.push(href);
    },
    [query, router, close],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Hangul/CJK IME: the keydown that commits a composed syllable belongs to
    // the IME — acting on it would navigate away mid-word.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (rows.length ? (i + 1) % rows.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (rows.length ? (i - 1 + rows.length) % rows.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[active];
      if (row) go(row);
      else if (query.trim().length >= 2) go({ type: "action", label: "", href: `/search?q=${encodeURIComponent(query.trim())}` });
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      e.preventDefault(); // keep focus in the input
    }
  };

  /* ------------------------------------------------------------ rendering */

  if (!open) return null;

  const q = query.trim();
  const searching = q.length >= 2;

  const rowBtn = (i: number, className: string, onPick: () => void, children: React.ReactNode) => (
    <button
      key={i}
      type="button"
      role="option"
      id={`gcmdk-opt-${i}`}
      aria-selected={i === active}
      data-active={i === active || undefined}
      className={className}
      onMouseEnter={() => setActiveIdx(i)}
      onClick={onPick}
      tabIndex={-1}
    >
      {children}
    </button>
  );

  const renderRow = (row: Row, i: number) => {
    if (row.type === "hit") {
      const h = row.hit;
      const kindLabel = KIND_LABEL[h.kind];
      return rowBtn(
        i,
        "gcmdk-row",
        () => go(row),
        <>
          {h.poster ? (
            <img className="gcmdk-thumb" src={tmdbUrl(h.poster) ?? undefined} alt="" loading="lazy" width={24} height={36} />
          ) : (
            <span className="gcmdk-mono" aria-hidden="true">
              {h.kind.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="gcmdk-main">
            <span className="gcmdk-title">
              {h.title}
              {h.year ? <span className="gcmdk-year"> {h.year}</span> : null}
            </span>
            {h.sub ? <span className="gcmdk-sub">{h.sub}</span> : null}
          </span>
          {h.match === "meaning" ? (
            <span className="gcmdk-sem" title="Matched by meaning, not text">
              ≈ meaning
            </span>
          ) : null}
          {h.is_catalog ? <span className="gcmdk-cat">catalog</span> : null}
          {/* Kind chip only where the section header doesn't already say it —
              mixed sections (People, Writing, Ideas, Places) keep the tag. */}
          {h.kind !== "film" ? <span className="gcmdk-kind">{kindLabel}</span> : null}
        </>,
      );
    }
    if (row.type === "page") {
      return rowBtn(
        i,
        "gcmdk-row",
        () => go(row),
        <>
          <span className="gcmdk-mono gcmdk-mono--page" aria-hidden="true">→</span>
          <span className="gcmdk-main">
            <span className="gcmdk-title">{row.label}</span>
          </span>
          <span className="gcmdk-kind">page</span>
        </>,
      );
    }
    if (row.type === "recent") {
      return rowBtn(
        i,
        "gcmdk-row",
        () => go(row),
        <>
          <span className="gcmdk-mono gcmdk-mono--page" aria-hidden="true">↺</span>
          <span className="gcmdk-main">
            <span className="gcmdk-title">{row.q}</span>
          </span>
          <span className="gcmdk-kind">recent</span>
        </>,
      );
    }
    return rowBtn(
      i,
      "gcmdk-row gcmdk-row--action",
      () => go(row),
      <>
        <span className="gcmdk-main">
          <span className="gcmdk-title">{row.label}</span>
        </span>
        <span className="gcmdk-arrow" aria-hidden="true">→</span>
      </>,
    );
  };

  const indexed = rows.map((r, i) => [r, i] as const);
  const pageRows = indexed.filter(([r]) => r.type === "page");
  const recentRows = indexed.filter(([r]) => r.type === "recent");
  const actionRows = indexed.filter(([r]) => r.type === "action");

  return (
    <div className="gcmdk-overlay" role="presentation" onMouseDown={close}>
      <div
        className="gcmdk-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Search Metatake"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="gcmdk-inputrow">
          <span className="gcmdk-glass" aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            className="gcmdk-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all of Metatake — any language"
            aria-label="Search all of Metatake — any language"
            role="combobox"
            aria-expanded="true"
            aria-controls="gcmdk-list"
            aria-activedescendant={rows.length ? `gcmdk-opt-${active}` : undefined}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {pending ? <span className="gcmdk-pending" aria-hidden="true" /> : null}
          <kbd className="gcmdk-esc">esc</kbd>
        </div>

        <div className="gcmdk-body" id="gcmdk-list" role="listbox" aria-label="Search results" ref={listRef}>
          {!searching ? (
            <div className="gcmdk-cols">
              <div className="gcmdk-col">
                <div className="gcmdk-h">Go to</div>
                {pageRows.map(([r, i]) => renderRow(r, i))}
              </div>
              <div className="gcmdk-col">
                <div className="gcmdk-h">Recent searches</div>
                {recentRows.length > 0 ? (
                  recentRows.map(([r, i]) => renderRow(r, i))
                ) : (
                  <div className="gcmdk-none">Nothing yet — your last searches will appear here.</div>
                )}
              </div>
            </div>
          ) : (
            <>
              {hits.length === 0 && !pending ? (
                <div className="gcmdk-none">No direct matches — try asking, or see all results below.</div>
              ) : null}
              {sections.map((s) => (
                <div key={s.label} className="gcmdk-sec">
                  <div className="gcmdk-h">{s.label}</div>
                  {rows.slice(s.start, s.start + s.count).map((r, j) => renderRow(r, s.start + j))}
                </div>
              ))}
              <div className="gcmdk-actions">{actionRows.map(([r, i]) => renderRow(r, i))}</div>
            </>
          )}
        </div>

        <div className="gcmdk-foot" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
          <span className="gcmdk-foot-note">searches meaning, not just titles</span>
        </div>
      </div>

      <style>{`
        .gcmdk-overlay{position:fixed;inset:0;z-index:1200;background:rgba(13,13,13,.45);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);display:flex;justify-content:center;align-items:flex-start;padding:15vh 16px 16px}
        .gcmdk-panel{width:100%;max-width:640px;background:var(--bg,#fff);color:var(--ink,#0d0d0d);border:1px solid var(--hairline,#d8d8d8);border-radius:12px;box-shadow:0 24px 80px -12px rgba(0,0,0,.4);overflow:hidden;font-family:var(--font-ui,Inter,-apple-system,sans-serif)}
        .gcmdk-inputrow{display:flex;align-items:center;gap:10px;padding:13px 16px;border-bottom:1px solid var(--hairline,#d8d8d8)}
        .gcmdk-glass{color:var(--muted,#6b6b6b);font-size:18px;line-height:1}
        .gcmdk-input{flex:1;min-width:0;border:0;outline:0;background:transparent;font-family:inherit;font-size:16px;color:var(--ink,#0d0d0d)}
        .gcmdk-input::placeholder{color:var(--subtle,#8f8f8f)}
        .gcmdk-pending{width:8px;height:8px;border-radius:50%;background:var(--accent,#e3120b);animation:gcmdk-pulse 1s ease-in-out infinite}
        @keyframes gcmdk-pulse{0%,100%{opacity:.25}50%{opacity:1}}
        .gcmdk-esc{flex:0 0 auto}
        .gcmdk-body{max-height:min(56vh,460px);overflow-y:auto;padding:6px}
        .gcmdk-row{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:0;background:transparent;padding:7px 10px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:14px;color:var(--ink,#0d0d0d)}
        .gcmdk-row[data-active]{background:var(--surface-2,#f2f2f2)}
        .gcmdk-thumb{flex:0 0 auto;width:24px;height:36px;object-fit:cover;border-radius:3px;background:var(--surface-2,#f2f2f2)}
        .gcmdk-mono{flex:0 0 auto;width:24px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:3px;background:var(--surface-2,#f2f2f2);color:var(--muted,#6b6b6b);font-size:12px;font-weight:600;font-family:var(--font-display,Georgia,serif)}
        .gcmdk-mono--page{height:24px;font-family:inherit}
        .gcmdk-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
        .gcmdk-title{font-size:14.5px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .gcmdk-year{color:var(--muted,#6b6b6b);font-size:12.5px}
        .gcmdk-sub{font-size:12px;color:var(--muted,#6b6b6b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .gcmdk-kind{flex:0 0 auto;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#6b6b6b);border:1px solid var(--hairline,#d8d8d8);border-radius:4px;padding:2px 6px}
        .gcmdk-sem{flex:0 0 auto;font-size:10.5px;font-weight:600;font-style:italic;color:var(--accent,#e3120b)}
        .gcmdk-cat{flex:0 0 auto;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--subtle,#8f8f8f)}
        .gcmdk-sec{margin-bottom:2px}
        .gcmdk-sec + .gcmdk-sec{margin-top:4px}
        .gcmdk-actions{margin-top:6px;border-top:1px solid var(--hairline,#d8d8d8);padding-top:6px}
        .gcmdk-row--action .gcmdk-title{color:var(--accent,#e3120b);font-weight:600;font-size:13.5px}
        .gcmdk-arrow{color:var(--accent,#e3120b)}
        .gcmdk-cols{display:grid;grid-template-columns:1.2fr 1fr;gap:4px 14px;align-items:start}
        .gcmdk-col{min-width:0}
        .gcmdk-h{font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--subtle,#8f8f8f);padding:8px 10px 4px}
        .gcmdk-none{padding:10px;font-size:13px;color:var(--muted,#6b6b6b)}
        .gcmdk-foot{display:flex;align-items:center;gap:14px;padding:8px 16px;border-top:1px solid var(--hairline,#d8d8d8);color:var(--muted,#6b6b6b);font-size:11.5px}
        .gcmdk-foot-note{margin-left:auto;font-style:italic}
        .gcmdk-panel kbd{font-family:inherit;font-size:10.5px;color:var(--muted,#6b6b6b);background:var(--surface-2,#f2f2f2);border:1px solid var(--hairline,#d8d8d8);border-radius:4px;padding:1px 5px;margin-right:2px}
        @media(max-width:600px){
          .gcmdk-overlay{padding:8vh 8px 8px}
          .gcmdk-cols{grid-template-columns:1fr}
          .gcmdk-body{max-height:62vh}
          .gcmdk-kind{display:none}
        }
      `}</style>
    </div>
  );
}
