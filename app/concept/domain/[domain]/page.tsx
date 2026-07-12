import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import EntityTVHero from "@/components/EntityTVHero";
import DomainConcepts from "@/components/theory/DomainConcepts";
import ShareDock from "@/components/ShareDock";
import { pageRobots } from "@/lib/seo";

/**
 * Concepts by domain — the theory DB's 14 discipline domains, each listing
 * its concepts grouped by major field. 2026-07-08: every concept carries its
 * film count (essay links + Strong Misreadings via crosswalk), every field
 * header carries concept/film totals, and Korean field labels render as
 * their English parenthetical (terminology charter).
 */
export const revalidate = 3600;
export async function generateStaticParams() { return []; }

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const DOMAINS: Record<string, string> = {
  politics: "Politics", criticism: "Criticism", economics: "Economics", culture: "Culture",
  society: "Society", psychology: "Psychology", family: "Family", art: "Art",
  medicine: "Medicine", management: "Management", law: "Law", history: "History",
  nature: "Nature", literature: "Literature",
};

type Row = { concept: string; concept_slug: string; major: string | null; one_liner: string | null; films: number; theorist: string | null };

/** Korean field labels carry their English translation in parens — show that. */
function fieldLabel(major: string | null): string {
  if (!major) return "General";
  if (/[가-힣]/.test(major)) {
    const m = major.match(/\(([^)]{2,60})\)/);
    if (m) return m[1];
  }
  return major.replace(/^[0-9]+\.\s*/, "").replace(/^[IVX]+\.\s*/, "");
}

function load(domainSlug: string) {
  return unstable_cache(
    async () => {
      const part = DOMAINS[domainSlug];
      if (!part) return null;
      const { data } = await db().rpc("concept_domain_live", { p_part: part });
      const rows = (data as Row[] | null) ?? [];
      if (rows.length === 0) return null;
      const groups = new Map<string, Row[]>();
      for (const r of rows) {
        const k = fieldLabel(r.major);
        const g = groups.get(k) ?? [];
        g.push(r);
        groups.set(k, g);
      }
      // Fields with the most staged films first; concepts inside by films desc, then A–Z.
      const sorted = [...groups.entries()]
        .map(([k, g]) => [k, g.sort((a, b) => b.films - a.films || a.concept.localeCompare(b.concept))] as const)
        .sort((a, b) => b[1].reduce((s, r) => s + r.films, 0) - a[1].reduce((s, r) => s + r.films, 0));
      return { part, groups: sorted };
    },
    ["concept-domain-2", domainSlug],
    { revalidate: 3600 }
  )();
}

type Props = { params: Promise<{ domain: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain } = await params;
  const data = await load(domain);
  if (!data) return { title: "Not found" };
  const n = data.groups.reduce((s, [, g]) => s + g.length, 0);
  const films = data.groups.reduce((s, [, g]) => s + g.reduce((x, r) => x + r.films, 0), 0);
  const title = films >= 3
    ? `${data.part} Film Theory — ${n.toLocaleString()} Concepts, ${films.toLocaleString()} Film Readings`
    : `${data.part} concepts in film — the ${domain} domain`;
  const description = `${n.toLocaleString()} ${data.part.toLowerCase()} concepts in Metatake's theory registry, ${films.toLocaleString()} film readings between them — organized by field, each concept linked to the films that stage it.`;
  return {
    title, description,
    alternates: { canonical: `/concept/domain/${domain}` },
    openGraph: { title, description },
    robots: pageRobots(true),
  };
}

export default async function ConceptDomainPage({ params }: Props) {
  const { domain } = await params;
  const data = await load(domain);
  if (!data) notFound();
  const { part, groups } = data;
  const _conceptSlugs = groups.flatMap(([, g]) => g.map((r) => r.concept_slug)).slice(0, 80);
  const { data: _reelData } = await db().rpc("tv_films_for_concepts", { p_slugs: _conceptSlugs, p_cap: 40 });
  const _reelSlugs = (_reelData as string[] | null) ?? [];
  const total = groups.reduce((s, [, g]) => s + g.length, 0);
  const films = groups.reduce((s, [, g]) => s + g.reduce((x, r) => x + r.films, 0), 0);
  const liveTotal = groups.reduce((s, [, g]) => s + g.filter((r) => r.films > 0).length, 0);
  const hiddenCount = total - liveTotal;

  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap lh">
        <div className="mt-crumb"><Link href="/theorist">Theory</Link> › <Link href="/concept">Concepts</Link> › <span>{part}</span></div>
        <EntityTVHero reelSlugs={_reelSlugs} label={part} backdrop={null} />
        <h1 className="lh-h1">{part}</h1>
        <div className="rd-share" style={{ marginTop: 12 }}>
          <ShareDock variant="bar" path={`/concept/domain/${domain}`} title={part} />
          <ShareDock variant="fab" path={`/concept/domain/${domain}`} title={part} />
        </div>
        <p className="lh-def">
          Where does cinema stage {part.toLowerCase()}? {liveTotal.toLocaleString()} of this domain&rsquo;s{" "}
          {total.toLocaleString()} concepts have a film example — {films.toLocaleString()} readings between them. Fields
          with the most staged concepts first; the number beside a concept is how many films put it on screen.
        </p>
        <DomainConcepts
          groups={groups.map(([major, rows]) => ({
            major,
            rows: rows.map((r) => ({ concept: r.concept, concept_slug: r.concept_slug, one_liner: r.one_liner, films: r.films, theorist: r.theorist })),
          }))}
          hiddenCount={hiddenCount}
        />
        <p className="th-foot"><Link href="/concept">← All concepts</Link></p>
      </div>
    </div>
  );
}
