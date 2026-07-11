import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import TVDirectory from "@/components/TVDirectory";
import "@/app/home2.css";

// /tv/lists — the full watch-list LIBRARY: filter/search the whole directory
// (every director, canon, trope, concept…) as dark, image-backed cards. The
// /watch player links here as "Browse all lists". SSR-seeds the first page.
export const revalidate = 300;
export const maxDuration = 20;

const SITE = "https://metatake.net";
function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export const metadata: Metadata = {
  title: "Every Watch List · METATAKE TV",
  description: "Browse every METATAKE TV watch list — directors, canons, awards, movements, genres, countries, decades, theorists, tropes, concepts and archetypes, each compiled into a broadcast with no LLM.",
  alternates: { canonical: "/tv/lists" },
  openGraph: { title: "Every Watch List · METATAKE TV", url: `${SITE}/tv/lists`, siteName: "Metatake", type: "website" },
};

export default async function Page() {
  const sb = db();
  const [dir, sum] = await Promise.all([
    sb.rpc("tv_directory", { p_axis: null, p_q: null, p_limit: 48, p_offset: 0 }),
    sb.rpc("tv_directory_summary"),
  ]);
  const data = (dir.data as { total?: number; lists?: unknown[] } | null) ?? {};
  const initial = (data.lists ?? []) as React.ComponentProps<typeof TVDirectory>["initial"];
  const initialSummary = (sum.data ?? []) as React.ComponentProps<typeof TVDirectory>["initialSummary"];

  const collLd = {
    "@context": "https://schema.org", "@type": "CollectionPage",
    name: "Every Watch List · METATAKE TV", url: `${SITE}/tv/lists`,
    isPartOf: { "@type": "WebSite", name: "Metatake", url: SITE },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collLd) }} />
      <TVDirectory initial={initial} initialSummary={initialSummary} initialTotal={data.total ?? 0} />
    </>
  );
}
