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
    .select("id, title, slug, created_at, view_count, canonical_answers(id, body)")
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
    .select("id, title, slug, view_count")
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
      // Extract first ~200 chars as TL;DR teaser
      const teaser =
        answer.body.length > 200
          ? answer.body.slice(0, 200).replace(/\s+\S*$/, "") + "…"
          : answer.body;
      return { ...q, teaser };
    }
  }

  return null;
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

      <hr className="rule" style={{ marginTop: "22px" }} />

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
            const answerTeaser = hasAnswer
              ? (Array.isArray(q.canonical_answers) ? q.canonical_answers[0]?.body : (q.canonical_answers as unknown as { body: string })?.body)
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
                    {q.title}
                  </Link>
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
    </article>
  );
}
