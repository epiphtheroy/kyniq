"use client";

/** Site-wide TakeScore (TS) poster badges.
 *  Mounted once in the root layout. Scans the page for poster images that sit
 *  inside a link to /film/<slug>, batch-loads each film's TS, and overlays a
 *  badge in the poster's top-left corner. Re-runs on DOM changes (route nav,
 *  infinite scroll). Purely additive — no layout edits in dozens of components. */
import { useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const cache = new Map<string, number | null>(); // slug -> TS (null = no score)

function slugFromAnchor(a: HTMLAnchorElement): string | null {
  const href = a.getAttribute("href") || "";
  const i = href.indexOf("/film/");
  if (i < 0) return null;
  const rest = href.slice(i + 6);
  const slug = rest.split(/[/?#]/)[0];
  return slug || null;
}

export default function TakeScoreBadges() {
  useEffect(() => {
    let raf = 0;

    async function paint(pairs: { img: HTMLImageElement; slug: string }[]) {
      const need = [...new Set(pairs.map((p) => p.slug).filter((s) => !cache.has(s)))];
      for (let i = 0; i < need.length; i += 200) {
        const chunk = need.slice(i, i + 200);
        const { data } = await sb.rpc("takescore_for_slugs", { p_slugs: chunk });
        const rows = (data as { slug: string; ts: number }[] | null) ?? [];
        const got = new Set<string>();
        for (const r of rows) { cache.set(r.slug, r.ts); got.add(r.slug); }
        for (const s of chunk) if (!got.has(s)) cache.set(s, null); // remember misses
      }
      for (const { img, slug } of pairs) {
        const ts = cache.get(slug);
        if (ts == null) continue;
        const parent = img.parentElement;
        if (!parent) continue;
        if (parent.querySelector(":scope > .ts-badge")) continue;
        const cs = getComputedStyle(parent);
        if (cs.position === "static") parent.style.position = "relative";
        const b = document.createElement("span");
        b.className = "ts-badge";
        b.innerHTML = `<b>${ts}</b><i>TS</i>`;
        b.title = "TakeScore — durable value minus risk. Click the poster for detail.";
        parent.appendChild(b);
      }
    }

    function scan() {
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('img[src*="image.tmdb.org"]'));
      const pairs: { img: HTMLImageElement; slug: string }[] = [];
      for (const img of imgs) {
        if (img.dataset.tsDone) continue;
        const a = img.closest<HTMLAnchorElement>('a[href*="/film/"]');
        if (!a) continue;
        const slug = slugFromAnchor(a);
        if (!slug) continue;
        img.dataset.tsDone = "1";
        pairs.push({ img, slug });
      }
      if (pairs.length) void paint(pairs);
    }

    const kick = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(scan); };
    kick();
    const mo = new MutationObserver(kick);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  return null;
}
