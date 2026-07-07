import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import LensQuickBar from "@/components/LensQuickBar";
import MineEntityIndex from "@/components/MineEntityIndex";
import ConceptDirectory, { type DirRow } from "@/components/ConceptDirectory";
import { pageRobots } from "@/lib/seo";

/**
 * Concepts — the single canonical index of theoretical concepts.
 * 2026-07-08 rework (원우's directory spec): every entry carries its film
 * count; the list is searchable, browsable A–Z, and sortable by theorist
 * (name — concept). Domain chips carry registry counts. Data merges the live
 * registry (concept_live_registry: theory_concepts with ≥1 film link) with
 * the SM registry and readings-corpus vocabulary, deduped by slug/name.
 */
export const revalidate = 1800;

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type SmRow = { slug: string; name: string; n: number };
type TakesRow = { slug: string; title: string; n: number };
type LiveRow = { slug: string; name: string; films: number; theorist: string | null };
type DomainCount = { part: string; concepts: number; live: number };

const normName = (s: string) => s.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]/g, "");

async function loadRows() {
  const supabase = db();
  const [{ data: liveData }, { data: smData }, { data: takesData }, { data: domData }] = await Promise.all([
    supabase.rpc("concept_live_registry"),
    supabase.rpc("sm_concept_index", { p_limit: 500 }),
    supabase.rpc("concept_index"),
    supabase.rpc("concept_domain_counts"),
  ]);
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
  return { rows, domains: ((domData as DomainCount[] | null) ?? []) };
}

export async function generateMetadata(): Promise<Metadata> {
  const { rows } = await loadRows();
  const films = rows.reduce((s, r) => s + r.films, 0);
  const title = `Film Theory Concepts A–Z — ${rows.length.toLocaleString()} Ideas, ${films.toLocaleString()} Film Readings`;
  const description =
    `Every concept Metatake reads films through — the uncanny, the gaze, bare life, repetition compulsion and ${(rows.length - 4).toLocaleString()} more — with the films that stage each one. Browse A–Z, by film count, or by theorist.`;
  return { title, description, alternates: { canonical: "/concept" }, openGraph: { title, description }, robots: pageRobots(true) };
}

export default async function ConceptIndex() {
  const { rows, domains } = await loadRows();
  const films = rows.reduce((s, r) => s + r.films, 0);
  const registryTotal = domains.reduce((s, d) => s + d.concepts, 0);

  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap lh">
        <div className="mt-crumb"><Link href="/theorist">Theory</Link> › <span>Concepts</span> · <Link href="/theorist">Theorists</Link> · <Link href="/tradition">Traditions</Link></div>
        <h1 className="lh-h1">Concepts</h1>
        <p className="lh-def">
          The ideas cinema is read through — {rows.length.toLocaleString()} concepts with {films.toLocaleString()} film
          readings between them. Filter, browse A–Z, or sort by the <Link href="/theorist">theorists</Link> who coined
          them; every count is the number of films that stage the idea. (Grouped upstream into{" "}
          <Link href="/tradition">traditions</Link>; the full registry holds {registryTotal.toLocaleString()} concepts
          across {domains.length} domains below.)
        </p>
        <p style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0 0" }}>
          {domains.map((d) => (
            <Link key={d.part} href={`/concept/domain/${d.part.toLowerCase()}`}
              style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "rgba(0,0,0,.055)", textDecoration: "none" }}>
              {d.part} <span style={{ fontWeight: 500, opacity: .65 }}>{d.concepts.toLocaleString()}{d.live > 0 ? ` · ${d.live} on screen` : ""}</span>
            </Link>
          ))}
        </p>
        <LensQuickBar />
        <MineEntityIndex kind="concepts" hrefBase="/concept/" noun="concepts" />
        <div className="mtl-swap-out">
          <ConceptDirectory rows={rows} />
        </div>
      </div>
    </div>
  );
}
