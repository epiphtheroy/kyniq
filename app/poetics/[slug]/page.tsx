import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { pageRobots } from "@/lib/seo";
import { poeBySlug, poeCategoryBySlug, poeHref, poeEssaysInCategory } from "@/lib/poetics/registry";
import { POE_BODIES } from "@/lib/poetics/content";
import { renderDocMarkdown } from "@/lib/docs/md";
import PoePager from "@/components/poetics/PoePager";

export const revalidate = 3600;

const SITE = "https://metatake.net";
const REVIEWED = "July 2026";
const REVIEWED_ISO = "2026-07-12";

type Props = { params: Promise<{ slug: string }> };

/** Essays replaced in the 2026-07 revision — old URLs 308 to their successors. */
const POE_RENAMES: Record<string, string> = {
  "the-fear-of-a-wasted-evening": "the-arithmetic-of-a-lifetime",
  "a-thousand-titles-that-say-nothing": "the-shape-of-a-blind-spot",
  "movements-are-not-quality": "how-to-read-a-filmography",
  "whose-hundred-greatest": "the-location-cannot-lie",
  "the-economics-of-an-evening": "the-film-outside-the-frame",
};

export function generateStaticParams() {
  return [] as { slug: string }[];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const e = poeBySlug(slug);
  if (!e || !POE_BODIES[slug]) return { title: "Poetics", robots: pageRobots(false) };
  return {
    title: `${e.title} — Poetics`,
    description: e.desc,
    alternates: { canonical: poeHref(slug) },
    robots: pageRobots(true),
    openGraph: { title: `${e.title} — Poetics · Metatake`, description: e.desc, url: `${SITE}${poeHref(slug)}`, type: "article" },
    twitter: { card: "summary_large_image", title: `${e.title} — Poetics · Metatake`, description: e.desc },
  };
}

const renderBody = (slug: string, body: string) =>
  unstable_cache(async () => renderDocMarkdown(body), ["poe-render2", slug], {
    revalidate: 3600,
    tags: ["poetics"],
  })();

export default async function PoeticsEssayPage({ params }: Props) {
  const { slug } = await params;
  if (POE_RENAMES[slug]) permanentRedirect(poeHref(POE_RENAMES[slug]));
  const e = poeBySlug(slug);
  const body = POE_BODIES[slug];
  if (!e || !body) notFound();

  const cat = poeCategoryBySlug(slug);
  const html = await renderBody(slug, body);
  const related = poeEssaysInCategory(e!.category).filter((x) => x.slug !== slug).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${SITE}${poeHref(slug)}`,
        headline: e!.title,
        description: e!.desc,
        isPartOf: { "@type": "WebSite", "@id": "https://metatake.net" },
        author: { "@type": "Person", name: "Wonwoo Yoon", url: `${SITE}/editor` },
        editor: { "@type": "Person", name: "Wonwoo Yoon", url: `${SITE}/editor` },
        publisher: { "@type": "Organization", name: "Metatake", url: SITE },
        about: "Film criticism and film theory",
        datePublished: "2026-07-12",
        dateModified: REVIEWED_ISO,
        inLanguage: "en",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Poetics", item: `${SITE}/poetics` },
          ...(cat ? [{ "@type": "ListItem", position: 2, name: cat.label, item: `${SITE}${poeHref(slug)}` }] : []),
          { "@type": "ListItem", position: cat ? 3 : 2, name: e!.title, item: `${SITE}${poeHref(slug)}` },
        ],
      },
    ],
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="poe-crumb">
        <Link href="/poetics">Poetics</Link>
        {cat ? <> › {cat.label}</> : null} › {e!.title}
      </div>
      <h1 className="poe-h1">{e!.title}</h1>
      <p className="poe-standfirst">{e!.desc}</p>
      <p className="poe-byline">
        Written by Metatake AI · directed &amp; signed off by <Link href="/editor">Wonwoo Yoon</Link> · {REVIEWED}
      </p>

      <div className="poe-body" dangerouslySetInnerHTML={{ __html: html }} />

      {related.length ? (
        <div className="poe-related">
          <div className="poe-related__h">More in {cat?.label ?? "Poetics"}</div>
          <div className="poe-related__list">
            {related.map((x) => (
              <Link key={x.slug} href={poeHref(x.slug)}>{x.title}</Link>
            ))}
          </div>
        </div>
      ) : null}

      <PoePager slug={slug} />

      <p className="poe-updated">
        An open working note, not a settled verdict. Facts get corrected; positions welcome argument —{" "}
        <Link href="/methodology#corrections">how corrections work</Link>.
      </p>
    </main>
  );
}
