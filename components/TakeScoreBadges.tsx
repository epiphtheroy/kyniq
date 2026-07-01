"use client";

/** Site-wide TakeScore (TS) poster badges — React-safe overlay.
 *  The overlay layer is a React-rendered leaf <div> (returned below). Badges are
 *  appended imperatively INTO that div only — the same safe pattern used for
 *  MapLibre/YouTube containers. We never append into <body> or any node React
 *  reconciles around, so React's child bookkeeping is never corrupted (this is
 *  what caused the "insertBefore … not a child" crash). Purely visual;
 *  pointer-events:none so clicks pass through to the poster. */
import { useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const cache = new Map<string, number | null>();

function slugFrom(img: HTMLImageElement): string | null {
  const a = img.closest<HTMLAnchorElement>('a[href*="/film/"]');
  if (!a) return null;
  const href = a.getAttribute("href") || "";
  const i = href.indexOf("/film/");
  if (i < 0) return null;
  return href.slice(i + 6).split(/[/?#]/)[0] || null;
}

export default function TakeScoreBadges() {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const badges = new Map<HTMLImageElement, HTMLElement>();
    let posRaf = 0;      // repositioning (scroll/resize) — its own handle
    let scanT: number = 0; // debounced scan — separate timer so bursts don't starve it

    async function loadScores(slugs: string[]) {
      const need = [...new Set(slugs)].filter((s) => !cache.has(s));
      for (let i = 0; i < need.length; i += 200) {
        const chunk = need.slice(i, i + 200);
        try {
          const { data } = await sb.rpc("takescore_for_slugs", { p_slugs: chunk });
          const rows = (data as { slug: string; ts: number }[] | null) ?? [];
          const got = new Set<string>();
          for (const r of rows) { cache.set(r.slug, r.ts); got.add(r.slug); }
          for (const s of chunk) if (!got.has(s)) cache.set(s, null);
        } catch { for (const s of chunk) cache.set(s, null); }
      }
    }

    function reposition() {
      if (!layerRef.current) return;
      const vh = window.innerHeight, vw = window.innerWidth;
      for (const [img, b] of badges) {
        if (!img.isConnected) { b.remove(); badges.delete(img); continue; }
        const r = img.getBoundingClientRect();
        if (r.width < 26 || r.height < 40 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) { b.style.display = "none"; continue; }
        b.style.display = "flex";
        b.style.left = `${Math.round(r.left + 6)}px`;
        b.style.top = `${Math.round(r.top + 6)}px`;
      }
    }

    async function scan() {
      if (!layerRef.current) return;
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('img[src*="image.tmdb.org"]'));
      const fresh: { img: HTMLImageElement; slug: string }[] = [];
      for (const img of imgs) {
        if (img.dataset.tsSeen) continue;
        if (img.closest(".fmap")) { img.dataset.tsSeen = "1"; continue; }
        const slug = slugFrom(img);
        if (!slug) continue;
        img.dataset.tsSeen = "1";
        fresh.push({ img, slug });
      }
      if (fresh.length) {
        await loadScores(fresh.map((f) => f.slug));
        for (const { img, slug } of fresh) {
          const ts = cache.get(slug);
          if (ts == null || badges.has(img)) continue;
          const b = document.createElement("span");
          b.className = "ts-badge";
          b.innerHTML = `<b>${ts}</b><i>TS</i>`;
          layer.appendChild(b); // into our own React-leaf div — safe
          badges.set(img, b);
        }
      }
      reposition();
    }

    const onScroll = () => { cancelAnimationFrame(posRaf); posRaf = requestAnimationFrame(reposition); };
    const kick = () => { clearTimeout(scanT); scanT = window.setTimeout(() => { void scan(); }, 180); };

    void scan(); // immediate first pass
    // observe app content for newly-added posters; never mutates React nodes
    const mo = new MutationObserver(kick);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    const iv = window.setInterval(() => { void scan(); reposition(); }, 1000); // fallback sweep

    return () => {
      mo.disconnect();
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      window.clearInterval(iv);
      clearTimeout(scanT);
      cancelAnimationFrame(posRaf);
      badges.clear();
    };
  }, []);

  return <div ref={layerRef} aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 60 }} />;
}
