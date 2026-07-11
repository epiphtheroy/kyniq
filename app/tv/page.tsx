import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import TVWatch, { type TVSeed } from "@/components/TVWatch";
import "@/app/home2.css";

// /tv — the main METATAKE TV watch interface (player + up-next queue + the full
// "Every watch list" library). The top-nav "Metatake TV" lands here. The
// full-page channel (the On Air broadcast) is at /tv/fullscreen.
//
// Instant play: the page ISR-caches ONE entry of the default list (re-picked on
// each revalidate) and hands it to TVWatch, so the player starts the moment the
// page hydrates — the full list JSON (~550KB) streams in behind it and the
// seeded entry keeps playing through the queue swap.
const SITE = "https://metatake.net";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Metatake TV — Watch",
  description: "Watch Metatake TV — a continuous, LLM-free video essay on cinema. Pick a watch list — a director, a canon, a trope, a concept — and leave it on. Browse the full library below.",
  alternates: { canonical: "/tv" },
  openGraph: { title: "Metatake TV — Watch", url: `${SITE}/tv`, siteName: "Metatake", type: "website" },
};

type SeedData = {
  playlist?: { slug: string | null; title: string; dek?: string | null; kind?: string } | null;
  entries?: ({ slug: string } & Record<string, unknown>)[];
} | null;

const getSeed = unstable_cache(
  async (): Promise<TVSeed> => {
    try {
      const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { data } = await db.rpc("tv_watch", { p_list: "palme-files", p_program: null });
      const d = data as SeedData;
      const entries = (d?.entries ?? []).filter((e) => !e.slug.startsWith("intro-") && !e.slug.startsWith("seg-"));
      if (!entries.length) return null;
      const pick = entries[Math.floor(Math.random() * entries.length)];
      return { playlist: d?.playlist ?? null, entry: pick } as TVSeed;
    } catch {
      return null;
    }
  },
  ["tv-watch-seed-v1"],
  { revalidate: 300 },
);

export default async function Page() {
  const seed = await getSeed();
  return (
    <>
      {/* the player's critical third parties — connect before hydration asks */}
      <link rel="preconnect" href="https://www.youtube-nocookie.com" />
      <link rel="preconnect" href="https://image.tmdb.org" />
      <TVWatch seed={seed} />
    </>
  );
}
