import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { posterUrl } from "@/lib/tmdb";
import ContributionSection from "./ContributionSection";
import MediaGallery from "@/components/MediaGallery";
import RelatedQuestions from "@/components/RelatedQuestions";

// ISR: revalidate every 60 seconds so new answers appear promptly
export const revalidate = 60;

function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const POSTER_BASE = "https://image.tmdb.org/t/p";

interface Props {
  params: Promise<{ slug: string; "question-slug": string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, "question-slug": qSlug } = await params;
  const supabase = supabaseAnon();

  const { data: question } = await supabase
    .from("questions")
    .select("title, films!inner(title, year)")
    .eq("slug", qSlug)
    .eq("status", "published")
    .single();

  if (!question) return { title: "Question not found" };

  const film = question.films as unknown as { title: string; year?: number };
  const yearStr = film.year ? ` (${film.year})` : "";
  return {
    title: `${question.title} — ${film.title}${yearStr}`,
    description: `Read interpretations of "${question.title}" about ${film.title}${yearStr} on FilmCurio.`,
  };
}

export default async function QuestionPage({ params }: Props) {
  const { slug, "question-slug": qSlug } = await params;
  const supabase = supabaseAnon();

  // Fetch question + film + canonical answer
  const { data: question, error } = await supabase
    .from("questions")
    .select(`
      id, title, body, slug, question_type, view_count, created_at, published_at,
      author:profiles!questions_author_id_fkey(username, display_name),
      film:films!inner(id, title, year, director, director_slug, slug, poster_path, imdb_id, wikidata_id),
      canonical_answers(id, body, updated_at, revision_count, status, source, generated_by,
        updated_by_profile:profiles!canonical_answers_updated_by_fkey(username, display_name)
      )
    `)
    .eq("slug", qSlug)
    .eq("status", "published")
    .single();

  if (error || !question) notFound();

  const film = question.film as unknown as {
    id: string; title: string; year: number; director: string; director_slug: string | null;
    slug: string; poster_path: string | null; imdb_id: string | null; wikidata_id: string | null;
  };

  const author = question.author as unknown as { username: string; display_name: string } | null;
  const canonicalArr = question.canonical_answers as unknown as Array<{
    id: string; body: string; updated_at: string; revision_count: number;
    status: string; source: string; generated_by: string | null;
    updated_by_profile: { username: string; display_name: string } | null;
  }>;
  const canonical = canonicalArr?.[0] ?? null;

  // TL;DR extraction: first paragraph as standfirst
  let standfirst = "";
  let restBody = "";
  if (canonical?.body) {
    const paragraphs = canonical.body.split(/\n\n+/);
    standfirst = paragraphs[0] || "";
    restBody = paragraphs.slice(1).join("\n\n");
  }

  const updater = canonical?.updated_by_profile;
  const isAI = canonical?.source === "ai";

  // Fetch backdrop image for the film banner
  const { data: backdropMedia } = await supabase
    .from("media")
    .select("url")
    .eq("entity_type", "film")
    .eq("entity_id", film.id)
    .eq("kind", "image")
    .eq("status", "published")
    .order("position")
    .limit(1)
    .single();

  const backdropUrl = backdropMedia?.url ?? null;

  // Count questions on this film
  const { count: filmQuestionCount } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("film_id", film.id)
    .eq("status", "published");

  // Fetch published media for this question
  const { data: mediaRows } = await supabase
    .from("media")
    .select("id, kind, source, external_id, url, thumbnail_url, title, attribution, duration, channel_name")
    .eq("entity_type", "question")
    .eq("entity_id", question.id)
    .eq("status", "published")
    .order("position");

  // JSON-LD QAPage with about → Movie (§8.2 film-entity recognition)
  const sameAsLinks = [
    film.imdb_id ? `https://www.imdb.com/title/${film.imdb_id}/` : null,
    film.wikidata_id ? `https://www.wikidata.org/wiki/${film.wikidata_id}` : null,
  ].filter(Boolean);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "QAPage",
    about: {
      "@type": "Movie",
      name: film.title,
      ...(film.year && { dateCreated: String(film.year) }),
      ...(film.director && {
        director: { "@type": "Person", name: film.director },
      }),
      url: `https://filmcurio.com/film/${film.slug}`,
      ...(sameAsLinks.length > 0 && { sameAs: sameAsLinks }),
    },
    mainEntity: {
      "@type": "Question",
      name: question.title,
      text: question.body || question.title,
      dateCreated: question.created_at,
      answerCount: canonical ? 1 : 0,
      ...(canonical && {
        acceptedAnswer: {
          "@type": "Answer",
          text: canonical.body.slice(0, 500),
          dateModified: canonical.updated_at,
          author: {
            "@type": isAI ? "Organization" : "Person",
            name: isAI ? "FilmCurio Editorial" : (updater?.display_name || "Community"),
          },
        },
      }),
    },
  };

  // ImageObject / VideoObject JSON-LD for media (§8 GEO)
  const mediaLd = (mediaRows ?? []).map((m) => {
    if (m.kind === "image") {
      return {
        "@context": "https://schema.org",
        "@type": "ImageObject",
        contentUrl: m.url,
        thumbnailUrl: m.thumbnail_url,
        caption: m.title ?? `Image for ${question.title}`,
        creditText: m.attribution ?? "TMDB",
      };
    }
    return {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: m.title ?? question.title,
      thumbnailUrl: m.thumbnail_url,
      embedUrl: m.url,
      uploadDate: question.created_at,
    };
  });

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://filmcurio.com" },
      { "@type": "ListItem", position: 2, name: film.title, item: `https://filmcurio.com/film/${film.slug}` },
      { "@type": "ListItem", position: 3, name: question.title },
    ],
  };

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const days = Math.floor(diff / 86400000);
    if (days < 1) return "today";
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {mediaLd.map((ld, i) => (
        <script
          key={`media-ld-${i}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      ))}

      {/* ── D1: Big Film Banner ── */}
      <div className="film-banner">
        {backdropUrl ? (
          <img src={backdropUrl} alt={film.title} className="film-banner__bg" loading="eager" fetchPriority="high" />
        ) : (
          <div className="film-banner__bg" style={{ background: "var(--ink)" }} />
        )}
        <div className="film-banner__overlay" />
        <div className="film-banner__content">
          <Link href={`/film/${film.slug}`}>
            {film.poster_path ? (
              <img
                src={posterUrl(film.poster_path, "w185")!}
                alt={film.title}
                className="film-banner__poster"
              />
            ) : (
              <div className="poster film-banner__poster" />
            )}
          </Link>
          <div className="film-banner__info">
            <h2 className="film-banner__title">
              <Link href={`/film/${film.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                {film.title}
              </Link>
              {" "}
              <span style={{ fontWeight: 400, fontSize: 18, opacity: 0.7 }}>({film.year})</span>
            </h2>
            <div className="film-banner__meta">
              dir.{" "}
              {film.director_slug ? (
                <Link href={`/director/${film.director_slug}`}>{film.director}</Link>
              ) : (
                film.director
              )}
            </div>
            {filmQuestionCount && filmQuestionCount > 1 && (
              <div className="film-banner__qcount">
                <Link href={`/film/${film.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                  ▸ {filmQuestionCount} questions on this film
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="shell" style={{ paddingTop: 0 }}>
        {/* ── D2: Breadcrumb ── */}
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span className="breadcrumb__sep">›</span>
          <Link href={`/film/${film.slug}`}>{film.title}</Link>
          <span className="breadcrumb__sep">›</span>
          <span style={{ color: "var(--ink)" }}>{question.title.length > 60 ? question.title.slice(0, 57) + "…" : question.title}</span>
        </nav>

        {/* ── Desktop: sticky layout wrapper ── */}
        <div className="sticky-layout">
          {/* ── Main column ── */}
          <div>
            {/* Question title */}
            <h1 className="disp" style={{ fontSize: 30, margin: 0 }}>{question.title}</h1>
            <div className="credit" style={{ marginTop: 10 }}>
              asked by {author?.username || "anonymous"} · {timeAgo(question.created_at)}
            </div>

            {question.body && (
              <p className="body reading" style={{ fontSize: 16, marginTop: 12, color: "var(--muted)" }}>
                {question.body}
              </p>
            )}

            {/* Media gallery */}
            {mediaRows && mediaRows.length > 0 && (
              <div style={{ margin: "1.5rem 0" }}>
                <MediaGallery media={mediaRows as Array<{ id: string; kind: "image" | "video"; source: "tmdb" | "youtube"; external_id: string; url: string; thumbnail_url: string | null; title: string | null; attribution: string | null; duration?: string | null; channel_name?: string | null }>} />
              </div>
            )}

            <hr className="rule" />

            {/* Canonical answer */}
            {canonical && canonical.status === "published" ? (
              <>
                <div className="seclbl">The reading</div>
                <div className="tick" />

                {standfirst && (
                  <p className="standfirst" style={{ margin: "0 0 16px" }}>{standfirst}</p>
                )}

                {restBody && (
                  <div className="body reading" style={{ fontSize: 18, margin: 0 }}>
                    {restBody.split(/\n\n+/).map((p, i) => (
                      <p key={i} style={{ margin: i === 0 ? 0 : "14px 0 0" }}>{p}</p>
                    ))}
                  </div>
                )}

                <div className="credit" style={{ marginTop: 18 }}>
                  Last updated by{" "}
                  <span style={{ color: "var(--ink)" }}>
                    {updater?.username || (isAI ? "FilmCurio Editorial" : "community")}
                  </span>
                  {" "}· {timeAgo(canonical.updated_at)} · read by {question.view_count.toLocaleString()}
                </div>

                {isAI && (
                  <div className="ui muted" style={{ fontSize: 11.5, marginTop: 8, fontStyle: "italic" }}>
                    AI-written and fact-checked to FilmCurio&apos;s editorial standards.
                  </div>
                )}

                <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                  <Link href="#share-reading" className="link-primary">Share your reading</Link>
                  <Link href="#suggest-edit" className="action-secondary">Suggest an edit</Link>
                </div>
              </>
            ) : (
              <>
                <div className="seclbl">The reading</div>
                <div className="tick" />
                <p className="ui muted" style={{ fontSize: 15, fontStyle: "italic" }}>
                  No canonical answer yet — <Link href="#share-reading" className="accent" style={{ textDecoration: "none" }}>share your reading</Link> to start one.
                </p>
              </>
            )}

            <hr className="rule" style={{ marginTop: 26 }} />

            {/* Contributions section (client component) */}
            <ContributionSection questionId={question.id} filmSlug={film.slug} />
          </div>

          {/* ── Sticky rail (desktop only via CSS) ── */}
          <aside className="sticky-rail">
            {/* Film context card */}
            <div className="related-box" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Link href={`/film/${film.slug}`}>
                  {film.poster_path ? (
                    <img
                      src={`${POSTER_BASE}/w92${film.poster_path}`}
                      alt={film.title}
                      style={{ width: 48, height: 72, borderRadius: 3, objectFit: "cover" }}
                    />
                  ) : (
                    <div className="poster" style={{ width: 48, height: 72 }} />
                  )}
                </Link>
                <div>
                  <Link href={`/film/${film.slug}`} className="disp" style={{ fontSize: 15, textDecoration: "none", color: "var(--ink)" }}>
                    {film.title}
                  </Link>
                  <div className="ui muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {film.year} · {film.director}
                  </div>
                  {filmQuestionCount && filmQuestionCount > 0 && (
                    <Link
                      href={`/film/${film.slug}`}
                      className="ui"
                      style={{ fontSize: 11.5, color: "var(--accent)", textDecoration: "none", display: "block", marginTop: 4 }}
                    >
                      {filmQuestionCount} question{filmQuestionCount > 1 ? "s" : ""} →
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Related questions in rail */}
            <RelatedQuestions
              currentQuestionId={question.id}
              filmId={film.id}
              filmTitle={film.title}
              filmSlug={film.slug}
              director={film.director}
              directorSlug={film.director_slug}
            />
          </aside>
        </div>

        {/* ── Mobile: Related questions below (hidden on desktop via CSS) ── */}
        <div className="mobile-related" style={{ marginTop: 24 }}>
          <style>{`
            @media (min-width: 900px) {
              .mobile-related { display: none; }
            }
          `}</style>
          <RelatedQuestions
            currentQuestionId={question.id}
            filmId={film.id}
            filmTitle={film.title}
            filmSlug={film.slug}
            director={film.director}
            directorSlug={film.director_slug}
          />
        </div>
      </main>
    </>
  );
}
