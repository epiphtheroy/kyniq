import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getFilmBySlug, posterUrl } from "@/lib/tmdb";
import { createClient } from "@supabase/supabase-js";

// Force dynamic rendering — always fetch fresh data from Supabase
export const dynamic = 'force-dynamic';

/** Anon Supabase client for public reads (safe at build time — no cookies needed) */
function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ── Metadata ─────────────────────────────────────────────────────

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const film = await getFilmBySlug(slug);
  if (!film) return {};

  const title = `${film.title} (${film.year}) — Interpretations & Analysis`;
  const description =
    film.overview ??
    `Read community interpretations and analysis of ${film.title}.`;
  const poster = posterUrl(film.poster_path, "w500");

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      ...(poster && {
        images: [{ url: poster, width: 500, height: 750, alt: film.title }],
      }),
    },
  };
}

// ── Published questions query ─────────────────────────────────────

interface QuestionRow {
  id: string;
  title: string;
  display_title: string | null;
  spoiler_level: string | null;
  safe_hook: string | null;
  slug: string;
  created_at: string;
  view_count: number;
  canonical_answers: { id: string; body: string }[];
  _contribution_count?: number;
}

async function getPublishedQuestions(
  filmId: string,
  sort: "discussed" | "newest" = "discussed"
): Promise<QuestionRow[]> {
  const supabase = supabaseAnon();

  let query = supabase
    .from("questions")
    .select("id, title, display_title, spoiler_level, safe_hook, slug, created_at, view_count, canonical_answers(id, body)")
    .eq("film_id", filmId)
    .eq("status", "published");

  if (sort === "newest") {
    query = query.order("created_at", { ascending: false });
  } else {
    query = query.order("view_count", { ascending: false });
  }

  const { data } = await query.limit(50);
  return (data as QuestionRow[]) ?? [];
}

// Get contribution counts for questions
async function getContributionCounts(
  questionIds: string[]
): Promise<Record<string, number>> {
  if (questionIds.length === 0) return {};

  const supabase = supabaseAnon();
  const counts: Record<string, number> = {};

  for (const qId of questionIds) {
    const { count } = await supabase
      .from("contributions")
      .select("id", { count: "exact", head: true })
      .eq("question_id", qId)
      .eq("status", "published");
    counts[qId] = count ?? 0;
  }

  return counts;
}

// Get the "most-read" question: most views with a canonical answer
async function getMostReadQuestion(filmId: string) {
  const supabase = supabaseAnon();

  // Get top question by views that has a published canonical answer
  const { data: questions } = await supabase
    .from("questions")
    .select("id, title, display_title, spoiler_level, safe_hook, slug, view_count")
    .eq("film_id", filmId)
    .eq("status", "published")
    .order("view_count", { ascending: false })
    .limit(5);

  if (!questions || questions.length === 0) return null;

  for (const q of questions) {
    const { data: answer } = await supabase
      .from("canonical_answers")
      .select("body")
      .eq("question_id", q.id)
      .eq("status", "published")
      .single();

    if (answer) {
      // Extract first ~200 chars as TL;DR teaser.
      // Spoiler guard: major answers open on the ending — use the safe hook.
      const teaserSource =
        q.spoiler_level === "major" ? (q.safe_hook ?? "") : answer.body;
      const teaser =
        teaserSource.length > 200
          ? teaserSource.slice(0, 200).replace(/\s+\S*$/, "") + "…"
          : teaserSource;
      return { ...q, title: q.display_title || q.title, teaser };
    }
  }

  return null;
}

// ── Film features (fixed hub sections, film-features-plan.md) ────

interface PitchPayload {
  assets: { title: string; body: string }[];
  hwadu?: string;
}
interface RecordPayload {
  premiere?: string | null; budget?: string | null; box_office?: string | null;
  awards?: string[]; production_notes?: string[]; strategic_significance?: string | null;
}
interface ReceptionPayload {
  at_release?: string | null; turning_point?: string | null; today?: string | null;
}
interface ExperiencePayload {
  level: number; label: string; rationale?: string; comparables?: string[];
}

async function getFilmFeatures(filmId: string) {
  const supabase = supabaseAnon();
  const { data } = await supabase
    .from("film_features")
    .select("kind, body, payload")
    .eq("film_id", filmId)
    .eq("status", "published");
  const map = new Map<string, { body: string | null; payload: unknown }>();
  for (const r of data ?? []) map.set(r.kind as string, { body: r.body, payload: r.payload });
  return {
    pitch: map.get("pitch") as { body: string | null; payload: PitchPayload } | undefined,
    record: map.get("record") as { body: string | null; payload: RecordPayload } | undefined,
    reception: map.get("reception") as { body: string | null; payload: ReceptionPayload } | undefined,
    experience: map.get("experience") as { body: string | null; payload: ExperiencePayload } | undefined,
  };
}

async function getFilmFrames(filmId: string) {
  const supabase = supabaseAnon();
  const { data } = await supabase
    .from("question_frames")
    .select("frame:frames!inner(id, slug, label), question:questions!inner(film_id, status)")
    .eq("question.film_id", filmId)
    .eq("question.status", "published")
    .eq("is_primary", true);
  const seen = new Map<string, { slug: string; label: string }>();
  for (const r of data ?? []) {
    const f = r.frame as unknown as { id: string; slug: string; label: string };
    if (f && !seen.has(f.id)) seen.set(f.id, { slug: f.slug, label: f.label });
  }
  return [...seen.values()];
}

// ── Page ──────────────────────────────────────────────────────────

export default async function FilmPage({ params }: PageProps) {
  const { slug } = await params;
  const film = await getFilmBySlug(slug);
  if (!film) notFound();

  const questions = await getPublishedQuestions(film.id);
  const contributionCounts = await getContributionCounts(
    questions.map((q) => q.id)
  );
  const mostRead = await getMostReadQuestion(film.id);
  const features = await getFilmFeatures(film.id);
  const filmFrames = await getFilmFrames(film.id);
  const hasPreviewZone = !!(features.pitch || features.record || features.experience);

  return (
    <article className="shell">
      {/* Breadcrumb */}
      <nav
        className="ui muted"
        style={{ fontSize: "12px", marginBottom: "16px" }}
        aria-label="Breadcrumb"
      >
        <Link
          href="/"
          style={{ color: "inherit", textDecoration: "none" }}
        >
          Home
        </Link>
        {" › "}
        <span>Films</span>
      </nav>

      {/* Film header — text only */}
      <h1
        className="disp"
        style={{ fontSize: "32px", margin: 0, lineHeight: "1.18" }}
      >
        {film.title}
      </h1>
      <div className="ui muted" style={{ fontSize: "13px", marginTop: "7px" }}>
        {film.year} · dir. {film.director ?? "Unknown"} ·{" "}
        {questions.length} question{questions.length !== 1 ? "s" : ""}
      </div>
      {film.overview && (
        <p
          className="body"
          style={{
            fontSize: "17px",
            lineHeight: "1.6",
            margin: "14px 0 0",
            maxWidth: "60ch",
            color: "var(--ink-soft)",
          }}
        >
          {film.overview}
        </p>
      )}

      {/* ════ PREVIEW ZONE — safe before watching (spoiler-zero contract) ════ */}

      {features.pitch && (
        <section style={{ marginTop: 26 }}>
          <div className="seclbl">Why watch — no spoilers</div>
          <div className="tick" />
          {(features.pitch.payload.assets ?? []).map((a, i) => (
            <div key={i} style={{ marginTop: i === 0 ? 10 : 16 }}>
              <h3 className="disp" style={{ fontSize: 17, margin: 0 }}>{a.title}</h3>
              <p className="body" style={{ fontSize: 15.5, lineHeight: 1.6, margin: "5px 0 0", maxWidth: "62ch", color: "var(--ink-soft)" }}>
                {a.body}
              </p>
            </div>
          ))}
          {features.pitch.body && (
            <p className="body" style={{ fontSize: 16, lineHeight: 1.65, margin: "18px 0 0", maxWidth: "62ch", paddingLeft: 14, borderLeft: "2px solid var(--accent)" }}>
              {features.pitch.body}
            </p>
          )}
        </section>
      )}

      {features.experience && (
        <section style={{ marginTop: 26 }}>
          <div className="seclbl">The experience</div>
          <div className="tick" />
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
            <span className="disp" style={{ fontSize: 30, color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>
              {features.experience.payload.level}<span style={{ fontSize: 16, color: "var(--subtle)" }}>/10</span>
            </span>
            <span className="disp" style={{ fontSize: 18 }}>{features.experience.payload.label}</span>
          </div>
          {features.experience.payload.rationale && (
            <p className="body" style={{ fontSize: 15, lineHeight: 1.6, margin: "8px 0 0", maxWidth: "62ch", color: "var(--muted)" }}>
              {features.experience.payload.rationale}
            </p>
          )}
          {(features.experience.payload.comparables ?? []).length > 0 && (
            <p className="ui" style={{ fontSize: 13, marginTop: 10, color: "var(--ink-soft)" }}>
              A similar intensity: {(features.experience.payload.comparables ?? []).join(" · ")}
            </p>
          )}
        </section>
      )}

      {features.record && (
        <section style={{ marginTop: 26 }}>
          <div className="seclbl">The record</div>
          <div className="tick" />
          <dl style={{ margin: "10px 0 0", display: "grid", gridTemplateColumns: "max-content 1fr", gap: "7px 18px", fontSize: 14.5 }}>
            {([
              ["Premiere", features.record.payload.premiere],
              ["Budget", features.record.payload.budget],
              ["Box office", features.record.payload.box_office],
            ] as const).map(([k, v]) =>
              v ? (
                <div key={k} style={{ display: "contents" }}>
                  <dt className="ui" style={{ color: "var(--muted)" }}>{k}</dt>
                  <dd className="body" style={{ margin: 0, color: "var(--ink-soft)" }}>{v}</dd>
                </div>
              ) : null
            )}
            {(features.record.payload.awards ?? []).length > 0 && (
              <div style={{ display: "contents" }}>
                <dt className="ui" style={{ color: "var(--muted)" }}>Awards</dt>
                <dd className="body" style={{ margin: 0, color: "var(--ink-soft)" }}>
                  {(features.record.payload.awards ?? []).join(" · ")}
                </dd>
              </div>
            )}
          </dl>
          {(features.record.payload.production_notes ?? []).length > 0 && (
            <ul style={{ margin: "12px 0 0", paddingLeft: 18, maxWidth: "62ch" }}>
              {(features.record.payload.production_notes ?? []).map((n, i) => (
                <li key={i} className="body" style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--ink-soft)", marginBottom: 4 }}>{n}</li>
              ))}
            </ul>
          )}
          {features.record.payload.strategic_significance && (
            <p className="body" style={{ fontSize: 14.5, lineHeight: 1.6, margin: "12px 0 0", maxWidth: "62ch", color: "var(--muted)", fontStyle: "italic" }}>
              {features.record.payload.strategic_significance}
            </p>
          )}
        </section>
      )}

      {/* ════ SPOILER BOUNDARY ════ */}
      {hasPreviewZone && (
        <div className="spoiler-banner" role="note" style={{ marginTop: 30 }}>
          <span aria-hidden="true">🎬</span>
          <span className="spoiler-banner__label">
            Below this line: interpretations. Endings are discussed.
          </span>
        </div>
      )}

      {features.reception && (
        <section style={{ marginTop: 26 }}>
          <div className="seclbl">The reception — then and now</div>
          <div className="tick" />
          <p className="body" style={{ fontSize: 15.5, lineHeight: 1.65, margin: "10px 0 0", maxWidth: "62ch", color: "var(--ink-soft)" }}>
            {features.reception.body}
          </p>
        </section>
      )}

      <hr className="rule" style={{ marginTop: "26px" }} />

      {/* Most-read interpretation */}
      <div className="seclbl">Most-read interpretation</div>
      <div className="tick" />

      {mostRead ? (
        <>
          <div className="disp" style={{ fontSize: "18px" }}>
            <Link
              href={`/film/${slug}/q/${mostRead.slug}`}
              style={{ color: "inherit", textDecoration: "none" }}
            >
              {mostRead.title}
            </Link>
          </div>
          <p
            className="body"
            style={{
              fontSize: "16px",
              lineHeight: "1.6",
              color: "var(--muted)",
              margin: "5px 0 0",
              maxWidth: "62ch",
            }}
          >
            {mostRead.teaser}{" "}
            <Link
              href={`/film/${slug}/q/${mostRead.slug}`}
              className="ui accent"
              style={{
                fontSize: "12.5px",
                textDecoration: "none",
              }}
            >
              read the full reading ▸
            </Link>
          </p>
        </>
      ) : (
        <p
          className="body muted"
          style={{ fontSize: "16px", lineHeight: "1.6" }}
        >
          No interpretations yet — be the first to share a reading.
        </p>
      )}

      {/* CTA */}
      <div style={{ margin: "22px 0" }}>
        <Link href={`/ask?film=${slug}`} className="btn">
          Ask a question about this film
        </Link>
      </div>

      <hr className="rule" />

      {/* All questions */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <div className="seclbl">All questions</div>
        <div className="ui" style={{ fontSize: "12.5px" }}>
          <span className="tab active">Most discussed</span>
          &nbsp;·&nbsp;
          <span className="tab">Newest</span>
        </div>
      </div>

      <div style={{ marginTop: "8px" }}>
        {questions.length > 0 ? (
          questions.map((q) => {
            const count = contributionCounts[q.id] ?? 0;
            const hasAnswer = Array.isArray(q.canonical_answers) ? q.canonical_answers.length > 0 : !!q.canonical_answers;
            // Spoiler guard: major answers open on the ending — preview the
            // spoiler-free hook instead of the answer body.
            const answerTeaser = hasAnswer
              ? (q.spoiler_level === "major"
                  ? q.safe_hook
                  : (Array.isArray(q.canonical_answers) ? q.canonical_answers[0]?.body : (q.canonical_answers as unknown as { body: string })?.body))
              : null;
            const teaser = answerTeaser && answerTeaser.length > 120
              ? answerTeaser.slice(0, 120).replace(/\s+\S*$/, "") + "…"
              : answerTeaser;
            return (
              <div key={q.id} className="qrow">
                <div className="disp" style={{ fontSize: "17px" }}>
                  <Link
                    href={`/film/${slug}/q/${q.slug}`}
                    style={{
                      color: "inherit",
                      textDecoration: "none",
                    }}
                  >
                    {q.display_title || q.title}
                  </Link>
                  {q.spoiler_level === "major" && (
                    <>
                      {" "}
                      <span className="spoiler-chip" title="The full answer discusses the ending">
                        <span aria-hidden="true">🍿</span> Ending inside
                      </span>
                    </>
                  )}
                </div>
                {teaser && (
                  <p
                    className="body"
                    style={{
                      fontSize: "14.5px",
                      lineHeight: "1.55",
                      color: "var(--muted)",
                      margin: "4px 0 0",
                      maxWidth: "60ch",
                    }}
                  >
                    {teaser}{" "}
                    <Link
                      href={`/film/${slug}/q/${q.slug}`}
                      className="ui accent"
                      style={{ fontSize: "12px", textDecoration: "none" }}
                    >
                      read more ▸
                    </Link>
                  </p>
                )}
                <span
                  className="ui muted"
                  style={{
                    fontSize: "12px",
                    whiteSpace: "nowrap",
                    marginTop: "4px",
                    display: "block",
                  }}
                >
                  {hasAnswer ? "answered" : "awaiting answer"}
                  {count > 0 && (
                    <> · {count} reading{count !== 1 ? "s" : ""}</>
                  )}
                </span>
              </div>
            );
          })
        ) : (
          <p
            className="body muted"
            style={{
              fontSize: "15px",
              lineHeight: "1.6",
              padding: "16px 0",
            }}
          >
            No questions yet about this film. Be the first to ask
            something.
          </p>
        )}
      </div>

      {/* ── Where this film sits — the big questions it belongs to ── */}
      {filmFrames.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <div className="seclbl">Where this film sits</div>
          <div className="tick" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {filmFrames.map((f) => (
              <Link
                key={f.slug}
                href={`/frame/${f.slug}`}
                className="ui"
                style={{
                  fontSize: 13,
                  border: "1px solid var(--hairline-2)",
                  borderRadius: 999,
                  padding: "5px 13px",
                  color: "var(--ink-soft)",
                  textDecoration: "none",
                }}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
