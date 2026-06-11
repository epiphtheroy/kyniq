import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import ContributionSection from "./ContributionSection";
import MediaGallery from "@/components/MediaGallery";
import ShareRow from "@/components/ShareRow";

// Force dynamic rendering — always fetch fresh data from Supabase
export const dynamic = 'force-dynamic';

function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

interface Props {
  params: Promise<{ slug: string; "question-slug": string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { "question-slug": qSlug } = await params;
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
  const { "question-slug": qSlug } = await params;
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

  // PostgREST returns a single object for 1:1 UNIQUE FK, or an array for 1:N.
  type CanonicalAnswer = {
    id: string; body: string; updated_at: string; revision_count: number;
    status: string; source: string; generated_by: string | null;
    updated_by_profile: { username: string; display_name: string } | null;
  };
  const rawCA = question.canonical_answers as unknown;
  const canonical: CanonicalAnswer | null = Array.isArray(rawCA)
    ? (rawCA[0] ?? null)
    : (rawCA as CanonicalAnswer | null);

  // Standfirst (dek) = first paragraph; body = the rest
  let standfirst = "";
  let restBody = "";
  if (canonical?.body) {
    const paragraphs = canonical.body.split(/\n\n+/);
    standfirst = paragraphs[0] || "";
    restBody = paragraphs.slice(1).join("\n\n");
  }

  const updater = canonical?.updated_by_profile;
  const isAI = canonical?.source === "ai";

  // Media for this question (hero still + videos)
  type MediaItem = {
    id: string; kind: "image" | "video"; source: "tmdb" | "youtube";
    external_id: string; url: string; thumbnail_url: string | null;
    title: string | null; attribution: string | null;
    duration: string | null; channel_name: string | null;
  };
  const { data: mediaRows } = await supabase
    .from("media")
    .select("id, kind, source, external_id, url, thumbnail_url, title, attribution, duration, channel_name")
    .eq("entity_type", "question")
    .eq("entity_id", question.id)
    .eq("status", "published")
    .order("position");

  const media = (mediaRows ?? []) as MediaItem[];
  const heroIdx = media.findIndex((m) => m.kind === "image");
  const hero = heroIdx >= 0 ? media[heroIdx] : null;
  const restMedia = media.filter((_, i) => i !== heroIdx);

  // Count questions on this film
  const { count: filmQuestionCount } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("film_id", film.id)
    .eq("status", "published");

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

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://filmcurio.com" },
      { "@type": "ListItem", position: 2, name: film.title, item: `https://filmcurio.com/film/${film.slug}` },
      { "@type": "ListItem", position: 3, name: question.title },
    ],
  };

  const dateFmt = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const words = (canonical?.body ?? "").split(/\s+/).filter(Boolean).length;
  const readMins = Math.max(1, Math.round(words / 220));
  const bodyParagraphs = restBody ? restBody.split(/\n\n+/) : [];

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

      <main className="page">
        <div className="colwrap">
          {/* ── Kicker: film | year · director ── */}
          <header className="article-head">
            <p className="kicker">
              <Link href={`/film/${film.slug}`}>{film.title}</Link>
              <span className="sep">|</span>
              <span className="topic">
                {film.year}
                {film.director ? (
                  <>
                    {" · dir. "}
                    {film.director_slug ? (
                      <Link
                        href={`/director/${film.director_slug}`}
                        style={{ color: "inherit", textDecoration: "none" }}
                      >
                        {film.director}
                      </Link>
                    ) : (
                      film.director
                    )}
                  </>
                ) : null}
              </span>
            </p>

            {/* ── Headline ── */}
            <h1 className="article-title">{question.title}</h1>

            {/* ── Dek (standfirst) ── */}
            {standfirst && <p className="article-dek">{standfirst}</p>}

            {/* ── Meta + share row ── */}
            <div className="article-metarow">
              <span>{dateFmt(question.published_at ?? question.created_at)}</span>
              <span>·</span>
              <span>{readMins} min read</span>
              {question.view_count > 0 && (
                <>
                  <span>·</span>
                  <span>{question.view_count.toLocaleString()} reads</span>
                </>
              )}
              <span className="grow" />
              <ShareRow title={question.title} />
            </div>
          </header>

          {/* ── Hero image with caption ── */}
          {hero && (
            <figure className="article-hero" style={{ margin: "18px 0 0" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hero.url ?? hero.thumbnail_url ?? ""}
                alt={hero.title ?? `Still from ${film.title}`}
                width={780}
                height={439}
              />
              <figcaption>
                {hero.title ?? `${film.title} (${film.year})`}
                {" · "}
                {hero.attribution ?? "Still via TMDB"}
              </figcaption>
            </figure>
          )}

          {/* ── The asked question, if it has a body ── */}
          {question.body && (
            <p
              className="body"
              style={{
                fontSize: 16.5,
                lineHeight: 1.6,
                marginTop: 20,
                color: "var(--muted)",
                maxWidth: "60ch",
                paddingLeft: 14,
                borderLeft: "2px solid var(--accent)",
              }}
            >
              {question.body}
              <span
                className="ui"
                style={{ display: "block", fontSize: 12, marginTop: 6, color: "var(--subtle)" }}
              >
                asked by {author?.username || "anonymous"}
              </span>
            </p>
          )}

          {/* ── Article body — drop cap, ■ end mark ── */}
          {canonical && canonical.status === "published" ? (
            <>
              <div className="article-body">
                {bodyParagraphs.length > 0 ? (
                  bodyParagraphs.map((p, i) => (
                    <p key={i} className={i === 0 ? "has-dropcap" : undefined}>
                      {p}
                      {i === bodyParagraphs.length - 1 && (
                        <span className="endmark">■</span>
                      )}
                    </p>
                  ))
                ) : (
                  <p className="has-dropcap">
                    {standfirst}
                    <span className="endmark">■</span>
                  </p>
                )}
              </div>

              <div className="article-credit">
                Last updated by{" "}
                <span style={{ color: "var(--ink)" }}>
                  {updater?.username || (isAI ? "FilmCurio Editorial" : "community")}
                </span>{" "}
                · {dateFmt(canonical.updated_at)}
                {isAI && (
                  <span style={{ display: "block", marginTop: 4, fontStyle: "italic" }}>
                    AI-written and fact-checked to FilmCurio&apos;s editorial standards.
                  </span>
                )}
              </div>

              <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                <Link href="#share-reading" className="link-primary">Share your reading</Link>
                <Link href="#suggest-edit" className="action-secondary">Suggest an edit</Link>
                {filmQuestionCount && filmQuestionCount > 1 ? (
                  <Link href={`/film/${film.slug}`} className="action-secondary">
                    {filmQuestionCount} questions on this film →
                  </Link>
                ) : null}
              </div>
            </>
          ) : (
            <p className="ui muted" style={{ fontSize: 15, fontStyle: "italic", marginTop: 24 }}>
              No canonical answer yet —{" "}
              <Link href="#share-reading" className="accent" style={{ textDecoration: "none" }}>
                share your reading
              </Link>{" "}
              to start one.
            </p>
          )}

          {/* ── Stills strip + related videos ── */}
          {restMedia.length > 0 && (
            <section className="secmod">
              <div className="secmod__head secmod__head--red">
                <h2 className="secmod__title">From the film</h2>
              </div>
              <div style={{ marginTop: 14 }}>
                <MediaGallery media={restMedia} />
              </div>
            </section>
          )}

          {/* ── Contributions ── */}
          <section className="secmod">
            <div className="secmod__head">
              <h2 className="secmod__title">Readers&apos; readings</h2>
            </div>
            <ContributionSection questionId={question.id} filmSlug={film.slug} />
          </section>

          {/* ── More interpretations ── */}
          <section className="secmod">
            <div className="secmod__head secmod__head--red">
              <h2 className="secmod__title">More interpretations</h2>
              <Link href="/" className="secmod__more">
                The latest →
              </Link>
            </div>
            <MoreFeed filmId={film.id} excludeId={question.id} />
          </section>
        </div>
      </main>
    </>
  );
}

/* --- Server helper that fetches the first page of the "more" feed --- */
import InfiniteScrollFeed from "@/components/InfiniteScrollFeed";

async function MoreFeed({ filmId, excludeId }: { filmId: string; excludeId: string }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const LIMIT = 8;
  const { data: feedRaw } = await supabase
    .from("questions")
    .select(`
      id, title, slug, view_count, published_at, created_at,
      film:films!inner(id, title, year, director, director_slug, slug, poster_path),
      canonical_answers!inner(body, status)
    `)
    .eq("status", "published")
    .eq("canonical_answers.status", "published")
    .neq("id", excludeId)
    .order("published_at", { ascending: false })
    .limit(LIMIT + 1);

  const rows = feedRaw ?? [];
  const hasMore = rows.length > LIMIT;
  const items = rows.slice(0, LIMIT);

  // Fetch media
  const questionIds = items.map((q) => q.id);
  const mediaMap = new Map<string, Array<{
    kind: string; source: string; external_id: string;
    url: string; thumbnail_url: string | null; title: string | null;
    attribution: string | null; duration: string | null; channel_name: string | null;
  }>>();

  if (questionIds.length > 0) {
    const { data: mediaRows } = await supabase
      .from("media")
      .select("entity_id, kind, source, external_id, url, thumbnail_url, title, attribution, duration, channel_name")
      .eq("entity_type", "question")
      .eq("status", "published")
      .in("entity_id", questionIds)
      .order("position");

    for (const m of mediaRows ?? []) {
      const list = mediaMap.get(m.entity_id) ?? [];
      list.push(m as typeof list[0]);
      mediaMap.set(m.entity_id, list);
    }
  }

  const feedItems = items.map((q) => {
    const film = q.film as unknown as {
      id: string; title: string; year: number; director: string;
      director_slug: string | null; slug: string; poster_path: string | null;
    };
    const rawCA = q.canonical_answers as unknown;
    const body = Array.isArray(rawCA)
      ? (rawCA[0] as { body: string })?.body
      : (rawCA as { body: string } | null)?.body;

    const paragraphs = (body ?? "").split(/\n\n+/);
    let teaser = "";
    for (const p of paragraphs) {
      if (teaser.length + p.length > 400) break;
      teaser += (teaser ? "\n\n" : "") + p;
    }

    return {
      id: q.id as string,
      title: q.title as string,
      slug: q.slug as string,
      film: {
        title: film.title,
        year: film.year,
        director: film.director,
        directorSlug: film.director_slug,
        slug: film.slug,
        posterPath: film.poster_path,
      },
      answer: body ?? "",
      answerTeaser: teaser,
      media: mediaMap.get(q.id as string) ?? [],
      publishedAt: (q.published_at ?? q.created_at) as string,
      viewCount: q.view_count as number,
    };
  });

  const nextCursor = hasMore
    ? feedItems[feedItems.length - 1]?.publishedAt ?? null
    : null;

  return (
    <InfiniteScrollFeed
      initialItems={feedItems}
      initialCursor={nextCursor}
      excludeId={excludeId}
    />
  );
}
