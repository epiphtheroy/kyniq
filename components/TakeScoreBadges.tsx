"use client";

/** Site-wide TakeScore (TS) poster badges — SAFE overlay.
 *  Badges are rendered into a single fixed layer appended to <body> (outside the
 *  React root) and positioned over each poster via getBoundingClientRect. We never
 *  insert nodes into React-managed elements, so React reconciliation is untouched
 *  (this avoids the "insertBefore … not a child" crash that a child-injection
 *  approach caused). Purely visual; pointer-events:none so clicks pass through. */
import { useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const cache = new Map<string, number | null>(); // slug -> TS (null = no score)

function slugFrom(img: HTMLImageElement): string | null {
  const a = img.closest<HTMLAnchorElement>('a[href*="/film/"]');
  if (!a) return null;
  const href = a.getAttribute("href") || "";
  const i = href.indexOf("/film/");
  if (i < 0) return null;
  return href.slice(i + 6).split(/[/?#]/)[0] || null;
}

export default function TakeScoreBadges() {
  useEffect(() => {
    const layer = document.createElement("div");
    layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:60";
    document.body.appendChild(layer);

    const badges = new Map<HTMLImageElement, HTMLElement>();
    let raf = 0;

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
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('img[src*="image.tmdb.org"]'));
      const fresh: { img: HTMLImageElement; slug: string }[] = [];
      for (const img of imgs) {
        if (img.dataset.tsSeen) continue;
        if (img.closest(".fmap")) { img.dataset.tsSeen = "1"; continue; } // Atlas maps handle their own visuals
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
          layer.appendChild(b);
          badges.set(img, b);
        }
      }
      reposition();
    }

    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(reposition); };
    const kick = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(scan); };

    kick();
    const mo = new MutationObserver(() => kick());
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    const iv = window.setInterval(reposition, 600); // catch async image loads / layout shifts

    return () => {
      mo.disconnect();
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      window.clearInterval(iv);
      cancelAnimationFrame(raf);
      layer.remove();
    };
  }, []);

  return null;
}
