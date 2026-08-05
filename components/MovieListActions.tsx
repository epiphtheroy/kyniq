"use client";

/**
 * MovieListActions — personal Seen / Watchlist / 0.5-step rating for one film.
 * One row per (user, film) in user_movies: seen + watchlist are INDEPENDENT booleans;
 * rating is numeric(2,1), 0.5–5.0. Reads the user's own row (RLS), writes optimistically.
 * Logged-out clicks route to /login. (migration: save_layer_user_films_and_saves)
 */
import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { requireAuthEvent } from "@/lib/conversion/bus";

function sb() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default function MovieListActions({ filmId }: { filmId: string }) {
  const [uid, setUid] = useState<string | null>(null);
  const [seen, setSeen] = useState(false);
  const [watchlist, setWatchlist] = useState(false);
  const [rating, setRating] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const c = sb();
    (async () => {
      const { data: auth } = await c.auth.getUser();
      const user = auth?.user;
      if (alive && user) {
        setUid(user.id);
        const { data } = await c.from("user_movies").select("seen, watchlist, rating").eq("user_id", user.id).eq("film_id", filmId).maybeSingle();
        if (alive && data) { setSeen(!!data.seen); setWatchlist(!!data.watchlist); setRating(Number(data.rating) || 0); }
      }
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
  }, [filmId]);

  const need = useCallback(() => {
    if (!uid) { requireAuthEvent({ ctx: { kind: "save", verb: "seen" } }); return true; }
    return false;
  }, [uid]);

  // Persist the full row, or delete it when nothing is set.
  const persist = useCallback(async (s: boolean, w: boolean, r: number) => {
    const c = sb();
    if (!s && !w && !r) { await c.from("user_movies").delete().eq("user_id", uid!).eq("film_id", filmId); return; }
    await c.from("user_movies").upsert({ user_id: uid!, film_id: filmId, seen: s, watchlist: w, rating: r || null }, { onConflict: "user_id,film_id" });
  }, [uid, filmId]);

  const toggleSeen = useCallback(() => {
    if (need()) return;
    const s = !seen; const r = s ? rating : 0;
    setSeen(s); if (!s) setRating(0);
    persist(s, watchlist, r);
  }, [need, seen, rating, watchlist, persist]);

  const toggleWatch = useCallback(() => {
    if (need()) return;
    const w = !watchlist; setWatchlist(w); persist(seen, w, rating);
  }, [need, watchlist, seen, rating, persist]);

  const pick = useCallback((n: number) => {
    if (need()) return;
    const r = rating === n ? 0 : n;          // click same value → clear
    const s = r ? true : seen;
    setRating(r); setSeen(s); persist(s, watchlist, r);
  }, [need, rating, seen, watchlist, persist]);

  if (!ready) return <div className="ml ml--ph" aria-hidden="true" />;

  return (
    <div className="ml">
      <button type="button" className={`ml-btn${seen ? " on" : ""}`} onClick={toggleSeen} aria-pressed={seen}>
        <span className="ml-ic">✓</span>Seen
      </button>
      <button type="button" className={`ml-btn${watchlist ? " on" : ""}`} onClick={toggleWatch} aria-pressed={watchlist}>
        <span className="ml-ic">{watchlist ? "✓" : "+"}</span>Watchlist
      </button>
      <span className="ml-stars" role="group" aria-label="Your rating (half-steps)">
        {[1, 2, 3, 4, 5].map((n) => {
          const pct = rating >= n ? 100 : rating >= n - 0.5 ? 50 : 0;
          return (
            <span className="ml-star2" key={n}>
              ★<span className="ml-fill" style={{ width: `${pct}%` }}>★</span>
              <button type="button" className="ml-half ml-half--l" onClick={() => pick(n - 0.5)} aria-label={`${n - 0.5} stars`} />
              <button type="button" className="ml-half ml-half--r" onClick={() => pick(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`} />
            </span>
          );
        })}
        {rating ? <span className="ml-rval">{rating.toFixed(1)}</span> : null}
      </span>
    </div>
  );
}
