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
import type { SearchHit, SearchKind } from "@/lib/search-shared";

export type { SearchHit, SearchKind };
export { KIND_LABEL, TMDB_IMG, tmdbUrl } from "@/lib/search-shared";

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

    let hybridDone = false;
    let lexFailed = false;
    const HYBRID_MIN_LEN = 4;
    const hybridScheduled = term.length >= HYBRID_MIN_LEN;

    const t = setTimeout(() => {
      if (id !== reqId.current) return;
      const base = `/api/search?q=${encodeURIComponent(term)}&limit=${limit}`;
      const lexCtrl = new AbortController();
      ctrls.current.push(lexCtrl);

      const lexFail = () => {
        lexFailed = true;
        if (!hybridScheduled && id === reqId.current) {
          setHits([]); // no hybrid coming — don't leave the previous query's hits up
          setLoading(false);
        }
      };
      // Stage 1 — lexical only: fast path, shown while meaning search runs.
      fetch(`${base}&mode=lex`, { signal: lexCtrl.signal })
        .then((r) => (r.ok ? (r.json() as Promise<ApiResult>) : null))
        .then((d) => {
          if (id !== reqId.current || hybridDone) return;
          if (d) setHits(d.hits ?? []);
          else lexFail();
        })
        .catch(() => {
          if (id === reqId.current) lexFail();
        });
    }, debounceMs);

    // Stage 2 — hybrid (adds embedding matches): replaces stage 1 on arrival.
    // Gated behind a longer idle and a minimum length: embedding mid-word
    // prefixes ("grief th", "grief that ref") wastes an OpenAI call + a
    // 6-leg pgvector query per keystroke for results nobody sees.
    const t2 = hybridScheduled
      ? setTimeout(() => {
          if (id !== reqId.current) return;
          const hybCtrl = new AbortController();
          ctrls.current.push(hybCtrl);
          fetch(`/api/search?q=${encodeURIComponent(term)}&limit=${limit}`, { signal: hybCtrl.signal })
            .then((r) => (r.ok ? (r.json() as Promise<ApiResult>) : null))
            .then((d) => {
              if (id !== reqId.current) return;
              hybridDone = true;
              if (d) setHits(d.hits ?? []);
              else if (lexFailed) setHits([]); // both legs failed — don't show stale hits
              setLoading(false);
            })
            .catch(() => {
              if (id !== reqId.current) return;
              if (lexFailed) setHits([]); // both legs failed for this query
              setLoading(false); // otherwise keep lex results
            });
        }, debounceMs + 320)
      : (setLoading(false), null);

    return () => {
      clearTimeout(t);
      if (t2) clearTimeout(t2);
      ctrls.current.forEach((c) => c.abort());
      ctrls.current = [];
    };
  }, [q, limit, debounceMs]);

  return { hits, loading };
}
