import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import EntityTVHero from "@/components/EntityTVHero";
import ReadingFeed, { type FeedRow, type Facets } from "@/components/ReadingFeed";
import LensQuickBar from "@/components/LensQuickBar";
import { fwBySlug } from "@/lib/frameworks";
import { FRAMEWORK_INTROS } from "@/lib/frameworkIntros";
import ShareDock from "@/components/ShareDock";

export const revalidate = 600;
export async function generateStaticParams() { return []; }

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

interface Props { params: Promise<{ fw: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { fw: slug } = await params;
  if (slug === "all") return { title: "All Strong Misreadings — every critical reading on Metatake", alternates: { canonical: "/strong-misreadings/all" } };
  const f = fwBySlug(slug);
  if (!f) return { title: "Strong Misreadings — Metatake" };
  // Lead with the search phrase, keep the brand term in the description.
  const title = f.seoTitle;
  const introText = FRAMEWORK_INTROS[f.slug];
  const firstSentence = introText ? (introText.match(/^[^.!?]+[.!?]/)?.[0] ?? "").trim() : "";
  const description = firstSentence && firstSentence.length <= 160
    ? firstSentence
    : `${f.short} Every ${f.label} Strong Misreading across cinema, searchable on Metatake.`;
  return {
    title,
    description,
    authors: [{ name: "Wonwoo Yoon", url: "https://metatake.net/editor" }],
    alternates: { canonical: `https://metatake.net/strong-misreadings/${f.slug}` },
    openGraph: { title, description, type: "website", url: `https://metatake.net/strong-misreadings/${f.slug}` },
  };
}

export default async function FrameworkPage({ params }: Props) {
  const { fw: slug } = await params;
  const isAll = slug === "all";
  const f = isAll ? null : fwBySlug(slug);
  if (!isAll && !f) redirect("/strong-misreadings");

  const supabase = db();
  const [{ data: facetsRaw }, { data: initRaw }] = await Promise.all([
    supabase.rpc("framework_facets", { p_fw: f?.key ?? null }),
    supabase.rpc("readings_by_framework", { p_fw: f?.key ?? null, p_sort: "film", p_limit: 24, p_offset: 0 }),
  ]);
  const facets = (facetsRaw as Facets | null) ?? { total: 0, decades: [], top_tropes: [] };
  const initial = (initRaw as { total: number; rows: FeedRow[] } | null) ?? { total: 0, rows: [] };

  const hubJsonld = isAll ? null : {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: f!.seoTitle,
    url: `https://metatake.net/strong-misreadings/${f!.slug}`,
    description: f!.short,
    about: { "@type": "Thing", name: `${f!.label} film analysis` },
    author: { "@type": "Person", "@id": "https://metatake.net/editor#person", name: "Wonwoo Yoon", url: "https://metatake.net/editor" },
    publisher: { "@type": "Organization", "@id": "https://metatake.net/#org", name: "Metatake" },
  };

  return (
    <div className="mt">
      <SiteNav />
      {hubJsonld ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(hubJsonld) }} /> : null}
      <div className="mt-wrap smb-fw">
        <div className="smb-crumb"><Link href="/strong-misreadings">Strong Misreadings</Link></div>
        <EntityTVHero reelSlugs={[...new Set(initial.rows.map((r) => r.filmslug))]} label={isAll ? "Strong Misreadings" : (f?.label ?? "Strong Misreadings")} backdrop={null} />
        <h1 className="smb-fw__h" style={isAll ? undefined : { color: f!.color }}>
          {isAll ? "All readings" : f!.label}
        </h1>
        <div className="rd-share" style={{ marginTop: 12 }}>
          <ShareDock variant="bar" path={`/strong-misreadings/${slug}`} title={isAll ? "All readings" : f!.label} hook={isAll ? "Every Strong Misreading on Metatake, across all 14 frameworks." : f!.short} />
          <ShareDock variant="fab" path={`/strong-misreadings/${slug}`} title={isAll ? "All readings" : f!.label} hook={isAll ? "Every Strong Misreading on Metatake, across all 14 frameworks." : f!.short} />
        </div>
        <p className="smb-fw__short">
          {isAll ? "Every Strong Misreading on Metatake, across all 14 frameworks." : f!.short}
        </p>
        {!isAll && FRAMEWORK_INTROS[f!.slug] ? (
          <p className="body reading" style={{ fontSize: 17, lineHeight: 1.62, margin: "10px 0 22px", maxWidth: "70ch", opacity: 0.92 }}>
            {FRAMEWORK_INTROS[f!.slug]}
          </p>
        ) : null}
        <LensQuickBar />
        <ReadingFeed fwSlug={isAll ? "all" : f!.slug} isAll={isAll} initial={initial} facets={facets} />
      </div>
    </div>
  );
}
