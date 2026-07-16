// User film ledger — single source of truth is public.user_movies (invariant §13-5).
// Local map is an optimistic cache keyed by slug; server rows win on reload.
// Write idiom mirrors the web (MovieListActions): upsert onConflict user_id,film_id.
// The app never deletes rows (it can't see ratings safely) — it sets booleans false.
import type { Session } from "@supabase/supabase-js";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export type LedgerEntry = { filmId: string; seen: boolean; watchlist: boolean };

type FilmsCtx = {
  session: Session | null;
  ledger: Map<string, LedgerEntry>;
  ready: boolean;
  toggleSeen: (slug: string, filmId: string) => Promise<void>;
  toggleWatchlist: (slug: string, filmId: string) => Promise<void>;
  reload: () => Promise<void>;
};

const Ctx = createContext<FilmsCtx>({
  session: null,
  ledger: new Map(),
  ready: false,
  toggleSeen: async () => {},
  toggleWatchlist: async () => {},
  reload: async () => {},
});

type Row = {
  film_id: string;
  seen: boolean | null;
  watchlist: boolean | null;
  film: { slug: string } | { slug: string }[] | null;
};

function rowSlug(r: Row): string | null {
  if (!r.film) return null;
  return Array.isArray(r.film) ? (r.film[0]?.slug ?? null) : r.film.slug;
}

export function FilmsProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ledger, setLedger] = useState<Map<string, LedgerEntry>>(new Map());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const reload = useCallback(async () => {
    if (!session?.user) {
      setLedger(new Map());
      setReady(true);
      return;
    }
    const out = new Map<string, LedgerEntry>();
    // Page through the PostgREST 1000-row cap.
    for (let from = 0; from < 20000; from += 1000) {
      const { data, error } = await supabase
        .from("user_movies")
        .select("film_id, seen, watchlist, film:films!inner(slug)")
        .eq("user_id", session.user.id)
        .range(from, from + 999);
      if (error || !data) break;
      for (const r of data as Row[]) {
        const slug = rowSlug(r);
        if (slug) out.set(slug, { filmId: r.film_id, seen: !!r.seen, watchlist: !!r.watchlist });
      }
      if (data.length < 1000) break;
    }
    setLedger(out);
    setReady(true);
  }, [session?.user?.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  const write = useCallback(
    async (slug: string, filmId: string, patch: Partial<Pick<LedgerEntry, "seen" | "watchlist">>) => {
      const uid = session?.user?.id;
      if (!uid) return;
      const prev = ledger.get(slug) ?? { filmId, seen: false, watchlist: false };
      const next = { ...prev, filmId, ...patch };
      setLedger((m) => new Map(m).set(slug, next)); // optimistic
      const { error } = await supabase.from("user_movies").upsert(
        { user_id: uid, film_id: filmId, seen: next.seen, watchlist: next.watchlist },
        { onConflict: "user_id,film_id" },
      );
      if (error) setLedger((m) => new Map(m).set(slug, prev)); // roll back
    },
    [session?.user?.id, ledger],
  );

  const toggleSeen = useCallback(
    (slug: string, filmId: string) =>
      write(slug, filmId, { seen: !(ledger.get(slug)?.seen ?? false) }),
    [write, ledger],
  );
  const toggleWatchlist = useCallback(
    (slug: string, filmId: string) =>
      write(slug, filmId, { watchlist: !(ledger.get(slug)?.watchlist ?? false) }),
    [write, ledger],
  );

  const value = useMemo(
    () => ({ session, ledger, ready, toggleSeen, toggleWatchlist, reload }),
    [session, ledger, ready, toggleSeen, toggleWatchlist, reload],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFilms(): FilmsCtx {
  return useContext(Ctx);
}
