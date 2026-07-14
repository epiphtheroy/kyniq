import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";

export const revalidate = 600;

function slugifyGenre(g: string) { return g.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

// Unique, live-data description (charter: "descriptions unique per page") — the
// distinct-genre count and the size of the closely-read corpus, both computed
// from the same rows the index renders, so /genre never shares the homepage snippet.
export async function generateMetadata(): Promise<Metadata> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: films } = await supabase.from("films").select("genres").eq("visible", true).not("genres", "is", null).limit(5000);
  const set = new Set<string>();
  let n = 0;
  for (const f of films ?? []) { n++; for (const g of (f.genres ?? []) as string[]) set.add(g); }
  const description = set.size > 0
    ? `Browse ${set.size} film genres across ${n.toLocaleString()} closely-read films on Metatake — each genre ranked by TakeScore and read scene by scene.`
    : "Browse films by genre on Metatake — each genre ranked by TakeScore and read scene by scene.";
  return { title: "Genres", description, alternates: { canonical: "/genre" } };
}

export default async function GenreIndex() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: films } = await supabase.from("films").select("genres").eq("visible", true).not("genres", "is", null).limit(5000);
  const counts = new Map<string, number>();
  for (const f of films ?? []) for (const g of (f.genres ?? []) as string[]) counts.set(g, (counts.get(g) ?? 0) + 1);
  const list = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": "https://metatake.net/genre#page",
    name: "Film genres",
    url: "https://metatake.net/genre",
    isPartOf: { "@type": "WebSite", "@id": "https://metatake.net/#website" },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: list.length,
      itemListElement: list.map(([g], i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: g,
        url: `https://metatake.net/genre/${slugifyGenre(g)}`,
      })),
    },
  };
  return (
    <div className="mt">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }} />
      <SiteNav />
      <div className="mt-wrap">
        <h1 className="mt-h1">Genres</h1>
        {list.length === 0 ? (
          <p style={{ color: "var(--muted)", marginTop: 16 }}>Genre data is being enriched from TMDB.</p>
        ) : (
          <div className="mt-cols" style={{ marginTop: 14 }}>
            {list.map(([g, n]) => (
              <div key={g}><Link href={`/genre/${slugifyGenre(g)}`}>{g}</Link> <span style={{ color: "var(--subtle)" }}>{n}</span></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
