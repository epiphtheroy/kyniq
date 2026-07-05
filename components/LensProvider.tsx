"use client";

/**
 * LensProvider — the "My Films" lens. Three modes:
 *   off        — the public site, untouched.
 *   highlight  — films you've seen get an accent border everywhere; the rest stay normal.
 *   only       — the site re-centres on your films: unseen poster cards ghost out,
 *                the galaxy/panel/atlas filter down to what you've watched.
 *
 * Mechanism: one DOM engine. Every film link on the site is an <a href="/film/{slug}">
 * (bespoke canvases opt in via data-lens-film="{slug}"), so a single scanner marks
 * elements with mtl-seen / mtl-unseen + mtl-card / mtl-inline classes and CSS does the
 * rest, gated on <html data-mtlens="...">. Server HTML stays fully cacheable — the
 * lens is a pure client overlay (see globals.css "My Films lens" block).
 *
 * Canvas surfaces (GalaxyMap, FilmMap) read useLens() directly.
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
const FILM_HREF = /^\/film\/([^/?#]+)\/?(?:[?#].*)?$/;

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

  // hydrate the stored preference after mount (SSR-safe)
  useEffect(() => { setRawMode(readStoredMode()); }, []);

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

    const apply = () => {
      const els = document.querySelectorAll<HTMLElement>('a[href^="/film/"], [data-lens-film]');
      els.forEach((el) => {
        const slug =
          el.dataset.lensFilm ??
          (() => { const m = FILM_HREF.exec(el.getAttribute("href") ?? ""); return m ? decodeURIComponent(m[1]) : null; })();
        if (!slug) return;
        const isSeen = seenSlugs.has(slug);
        // cards carry a poster <img> (or are bespoke data-lens-film nodes);
        // icon-only anchors ("↗") are left unmarked to avoid ✓ noise.
        const isCard = !!el.dataset.lensFilm || !!el.querySelector("img");
        const isInline = !isCard && (el.textContent ?? "").trim().length >= 3;
        el.classList.toggle("mtl-card", isCard);
        el.classList.toggle("mtl-inline", isInline);
        el.classList.toggle("mtl-seen", (isCard || isInline) && isSeen);
        el.classList.toggle("mtl-unseen", (isCard || isInline) && !isSeen);
      });
    };
    applyRef.current = apply;

    if (mode === "off") return; // CSS is gated on the html attr — no sweep needed

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
