import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import { SECTIONS, sectionCounts, sectionHref, nodeHref, type KindCount } from "@/lib/catalog";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Archetype — what each figure is | Metatake",
  description:
    "A controlled vocabulary for every figure in the archive — objects, characters, places, themes, theory. Browse cinema by what its elements are, not only what they mean.",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Top = { slug: string; label: string; code: string | null; n: number };

export default async function CatalogHub() {
  const supabase = db();
  const { data: countRows } = await supabase.rpc("catalog_kind_counts");
  const counts = sectionCounts((countRows as KindCount[]) ?? []);

  // featured named archetypes per section (skip theory — sourced from the canon)
  const featutedKinds = SECTIONS.filter((s) => s.key !== "theory");
  const tops = await Promise.all(
    featutedKinds.map((s) => supabase.rpc("catalog_top_nodes", { p_kind: s.primaryKind, p_n: 4 }))
  );
  const topBySection: Record<string, Top[]> = {};
  featutedKinds.forEach((s, i) => { topBySection[s.key] = (tops[i].data as Top[]) ?? []; });

  // Theory section is sourced from the concept layer (takes.concept), not figure_taxonomy.
  const { data: cRows } = await supabase.rpc("concept_index");
  const concepts = (cRows as { slug: string; title: string; n: number }[]) ?? [];
  const conceptCount = concepts.length;
  topBySection["theory"] = concepts.slice(0, 4).map((c) => ({ slug: c.slug, label: c.title, code: null, n: c.n }));

  return (
    <div className="mt">
      <SiteNav />
      <div className="cat-wrap">
        <div className="cat-kick">Archetype</div>
        <h1 className="cat-h1">What each figure <em>is</em></h1>
        <p className="cat-intro">
          A controlled vocabulary for every figure in the archive — its <strong>objects</strong>,{" "}
          <strong>characters</strong>, <strong>places</strong>, <strong>themes</strong>, and{" "}
          <strong>theory</strong>. This is the descriptive layer: what a figure <em>is</em>. It sits
          beside <Link href="/tropes">Tropes</Link>, the interpretive layer — what a figure{" "}
          <em>means</em>.
        </p>

        <div className="cat-sections">
          {SECTIONS.map((s) => {
            const c = counts[s.key];
            const feat = topBySection[s.key] ?? [];
            return (
              <section key={s.key} className="cat-scard">
                <Link href={sectionHref(s.key)} className="cat-scard__h">
                  <i className={`ti ti-${s.icon}`} aria-hidden="true" />
                  <span className="cat-scard__title">{s.cardTitle}</span>
                </Link>
                <div className="cat-scard__count">
                  {s.key === "theory"
                    ? `${conceptCount.toLocaleString()} concepts · from the readings`
                    : `${c.nodes.toLocaleString()} ${s.key === "themes" ? "themes" : "archetypes"} · ${c.figures.toLocaleString()} figures`}
                </div>
                <p className="cat-scard__blurb">{s.blurb}</p>
                {feat.length > 0 ? (
                  <div className="cat-chips">
                    {feat.map((f) => (
                      <Link key={f.slug} href={s.key === "theory" ? `/concept/${f.slug}` : nodeHref(s.primaryKind, f.slug)} className="cat-chip">
                        {f.label}<span className="cat-chip__n">{f.n}</span>
                      </Link>
                    ))}
                  </div>
                ) : null}
                <Link href={s.key === "theory" ? "/concept" : sectionHref(s.key)} className="cat-scard__go">
                  Browse {s.label} <span aria-hidden="true">→</span>
                </Link>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
