"use client";

/**
 * RandomWall — a dense, reshuffling wall of real detail pages drawn at random
 * from across the site (readings, tropes, figures, films). Each card links to
 * the real page; "Shuffle" pulls a fresh random draw from home_pool().
 *  - reading / trope cards: body lists the related films (card still links to
 *    the reading/trope page).
 *  - film cards: a still thumbnail (backdrop, not a poster).
 *  - figure cards: the take's reading snippet.
 */

import { useCallback, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

export type PoolItem = {
  type: string; title: string; href: string;
  sub?: string | null; snip?: string | null; films?: string[] | null; img?: string | null; yr?: number | null;
};

const TYPE_LABEL: Record<string, string> = { reading: "Meta take", trope: "Trope", figure: "Figure", film: "Film" };
const IMG = "https://image.tmdb.org/t/p/w300";

function sb() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default function RandomWall({ initial }: { initial: PoolItem[] }) {
  const [items, setItems] = useState<PoolItem[]>(initial);
  const [loading, setLoading] = useState(false);

  const shuffle = useCallback(async () => {
    setLoading(true);
    const { data } = await sb().rpc("home_pool", { p_n: 42 });
    if (Array.isArray(data) && data.length) setItems(data as PoolItem[]);
    setLoading(false);
  }, []);

  return (
    <section className="rw">
      <div className="rw-head">
        <h2 className="mt-h2" style={{ border: "none", padding: 0, margin: 0 }}>Wander at random</h2>
        <button type="button" className="rw-shuf" onClick={shuffle} disabled={loading} aria-label="Shuffle">
          ↻ {loading ? "…" : "Shuffle"}
        </button>
      </div>
      <p className="mt-sub" style={{ marginTop: 4 }}>
        A fresh draw of pages from across the site — readings, tropes, figures, films. Reshuffle and fall in.
      </p>
      <div className="rw-grid">
        {items.map((it, i) => {
          const films = it.films ?? [];
          return (
            <Link key={`${it.href}-${i}`} href={it.href} className={`rw-card rw-${it.type}`}>
              <span className="rw-type">{TYPE_LABEL[it.type] ?? it.type}</span>
              {it.type === "film" && it.img ? (
                <span className="rw-thumb"><img src={`${IMG}${it.img}`} alt={`${it.title}${it.yr ? ` (${it.yr})` : ""} poster`} loading="lazy" /></span>
              ) : null}
              <span className="rw-ttl">{it.title}</span>
              {it.sub ? <span className="rw-sub">{it.sub}{it.yr ? ` · ${it.yr}` : ""}</span> : null}
              {films.length > 0 ? (
                <span className="rw-films">{films.slice(0, 5).join(" · ")}</span>
              ) : it.snip ? (
                <span className="rw-snip">{it.snip}</span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
