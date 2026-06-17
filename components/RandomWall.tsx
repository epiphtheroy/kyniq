"use client";

/**
 * RandomWall — a dense, reshuffling wall of real detail pages drawn at random
 * from across the site (readings, tropes, figures, films). Each card is a real
 * link; "Shuffle" pulls a fresh random draw from home_pool(). The point of the
 * homepage: many of our detail pages, surfaced at random.
 */

import { useCallback, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

export type PoolItem = { type: string; title: string; href: string; sub?: string | null; snip?: string | null };

const TYPE_LABEL: Record<string, string> = { reading: "Meta take", trope: "Trope", figure: "Figure", film: "Film" };

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
        {items.map((it, i) => (
          <Link key={`${it.href}-${i}`} href={it.href} className={`rw-card rw-${it.type}`}>
            <span className="rw-type">{TYPE_LABEL[it.type] ?? it.type}</span>
            <span className="rw-ttl">{it.title}</span>
            {it.sub ? <span className="rw-sub">{it.sub}</span> : null}
            {it.snip ? <span className="rw-snip">{it.snip}</span> : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
