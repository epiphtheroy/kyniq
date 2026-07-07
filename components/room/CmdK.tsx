"use client";
/** ⌘K palette — instant jump to films / pages. Sections: FILMS / PAGES / RECENT.
 *  PAGES comes from lib/room/nav.ts (single source with the rail — no drift).
 *  RECENT persists picked entries in localStorage. film_search is debounced
 *  300ms; arrow keys move the selection, Enter opens it. */
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NAV_ITEMS, EXTRA_PAGES } from "@/lib/room/nav";
import { STR } from "./strings";

type Hit = { kind: "film" | "page"; label: string; sub?: string; href: string; icon?: string };

const PAGES: Hit[] = [...NAV_ITEMS, ...EXTRA_PAGES].map((n) => ({
  kind: "page" as const, label: n.label, href: n.href, icon: n.icon,
}));

const RECENT_KEY = "mt_cmdk_recent";
const RECENT_MAX = 8;

function readRecent(): Hit[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? (JSON.parse(raw) as Hit[]) : [];
    return Array.isArray(arr) ? arr.filter((h) => h && typeof h.href === "string" && typeof h.label === "string").slice(0, RECENT_MAX) : [];
  } catch { return []; }
}
function pushRecent(h: Hit) {
  try {
    const next = [h, ...readRecent().filter((x) => x.href !== h.href)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* storage unavailable — recents are a nicety, not a contract */ }
}

type Section = { label: string; items: Hit[] };

export default function CmdK({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [films, setFilms] = useState<Hit[]>([]);
  const [recent, setRecent] = useState<Hit[]>([]);
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (open) { setRecent(readRecent()); setTimeout(() => inputRef.current?.focus(), 30); }
    else { setQ(""); setFilms([]); setIdx(0); }
  }, [open]);

  /* film_search — 300ms debounce */
  useEffect(() => {
    const term = q.trim();
    if (!term) { setFilms([]); return; }
    let alive = true;
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("film_search", { p_q: term, p_limit: 8 });
      if (!alive) return;
      // room = Tier-1 only: unscored catalog films 404 at /room/film/{slug}
      const rows: Hit[] = ((data as Array<{ slug: string; title: string; year: number | null; is_catalog?: boolean }> | null) ?? [])
        .filter((f) => f.is_catalog !== true)
        .map((f) => ({ kind: "film" as const, label: f.title, sub: f.year ? String(f.year) : undefined, href: `/room/film/${f.slug}` }));
      setFilms(rows);
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [q, supabase]);

  const sections: Section[] = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) {
      const s: Section[] = [{ label: STR.cmdk.pages, items: PAGES }];
      if (recent.length) s.push({ label: STR.cmdk.recent, items: recent });
      return s;
    }
    const s: Section[] = [];
    if (films.length) s.push({ label: STR.cmdk.films, items: films });
    const pageHits = PAGES.filter((p) => p.label.toLowerCase().includes(term));
    if (pageHits.length) s.push({ label: STR.cmdk.pages, items: pageHits });
    return s;
  }, [q, films, recent]);

  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);
  useEffect(() => { setIdx(0); }, [q, films.length]);

  const go = useCallback((h: Hit) => {
    pushRecent(h);
    onClose();
    setQ("");
    router.push(h.href);
  }, [onClose, router]);

  if (!open) return null;
  let flatIdx = -1;
  return (
    <div className="palette show" onClick={onClose}>
      <div className="palbox" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={q}
          placeholder={STR.cmdk.placeholder}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            else if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, flat.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
            else if (e.key === "Enter" && flat[idx]) go(flat[idx]);
          }}
        />
        <div className="palres">
          {sections.map((s) => (
            <div key={s.label}>
              <div className="palsec">{s.label}</div>
              {s.items.map((h) => {
                flatIdx += 1;
                const i = flatIdx;
                return (
                  <div className={`palitem${i === idx ? " on" : ""}`} key={`${s.label}-${h.href}`} onClick={() => go(h)} onMouseEnter={() => setIdx(i)}>
                    <i className={`ti ${h.kind === "film" ? "ti-movie" : h.icon ?? "ti-arrow-right"}`} />
                    <span>{h.label}</span>
                    {h.sub ? <span className="pk">{h.sub}</span> : null}
                    <span className="pk">{h.kind === "film" ? STR.cmdk.film : STR.cmdk.page}</span>
                  </div>
                );
              })}
            </div>
          ))}
          {flat.length === 0 ? <div className="palitem">{STR.cmdk.empty}</div> : null}
        </div>
      </div>
    </div>
  );
}
