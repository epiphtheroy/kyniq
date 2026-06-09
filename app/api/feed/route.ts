import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/feed — cursor-based infinite scroll feed
 *
 * Query params:
 *   cursor   — ISO timestamp (published_at) for pagination; omit for first page
 *   limit    — items per page (default 10, max 30)
 *   filmId   — optional: filter to a single film
 *   exclude  — optional: question id to exclude (for "more from this film" on question page)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get("cursor");       // ISO string
  const limit  = Math.min(Number(searchParams.get("limit") || 10), 30);
  const filmId = searchParams.get("filmId");
  const excludeId = searchParams.get("exclude");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  let query = supabase
    .from("questions")
    .select(`
      id, title, slug, view_count, published_at, created_at,
      film:films!inner(id, title, year, director, director_slug, slug, poster_path),
      canonical_answers!inner(body, status)
    `)
    .eq("status", "published")
    .eq("canonical_answers.status", "published")
    .order("published_at", { ascending: false })
    .limit(limit + 1);  // +1 to detect hasMore

  if (cursor) {
    query = query.lt("published_at", cursor);
  }
  if (filmId) {
    query = query.eq("film_id", filmId);
  }
  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);

  // Collect film IDs for media lookup
  const filmIds = [...new Set(items.map((q) => {
    const film = q.film as unknown as { id: string };
    return film.id;
  }))];
  const questionIds = items.map((q) => q.id);

  // Fetch media (YouTube videos + images) for these questions
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

  // Build response
  const feedItems = items.map((q) => {
    const film = q.film as unknown as {
      id: string; title: string; year: number; director: string;
      director_slug: string | null; slug: string; poster_path: string | null;
    };

    // PostgREST 1:1 UNIQUE FK → object or array
    const rawCA = q.canonical_answers as unknown;
    const body = Array.isArray(rawCA)
      ? (rawCA[0] as { body: string })?.body
      : (rawCA as { body: string } | null)?.body;

    // Teaser: first 2-3 paragraphs, max ~400 chars
    const paragraphs = (body ?? "").split(/\n\n+/);
    let teaser = "";
    for (const p of paragraphs) {
      if (teaser.length + p.length > 400) break;
      teaser += (teaser ? "\n\n" : "") + p;
    }

    return {
      id: q.id,
      title: q.title,
      slug: q.slug,
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
      publishedAt: q.published_at ?? q.created_at,
      viewCount: q.view_count as number,
    };
  });

  const nextCursor = hasMore
    ? feedItems[feedItems.length - 1]?.publishedAt ?? null
    : null;

  return NextResponse.json({
    items: feedItems,
    nextCursor,
  });
}
