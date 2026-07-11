import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import EntityTVHero from "@/components/EntityTVHero";
import ShareDock from "@/components/ShareDock";
import QuickAnswers, { type QuickAnswerItem } from "@/components/read/QuickAnswers";

/**
 * Tradition — the school-of-thought axis (unified taxonomy Major).
 * 2026-07-08 rework: the old per-canon tradition pages were the same substance
 * as /concept pages (100% crosswalked via theory_canon_map), so old canon
 * slugs now 308 to their canonical /concept page. /tradition/[slug] serves the
 * real traditions instead: schools from the unified taxonomy (theory_schools_index).
 */
export const revalidate = 1800;
export async function generateStaticParams() { return []; }

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

interface Props { params: Promise<{ slug: string }> }

type SchoolRow = {
  school: string; part: string | null; sub: string | null;
  concept: string; concept_slug: string; films: number; theorists: string | null;
};

function load(slug: string) {
  return unstable_cache(
    async () => {
      const supabase = db();
      const { data: school } = await supabase.rpc("theory_school_detail", { p_slug: slug });
      const rows = (school as SchoolRow[] | null) ?? [];
      if (rows.length > 0) {
        // Reel for the video hero: films across all the school's concepts.
        const { data: reel } = await supabase.rpc("tv_films_for_concepts", { p_slugs: rows.map((r) => r.concept_slug), p_cap: 40 });
        return { kind: "school" as const, rows, reelSlugs: (reel as string[] | null) ?? [] };
      }
      // Legacy canon slug → its canonical concept page (crosswalk).
      const { data: target } = await supabase.rpc("canon_concept_slug", { p_slug: slug });
      if (typeof target === "string" && target) return { kind: "redirect" as const, target };
      return null;
    },
    ["tradition-school-1", slug],
    { revalidate: 1800, tags: [`tradition:${slug}`] },
  )();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data || data.kind !== "school") return { title: "Tradition — Metatake" };
  const { rows } = data;
  const name = rows[0].school;
  const films = rows.reduce((s, r) => s + r.films, 0);
  const withFilms = rows.filter((r) => r.films > 0).length;
  const title = films >= 3
    ? `${name} in Film — ${films} Readings Across ${withFilms} Concepts`
    : `${name} — a tradition on Metatake`;
  const description = `The ${name} tradition on screen: ${rows.length} concepts${rows[0].theorists ? ` from ${rows[0].theorists.split(",")[0].trim()} onward` : ""}, each linked to the films whose readings put it to work.`;
  return {
    title, description,
    openGraph: { title, description },
    alternates: { canonical: `/tradition/${slug}` },
  };
}

// ── Quick answers (docs/PLAN-intent-coverage.md §0 charter + §5.7) ─────────
// Deterministic Q&A assembled ONLY from the school's rows already in scope.
// tradition has NO definition field, so there is NEVER a "What is X?" question
// (it cannot be answered from data — charter §0-1); only concept, theorist and
// count questions, every name verbatim. Variants (tradition / school /
// concepts) woven across Q and A, max two uses each: "concepts" carries Q1+Q3,
// "tradition" carries Q1+A2, "school" carries A1.
function quickAnswerItems(rows: SchoolRow[], films: number): QuickAnswerItem[] {
  const name = rows[0].school;
  const items: QuickAnswerItem[] = [];

  const shown = rows.slice(0, 4);
  const conceptNodes = shown.map((r, i) => (
    <span key={r.concept_slug}>
      {i > 0 ? (i === shown.length - 1 ? " and " : ", ") : ""}
      <Link href={`/concept/${r.concept_slug}`}>{r.concept}</Link>
    </span>
  ));
  items.push({
    q: `What are the key concepts in the ${name} tradition?`,
    a: <>The {name} school turns on {conceptNodes}.</>,
  });

  const theorists: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (!r.theorists) continue;
    for (const t of r.theorists.split(",").map((s) => s.trim()).filter(Boolean)) {
      const k = t.toLowerCase();
      if (!seen.has(k)) { seen.add(k); theorists.push(t); }
    }
  }
  if (theorists.length > 0) {
    const names = theorists.slice(0, 4);
    const joined = names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    items.push({
      q: `Who are the ${name} theorists?`,
      a: `${joined} — the theorists whose work this tradition gathers.`,
    });
  }

  items.push({
    q: `How many concepts does ${name} cover?`,
    a: `${rows.length} in all${films > 0 ? `, drawn on across ${films} film reading${films !== 1 ? "s" : ""} on Metatake` : ""}.`,
  });

  return items.slice(0, 4);
}

export default async function TraditionPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  if (data.kind === "redirect") permanentRedirect(`/concept/${data.target}`);

  const { rows, reelSlugs } = data;
  const name = rows[0].school;
  const parts = [...new Set(rows.map((r) => r.part).filter(Boolean))] as string[];
  const films = rows.reduce((s, r) => s + r.films, 0);

  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap">
        <div className="mt-crumb"><Link href="/theorist">Theory</Link> › <Link href="/tradition">Traditions</Link></div>
        <EntityTVHero reelSlugs={reelSlugs} label={name} backdrop={null} />
        <h1 className="th-h1">{name}</h1>
        {parts.length > 0 && (
          <p style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0 0" }}>
            {parts.map((p) => (
              <span key={p} style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "rgba(0,0,0,.055)" }}>{p}</span>
            ))}
          </p>
        )}
        <p className="th-sub">
          {rows.length} concept{rows.length !== 1 ? "s" : ""} carry the <em>{name}</em> tradition
          {films > 0 ? <> — {films} film reading{films !== 1 ? "s" : ""} across Metatake lean on them.</> : "."}
        </p>
        <QuickAnswers items={quickAnswerItems(rows, films)} />
        <div className="th-share" style={{ marginTop: 14 }}>
          <ShareDock variant="bar" path={`/tradition/${slug}`} title={`${name} — a theory tradition`}
            hook={`${name} — ${rows.length} concept${rows.length !== 1 ? "s" : ""} read across film on Metatake`}
            saveType="tradition" saveRef={slug} />
          <ShareDock variant="fab" path={`/tradition/${slug}`} title={name} noSave />
        </div>

        <div className="th-grid" style={{ marginTop: 18 }}>
          {rows.map((r) => (
            <Link className="th-row" href={`/concept/${r.concept_slug}`} key={r.concept_slug}>
              <span className="th-name">
                {r.concept}
                {r.theorists ? <span className="th-by"> — {r.theorists}</span> : null}
              </span>
              {r.films > 0 ? <span className="th-n">{r.films}</span> : null}
            </Link>
          ))}
        </div>
        <p className="th-foot"><Link href="/tradition">← All traditions</Link></p>
      </div>
    </div>
  );
}
