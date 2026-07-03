import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/film-clip?slug=<film-slug> → the film's primary YouTube clip.
// Feeds the Atlas floating mini-player: when a film is selected on the map we
// autoplay its clip in the corner. Same media the film hero reel uses — clips
// first (title not "trailer/teaser"), trailer last — so the corner plays a
// scene, not the trailer, exactly like the home "Surprise me" hero.
const isTrailerTitle = (t: string | null) => !!t && /trailer|teaser/i.test(t);

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: film } = await db.from("films").select("id, title, year").eq("slug", slug).maybeSingle();
  if (!film) return NextResponse.json({ clip: null });

  const { data: rows } = await db.from("media")
    .select("external_id, title, thumbnail_url")
    .eq("entity_type", "film").eq("entity_id", film.id).eq("status", "published")
    .eq("kind", "video").eq("source", "youtube").order("position");

  const vids = (rows ?? []).sort((a, b) => (isTrailerTitle(a.title) ? 1 : 0) - (isTrailerTitle(b.title) ? 1 : 0));
  const first = vids[0] ?? null;

  return NextResponse.json(
    {
      clip: first?.external_id ?? null,
      clip_title: first?.title ?? null,
      poster: first?.thumbnail_url ?? null,
      title: film.title,
      year: film.year ?? null,
    },
    { headers: { "cache-control": "public, max-age=300, s-maxage=600, stale-while-revalidate=3600" } }
  );
}
