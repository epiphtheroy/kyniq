"use client";

/**
 * LensProvider — the "My Films" lens. Three modes:
 *   off        — the public site, untouched.
 *   highlight  — films you've seen get an accent border everywhere; the rest stay normal.
 *   only       — the site re-centres on your films: unseen poster cards ghost out,
 *                the galaxy/panel/locations filter down to what you've watched.
 *
 * Mechanism: one DOM engine. Every film link on the site is an <a href="/film/{slug}">
 * (bespoke canvases opt in via data-lens-film="{slug}"), so a single scanner marks
 * elements with mtl-seen / mtl-unseen + mtl-card / mtl-inline classes and CSS does the
 * rest, gated on <html data-mtlens="...">. Server HTML stays fully cacheable — the
 * lens is a pure client overlay (see globals.css "My Films lens" block).
 *
 * Canvas surfaces (GalaxyView, FilmMap) read useLens() directly.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useUserFilms } from "@/components/UserFilmsProvider";

export type LensMode = "off" | "highlight" | "only";

type LensCtx = {
  /** effective mode — forced "off" until auth + seen set are ready */
  mode: LensMode;
  /** the user's stored preference, regardless of auth state */
  rawMode: LensMode;
  setMode: (m: LensMode) => void;
  active: boolean;
  seen: (slug?: string | null) => boolean;
  seenSlugs: ReadonlySet<string>;
  seenCount: number;
  uid: string | null;
  ready: boolean;
};

const Lens = createContext<LensCtx | null>(null);
const LS_KEY = "mt-lens-mode";
// deep paths count too: /film/x/figure/y (a reading card) belongs to film x
const FILM_HREF = /^\/film\/([^/?#]+)/;
// mine-first ordering guards: only reorder homogeneous film containers
const ORDER_MIN_ITEMS = 4;
const ORDER_MIN_COVERAGE = 0.7;

function readStoredMode(): LensMode {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v === "highlight" || v === "only") return v;
  } catch {}
  return "off";
}

export function LensProvider({ children }: { children: React.ReactNode }) {
  const films = useUserFilms();
  const [rawMode, setRawMode] = useState<LensMode>("off");

  // hydrate the stored preference after mount (SSR-safe). A `?lens=mine` param
  // (e.g. "Open the world map →" from My Room) activates the my-films lens on
  // arrival, without overwriting the persisted preference.
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search).get("lens");
      if (p === "mine" || p === "only") { setRawMode("only"); return; }
      if (p === "highlight") { setRawMode("highlight"); return; }
    } catch { /* fall through to stored */ }
    setRawMode(readStoredMode());
  }, []);

  const setMode = useCallback((m: LensMode) => {
    setRawMode(m);
    try { localStorage.setItem(LS_KEY, m); } catch {}
  }, []);

  const seenSlugs = films?.seenSlugs ?? (new Set<string>() as ReadonlySet<string>);
  const uid = films?.uid ?? null;
  const ready = !!films?.ready;
  const seenCount = seenSlugs.size;
  // the lens needs a signed-in user with at least one seen film, fully loaded
  const mode: LensMode = ready && uid && seenCount > 0 ? rawMode : "off";

  const seen = useCallback((slug?: string | null) => (slug ? seenSlugs.has(slug) : false), [seenSlugs]);

  // ---- DOM engine ----
  const applyRef = useRef<() => void>(() => {});
  useEffect(() => {
    document.documentElement.setAttribute("data-mtlens", mode);

    // clear a previous pass's mine-first ordering (inline styles can't be CSS-gated)
    const clearOrder = () => {
      document.querySelectorAll<HTMLElement>("[data-mtl-ordered]").forEach((c) => {
        for (const child of Array.from(c.children)) (child as HTMLElement).style.removeProperty("order");
        delete c.dataset.mtlOrdered;
      });
    };

    // mine-first: inside homogeneous flex/grid film containers, float seen items
    // to the front via CSS order — no DOM moves, so React reconciliation is safe.
    // Bespoke panels opt out with data-mtl-no-order (they band-sort in state).
    const applyOrder = (marked: Map<HTMLElement, boolean>) => {
      clearOrder();
      const dispCache = new Map<HTMLElement, string>();
      const disp = (el: HTMLElement) => {
        let d = dispCache.get(el);
        if (!d) { d = getComputedStyle(el).display; dispCache.set(el, d); }
        return d;
      };
      // every flex/grid ancestor (≤6 levels up) is a candidate container; the
      // guards below reject a card's own internal layout (too few children /
      // no seen+unseen mix) and page-level grids (coverage too low), leaving
      // the actual list container.
      const byContainer = new Map<HTMLElement, Map<HTMLElement, boolean>>();
      for (const [card, seenCard] of marked) {
        let node: HTMLElement = card;
        let parent = node.parentElement as HTMLElement | null;
        for (let i = 0; i < 6 && parent && parent !== document.body; i++) {
          if (parent.dataset.mtlNoOrder !== undefined) break;
          const d = disp(parent);
          if (d.includes("flex") || d.includes("grid")) {
            let g = byContainer.get(parent);
            if (!g) { g = new Map(); byContainer.set(parent, g); }
            g.set(node, (g.get(node) ?? false) || seenCard);
          }
          node = parent; parent = parent.parentElement as HTMLElement | null;
        }
      }
      for (const [c, g] of byContainer) {
        const total = c.children.length;
        let seenN = 0; for (const s of g.values()) if (s) seenN++;
        if (total < ORDER_MIN_ITEMS || g.size / total < ORDER_MIN_COVERAGE) continue;
        if (seenN === 0 || seenN === g.size) continue; // nothing to float
        for (const [item, seenItem] of g) if (seenItem) item.style.order = "-1";
        c.dataset.mtlOrdered = "1";
      }
    };

    const apply = () => {
      const els = document.querySelectorAll<HTMLElement>('a[href^="/film/"], [data-lens-film]');
      const markedCards = new Map<HTMLElement, boolean>();
      els.forEach((el) => {
        const slug =
          el.dataset.lensFilm ??
          (() => { const m = FILM_HREF.exec(el.getAttribute("href") ?? ""); return m ? decodeURIComponent(m[1]) : null; })();
        if (!slug) return;
        const isSeen = seenSlugs.has(slug);
        // classification: poster/bespoke/block anchors are "cards" (border on
        // their img when seen; ghosted whole in only-mode). Only true inline
        // text links get the ✓ — block anchors would render it in odd spots,
        // and icon-only anchors ("↗") stay unmarked to avoid noise.
        const hasImg = !!el.dataset.lensFilm || !!el.querySelector("img");
        const hasText = (el.textContent ?? "").trim().length >= 3;
        const isInline = !hasImg && hasText && getComputedStyle(el).display.startsWith("inline");
        const isCard = hasImg || (hasText && !isInline);
        el.classList.toggle("mtl-card", isCard);
        el.classList.toggle("mtl-inline", isInline);
        el.classList.toggle("mtl-seen", (isCard || isInline) && isSeen);
        el.classList.toggle("mtl-unseen", (isCard || isInline) && !isSeen);
        // data-lens-film rows (genre/lineage rows, graph nodes) join ordering too;
        // graph nodes are unaffected because their parent is never flex/grid
        if (isCard) markedCards.set(el, isSeen);
      });
      applyOrder(markedCards);
    };
    applyRef.current = apply;

    if (mode === "off") { clearOrder(); return; }

    apply();
    let timer: number | null = null;
    const mo = new MutationObserver(() => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => applyRef.current(), 120);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); if (timer) window.clearTimeout(timer); };
  }, [mode, seenSlugs]);

  const value = useMemo<LensCtx>(() => ({
    mode, rawMode, setMode, active: mode !== "off", seen, seenSlugs, seenCount, uid, ready,
  }), [mode, rawMode, setMode, seen, seenSlugs, seenCount, uid, ready]);

  return <Lens.Provider value={value}>{children}</Lens.Provider>;
}

export function useLens() { return useContext(Lens); }
