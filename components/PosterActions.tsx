"use client";

/**
 * PosterActions — compact overlay for a film poster card: Seen ✓ · Watchlist 🔖 · 0.5 rating.
 * Reads/writes the global UserFilmsProvider map (one load per session). Drop into any poster
 * container that is position:relative. No-op (renders nothing) outside a provider.
 */
import { useUserFilms } from "@/components/UserFilmsProvider";

export default function PosterActions({ filmId, rating: showRating = true }: { filmId: string; rating?: boolean }) {
  const ctx = useUserFilms();
  if (!ctx || !ctx.ready) return null;
  const st = ctx.get(filmId);
  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };

  return (
    <div className="pa" onClick={stop}>
      <div className="pa-top">
        <button type="button" className={`pa-b${st.seen ? " on" : ""}`} title={st.seen ? "Seen" : "Mark seen"}
          aria-pressed={st.seen} onClick={(e) => { stop(e); ctx.toggleSeen(filmId); }}>✓</button>
        <button type="button" className={`pa-b pa-bm${st.watchlist ? " on" : ""}`} title={st.watchlist ? "On your watchlist" : "Add to watchlist"}
          aria-pressed={st.watchlist} onClick={(e) => { stop(e); ctx.toggleWatch(filmId); }}>{st.watchlist ? "🔖" : "+"}</button>
      </div>
      {showRating ? (
        <div className={`pa-stars${st.rating ? " has" : ""}`} role="group" aria-label="Rate (half-steps)">
          {[1, 2, 3, 4, 5].map((n) => {
            const pct = st.rating >= n ? 100 : st.rating >= n - 0.5 ? 50 : 0;
            return (
              <span className="pa-star" key={n}>
                ★<span className="pa-fill" style={{ width: `${pct}%` }}>★</span>
                <button type="button" className="pa-half pa-half--l" onClick={(e) => { stop(e); ctx.rate(filmId, n - 0.5); }} aria-label={`${n - 0.5} stars`} />
                <button type="button" className="pa-half pa-half--r" onClick={(e) => { stop(e); ctx.rate(filmId, n); }} aria-label={`${n} stars`} />
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
