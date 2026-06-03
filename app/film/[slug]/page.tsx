import { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getFilmBySlug, posterUrl } from "@/lib/tmdb";
import { createClient } from "@supabase/supabase-js";

// Dynamic SSR with ISR revalidation at runtime
export const revalidate = 60;

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
  _contribution_count?: number;
}

async function getPublishedQuestions(
  filmId: string,
  sort: "discussed" | "newest" = "discussed"
): Promise<QuestionRow[]> {
  const supabase = supabaseAnon();

  let query = supabase
    .from("questions")
    .select("id, title, slug, created_at, view_count")
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

  const poster = posterUrl(film.poster_path);
  const questions = await getPublishedQuestions(film.id);
  const contributionCounts = await getContributionCounts(
    questions.map((q) => q.id)
  );
  const mostRead = await getMostReadQuestion(film.id);

  // Fetch backdrop media for hero
  const { data: filmMedia } = supabaseAnon()
    .from("media")
    .select("url, thumbnail_url, caption, attribution")
    .eq("entity_type", "film")
    .eq("entity_id", film.id)
    .eq("kind", "image")
    .eq("status", "published")
    .order("position")
    .limit(1);
  const backdropUrl = (await filmMedia)?.at(0)?.url ?? null;

  return (
    <article>
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

      {/* Backdrop hero */}
      {backdropUrl && (
        <div
          style={{
            position: "relative",
            width: "100%",
            height: 200,
            marginBottom: 20,
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <img
            src={backdropUrl}
            alt={`${film.title} backdrop`}
            loading="lazy"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(transparent 40%, var(--bg) 100%)",
            }}
          />
        </div>
      )}

      {/* Film header — poster + title + meta + synopsis */}
      <div
        style={{
          display: "flex",
          gap: "20px",
          alignItems: "flex-start",
        }}
      >
        {/* Poster */}
        <div
          className="poster"
          style={{
            width: "90px",
            height: "128px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {poster && (
            <Image
              src={poster}
              alt={`${film.title} poster`}
              fill
              sizes="90px"
              style={{
                objectFit: "cover",
                filter: "saturate(0.7)",
                borderRadius: "4px",
              }}
              priority
            />
          )}
        </div>

        <div style={{ flex: 1 }}>
          <h1
            className="disp"
            style={{ fontSize: "30px", margin: 0, lineHeight: "1.18" }}
          >
            {film.title}
          </h1>
          <div
            className="ui muted"
            style={{ fontSize: "13px", marginTop: "6px" }}
          >
            {film.year} · dir. {film.director ?? "Unknown"} ·{" "}
            {questions.length} question{questions.length !== 1 ? "s" : ""}
          </div>
          {film.overview && (
            <p
              className="body"
              style={{
                fontSize: "16.5px",
                lineHeight: "1.6",
                margin: "12px 0 0",
                maxWidth: "60ch",
              }}
            >
              {film.overview}
            </p>
          )}
        </div>
      </div>

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
                <span
                  className="ui muted"
                  style={{
                    fontSize: "12px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {count > 0 ? (
                    <>
                      answered · {count} reading
                      {count !== 1 ? "s" : ""}
                    </>
                  ) : (
                    <Link
                      href={`/film/${slug}/q/${q.slug}`}
                      className="ui accent"
                      style={{
                        fontSize: "12px",
                        whiteSpace: "nowrap",
                        textDecoration: "none",
                      }}
                    >
                      no reading yet ▸
                    </Link>
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
