import { createClient } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import ListFilter from "@/components/ListFilter";
import { sectionBySeg, kindMeta, axisLabel, nodeHref } from "@/lib/catalog";

export const revalidate = 600;
export async function generateStaticParams() { return []; }

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
interface Props { params: Promise<{ seg: string }> }
type Node = { slug: string; label: string; code: string | null; parent_slug: string | null; parent_label: string | null; n: number };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { seg } = await params;
  const s = sectionBySeg(seg);
  if (!s) return { title: "Catalog — Metatake" };
  return { title: `${s.label} — Film Archetypes`, description: s.blurb, alternates: { canonical: `/catalog/${seg}` } };
}

export default async function CatalogSection({ params }: Props) {
  const { seg } = await params;
  const s = sectionBySeg(seg);
  if (!s) notFound();
  if (s.key === "theory") redirect("/concept"); // Theory is sourced from the canon (absorption pending)

  const supabase = db();
  // tiers first (coarse browse-by), named archetype last (the big list)
  const kinds = [...s.kinds].sort((a, b) => Number(kindMeta(b)?.tier) - Number(kindMeta(a)?.tier));
  const blocks = await Promise.all(
    kinds.map(async (kind) => {
      const { data } = await supabase.rpc("catalog_browse", { p_kind: kind });
      return { kind, nodes: ((data as Node[]) ?? []).filter((n) => n.n > 0) };
    })
  );
  const live = blocks.filter((b) => b.nodes.length > 0);

  const SITE = "https://metatake.net";
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${SITE}/catalog/${seg}`,
        url: `${SITE}/catalog/${seg}`,
        name: `${s.label} — Film Archetypes`,
        description: s.blurb,
        isPartOf: { "@type": "CollectionPage", "@id": `${SITE}/catalog` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE },
          { "@type": "ListItem", position: 2, name: "Film Archetypes", item: `${SITE}/catalog` },
          { "@type": "ListItem", position: 3, name: s.label, item: `${SITE}/catalog/${seg}` },
        ],
      },
    ],
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="cat-wrap">
        <div className="cat-crumb"><Link href="/catalog">Archetype</Link> <span>›</span> {s.label}</div>
        <h1 className="cat-h1">{s.label}</h1>
        <p className="cat-intro">{s.blurb}</p>

        {live.map(({ kind, nodes }) => {
          const km = kindMeta(kind)!;
          const big = nodes.length > 40;
          const listId = `cat-${kind}`;
          return (
            <section key={kind} className="cat-block">
              <h2 className="cat-h2">
                {km.tier ? `Browse by ${axisLabel(kind)}` : `All ${axisLabel(kind)}s`}
                <span className="cat-h2__n"> — {nodes.length.toLocaleString()}</span>
              </h2>
              {big ? <ListFilter targetId={listId} placeholder={`Filter ${nodes.length} ${axisLabel(kind).toLowerCase()}…`} total={nodes.length} /> : null}
              <div className="cat-pills" id={listId}>
                {nodes.map((nd) => (
                  <Link
                    key={nd.slug}
                    href={nodeHref(kind, nd.slug)}
                    className="cat-pill"
                    data-filter-item
                    data-filter-text={nd.label.toLowerCase()}
                  >
                    {nd.label}<span className="cat-pill__n">{nd.n}</span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
