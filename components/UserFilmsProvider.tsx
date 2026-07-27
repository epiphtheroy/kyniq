"use client";

/**
 * UserFilmsProvider — loads the signed-in user's whole user_movies map ONCE per session, keyed by
 * film_id with a slug→id index, so any poster card (PosterActions) can read/toggle Seen / Watchlist /
 * 0.5 rating by film_id OR by slug without a query per card. Writes optimistically via RLS.
 * A never-touched film referenced by slug resolves its id lazily on first toggle. Logged-out → /login.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { requireAuthEvent } from "@/lib/conversion/bus";
import type { IntentVerb } from "@/lib/conversion/intent";

export type FilmState = { seen: boolean; watchlist: boolean; rating: number };
export type FilmKey = { id?: string | null; slug?: string | null };
type Ctx = {
  ready: boolean;
  uid: string | null;
  get: (key: FilmKey) => FilmState;
  toggleSeen: (key: FilmKey) => void;
  toggleWatch: (key: FilmKey) => void;
  rate: (key: FilmKey, n: number) => void;
  /** slugs of every film marked Seen — powers the My Films lens */
  seenSlugs: ReadonlySet<string>;
};
const EMPTY: FilmState = { seen: false, watchlist: false, rating: 0 };
const UserFilms = createContext<Ctx | null>(null);

function sb() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export function UserFilmsProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [map, setMap] = useState<Record<string, FilmState>>({});
  const idBySlug = useRef<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      const c = sb();
      const { data: auth } = await c.auth.getUser();
      const user = auth?.user;
      if (alive && user) {
        setUid(user.id);
        // Page through user_movies: PostgREST caps any single response at 1000
        // rows, and a Letterboxd import easily exceeds that.
        type Row = { film_id: string; seen: boolean; watchlist: boolean; rating: number | null; film: { slug: string } | null };
        const PAGE = 1000;
        const rows: Row[] = [];
        for (let from = 0; alive; from += PAGE) {
          const { data, error } = await c
            .from("user_movies")
            .select("film_id, seen, watchlist, rating, film:films!inner(slug)")
            .eq("user_id", user.id)
            .range(from, from + PAGE - 1);
          if (error || !data) break;
          rows.push(...(data as unknown as Row[]));
          if (data.length < PAGE) break;
        }
        if (alive && rows.length) {
          const m: Record<string, FilmState> = {};
          for (const r of rows) {
            m[r.film_id] = { seen: !!r.seen, watchlist: !!r.watchlist, rating: Number(r.rating) || 0 };
            if (r.film?.slug) idBySlug.current[r.film.slug] = r.film_id;
          }
          setMap(m);
        }
      }
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
  }, []);

  const resolveId = useCallback(async (key: FilmKey): Promise<string | null> => {
    if (key.id) return key.id;
    if (!key.slug) return null;
    if (idBySlug.current[key.slug]) return idBySlug.current[key.slug];
    const { data } = await sb().from("films").select("id").eq("slug", key.slug).maybeSingle();
    const id = (data as { id: string } | null)?.id ?? null;
    if (id) idBySlug.current[key.slug] = id;
    return id;
  }, []);

  const persist = useCallback(async (id: string, s: FilmState) => {
    const c = sb();
    if (!s.seen && !s.watchlist && !s.rating) await c.from("user_movies").delete().eq("user_id", uid!).eq("film_id", id);
    else await c.from("user_movies").upsert({ user_id: uid!, film_id: id, seen: s.seen, watchlist: s.watchlist, rating: s.rating || null }, { onConflict: "user_id,film_id" });
  }, [uid]);

  const apply = useCallback(async (key: FilmKey, patch: (cur: FilmState) => FilmState, hint?: { v: IntentVerb; rating?: number }) => {
    if (!uid) {
      // Anon → in-context AuthSheet (ConversionProvider listens), replaying this exact
      // action after sign-in. Falls back to a bare gate if no declarative slug is known.
      requireAuthEvent({
        ctx: { kind: "save", verb: hint?.v ?? "seen" },
        decl: hint && key.slug ? { v: hint.v, slug: key.slug, rating: hint.rating } : undefined,
      });
      return;
    }
    const id = await resolveId(key);
    if (!id) return;
    setMap((prev) => {
      const next = patch(prev[id] ?? EMPTY);
      persist(id, next);
      return { ...prev, [id]: next };
    });
  }, [uid, resolveId, persist]);

  // idBySlug is a ref, but it is always populated before the setMap that makes a
  // film seen (initial load and lazy resolve both write the index first), so a
  // memo keyed on `map` sees a complete slug index.
  const seenSlugs = useMemo(() => {
    const s = new Set<string>();
    for (const [slug, id] of Object.entries(idBySlug.current)) if (map[id]?.seen) s.add(slug);
    return s as ReadonlySet<string>;
  }, [map]);

  const value = useMemo<Ctx>(() => ({
    ready, uid, seenSlugs,
    get: (key) => {
      const id = key.id ?? (key.slug ? idBySlug.current[key.slug] : null);
      return (id && map[id]) || EMPTY;
    },
    toggleSeen: (key) => apply(key, (c) => ({ ...c, seen: !c.seen, rating: c.seen ? 0 : c.rating }), { v: "seen" }),
    toggleWatch: (key) => apply(key, (c) => ({ ...c, watchlist: !c.watchlist }), { v: "watchlist" }),
    rate: (key, n) => apply(key, (c) => ({ ...c, rating: c.rating === n ? 0 : n, seen: c.rating === n ? c.seen : true }), { v: "rate", rating: n }),
  }), [ready, uid, apply, map, seenSlugs]);

  return <UserFilms.Provider value={value}>{children}</UserFilms.Provider>;
}

export function useUserFilms() { return useContext(UserFilms); }
