import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { pageRobots } from "@/lib/seo";
import { cachedLineageMeta } from "@/lib/lineage";
import { DOCS, docBySlug, categoryBySlug, docHref, docsInCategory } from "@/lib/docs/registry";
import { DOC_BODIES } from "@/lib/docs/content";
import { renderDocMarkdown } from "@/lib/docs/md";
import DocsPager from "@/components/docs/DocsPager";

export const revalidate = 3600;

const SITE = "https://metatake.net";
const REVIEWED = "July 2026";
const REVIEWED_ISO = "2026-07-12";

type Props = { params: Promise<{ slug: string }> };

// Pre-render nothing at build; docs fill in via ISR (repo convention).
export function generateStaticParams() {
  return [] as { slug: string }[];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = docBySlug(slug);
  if (!doc || slug === "overview" || !DOC_BODIES[slug]) {
    return { title: "Methodology", robots: pageRobots(false) };
  }
  return {
    title: `${doc.title} — Methodology`,
    description: doc.desc,
    alternates: { canonical: docHref(slug) },
    robots: pageRobots(true),
    openGraph: { title: `${doc.title} — Methodology · Metatake`, description: doc.desc, url: `${SITE}${docHref(slug)}`, type: "article" },
    twitter: { card: "summary_large_image", title: `${doc.title} — Metatake`, description: doc.desc },
  };
}

// Live-count tokens: {{n:key}} → formatted number from methodology_stats_json,
// {{n:lineage}} → lineage memberships. Bodies default to rounded prose; tokens
// are only for the few stat tiles that should read live (invariant I-3).
async function substituteCounts(body: string): Promise<string> {
  if (!body.includes("{{n:")) return body;
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const nums: Record<string, number> = {};
  try {
    const { data } = await db.rpc("methodology_stats_json");
    if (data && typeof data === "object") for (const [k, v] of Object.entries(data)) if (typeof v === "number") nums[k] = v;
  } catch { /* degrade to token removed */ }
  try {
    const lm = await cachedLineageMeta();
    if (lm?.memberships) nums.lineage = lm.memberships;
  } catch { /* optional */ }
  return body.replace(/\{\{n:([a-z_]+)\}\}/g, (_m, key) => {
    const v = nums[key];
    return typeof v === "number" ? v.toLocaleString("en-US") : "—";
  });
}

const renderBody = (slug: string, body: string) =>
  unstable_cache(async () => renderDocMarkdown(await substituteCounts(body)), ["mdocs-render2", slug], {
    revalidate: 3600,
    tags: ["methodology-docs"],
  })();

export default async function MethodologyDocPage({ params }: Props) {
  const { slug } = await params;
  const doc = docBySlug(slug);
  const body = DOC_BODIES[slug];
  // The hub lives at /methodology (app/methodology/page.tsx); it has no [slug].
  if (!doc || slug === "overview" || !body) notFound();

  const cat = categoryBySlug(slug);
  const html = await renderBody(slug, body);
  const related = docsInCategory(doc!.category).filter((d) => d.slug !== slug && d.slug !== "overview").slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${SITE}${docHref(slug)}`,
        headline: `${doc!.title} — Metatake methodology`,
        description: doc!.desc,
        isPartOf: { "@type": "WebSite", "@id": "https://metatake.net" },
        author: { "@type": "Person", name: "Wonwoo Yoon", url: `${SITE}/editor` },
        editor: { "@type": "Person", name: "Wonwoo Yoon", url: `${SITE}/editor` },
        publisher: { "@type": "Organization", name: "Metatake", url: SITE },
        about: "Film interpretation methodology",
        datePublished: "2026-07-12",
        dateModified: REVIEWED_ISO,
        inLanguage: "en",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Methodology", item: `${SITE}/methodology` },
          ...(cat ? [{ "@type": "ListItem", position: 2, name: cat.label, item: `${SITE}${docHref(slug)}` }] : []),
          { "@type": "ListItem", position: cat ? 3 : 2, name: doc!.title, item: `${SITE}${docHref(slug)}` },
        ],
      },
    ],
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mdocs-crumb">
        <Link href="/methodology">Methodology</Link>
        {cat ? <> › {cat.label}</> : null} › {doc!.title}
      </div>
      <h1 className="mdocs-h1">{doc!.title}</h1>
      <p className="mdocs-standfirst">{doc!.desc}</p>
      <p className="mdocs-byline">
        By the <Link href="/methodology/editorial-responsibility">Metatake editorial desk</Link> · Reviewed {REVIEWED}
      </p>

      <div className="mdocs-body" dangerouslySetInnerHTML={{ __html: html }} />

      {related.length ? (
        <div className="mdocs-related">
          <div className="mdocs-related__h">Related</div>
          <div className="mdocs-related__list">
            {related.map((d) => (
              <Link key={d.slug} href={docHref(d.slug)}>{d.title}</Link>
            ))}
          </div>
        </div>
      ) : null}

      <DocsPager slug={slug} />

      <p className="mdocs-updated">Last reviewed {REVIEWED}. Corpus counts are read live from the database.</p>
    </main>
  );
}
