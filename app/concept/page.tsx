import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import LensQuickBar from "@/components/LensQuickBar";
import MineEntityIndex from "@/components/MineEntityIndex";
import ConceptDirectory, { type DirRow } from "@/components/ConceptDirectory";
import TheoryExplorer from "@/components/theory/TheoryExplorer";
import ConceptDomainRail, { type DomainCount } from "@/components/theory/ConceptDomainRail";
import portraits from "@/lib/theorist_portrait.json";
import { pageRobots } from "@/lib/seo";

/**
 * Concepts — the single canonical index of the ideas cinema is read through.
 * The pitch is not "theory defined" but "the films that stage each idea": a
 * concept is a word we invented for something in the world we couldn't
 * otherwise hold onto; a film is where you finally watch it happen. Every
 * entry carries its film count; the list is searchable (unified across
 * concepts/theorists/traditions in the shell), browsable A–Z, sortable by
 * theorist, and organized above into 14 domains. Data merges the live registry
 * (theory_concepts with ≥1 film link) with the SM registry and readings-corpus
 * vocabulary, deduped by slug/name.
 */
export const revalidate = 1800;
const SITE = "https://metatake.net";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type SmRow = { slug: string; name: string; n: number };
type TakesRow = { slug: string; title: string; n: number };
type LiveRow = { slug: string; name: string; films: number; theorist: string | null };

const normName = (s: string) => s.toLowerCase().replace(/\s*\([^)]*\)/g, "").replace(/^the\s+/, "").replace(/[^a-z0-9]/g, "");

type TheoristIdx = { slug: string; name: string };

async function loadRows() {
  const supabase = db();
  const [{ data: liveData }, { data: smData }, { data: takesData }, { data: domData }, { data: thData }] = await Promise.all([
    supabase.rpc("concept_live_registry"),
    supabase.rpc("sm_concept_index", { p_limit: 500 }),
    supabase.rpc("concept_index"),
    supabase.rpc("concept_domain_counts"),
    supabase.rpc("theorist_index"),
  ]);
  // theorist NAME → portrait URL (concept rows carry a theorist name, not slug)
  const pmap = portraits as Record<string, string>;
  const portraitByTheorist: Record<string, string> = {};
  for (const t of ((thData as TheoristIdx[] | null) ?? [])) {
    const url = pmap[t.slug];
    if (url) portraitByTheorist[t.name] = url;
  }
  const live = (liveData as LiveRow[] | null) ?? [];
  const seenSlug = new Set(live.map((r) => r.slug));
  const seenName = new Set(live.map((r) => normName(r.name)));
  const rows: DirRow[] = live.map((r) => ({ slug: r.slug, name: r.name, films: r.films, theorist: r.theorist }));
  for (const r of ((smData as SmRow[] | null) ?? [])) {
    if (seenSlug.has(r.slug) || seenName.has(normName(r.name))) continue;
    seenSlug.add(r.slug); seenName.add(normName(r.name));
    rows.push({ slug: r.slug, name: r.name, films: r.n });
  }
  for (const r of ((takesData as TakesRow[] | null) ?? [])) {
    if (seenSlug.has(r.slug) || seenName.has(normName(r.title))) continue;
    seenSlug.add(r.slug); seenName.add(normName(r.title));
    rows.push({ slug: r.slug, name: r.title, films: r.n });
  }
  return { rows, domains: ((domData as DomainCount[] | null) ?? []), portraitByTheorist };
}

export async function generateMetadata(): Promise<Metadata> {
  const { rows } = await loadRows();
  const films = rows.reduce((s, r) => s + r.films, 0);
  const title = `Film Theory Concepts A–Z — ${rows.length.toLocaleString()} Ideas, ${films.toLocaleString()} Film Examples`;
  const description =
    `Which films show the uncanny, the gaze, bare life, repetition compulsion — and ${(rows.length - 4).toLocaleString()} more ideas? A concept names something in the world we couldn't otherwise hold; a film is where you watch it happen. Browse ${rows.length.toLocaleString()} concepts A–Z, by film count, by theorist, or across 14 domains.`;
  return { title, description, alternates: { canonical: "/concept" }, openGraph: { title, description }, robots: pageRobots(true) };
}

export default async function ConceptIndex() {
  const { rows, domains, portraitByTheorist } = await loadRows();
  const films = rows.reduce((s, r) => s + r.films, 0);
  const liveDomains = domains.filter((d) => d.live > 0).length;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", "@id": `${SITE}/concept`, url: `${SITE}/concept`, name: "Film Theory Concepts, Staged in Cinema",
        description: `${rows.length.toLocaleString()} theoretical concepts, each with the films that stage it.` },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE },
        { "@type": "ListItem", position: 2, name: "Concepts", item: `${SITE}/concept` },
      ] },
    ],
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mt-wrap lh">
        <TheoryExplorer
          axis="concepts"
          heroTitle="The ideas cinema is read through"
          heroLede={
            <>
              A concept is a word we invented for something in the world we couldn&rsquo;t otherwise hold onto — the
              uncanny, the gaze, bare life. Theory names it; a film is where you finally watch it happen.{" "}
              {rows.length.toLocaleString()} concepts here, {films.toLocaleString()} film examples between them, across{" "}
              {liveDomains} <Link href="/tradition">domains</Link>. The number by each is how many films stage the idea.
            </>
          }
        >
          <LensQuickBar />
          <MineEntityIndex kind="concepts" hrefBase="/concept/" noun="concepts" />
          <ConceptDomainRail domains={domains} />
          <div className="mtl-swap-out" style={{ marginTop: 30 }}>
            <ConceptDirectory rows={rows} portraits={portraitByTheorist} />
          </div>
        </TheoryExplorer>
      </div>
    </div>
  );
}
