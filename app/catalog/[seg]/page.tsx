import { createClient } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import ListFilter from "@/components/ListFilter";
import FacetFilter from "@/components/FacetFilter";
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

  // Themes: the UCN structure (Family clusters + Facet axis) lives in
  // taxonomy_nodes.meta — surface it instead of a flat 536-pill list.
  type ThemeMeta = { facet_label: string | null; cluster_label: string | null };
  let themeFamilies: { family: string; items: (Node & { facet: string })[] }[] = [];
  let themeFacets: { key: string; label: string; n: number }[] = [];
  if (s.key === "themes") {
    const metaBySlug = new Map<string, ThemeMeta>();
    for (let from = 0; from < 2000; from += 1000) {
      const { data: tn } = await supabase
        .from("taxonomy_nodes")
        .select("slug, meta")
        .eq("kind", "theme")
        .range(from, from + 999);
      const batch = (tn ?? []) as { slug: string; meta: ThemeMeta | null }[];
      for (const t of batch) metaBySlug.set(t.slug, t.meta ?? { facet_label: null, cluster_label: null });
      if (batch.length < 1000) break;
    }
    const themeNodes = blocks.find((b) => b.kind === "theme")?.nodes ?? [];
    const fam = new Map<string, (Node & { facet: string })[]>();
    const facetCount = new Map<string, number>();
    for (const nd of themeNodes) {
      const m = metaBySlug.get(nd.slug);
      const family = m?.cluster_label ?? "Other";
      const facet = m?.facet_label ?? "";
      const g = fam.get(family) ?? [];
      g.push({ ...nd, facet });
      fam.set(family, g);
      if (facet) facetCount.set(facet, (facetCount.get(facet) ?? 0) + 1);
    }
    themeFamilies = [...fam.entries()]
      .map(([family, items]) => ({ family, items: items.sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)) }))
      .sort((a, b) => b.items.length - a.items.length);
    themeFacets = [...facetCount.entries()]
      .map(([label, n]) => ({ key: label, label, n }))
      .sort((a, b) => b.n - a.n);
  }

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

        {s.key === "themes" && themeFamilies.length > 0 && (
          <section className="cat-block">
            <h2 className="cat-h2">
              All Themes, by family
              <span className="cat-h2__n"> — {themeFamilies.reduce((n, f) => n + f.items.length, 0).toLocaleString()} across {themeFamilies.length} families</span>
            </h2>
            <FacetFilter targetId="cat-theme-families" facets={themeFacets} />
            <ListFilter targetId="cat-theme-families" placeholder="Filter themes…" total={themeFamilies.reduce((n, f) => n + f.items.length, 0)} />
            <div id="cat-theme-families">
              {themeFamilies.map((f) => (
                <div key={f.family} data-family style={{ margin: "18px 0 0" }}>
                  <h3 className="cat-h3">{f.family} <span className="cat-h2__n">— {f.items.length}</span></h3>
                  <div className="cat-pills">
                    {f.items.map((nd) => (
                      <Link
                        key={nd.slug}
                        href={nodeHref("theme", nd.slug)}
                        className="cat-pill"
                        data-filter-item
                        data-filter-text={nd.label.toLowerCase()}
                        data-facet={nd.facet}
                        title={nd.facet || undefined}
                      >
                        {nd.label}<span className="cat-pill__n">{nd.n}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {live.filter(({ kind }) => !(s.key === "themes" && kind === "theme")).map(({ kind, nodes }) => {
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
