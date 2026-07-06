"use client";

/**
 * useSearchTypeahead — shared client hook for the unified hybrid search
 * (/api/search, backed by lib/search). Used by SearchBox (nav + /search hero)
 * and the home hero (BigSearch).
 *
 * Progressive two-stage fetch: on each debounced keystroke we fire BOTH
 *   1. mode=lex    — lexical only, fast, renders the instant it lands
 *   2. mode=hybrid — lexical + meaning (embedding) leg, replaces (1) when done
 * A request-id ref guards against stale responses overwriting newer input,
 * and in-flight fetches are aborted on every new keystroke/unmount.
 */

import { useEffect, useRef, useState } from "react";
import type { SearchHit, SearchKind } from "@/lib/search";

export type { SearchHit, SearchKind };

export const KIND_LABEL: Record<SearchKind, string> = {
  film: "Film",
  director: "Director",
  trope: "Trope",
  reading: "Reading",
  figure: "Figure",
  theorist: "Theorist",
  idea: "Idea",
  tradition: "Tradition",
  lineage: "List",
  movement: "Movement",
  archetype: "Archetype",
  country: "Place",
  city: "Place",
  genre: "Genre",
};

export const TMDB_IMG = "https://image.tmdb.org/t/p";
/** hit.poster is a TMDB-relative path (poster_path / profile_path) */
export function tmdbUrl(poster: string | null, size: "w92" | "w185" = "w92"): string | null {
  return poster ? `${TMDB_IMG}/${size}${poster}` : null;
}

interface ApiResult {
  hits?: SearchHit[];
}

export function useSearchTypeahead(q: string, limit = 9, debounceMs = 180) {
  const [hits, setHits] = useState<SearchHit[]>([]);
  /** true until the hybrid (meaning) leg settles for the current query */
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);
  const ctrls = useRef<AbortController[]>([]);

  useEffect(() => {
    const term = q.trim();
    const id = ++reqId.current; // invalidates any in-flight responses
    ctrls.current.forEach((c) => c.abort());
    ctrls.current = [];

    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const t = setTimeout(() => {
      if (id !== reqId.current) return;
      const base = `/api/search?q=${encodeURIComponent(term)}&limit=${limit}`;
      const lexCtrl = new AbortController();
      const hybCtrl = new AbortController();
      ctrls.current = [lexCtrl, hybCtrl];
      let hybridDone = false;

      // Stage 1 — lexical only: fast path, shown while meaning search runs.
      fetch(`${base}&mode=lex`, { signal: lexCtrl.signal })
        .then((r) => (r.ok ? (r.json() as Promise<ApiResult>) : null))
        .then((d) => {
          if (d && id === reqId.current && !hybridDone) setHits(d.hits ?? []);
        })
        .catch(() => {});

      // Stage 2 — hybrid (adds embedding matches): replaces stage 1 on arrival.
      fetch(base, { signal: hybCtrl.signal })
        .then((r) => (r.ok ? (r.json() as Promise<ApiResult>) : null))
        .then((d) => {
          if (id !== reqId.current) return;
          hybridDone = true;
          if (d) setHits(d.hits ?? []);
          setLoading(false);
        })
        .catch(() => {
          if (id === reqId.current) setLoading(false); // keep lex results on failure
        });
    }, debounceMs);

    return () => {
      clearTimeout(t);
      ctrls.current.forEach((c) => c.abort());
      ctrls.current = [];
    };
  }, [q, limit, debounceMs]);

  return { hits, loading };
}
