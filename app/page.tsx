import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import InfiniteScrollFeed from "@/components/InfiniteScrollFeed";

// ISR: edge-cached, refreshed in the background (was force-dynamic —
// every visitor paid full SSR + sequential DB round trips).
export const revalidate = 60;

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

function editionDate(): string {
  const d = new Date();
  const day = d.getDate();
  const suffix =
    day % 10 === 1 && day !== 11 ? "st"
    : day % 10 === 2 && day !== 12 ? "nd"
    : day % 10 === 3 && day !== 13 ? "rd"
    : "th";
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long" });
  const month = d.toLocaleDateString("en-GB", { month: "long" });
  return `${weekday} ${month} ${day}${suffix} ${d.getFullYear()}`;
}

export default async function HomePage() {
  const supabase = supabaseAnon();

  // Stats + first feed page — independent queries fired in parallel
  // (was 3 sequential round trips)
  const LIMIT = 10;
  const [
    { count: totalQuestions },
    { count: totalFilms },
    { data: feedRaw },
  ] = await Promise.all([
    supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
    supabase.from("films").select("id", { count: "exact", head: true }),
    supabase
      .from("questions")
      .select(`
        id, title, display_title, spoiler_level, safe_hook, slug, view_count, published_at, created_at,
        film:films!inner(id, title, year, director, director_slug, slug, poster_path),
        canonical_answers!inner(body, status)
      `)
      .eq("status", "published")
      .eq("canonical_answers.status", "published")
      .order("published_at", { ascending: false })
      .limit(LIMIT + 1),
  ]);

  const rows = feedRaw ?? [];
  const hasMore = rows.length > LIMIT;
  const items = rows.slice(0, LIMIT);

  // Fetch media for initial items
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
      displayTitle: (q.display_title as string | null) ?? null,
      spoilerLevel: (q.spoiler_level as string | null) ?? null,
      safeHook: (q.safe_hook as string | null) ?? null,
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

  // "In brief" digest — the next headlines after the lead
  const briefItems = feedItems.slice(1, 5);

  return (
    <main className="page">
      {/* ── Edition line ── */}
      <div className="edition">
        <span className="edition__date">{editionDate()}</span>
        <span className="edition__tag">Read films closely</span>
      </div>

      <div className="home-grid">
        {/* ── Main column: lead story + story rows ── */}
        <div className="home-grid__main">
          <InfiniteScrollFeed
            initialItems={feedItems}
            initialCursor={nextCursor}
            lead
          />
        </div>

        {/* ── Secondary column ── */}
        <aside>
          {/* Dark digest module ≈ "The world in brief" */}
          <section className="brief">
            <p className="brief__label">FilmCurio in brief</p>
            <h2 className="brief__title">
              {totalQuestions ?? 0} interpretations across {totalFilms ?? 0} films
            </h2>
            <p className="brief__sub">
              One question about one film, answered at depth — updated daily.
            </p>
            {briefItems.map((b) => (
              <Link
                key={b.id}
                href={`/film/${b.film.slug}/q/${b.slug}`}
                className="brief__item"
              >
                {b.title}
                <span className="f">
                  {b.film.title} ({b.film.year})
                </span>
              </Link>
            ))}
            <Link href="/ask" className="brief__cta">
              Ask your own question →
            </Link>
          </section>

          {/* Section module: films */}
          {topFilms.length > 0 && (
            <section className="secmod">
              <div className="secmod__head secmod__head--red">
                <h2 className="secmod__title">Most-read films</h2>
                <Link href="/film" className="secmod__more">
                  All films →
                </Link>
              </div>
              {topFilms.map((f) => (
                <Link key={f.slug} href={`/film/${f.slug}`} className="idxrow">
                  <span className="idxrow__t">{f.title}</span>
                  <span className="idxrow__c">{f.count}</span>
                </Link>
              ))}
            </section>
          )}

          {/* Section module: directors */}
          {topDirectors.length > 0 && (
            <section className="secmod">
              <div className="secmod__head secmod__head--red">
                <h2 className="secmod__title">Directors</h2>
                <Link href="/director" className="secmod__more">
                  All directors →
                </Link>
              </div>
              {topDirectors.map((d) => (
                <Link key={d.slug} href={`/director/${d.slug}`} className="idxrow">
                  <span className="idxrow__t">{d.name}</span>
                </Link>
              ))}
            </section>
          )}

          {/* About note */}
          <section className="secmod">
            <div className="secmod__head">
              <h2 className="secmod__title">About FilmCurio</h2>
            </div>
            <p
              className="ui"
              style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--muted)", margin: "10px 0 0" }}
            >
              A cabinet of cinema&apos;s curiosities. Interpretations are AI-written
              and fact-checked to FilmCurio&apos;s editorial standards, with human
              oversight by sampling.{" "}
              <Link href="/about" style={{ color: "var(--accent-text)" }}>
                How it works →
              </Link>
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
