import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import LensQuickBar from "@/components/LensQuickBar";
import MineEntityIndex from "@/components/MineEntityIndex";
import TheoryExplorer from "@/components/theory/TheoryExplorer";
import TheoristDirectory, { type TheoristRow } from "@/components/theory/TheoristDirectory";
import portraits from "@/lib/theorist_portrait.json";
import { pageRobots } from "@/lib/seo";

export const revalidate = 1800;

const SITE = "https://metatake.net";
const TITLE = "Film Theorists A–Z — the thinkers cinema is read through";
const DESC =
  "Freud, Lacan, Foucault, Arendt and hundreds more — each thinker named something the world does that we had no word for, and each is linked here to the films that stage it. Browse every theorist by the number of films read in their light.";

export const metadata: Metadata = {
  alternates: { canonical: "/theorist" },
  title: TITLE,
  description: DESC,
  openGraph: { title: TITLE, description: DESC },
  robots: pageRobots(true),
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default async function TheoristIndex() {
  const { data } = await db().rpc("theorist_index");
  const rows = (data as TheoristRow[] | null) ?? [];
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
        <TheoryExplorer
          axis="theorists"
          heroTitle="The thinkers cinema is read through"
          heroLede={
            <>
              Every one of them named something the world keeps doing that we had no word for, then handed criticism a lens
              to see it with. This is the roll of those minds — {rows.length.toLocaleString()} of them, {total.toLocaleString()}{" "}
              film readings between them. Open any to watch the films read in their light. See also the{" "}
              <Link href="/concept">concepts</Link> they coined and the <Link href="/tradition">traditions</Link> they belong to.
            </>
          }
        >
          <LensQuickBar />
          <MineEntityIndex kind="theorists" hrefBase="/theorist/" noun="theorists" />
          <div className="mtl-swap-out">
            <TheoristDirectory rows={rows} portraits={portraits as Record<string, string>} />
          </div>
        </TheoryExplorer>
      </div>
    </div>
  );
}
