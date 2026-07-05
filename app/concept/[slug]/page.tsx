import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import { pageRobots } from "@/lib/seo";

export const revalidate = 600;
export async function generateStaticParams() { return []; }
function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
interface Props { params: Promise<{ slug: string }> }
type Row = { concept: string; slug: string; title: string; laconic: string | null; films: number; bd: string | null };
const IMG = "https://image.tmdb.org/t/p/w300";

type Detail = {
  stats?: { films: number; readings: number; tropes: number };
  native?: string | null;
  theorist?: { name: string; slug: string } | null;
} | null;

async function load(slug: string) {
  const client = db();
  const [{ data }, { data: detail }] = await Promise.all([
    client.rpc("concept_readings", { p_slug: slug }),
    client.rpc("concept_detail", { p_slug: slug }),
  ]);
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return null;
  return { concept: rows[0].concept, rows, detail: (detail ?? null) as Detail };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Concept — Metatake" };
  const title = `${data.concept} in film — meaning & examples`;
  const description = `${data.concept} in cinema: ${data.rows.length} close readings across films, each tracing how the idea plays on screen.`;
  return {
    title,
    description,
    openGraph: { title, description },
    alternates: { canonical: `/concept/${slug}` },
    robots: pageRobots(data.rows.length >= 3),
  };
}

export default async function ConceptPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { concept, rows, detail } = data;
  const stats = detail?.stats ?? null;
  const native = detail?.native ?? null;
  const theorist = detail?.theorist ?? null;

  const jsonld = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Concepts", item: "https://metatake.net/concept" },
      { "@type": "ListItem", position: 2, name: concept, item: `https://metatake.net/concept/${slug}` },
    ] },
    { "@context": "https://schema.org", "@type": "DefinedTerm", "@id": `https://metatake.net/concept/${slug}#term`,
      name: concept, ...(native ? { alternateName: native } : {}), url: `https://metatake.net/concept/${slug}` },
    { "@context": "https://schema.org", "@type": "ItemList", name: `${concept} in film`, numberOfItems: rows.length,
      itemListElement: rows.map((r, i) => ({ "@type": "ListItem", position: i + 1,
        item: { "@type": "CreativeWork", name: r.title, url: `https://metatake.net/trope/${r.slug}` } })) },
    { "@context": "https://schema.org", "@type": "WebPage", "@id": `https://metatake.net/concept/${slug}`,
      name: `${concept} in film`,
      author: { "@type": "Organization", "@id": "https://metatake.net/#org", name: "Metatake" },
      editor: { "@type": "Person", "@id": "https://metatake.net/editor#person", name: "Wonwoo Yoon" } },
  ];

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
      <div className="mt-wrap">
        <div className="mt-crumb"><Link href="/catalog">Archetype</Link> › <Link href="/concept">Theory</Link></div>
        <h1 className="mt-h1">{concept} in film{native ? <span style={{ fontWeight: 400, opacity: .55, fontSize: "0.62em" }}> · {native}</span> : null}</h1>
        <p className="mt-laconic">
          {rows.length} ways {concept.toLowerCase()} shows up across cinema — each a recurring trope that gathers the films sharing it.
          {theorist ? <> Most read through <Link href={`/theorist/${theorist.slug}`}>{theorist.name}</Link>.</> : null}
        </p>
        {stats ? (
          <p style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0 0" }}>
            {[
              [stats.films, `film${stats.films === 1 ? "" : "s"}`],
              [stats.readings, `close reading${stats.readings === 1 ? "" : "s"}`],
              [stats.tropes, `trope${stats.tropes === 1 ? "" : "s"}`],
            ].map(([n, label]) => (
              <span key={String(label)} style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "rgba(0,0,0,.055)" }}>
                {n} <span style={{ fontWeight: 500, opacity: .7 }}>{label}</span>
              </span>
            ))}
          </p>
        ) : null}
        <p style={{ fontSize: 12, opacity: .68, margin: "10px 0 0" }}>
          Mapped by Metatake&apos;s connection engine from its readings corpus · Edited by <Link href="/editor">Wonwoo Yoon</Link> · <Link href="/methodology#connections">How it&apos;s computed →</Link>
        </p>
        <div className="cat-mlist">
          {rows.map((r) => {
            const src = r.bd ? `${IMG}${r.bd}` : null;
            return (
              <Link key={r.slug} href={`/trope/${r.slug}`} className="cat-mrow">
                <div className="cat-mrthumb">{src ? <img src={src} alt="" loading="lazy" /> : <i className="ti ti-movie" aria-hidden="true" />}</div>
                <div className="cat-mrtext">
                  <div className="cat-mrfig">{r.title}</div>
                  <div className="cat-mrfilm">{r.films} film{r.films === 1 ? "" : "s"}{r.laconic ? ` · ${r.laconic}` : ""}</div>
                </div>
              </Link>
            );
          })}
        </div>
        <p className="mt-see" style={{ marginTop: "1.25rem" }}>← All <Link href="/concept">concepts</Link></p>
      </div>
    </div>
  );
}
