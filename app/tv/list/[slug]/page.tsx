import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import TVListView, { type PlaylistMeta } from "@/components/TVListView";
import type { TVEntry } from "@/components/TVProgramPlayer";
import "@/app/home2.css";

// /tv/list/[slug] — the canonical, indexable page for a METATAKE TV watch list
// (an axis cut: a director, a Palme d'Or, a trope, a concept…). One playlist =
// one page = one video-collection. Carries CollectionPage + ItemList JSON-LD so
// the list and its member broadcasts are legible to search. ISR, per-slug lazy.
export const revalidate = 300;
export const dynamicParams = true;
export const maxDuration = 30; // headroom for a cold list build (ISR-cached after)
export function generateStaticParams() { return []; }

const IMG = "https://image.tmdb.org/t/p";
const SITE = "https://metatake.net";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Params = { params: Promise<{ slug: string }> };
const isIntro = (e: TVEntry) => e.slug.startsWith("intro-");

const load = cache(async (slug: string): Promise<{ pl: PlaylistMeta; entries: TVEntry[] } | null> => {
  const sb = db();
  const [watchRes, plRes] = await Promise.all([
    sb.rpc("tv_watch", { p_list: slug, p_program: null }),
    sb.from("tv_playlists").select("slug,title,dek,kind,axis,cut,href,n_films,n_segments,total_ms").eq("slug", slug).maybeSingle(),
  ]);
  const entries = ((watchRes.data as { entries?: TVEntry[] } | null)?.entries ?? []) as TVEntry[];
  const pl = plRes.data as PlaylistMeta | null;
  if (!pl || !entries.length) return null;
  return { pl, entries };
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) return { title: "METATAKE TV", robots: { index: false, follow: true } };
  const { pl, entries } = d;
  const first = entries.find((e) => !isIntro(e)) ?? entries[0];
  const img = first?.film?.backdrop ? `${IMG}/w1280${first.film.backdrop}` : undefined;
  const title = `${pl.title} · METATAKE TV`;
  const desc = `${pl.dek ? pl.dek + " " : ""}${pl.n_films ?? 0} films compiled into one watch list on METATAKE TV — no LLM, chapter by chapter from the Metatake record.`.trim();
  return {
    title,
    description: desc,
    alternates: { canonical: `/tv/list/${slug}` },
    openGraph: { title, description: desc, url: `${SITE}/tv/list/${slug}`, siteName: "Metatake", type: "website", ...(img ? { images: [{ url: img, width: 1280, height: 720 }] } : {}) },
    twitter: { card: "summary_large_image", title, description: desc, ...(img ? { images: [img] } : {}) },
  };
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) notFound();
  const { pl, entries } = d;
  const films = entries.filter((e) => !isIntro(e));

  const itemListLd = {
    "@context": "https://schema.org", "@type": "ItemList", name: pl.title, numberOfItems: films.length,
    itemListElement: films.slice(0, 50).map((e, i) => ({
      "@type": "ListItem", position: i + 1, url: `${SITE}/tv/${e.film?.slug ?? ""}`, name: e.film?.title ?? e.title,
    })),
  };
  const collLd = {
    "@context": "https://schema.org", "@type": "CollectionPage",
    name: `${pl.title} · METATAKE TV`, url: `${SITE}/tv/list/${slug}`,
    ...(pl.dek ? { description: pl.dek } : {}),
    isPartOf: { "@type": "WebSite", name: "Metatake", url: SITE },
    publisher: { "@type": "Organization", "@id": `${SITE}/#org`, name: "Metatake" },
  };
  const crumbLd = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: "METATAKE TV", item: `${SITE}/tv` },
      { "@type": "ListItem", position: 3, name: pl.title, item: `${SITE}/tv/list/${slug}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbLd) }} />
      <TVListView playlist={pl} entries={entries} />
    </>
  );
}
