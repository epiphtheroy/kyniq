import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";

export const revalidate = 1800;

const SITE = "https://metatake.net";
const TITLE = "Theorists — the thinkers cinema is read through";
const DESC =
  "Every theorist Metatake reads films through — Freud, Lacan, Foucault, Arendt and hundreds more — each linked to the Strong Misreadings that invoke them.";

export const metadata: Metadata = {
  alternates: { canonical: "/theorist" },
  title: TITLE,
  description: DESC,
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Row = { slug: string; name: string; blurb: string | null; n: number };

export default async function TheoristIndex() {
  const { data } = await db().rpc("theorist_index");
  const rows = (data as Row[] | null) ?? [];
  const total = rows.reduce((s, r) => s + r.n, 0);
  const top = [...rows].sort((a, b) => b.n - a.n).slice(0, 25);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", "@id": `${SITE}/theorist`, url: `${SITE}/theorist`, name: TITLE, description: DESC },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE },
        { "@type": "ListItem", position: 2, name: "Theorists", item: `${SITE}/theorist` },
      ] },
      { "@type": "ItemList", numberOfItems: rows.length,
        itemListElement: top.map((r, i) => ({
          "@type": "ListItem", position: i + 1, name: r.name, url: `${SITE}/theorist/${r.slug}`,
        })) },
    ],
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mt-wrap lh">
        <div className="mt-crumb">Theory › <Link href="/idea">Concepts</Link> · <Link href="/tradition">Traditions</Link></div>
        <h1 className="lh-h1">Theorists</h1>
        <p className="lh-def">
          The thinkers Metatake reads films <em>through</em>. Each Strong Misreading borrows a lens — a theorist and a
          concept — and this is the roll of those minds, {rows.length} of them across {total.toLocaleString()} readings.
          Open any one to see every film read in their light. (See also the <Link href="/idea">concepts</Link> they think
          and the <Link href="/tradition">traditions</Link> they belong to.)
        </p>
        <div className="th-grid">
          {rows.map((r) => (
            <Link className="th-row" href={`/theorist/${r.slug}`} key={r.slug}>
              <span className="th-name">{r.name}</span>
              <span className="th-n">{r.n}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
