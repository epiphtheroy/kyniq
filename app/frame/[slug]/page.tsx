import { createClient } from "@supabase/supabase-js";
import EntityTVHero from "@/components/EntityTVHero";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import HubExplore from "@/components/HubExplore";
import QuickAnswers, { type QuickAnswerItem } from "@/components/read/QuickAnswers";
import ShareDock from "@/components/ShareDock";

// One grammatical, linked enumeration of films for the Quick-answers block
// (never a bare keyword list, charter §0.6).
function FilmList({ films }: { films: { slug: string; title: string; year: number | null }[] }) {
  return (
    <>
      {films.map((f, i) => (
        <span key={f.slug}>
          {i > 0 ? (i === films.length - 1 ? " and " : ", ") : ""}
          <Link href={`/film/${f.slug}`}>{f.title}</Link>{f.year != null ? ` (${f.year})` : ""}
        </span>
      ))}
    </>
  );
}

/**
 * Frame hub — "one of cinema's big questions" (site-ia-plan.md §4.3).
 * Header (label/definition) → editorial ranking (spoiler-free rationales,
 * masked titles) → for-writers craft block → JSON-LD ItemList.
 * Only `approved` frames are visible (RLS); gate publishes at ≥5 instances.
 */

// ISR: edge-cached, background-refreshed (was force-dynamic).
export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}

function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

interface Props {
  params: Promise<{ slug: string }>;
}

interface SlotDef {
  name: string;
  values?: string[];
}

interface Instance {
  questionId: string;
  title: string;
  displayTitle: string | null;
  spoilerLevel: string | null;
  slug: string;
  viewCount: number;
  film: { title: string; year: number | null; slug: string; director: string | null };
  slots: Record<string, string>;
  aha: string | null;
  rank: number;
  rationale: string | null;
}

async function getFrame(slug: string) {
  const supabase = supabaseAnon();
  const { data: frame } = await supabase
    .from("frames")
    .select("id, slug, label, definition, dimension, slot_schema")
    .eq("slug", slug)
    .eq("status", "approved")
    .single();
  if (!frame) return null;

  // Instances + rankings in parallel (independent once the frame is known)
  const [{ data: qfRows }, { data: rankRows }] = await Promise.all([
    supabase
      .from("question_frames")
      .select(`
        slots,
        question:questions!inner(id, title, display_title, spoiler_level, slug, view_count, status,
          film:films!inner(title, year, slug, director),
          canonical_answers(aha, status))
      `)
      .eq("frame_id", frame.id)
      .eq("is_primary", true)
      .eq("question.status", "published"),
    supabase
      .from("frame_rankings")
      .select("question_id, rank, rationale")
      .eq("frame_id", frame.id),
  ]);

  const rankMap = new Map<string, { rank: number; rationale: string | null }>(
    (rankRows ?? []).map((r) => [
      r.question_id as string,
      { rank: r.rank as number, rationale: (r.rationale as string | null) ?? null },
    ])
  );

  const instances: Instance[] = (qfRows ?? []).map((r) => {
    const q = r.question as unknown as {
      id: string; title: string; display_title: string | null; spoiler_level: string | null;
      slug: string; view_count: number;
      film: { title: string; year: number | null; slug: string; director: string | null };
      canonical_answers: { aha: string | null; status: string }[] | { aha: string | null; status: string } | null;
    };
    const rawCA = q.canonical_answers;
    const ca = Array.isArray(rawCA) ? rawCA[0] : rawCA;
    const rk = rankMap.get(q.id);
    return {
      questionId: q.id,
      title: q.title,
      displayTitle: q.display_title,
      spoilerLevel: q.spoiler_level,
      slug: q.slug,
      viewCount: q.view_count,
      film: q.film,
      slots: (r.slots ?? {}) as Record<string, string>,
      aha: ca?.status === "published" ? ca.aha : null,
      rank: rk?.rank ?? 999,
      rationale: rk?.rationale ?? null,
    };
  });
  instances.sort((a, b) => a.rank - b.rank);

  return { frame, instances };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getFrame(slug);
  if (!data) return { title: "Not found" };
  return {
    title: `${data.frame.label} — ${data.instances.length} films, ranked`,
    description: `${data.frame.definition ?? ""} The films where this question matters most, ranked and answered on Metatake.`,
    alternates: { canonical: `/frame/${slug}` },
  };
}

export default async function FramePage({ params }: Props) {
  const { slug } = await params;
  const data = await getFrame(slug);
  if (!data || data.instances.length === 0) notFound();
  const { frame, instances } = data;

  // craft block: slot value distribution + spoiler-safe insights
  const slotSchema = (frame.slot_schema ?? []) as SlotDef[];
  const slotCounts = new Map<string, Map<string, number>>();
  for (const inst of instances) {
    for (const [k, v] of Object.entries(inst.slots)) {
      if (!v) continue;
      const m = slotCounts.get(k) ?? new Map<string, number>();
      m.set(v, (m.get(v) ?? 0) + 1);
      slotCounts.set(k, m);
    }
  }
  const safeInsights = instances
    .filter((i) => i.spoilerLevel === "none" && i.aha)
    .slice(0, 3);

  // ── Quick answers (docs/PLAN-intent-coverage.md §0 charter + §5.7/§5.8) ─────
  // frame.label is ITSELF a question ("How does the film subvert genre tropes?"),
  // so the noun-phrase templates ("What is X?") would be ungrammatical — instead
  // the primary Q is the label verbatim, and the supporting Qs say "this
  // question" (the label sits directly above them, as the H1). Grammar invariant
  // (§0.6-②). frame HAS a real ranking (rank + rationale), so the rank-1 "best"
  // answer is legitimately allowed here (§5.8). Every title/year is from the
  // instance rows; a verbatim definition/rationale is a quote, not woven
  // phrasing, so it is exempt from the variant tally. Authored variants:
  // "film(s)" Q2 + Q3 (2), "explore" Q2 (1) — each ≤2.
  const frameQA: QuickAnswerItem[] = [];
  const labelQ = /[?？]\s*$/.test(frame.label) ? frame.label.trim() : `${frame.label.trim()}?`;
  const frDef = (frame.definition ?? "").trim();
  if (frDef) frameQA.push({ q: labelQ, a: frDef });
  if (instances.length > 0) {
    const exploreFilms = instances.slice(0, 4).map((i) => ({ slug: i.film.slug, title: i.film.title, year: i.film.year }));
    frameQA.push({
      q: `Which films explore this question?`,
      a: <>Metatake ranks <FilmList films={exploreFilms} /> among the defining cases.</>,
    });
  }
  const best = instances.find((i) => i.rank === 1);
  if (best) {
    const rationale = (best.rationale ?? "").trim();
    frameQA.push({
      q: `Which film best answers this question?`,
      a: (
        <>
          <Link href={`/film/${best.film.slug}`}>{best.film.title}</Link>
          {best.film.year != null ? ` (${best.film.year})` : ""}
          {rationale ? <> — {/[.!?]$/.test(rationale) ? rationale : `${rationale}.`}</> : "."}
        </>
      ),
    });
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: frame.label,
    description: frame.definition,
    numberOfItems: instances.length,
    itemListElement: instances.map((i, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: `${i.film.title}${i.film.year ? ` (${i.film.year})` : ""}`,
      url: `https://metatake.net/film/${i.film.slug}/q/${i.slug}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="page">
        <div className="colwrap">
          <EntityTVHero reelSlugs={[...new Set(instances.map((i) => i.film.slug))]} label={frame.label} backdrop={null} />
          {/* ── Header ── */}
          <header className="article-head">
            <p className="kicker">
              <span>The big questions</span>
              <span className="sep">|</span>
              <span className="topic">{frame.dimension}</span>
            </p>
            <h1 className="article-title">{frame.label}</h1>
            <div className="rd-share" style={{ marginTop: 12 }}>
              <ShareDock variant="bar" path={`/frame/${slug}`} title={frame.label} hook={frame.definition ?? undefined} />
              <ShareDock variant="fab" path={`/frame/${slug}`} title={frame.label} hook={frame.definition ?? undefined} />
            </div>
            {frame.definition && <p className="article-dek">{frame.definition}</p>}
            <div className="article-metarow">
              <span>{instances.length} films carry this question</span>
              <span>·</span>
              <span>ranked by Metatake AI</span>
            </div>
            <QuickAnswers items={frameQA.slice(0, 5)} />
          </header>

          {/* ── The ranking ── */}
          <section className="secmod" style={{ marginTop: 26 }}>
            <div className="secmod__head secmod__head--red">
              <h2 className="secmod__title">The defining cases, ranked</h2>
            </div>
            <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {instances.map((inst, idx) => (
                <li
                  key={inst.questionId}
                  style={{
                    display: "flex",
                    gap: 18,
                    padding: "18px 0",
                    borderBottom: "1px solid var(--hairline)",
                  }}
                >
                  <span
                    className="disp"
                    style={{
                      fontSize: 30,
                      lineHeight: 1,
                      color: idx < 3 ? "var(--accent)" : "var(--subtle)",
                      minWidth: 44,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p className="kicker" style={{ marginBottom: 4 }}>
                      <Link href={`/film/${inst.film.slug}`}>{inst.film.title}</Link>
                      <span className="sep">|</span>
                      <span className="topic">
                        {inst.film.year}
                        {inst.film.director ? ` · ${inst.film.director}` : ""}
                      </span>
                    </p>
                    <h3 className="story__title" style={{ margin: 0 }}>
                      <Link href={`/film/${inst.film.slug}/q/${inst.slug}`}>
                        {inst.displayTitle || inst.title}
                      </Link>{" "}
                      {inst.spoilerLevel === "major" && (
                        <span className="spoiler-chip" title="The full answer discusses the ending">
                          <span aria-hidden="true">🍿</span> Ending inside
                        </span>
                      )}
                    </h3>
                    {inst.rationale && (
                      <p
                        className="dek"
                        style={{ marginTop: 5, fontStyle: "italic" }}
                      >
                        {inst.rationale}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* ── For writers (#craft) ── */}
          {(slotCounts.size > 0 || safeInsights.length > 0) && (
            <section className="secmod" id="craft">
              <div className="secmod__head">
                <h2 className="secmod__title">How the films play it — for writers</h2>
              </div>
              {[...slotCounts.entries()].map(([slot, values]) => (
                <div key={slot} style={{ marginTop: 12 }}>
                  <div className="seclbl">{slot.replace(/_/g, " ")}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    {[...values.entries()]
                      .sort((a, b) => b[1] - a[1])
                      .map(([v, n]) => (
                        <span
                          key={v}
                          className="ui"
                          style={{
                            fontSize: 12.5,
                            border: "1px solid var(--hairline-2)",
                            borderRadius: 999,
                            padding: "4px 12px",
                            color: "var(--ink-soft)",
                          }}
                        >
                          {v} <span style={{ color: "var(--subtle)" }}>×{n}</span>
                        </span>
                      ))}
                  </div>
                </div>
              ))}
              {slotSchema.length > 0 && slotCounts.size === 0 && (
                <p className="dek" style={{ marginTop: 10 }}>
                  Choice axes for this beat:{" "}
                  {slotSchema.map((s) => s.name.replace(/_/g, " ")).join(" · ")}
                </p>
              )}
              {safeInsights.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div className="seclbl">What makes it work (spoiler-free)</div>
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                    {safeInsights.map((i) => (
                      <li key={i.questionId} className="dek" style={{ marginBottom: 6 }}>
                        <strong>{i.film.title}:</strong> {i.aha}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* ── Footer link back ── */}
          <p className="ui muted" style={{ fontSize: 13, marginTop: 28 }}>
            One of cinema&apos;s recurring questions, catalogued by Metatake —{" "}
            <Link href="/" className="accent" style={{ textDecoration: "none" }}>
              the latest interpretations →
            </Link>
          </p>
          <HubExplore kind="frame" slug={slug} />
        </div>
      </main>
    </>
  );
}
