import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import InfiniteScrollFeed from "@/components/InfiniteScrollFeed";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FilmCurio — Film Q&A Community",
  description:
    "Read films closely. A cabinet of cinema's curiosities — a global film Q&A community.",
  openGraph: {
    title: "FilmCurio — Film Q&A Community",
    description:
      "Read films closely. A cabinet of cinema's curiosities — a global film Q&A community.",
    url: "https://filmcurio.com",
    siteName: "FilmCurio",
    images: [
      {
        url: "https://filmcurio.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "FilmCurio — Film Q&A Community",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FilmCurio — Film Q&A Community",
    description:
      "Read films closely. A cabinet of cinema's curiosities — a global film Q&A community.",
    images: ["https://filmcurio.com/og-image.png"],
  },
};

function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export default async function HomePage() {
  const supabase = supabaseAnon();

  // Stats
  const { count: totalQuestions } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");

  const { count: totalFilms } = await supabase
    .from("films")
    .select("id", { count: "exact", head: true });

  // SSR: first page of feed (10 items)
  const LIMIT = 10;
  const { data: feedRaw } = await supabase
    .from("questions")
    .select(`
      id, title, slug, view_count, published_at, created_at,
      film:films!inner(id, title, year, director, director_slug, slug, poster_path),
      canonical_answers!inner(body, status)
    `)
    .eq("status", "published")
    .eq("canonical_answers.status", "published")
    .order("published_at", { ascending: false })
    .limit(LIMIT + 1);

  const rows = feedRaw ?? [];
  const hasMore = rows.length > LIMIT;
  const items = rows.slice(0, LIMIT);

  // Fetch media for initial items
  const questionIds = items.map((q) => q.id);
  let mediaMap = new Map<string, Array<{
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

  // Transform to feed items
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

  // Browse index — tally films & directors from published questions
  const { data: idxRaw } = await supabase
    .from("questions")
    .select(`film:films!inner(title, slug, director, director_slug)`)
    .eq("status", "published")
    .limit(500);

  const filmTally = new Map<string, { title: string; slug: string; count: number }>();
  const dirTally = new Map<string, { name: string; slug: string; count: number }>();
  for (const row of idxRaw ?? []) {
    const f = row.film as unknown as {
      title: string; slug: string; director: string | null; director_slug: string | null;
    };
    if (f?.slug) {
      const e = filmTally.get(f.slug) ?? { title: f.title, slug: f.slug, count: 0 };
      e.count += 1;
      filmTally.set(f.slug, e);
    }
    if (f?.director && f?.director_slug) {
      const e = dirTally.get(f.director_slug) ?? { name: f.director, slug: f.director_slug, count: 0 };
      e.count += 1;
      dirTally.set(f.director_slug, e);
    }
  }
  const topFilms = [...filmTally.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  const topDirectors = [...dirTally.values()].sort((a, b) => b.count - a.count).slice(0, 6);

  return (
    <main className="home-main">
      {/* Masthead */}
      <div style={{ paddingBottom: 4 }}>
        <h1
          className="disp"
          style={{
            fontSize: 40,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            margin: "0 0 14px",
          }}
        >
          Read films closely.
        </h1>
        <p
          className="body"
          style={{
            fontSize: 17,
            lineHeight: 1.6,
            color: "var(--muted)",
            margin: 0,
            maxWidth: "54ch",
          }}
        >
          A cabinet of cinema&apos;s curiosities. One question about one film,
          answered at the depth a single paragraph can&apos;t replace — written
          to be read, and to be cited.
        </p>
        <p
          className="ui"
          style={{ margin: "16px 0 0", fontSize: 13.5, color: "var(--subtle)" }}
        >
          <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
            {totalQuestions ?? 0}
          </strong>{" "}
          interpretations across{" "}
          <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
            {totalFilms ?? 0}
          </strong>{" "}
          films · updated daily
        </p>
      </div>

      <hr className="rule" style={{ margin: "28px 0 8px" }} />

      <div className="home-cols">
        {/* Feed */}
        <div>
          <div
            className="seclbl"
            style={{ paddingBottom: 10, marginBottom: 2, borderBottom: "1px solid var(--hairline)" }}
          >
            <span
              style={{
                display: "inline-block",
                width: 26,
                borderTop: "2px solid var(--accent)",
                verticalAlign: "middle",
                marginRight: 8,
              }}
            />
            Latest readings
          </div>
          <InfiniteScrollFeed initialItems={feedItems} initialCursor={nextCursor} />
        </div>

        {/* Browse rail — text index */}
        <aside className="home-rail">
          {topFilms.length > 0 && (
            <div className="block">
              <div className="rlabel">Browse by film</div>
              <ul>
                {topFilms.map((f) => (
                  <li key={f.slug}>
                    <Link href={`/film/${f.slug}`}>{f.title}</Link>
                    <span className="c">{f.count}</span>
                  </li>
                ))}
                <li>
                  <Link href="/film">All films →</Link>
                </li>
              </ul>
            </div>
          )}

          {topDirectors.length > 0 && (
            <div className="block">
              <div className="rlabel">Browse by director</div>
              <ul>
                {topDirectors.map((d) => (
                  <li key={d.slug}>
                    <Link href={`/director/${d.slug}`}>{d.name}</Link>
                  </li>
                ))}
                <li>
                  <Link href="/director">All directors →</Link>
                </li>
              </ul>
            </div>
          )}

          <div className="block">
            <div className="rlabel">About</div>
            <p className="note">
              Interpretations are AI-written and fact-checked to FilmCurio&apos;s editorial
              standards, with human oversight by sampling.{" "}
              <Link href="/about">How it works →</Link>
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
