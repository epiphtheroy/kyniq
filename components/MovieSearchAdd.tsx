"use client";

/**
 * MovieSearchAdd — search TMDB and add any film to your Seen / Watchlist.
 * Tier-1 (analyzed) hits link to their rich page; everything else lazily becomes a
 * lightweight Tier-2 record (visible=false) on add. Posts to /api/track (server upsert).
 */
import { useEffect, useRef, useState } from "react";

const IMG = "https://image.tmdb.org/t/p/w92";
type Hit = { tmdb_id: number; title: string; year: string; poster_path: string | null; in_db?: boolean; slug?: string | null; is_analyzed?: boolean };

export default function MovieSearchAdd() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Record<number, string>>({});
  const [open, setOpen] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (t.current) clearTimeout(t.current);
    if (q.trim().length < 2) { setHits([]); return; }
    t.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/tmdb-search?q=${encodeURIComponent(q.trim())}`);
        const d = await r.json();
        setHits(d.results || []); setOpen(true);
      } catch { setHits([]); }
    }, 300);
  }, [q]);

  const add = async (h: Hit, status: "watched" | "watchlist") => {
    setBusy(`${h.tmdb_id}-${status}`);
    try {
      const r = await fetch("/api/track", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tmdb_id: h.tmdb_id, status }) });
      if (r.ok) setDone((m) => ({ ...m, [h.tmdb_id]: status }));
    } finally { setBusy(null); }
  };

  return (
    <div className="msa">
      <input className="msa-in" type="search" placeholder="Add a film you've seen or want to watch…" value={q}
        onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)} aria-label="Search films to add" />
      {open && hits.length > 0 ? (
        <div className="msa-res">
          {hits.map((h) => {
            const added = done[h.tmdb_id];
            return (
              <div key={h.tmdb_id} className="msa-row">
                {h.poster_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="msa-pi" src={`${IMG}${h.poster_path}`} alt="" loading="lazy" />
                ) : <span className="msa-pi msa-pi--e" aria-hidden="true" />}
                <span className="msa-t">{h.title} <span className="msa-y">({h.year || "?"})</span>{h.is_analyzed ? <span className="msa-badge">analyzed</span> : null}</span>
                {added ? (
                  <span className="msa-ok">✓ {added === "watched" ? "Seen" : "Watchlist"}</span>
                ) : (
                  <span className="msa-acts">
                    <button type="button" disabled={busy === `${h.tmdb_id}-watched`} onClick={() => add(h, "watched")}>✓ Seen</button>
                    <button type="button" disabled={busy === `${h.tmdb_id}-watchlist`} onClick={() => add(h, "watchlist")}>+ Watchlist</button>
                  </span>
                )}
              </div>
            );
          })}
          <div className="msa-foot">Reload the page to see new items in your lists below. Data via TMDB.</div>
        </div>
      ) : null}
    </div>
  );
}
