"use client";
/** My Room v3 — session-scoped optimistic state + result cache (spec §4).
 *  Mounted once in the room shell so optimistic kept/gone/reRated survive route
 *  changes (fixes the v2 "film resurrects on the next screen" bug), and the
 *  Screener's λ-keyed result cache prevents a full vector re-scan per λ click.
 *
 *  Contract:
 *  - useRoomActions records every mutation here; screens FILTER with it
 *    (e.g. Screener hides `kept`/`gone` slugs) and render the "Passed on this
 *    session" strip from `passed`.
 *  - Cache is in-memory per tab session. Convention for Screener results:
 *    key = `wwi:${lambda.toFixed(1)}` → WwiRow[]. Mutating actions do NOT
 *    invalidate the cache — session sets already mask stale rows. */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export type PassedFilm = { slug: string; title: string };

export type SessionStoreApi = {
  /** Slugs kept (added to slate) this session. */
  kept: ReadonlySet<string>;
  /** Slugs gone from the candidate pool this session (seen or dismissed). */
  gone: ReadonlySet<string>;
  /** Slug → latest rating given this session (optimistic re-rate overlay). */
  reRated: Readonly<Record<string, number>>;
  /** Films dismissed this session, in order — feeds the Screener "Passed on" strip. */
  passed: readonly PassedFilm[];
  recordKeep: (slug: string) => void;
  recordRelease: (slug: string) => void;
  recordSeen: (slug: string) => void;
  recordDismiss: (slug: string, title: string) => void;
  /** Undo of a dismiss (doRestore): clears the slug from kept/gone/passed. */
  recordRestore: (slug: string) => void;
  recordRate: (slug: string, rating: number) => void;
  getCache: <T>(key: string) => T | undefined;
  setCache: (key: string, value: unknown) => void;
  /** Drop cache entries; with a prefix, only keys starting with it. */
  clearCache: (prefix?: string) => void;
};

const SessionCtx = createContext<SessionStoreApi | null>(null);

export function SessionStoreProvider({ children }: { children: ReactNode }) {
  const [kept, setKept] = useState<ReadonlySet<string>>(new Set());
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [reRated, setReRated] = useState<Readonly<Record<string, number>>>({});
  const [passed, setPassed] = useState<readonly PassedFilm[]>([]);
  const cache = useRef(new Map<string, unknown>());

  const addTo = (set: ReadonlySet<string>, slug: string) => { const n = new Set(set); n.add(slug); return n; };
  const dropFrom = (set: ReadonlySet<string>, slug: string) => { if (!set.has(slug)) return set; const n = new Set(set); n.delete(slug); return n; };

  const recordKeep = useCallback((slug: string) => setKept((p) => addTo(p, slug)), []);
  const recordRelease = useCallback((slug: string) => setKept((p) => dropFrom(p, slug)), []);
  const recordSeen = useCallback((slug: string) => setGone((p) => addTo(p, slug)), []);
  const recordDismiss = useCallback((slug: string, title: string) => {
    setGone((p) => addTo(p, slug));
    setPassed((p) => (p.some((x) => x.slug === slug) ? p : [...p, { slug, title }]));
  }, []);
  const recordRestore = useCallback((slug: string) => {
    setKept((p) => dropFrom(p, slug));
    setGone((p) => dropFrom(p, slug));
    setPassed((p) => p.filter((x) => x.slug !== slug));
  }, []);
  const recordRate = useCallback((slug: string, rating: number) => {
    setReRated((p) => ({ ...p, [slug]: rating }));
    setGone((p) => addTo(p, slug)); // rating implies seen
  }, []);

  const getCache = useCallback(<T,>(key: string): T | undefined => cache.current.get(key) as T | undefined, []);
  const setCache = useCallback((key: string, value: unknown) => { cache.current.set(key, value); }, []);
  const clearCache = useCallback((prefix?: string) => {
    if (!prefix) { cache.current.clear(); return; }
    for (const k of Array.from(cache.current.keys())) if (k.startsWith(prefix)) cache.current.delete(k);
  }, []);

  const api = useMemo<SessionStoreApi>(() => ({
    kept, gone, reRated, passed,
    recordKeep, recordRelease, recordSeen, recordDismiss, recordRestore, recordRate,
    getCache, setCache, clearCache,
  }), [kept, gone, reRated, passed, recordKeep, recordRelease, recordSeen, recordDismiss, recordRestore, recordRate, getCache, setCache, clearCache]);

  return <SessionCtx.Provider value={api}>{children}</SessionCtx.Provider>;
}

export function useSessionStore(): SessionStoreApi {
  const c = useContext(SessionCtx);
  if (!c) throw new Error("useSessionStore must be used within SessionStoreProvider");
  return c;
}
