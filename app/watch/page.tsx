import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import TVDirectory from "@/components/TVDirectory";
import "@/app/home2.css";

// /watch — the main "Watch" landing: browse every METATAKE TV watch list
// (directors, canons, awards, movements, genres, countries, decades, theorists,
// tropes, concepts, archetypes), each compiled into a broadcast. The top nav's
// Watch and the TV's watch buttons land here. SSR-seeds the first page + axis
// summary; the client handles filter/search/pagination via /api/tv/directory.
export const revalidate = 300;
export const maxDuration = 20;

const SITE = "https://metatake.net";
function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export const metadata: Metadata = {
  title: "Watch — Every Film List & Broadcast · Metatake",
  description: "The Metatake watch library — every director, canon, award, movement, genre, country, decade, theorist, trope and concept, compiled into a METATAKE TV broadcast. Filter, search, and leave it on.",
  alternates: { canonical: "/watch" },
  openGraph: { title: "Watch — Every Film List & Broadcast · Metatake", url: `${SITE}/watch`, siteName: "Metatake", type: "website" },
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
    name: "Watch · Metatake", url: `${SITE}/watch`,
    isPartOf: { "@type": "WebSite", name: "Metatake", url: SITE },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collLd) }} />
      <TVDirectory initial={initial} initialSummary={initialSummary} initialTotal={data.total ?? 0} />
    </>
  );
}
