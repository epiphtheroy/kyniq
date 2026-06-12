import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";

/**
 * /frames — dimension index of cinema's big questions (site-ia-plan.md §4.5).
 * Approved frames only (RLS), grouped by dimension, with live instance counts.
 * Frames below the hub gate stay invisible until approved + >=5 instances.
 */

// ISR: edge-cached, background-refreshed (was force-dynamic).
export const revalidate = 300;

export const metadata: Metadata = {
  title: "The big questions of cinema",
  description:
    "The questions viewers keep asking of film after film — endings, motives, symbols, craft — catalogued and ranked across film history by FilmCurio.",
};

function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const DIMENSION_LABELS: Record<string, string> = {
  "ending": "Endings",
  "central-ambiguity": "Central ambiguities",
  "character-motive-or-fate": "Motives & fates",
  "symbol-or-motif": "Symbols & motifs",
  "craft-choice": "Craft choices",
  "theme": "Themes",
  "contested-point": "Contested points",
  "rewatch-detail": "Rewatch details",
  "director-connection": "Director connections",
  "central-provocation": "Provocations",
};

export default async function FramesIndexPage() {
  const supabase = supabaseAnon();

  const { data: frames } = await supabase
    .from("frames")
    .select("id, slug, label, definition, dimension")
    .eq("status", "approved")
    .order("label");

  const { data: counts } = await supabase
    .from("frame_instance_counts")
    .select("frame_id, instance_count");

  const countMap = new Map<string, number>(
    (counts ?? []).map((c) => [c.frame_id as string, c.instance_count as number] as [string, number])
  );

  const groups = new Map<string, typeof frames>();
  for (const f of frames ?? []) {
    const list = groups.get(f.dimension) ?? [];
    list.push(f);
    groups.set(f.dimension, list);
  }
  // dimensions ordered by total instances
  const ordered = [...groups.entries()].sort(
    (a, b) =>
      (b[1] ?? []).reduce((s, f) => s + (countMap.get(f.id) ?? 0), 0) -
      (a[1] ?? []).reduce((s, f) => s + (countMap.get(f.id) ?? 0), 0)
  );

  const total = (frames ?? []).length;

  return (
    <main className="page">
      <div className="colwrap">
        <header className="article-head">
          <p className="kicker">
            <span>FilmCurio</span>
            <span className="sep">|</span>
            <span className="topic">the catalogue</span>
          </p>
          <h1 className="article-title">The big questions of cinema</h1>
          <p className="article-dek">
            Every film raises its own questions — but the questions themselves
            recur across film history. These are the ones viewers keep asking,
            catalogued and ranked film by film.
          </p>
          <div className="article-metarow">
            <span>{total} question{total === 1 ? "" : "s"} catalogued so far</span>
            <span>·</span>
            <span>growing as the archive grows</span>
          </div>
        </header>

        {ordered.map(([dimension, list]) => (
          <section className="secmod" key={dimension}>
            <div className="secmod__head secmod__head--red">
              <h2 className="secmod__title">
                {DIMENSION_LABELS[dimension] ?? dimension}
              </h2>
            </div>
            <div style={{ marginTop: 4 }}>
              {(list ?? [])
                .sort((a, b) => (countMap.get(b.id) ?? 0) - (countMap.get(a.id) ?? 0))
                .map((f) => (
                  <article
                    key={f.id}
                    style={{ padding: "14px 0", borderBottom: "1px solid var(--hairline)" }}
                  >
                    <h3 className="story__title" style={{ margin: 0 }}>
                      <Link href={`/frame/${f.slug}`}>{f.label}</Link>
                    </h3>
                    {f.definition && (
                      <p className="dek" style={{ marginTop: 4 }}>
                        {f.definition.split(". ")[0]}.
                      </p>
                    )}
                    <div className="meta" style={{ marginTop: 4 }}>
                      <span>
                        {countMap.get(f.id) ?? 0} films, ranked
                      </span>
                    </div>
                  </article>
                ))}
            </div>
          </section>
        ))}

        {total === 0 && (
          <p className="ui muted" style={{ fontSize: 15, marginTop: 30 }}>
            The catalogue is being assembled — check back shortly.
          </p>
        )}
      </div>
    </main>
  );
}
