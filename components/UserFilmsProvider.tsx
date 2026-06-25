"use client";

/**
 * UserFilmsProvider — loads the signed-in user's whole user_movies map ONCE per session,
 * so every poster card (PosterActions) can read/toggle Seen / Watchlist / 0.5 rating without
 * a query per card. Writes optimistically via RLS. Logged-out → ready with empty map.
 * (migration: save_layer_user_films_and_saves)
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export type FilmState = { seen: boolean; watchlist: boolean; rating: number };
type Ctx = {
  ready: boolean;
  uid: string | null;
  get: (filmId: string) => FilmState;
  toggleSeen: (filmId: string) => void;
  toggleWatch: (filmId: string) => void;
  rate: (filmId: string, n: number) => void;
};
const EMPTY: FilmState = { seen: false, watchlist: false, rating: 0 };
const UserFilms = createContext<Ctx | null>(null);

function sb() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export function UserFilmsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [map, setMap] = useState<Record<string, FilmState>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      const c = sb();
      const { data: auth } = await c.auth.getUser();
      const user = auth?.user;
      if (alive && user) {
        setUid(user.id);
        const { data } = await c.from("user_movies").select("film_id, seen, watchlist, rating").eq("user_id", user.id);
        if (alive && data) {
          const m: Record<string, FilmState> = {};
          for (const r of data as Array<{ film_id: string; seen: boolean; watchlist: boolean; rating: number | null }>)
            m[r.film_id] = { seen: !!r.seen, watchlist: !!r.watchlist, rating: Number(r.rating) || 0 };
          setMap(m);
        }
      }
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
  }, []);

  const persist = useCallback(async (filmId: string, s: FilmState) => {
    if (!uid) return;
    const c = sb();
    if (!s.seen && !s.watchlist && !s.rating) {
      await c.from("user_movies").delete().eq("user_id", uid).eq("film_id", filmId);
    } else {
      await c.from("user_movies").upsert(
        { user_id: uid, film_id: filmId, seen: s.seen, watchlist: s.watchlist, rating: s.rating || null },
        { onConflict: "user_id,film_id" });
    }
  }, [uid]);

  const need = useCallback(() => {
    if (!uid) { router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`); return true; }
    return false;
  }, [uid, router]);

  const apply = useCallback((filmId: string, patch: (cur: FilmState) => FilmState) => {
    if (need()) return;
    setMap((prev) => {
      const cur = prev[filmId] ?? EMPTY;
      const next = patch(cur);
      const m = { ...prev, [filmId]: next };
      persist(filmId, next);
      return m;
    });
  }, [need, persist]);

  const value = useMemo<Ctx>(() => ({
    ready, uid,
    get: (filmId) => map[filmId] ?? EMPTY,
    toggleSeen: (filmId) => apply(filmId, (c) => ({ ...c, seen: !c.seen, rating: c.seen ? 0 : c.rating })),
    toggleWatch: (filmId) => apply(filmId, (c) => ({ ...c, watchlist: !c.watchlist })),
    rate: (filmId, n) => apply(filmId, (c) => ({ ...c, rating: c.rating === n ? 0 : n, seen: (c.rating === n ? c.seen : true) })),
  }), [ready, uid, apply, map]);

  return <UserFilms.Provider value={value}>{children}</UserFilms.Provider>;
}

export function useUserFilms() { return useContext(UserFilms); }
