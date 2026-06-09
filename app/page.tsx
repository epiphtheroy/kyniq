import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
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

  return (
    <main className="shell">
      {/* Stats bar */}
      <div
        style={{
          display: "flex",
          gap: 24,
          marginBottom: 4,
          fontSize: 12.5,
          color: "var(--muted)",
          fontFamily: "var(--font-ui)",
        }}
      >
        <span>
          <strong style={{ color: "var(--ink)", fontSize: 16 }}>
            {totalQuestions ?? 0}
          </strong>{" "}
          interpretations
        </span>
        <span>
          <strong style={{ color: "var(--ink)", fontSize: 16 }}>
            {totalFilms ?? 0}
          </strong>{" "}
          films
        </span>
      </div>

      <hr className="rule" />

      {/* Infinite scroll feed */}
      <InfiniteScrollFeed
        initialItems={feedItems}
        initialCursor={nextCursor}
      />
    </main>
  );
}
