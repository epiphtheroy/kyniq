import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { posterUrl } from "@/lib/tmdb";
import ContributionSection from "./ContributionSection";

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
  const { slug, "question-slug": qSlug } = await params;
  const supabase = supabaseAnon();

  const { data: question } = await supabase
    .from("questions")
    .select("title, films!inner(title)")
    .eq("slug", qSlug)
    .eq("status", "published")
    .single();

  if (!question) return { title: "Question not found" };

  const film = question.films as unknown as { title: string };
  return {
    title: `${question.title} — ${film.title} | Kyniq`,
    description: `Read interpretations of "${question.title}" about ${film.title} on Kyniq.`,
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
      film:films!inner(id, title, year, director, slug, poster_path, imdb_id, wikidata_id),
      canonical_answers(id, body, updated_at, revision_count, status, source, generated_by,
        updated_by_profile:profiles!canonical_answers_updated_by_fkey(username, display_name)
      )
    `)
    .eq("slug", qSlug)
    .eq("status", "published")
    .single();

  if (error || !question) notFound();

  const film = question.film as unknown as {
    id: string; title: string; year: number; director: string;
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

  // JSON-LD QAPage (M7 — built ahead)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "QAPage",
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
            name: isAI ? "Kyniq Editorial" : (updater?.display_name || "Community"),
          },
        },
      }),
    },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://kyniq.io" },
      { "@type": "ListItem", position: 2, name: film.title, item: `https://kyniq.io/film/${film.slug}` },
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

      <main className="shell">
        {/* Film context strip */}
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <Link href={`/film/${film.slug}`}>
            {film.poster_path ? (
              <img
                src={posterUrl(film.poster_path, "w185")!}
                alt={film.title}
                style={{ width: 34, height: 48, borderRadius: 4, objectFit: "cover" }}
              />
            ) : (
              <div className="poster" style={{ width: 34, height: 48 }} />
            )}
          </Link>
          <Link href={`/film/${film.slug}`} className="ui muted" style={{ fontSize: 13, lineHeight: 1.5, textDecoration: "none" }}>
            {film.title} <span style={{ opacity: 0.6 }}>({film.year})</span>
            <br />
            <span style={{ fontSize: 12 }}>dir. {film.director}</span>
          </Link>
        </div>

        <hr className="rule" />

        {/* Question title */}
        <h1 className="disp" style={{ fontSize: 30, margin: 0 }}>{question.title}</h1>
        <div className="credit" style={{ marginTop: 10 }}>
          asked by {author?.username || "anonymous"} · {timeAgo(question.created_at)}
          {question.question_type && (
            <span> · <span style={{ textTransform: "capitalize" }}>{question.question_type}</span></span>
          )}
        </div>

        {question.body && (
          <p className="body reading" style={{ fontSize: 16, marginTop: 12, color: "var(--muted)" }}>
            {question.body}
          </p>
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
                {updater?.username || (isAI ? "Kyniq Editorial" : "community")}
              </span>
              {" "}· {timeAgo(canonical.updated_at)} · read by {question.view_count.toLocaleString()}
            </div>

            {isAI && (
              <div className="ui muted" style={{ fontSize: 11.5, marginTop: 8, fontStyle: "italic" }}>
                Drafted with AI, reviewed by the Kyniq editorial team.
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
      </main>
    </>
  );
}
