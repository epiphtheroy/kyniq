"use client";

/**
 * MovieListActions — personal "Seen" / "Watchlist" toggles + optional 1–5 rating.
 * One row per (user, film) in user_movies; status flips between watched/watchlist.
 * Reads the user's own row (RLS), writes optimistically. Logged-out → /login.
 * Works on any film (Tier-1 now; Tier-2 catalog rows in Phase 2). (migration: user_movies)
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

function sb() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
type Status = "watched" | "watchlist" | null;

export default function MovieListActions({ filmId }: { filmId: string }) {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
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
        const { data } = await c.from("user_movies").select("status, rating").eq("user_id", user.id).eq("film_id", filmId).maybeSingle();
        if (alive && data) { setStatus((data.status as Status) ?? null); setRating((data.rating as number) ?? 0); }
      }
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
  }, [filmId]);

  const need = useCallback(() => {
    if (!uid) { router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`); return true; }
    return false;
  }, [uid, router]);

  const setStat = useCallback(async (s: "watched" | "watchlist") => {
    if (need()) return;
    const c = sb();
    if (status === s) {                                   // toggle off → remove from lists
      setStatus(null); setRating(0);
      await c.from("user_movies").delete().eq("user_id", uid!).eq("film_id", filmId);
      return;
    }
    const r = s === "watched" ? rating : null;
    setStatus(s); if (s !== "watched") setRating(0);
    await c.from("user_movies").upsert({ user_id: uid!, film_id: filmId, status: s, rating: r }, { onConflict: "user_id,film_id" });
  }, [need, status, rating, uid, filmId]);

  const rate = useCallback(async (n: number) => {
    if (need()) return;
    const nr = rating === n ? 0 : n;                      // click same star → clear rating
    setStatus("watched"); setRating(nr);
    const c = sb();
    await c.from("user_movies").upsert({ user_id: uid!, film_id: filmId, status: "watched", rating: nr || null }, { onConflict: "user_id,film_id" });
  }, [need, rating, uid, filmId]);

  if (!ready) return <div className="ml ml--ph" aria-hidden="true" />;

  return (
    <div className="ml">
      <button type="button" className={`ml-btn${status === "watched" ? " on" : ""}`} onClick={() => setStat("watched")} aria-pressed={status === "watched"}>
        <span className="ml-ic">✓</span>{status === "watched" ? "Seen" : "Seen"}
      </button>
      <button type="button" className={`ml-btn${status === "watchlist" ? " on" : ""}`} onClick={() => setStat("watchlist")} aria-pressed={status === "watchlist"}>
        <span className="ml-ic">{status === "watchlist" ? "✓" : "+"}</span>Watchlist
      </button>
      {status === "watched" ? (
        <span className="ml-stars" role="group" aria-label="Your rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" className={`ml-star${rating >= n ? " on" : ""}`} onClick={() => rate(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`}>★</button>
          ))}
        </span>
      ) : null}
    </div>
  );
}
