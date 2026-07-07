import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import { pageRobots } from "@/lib/seo";

/**
 * Concepts by domain — the theory DB's 14 discipline domains (terminology
 * charter: "Domain" = 학제 대분류), each listing its concepts grouped by
 * major field. The registry directory 원우 asked for (2026-07-08).
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

type Row = { concept: string; concept_slug: string; major: string | null; one_liner: string | null };

function load(domainSlug: string) {
  return unstable_cache(
    async () => {
      const part = DOMAINS[domainSlug];
      if (!part) return null;
      const supabase = db();
      const rows: Row[] = [];
      for (let from = 0; from < 4000; from += 1000) {
        const { data } = await supabase
          .from("theory_concepts")
          .select("concept, concept_slug, major, one_liner")
          .eq("part", part)
          .order("major", { ascending: true })
          .order("concept", { ascending: true })
          .range(from, from + 999);
        const batch = (data ?? []) as Row[];
        rows.push(...batch);
        if (batch.length < 1000) break;
      }
      if (rows.length === 0) return null;
      const groups = new Map<string, Row[]>();
      for (const r of rows) {
        const k = r.major ?? "General";
        const g = groups.get(k) ?? [];
        g.push(r);
        groups.set(k, g);
      }
      return { part, groups: [...groups.entries()] };
    },
    ["concept-domain-1", domainSlug],
    { revalidate: 3600 }
  )();
}

type Props = { params: Promise<{ domain: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain } = await params;
  const data = await load(domain);
  if (!data) return { title: "Not found" };
  const n = data.groups.reduce((s, [, g]) => s + g.length, 0);
  const title = `${data.part} concepts in film — the ${domain} domain`;
  const description = `${n.toLocaleString()} concepts from ${data.part.toLowerCase()} that Metatake's readings and desk essays draw on, organized by field.`;
  return {
    title, description,
    alternates: { canonical: `/concept/domain/${domain}` },
    robots: pageRobots(true),
  };
}

export default async function ConceptDomainPage({ params }: Props) {
  const { domain } = await params;
  const data = await load(domain);
  if (!data) notFound();
  const { part, groups } = data;
  const total = groups.reduce((s, [, g]) => s + g.length, 0);

  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap lh">
        <div className="mt-crumb"><Link href="/theorist">Theory</Link> › <Link href="/concept">Concepts</Link> › <span>{part}</span></div>
        <h1 className="lh-h1">{part}</h1>
        <p className="lh-def">
          {total.toLocaleString()} concepts from {part.toLowerCase()} in Metatake&rsquo;s theory registry — the
          vocabulary the desk essays and readings draw on, organized by field.
        </p>
        {groups.map(([major, rows]) => (
          <section key={major} style={{ marginTop: 26 }}>
            <h2 className="cmap-h2">{major}</h2>
            <ul className="mt-cols" style={{ marginTop: 8 }}>
              {rows.map((r) => (
                <li key={r.concept_slug}>
                  <Link href={`/concept/${r.concept_slug}`}>{r.concept}</Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="th-foot"><Link href="/concept">← All concepts</Link></p>
      </div>
    </div>
  );
}
