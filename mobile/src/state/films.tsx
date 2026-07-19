// User film ledger — the judgment state machine (v4 §5.0).
// Single source of truth is public.user_movies (invariants §13-5/§13-16).
// Local map is an optimistic cache keyed by slug; server rows win on reload.
//
// v4 write idiom: the five me_* RPCs (SECURITY DEFINER, auth.uid()-scoped, no uid
// params — the same lineage /room calls client-side). They carry side effects the
// old direct upsert bypassed:
//   me_set_watchlist(on)  → also clears dismissed
//   me_dismiss            → also drops watchlist; excluded from me_recommend_wwi
//   me_undismiss          → Restore, without re-adding to the watchlist (0045 R2)
//   me_mark_seen          → sets watched_at, clears dismissed
//   rate_film             → clamps 0.5–5 halves, sets seen, snapshots NAV
// UNDO of seen/rating has no RPC (me_mark_seen only sets true), so undo alone
// uses a minimal own-row update — same ledger, different door (§13-15/16).
import type { Session } from "@supabase/supabase-js";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

export type LedgerEntry = {
  filmId: string | null;
  seen: boolean;
  watchlist: boolean;
  dismissed: boolean;
  rating: number | null;
};

const EMPTY: LedgerEntry = { filmId: null, seen: false, watchlist: false, dismissed: false, rating: null };

/** One reversible judgment — feed it to undo() to roll the film back. */
export type JudgmentUndo = { slug: string; prev: LedgerEntry };

type FilmsCtx = {
  session: Session | null;
  ledger: Map<string, LedgerEntry>;
  ready: boolean;
  entry: (slug: string) => LedgerEntry;
  /** ♥ 볼래 — returns an undo token, or null when signed out / failed. */
  setWatchlist: (slug: string, on: boolean) => Promise<JudgmentUndo | null>;
  /** ✕ 패스 — dismissed=true, watchlist=false. */
  dismiss: (slug: string) => Promise<JudgmentUndo | null>;
  /** Restore a pass without re-adding to the watchlist. */
  undismiss: (slug: string) => Promise<JudgmentUndo | null>;
  /** ✓ 봤어 — seen=true (+watched_at, clears dismissed). */
  markSeen: (slug: string) => Promise<JudgmentUndo | null>;
  /** Post-watch rating (0.5–5) — also sets seen and snapshots NAV. */
  rate: (slug: string, rating: number) => Promise<JudgmentUndo | null>;
  /** Reverse any judgment above (invariant §13-15: every judgment is undoable). */
  undo: (token: JudgmentUndo) => Promise<void>;
  // legacy verbs (v3.1 screens — director card etc.); implemented on the v4 machine
  toggleSeen: (slug: string, filmId: string) => Promise<void>;
  toggleWatchlist: (slug: string, filmId: string) => Promise<void>;
  reload: () => Promise<void>;
};

const noop = async () => null;
const Ctx = createContext<FilmsCtx>({
  session: null,
  ledger: new Map(),
  ready: false,
  entry: () => EMPTY,
  setWatchlist: noop,
  dismiss: noop,
  undismiss: noop,
  markSeen: noop,
  rate: noop,
  undo: async () => {},
  toggleSeen: async () => {},
  toggleWatchlist: async () => {},
  reload: async () => {},
});

type Row = {
  film_id: string;
  seen: boolean | null;
  watchlist: boolean | null;
  dismissed: boolean | null;
  rating: number | null;
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
  const ledgerRef = useRef(ledger);
  ledgerRef.current = ledger;

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
        .select("film_id, seen, watchlist, dismissed, rating, film:films!inner(slug)")
        .eq("user_id", session.user.id)
        .range(from, from + 999);
      if (error || !data) break;
      for (const r of data as Row[]) {
        const slug = rowSlug(r);
        if (slug) {
          out.set(slug, {
            filmId: r.film_id,
            seen: !!r.seen,
            watchlist: !!r.watchlist,
            dismissed: !!r.dismissed,
            rating: r.rating,
          });
        }
      }
      if (data.length < 1000) break;
    }
    setLedger(out);
    setReady(true);
  }, [session?.user?.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  const entry = useCallback((slug: string): LedgerEntry => ledgerRef.current.get(slug) ?? EMPTY, []);

  /** Optimistic transition: apply `next` locally, run the RPC, roll back on error. */
  const transition = useCallback(
    async (
      slug: string,
      next: Partial<LedgerEntry>,
      rpc: () => PromiseLike<{ error: unknown }>,
    ): Promise<JudgmentUndo | null> => {
      if (!session?.user) return null;
      const prev = ledgerRef.current.get(slug) ?? EMPTY;
      setLedger((m) => new Map(m).set(slug, { ...prev, ...next }));
      const { error } = await rpc();
      if (error) {
        setLedger((m) => new Map(m).set(slug, prev)); // roll back
        return null;
      }
      if (!prev.filmId) {
        // The RPC just created the row — learn films.id so undo can address it.
        supabase
          .from("films")
          .select("id")
          .eq("slug", slug)
          .single()
          .then(({ data }) => {
            if (data?.id) {
              setLedger((m) => {
                const cur = m.get(slug);
                return cur ? new Map(m).set(slug, { ...cur, filmId: data.id }) : m;
              });
            }
          });
      }
      return { slug, prev };
    },
    [session?.user?.id],
  );

  const setWatchlist = useCallback(
    (slug: string, on: boolean) =>
      transition(
        slug,
        on ? { watchlist: true, dismissed: false } : { watchlist: false },
        () => supabase.rpc("me_set_watchlist", { p_slug: slug, p_on: on }),
      ),
    [transition],
  );

  const dismiss = useCallback(
    (slug: string) =>
      transition(slug, { dismissed: true, watchlist: false }, () =>
        supabase.rpc("me_dismiss", { p_slug: slug }),
      ),
    [transition],
  );

  const undismiss = useCallback(
    (slug: string) =>
      transition(slug, { dismissed: false }, () => supabase.rpc("me_undismiss", { p_slug: slug })),
    [transition],
  );

  const markSeen = useCallback(
    (slug: string) =>
      transition(slug, { seen: true, dismissed: false }, () =>
        supabase.rpc("me_mark_seen", { p_slug: slug }),
      ),
    [transition],
  );

  const rate = useCallback(
    (slug: string, rating: number) => {
      const clamped = Math.round(Math.min(5, Math.max(0.5, rating)) * 2) / 2;
      return transition(slug, { rating: clamped, seen: true, dismissed: false }, () =>
        supabase.rpc("rate_film", { p_slug: slug, p_rating: clamped }),
      );
    },
    [transition],
  );

  /**
   * Undo — restore the pre-judgment row. Watchlist/dismiss reversals go through
   * their RPCs; un-seen / un-rate have no RPC, so those two fields are restored
   * with a minimal own-row update (rating untouched unless it was the change).
   */
  const undo = useCallback(
    async (token: JudgmentUndo) => {
      const uid = session?.user?.id;
      if (!uid) return;
      const { slug, prev } = token;
      const cur = ledgerRef.current.get(slug) ?? EMPTY;
      setLedger((m) => new Map(m).set(slug, prev)); // optimistic full restore
      try {
        if (cur.dismissed && !prev.dismissed) await supabase.rpc("me_undismiss", { p_slug: slug });
        if (cur.watchlist !== prev.watchlist)
          await supabase.rpc("me_set_watchlist", { p_slug: slug, p_on: prev.watchlist });
        if (prev.dismissed && !cur.dismissed) await supabase.rpc("me_dismiss", { p_slug: slug });
        const needsRow =
          (cur.seen && !prev.seen) || cur.rating !== prev.rating;
        if (needsRow) {
          // seen/rating have no reversing RPC, so update the own row directly.
          // The film_id may not have been learned yet (the mark-seen RPC created
          // the row and the async id-learn hasn't landed) — resolve it by slug
          // first so undo of a freshly-seen film can't silently no-op.
          let fid = cur.filmId;
          if (!fid) {
            const { data } = await supabase.from("films").select("id").eq("slug", slug).single();
            fid = data?.id ?? null;
          }
          if (fid) {
            await supabase
              .from("user_movies")
              .update({ seen: prev.seen, rating: prev.rating })
              .eq("user_id", uid)
              .eq("film_id", fid);
          }
        }
      } catch {
        // Server state is authoritative — refetch rather than guess.
        reload();
      }
    },
    [session?.user?.id, reload],
  );

  // v3.1 compatibility verbs (director card & older call sites).
  const toggleSeen = useCallback(
    async (slug: string, _filmId: string) => {
      const cur = ledgerRef.current.get(slug) ?? EMPTY;
      if (!cur.seen) {
        await markSeen(slug);
      } else if (session?.user && cur.filmId) {
        const prev = cur;
        setLedger((m) => new Map(m).set(slug, { ...cur, seen: false }));
        const { error } = await supabase
          .from("user_movies")
          .update({ seen: false })
          .eq("user_id", session.user.id)
          .eq("film_id", cur.filmId);
        if (error) setLedger((m) => new Map(m).set(slug, prev));
      }
    },
    [markSeen, session?.user?.id],
  );
  const toggleWatchlist = useCallback(
    async (slug: string, _filmId: string) => {
      const cur = ledgerRef.current.get(slug) ?? EMPTY;
      await setWatchlist(slug, !cur.watchlist);
    },
    [setWatchlist],
  );

  const value = useMemo(
    () => ({
      session,
      ledger,
      ready,
      entry,
      setWatchlist,
      dismiss,
      undismiss,
      markSeen,
      rate,
      undo,
      toggleSeen,
      toggleWatchlist,
      reload,
    }),
    [session, ledger, ready, entry, setWatchlist, dismiss, undismiss, markSeen, rate, undo, toggleSeen, toggleWatchlist, reload],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFilms(): FilmsCtx {
  return useContext(Ctx);
}
