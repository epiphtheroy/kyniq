import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";
import { pageRobots } from "@/lib/seo";

export const revalidate = 600;
export async function generateStaticParams() { return []; }
function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
interface Props { params: Promise<{ slug: string }> }
type Row = { concept: string; slug: string; title: string; laconic: string | null; films: number };

async function load(slug: string) {
  const { data } = await db().rpc("concept_readings", { p_slug: slug });
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return null;
  return { concept: rows[0].concept, rows };
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
  const { concept, rows } = data;

  const jsonld = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Concepts", item: "https://metatake.net/concept" },
      { "@type": "ListItem", position: 2, name: concept, item: `https://metatake.net/concept/${slug}` },
    ] },
    { "@context": "https://schema.org", "@type": "ItemList", name: `${concept} in film`, numberOfItems: rows.length,
      itemListElement: rows.map((r, i) => ({ "@type": "ListItem", position: i + 1,
        item: { "@type": "CreativeWork", name: r.title, url: `https://metatake.net/trope/${r.slug}` } })) },
  ];

  return (
    <div className="mt">
      <MetatakeNav active="concepts" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
      <div className="mt-wrap">
        <div className="mt-crumb"><Link href="/concept">Concepts</Link></div>
        <h1 className="mt-h1">{concept} in film</h1>
        <p className="mt-laconic">
          {rows.length} ways {concept.toLowerCase()} shows up across cinema — each a close reading that gathers the films sharing it. A search-friendly door into the idea; follow any reading to fall through to the films.
        </p>
        <ul className="trm-list">
          {rows.map((r) => (
            <li key={r.slug}>
              <div className="trm-row">
                <Link href={`/trope/${r.slug}`} className="mt-fig">{r.title}</Link>{" "}
                <span className="yr">· {r.films} film{r.films === 1 ? "" : "s"}</span>
              </div>
              {r.laconic ? <p className="trm-desc">{r.laconic}</p> : null}
            </li>
          ))}
        </ul>
        <p className="mt-see" style={{ marginTop: "1.25rem" }}>← All <Link href="/concept">concepts</Link></p>
      </div>
    </div>
  );
}
