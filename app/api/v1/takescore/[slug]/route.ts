/**
 * GET /api/v1/takescore/{slug} — just the 13-dimension TakeScore assessment:
 * net score + Value / Cost / Risk + per-dimension breakdown. Lean sibling of
 * /api/v1/films/{slug} for badge / widget / quick-lookup callers.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAndLog, API_CORS, TOO_MANY } from "@/lib/apiGuard";
import { shapeTakeScore, filmUrl, citeAs, LICENSE } from "@/lib/apiv1";
import type { FilmPack } from "@/lib/pack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: API_CORS });
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = createAdminClient();

  if (await guardAndLog(db, req, "takescore", slug)) {
    return NextResponse.json(TOO_MANY, { status: 429, headers: API_CORS });
  }

  const { data, error } = await db.rpc("film_context_pack", { p_slug: slug, p_tier: "full" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: API_CORS });
  if (!data) return NextResponse.json({ error: `No film found for slug "${slug}".` }, { status: 404, headers: API_CORS });

  const pack = data as FilmPack;
  const ts = shapeTakeScore(pack);
  if (!ts) return NextResponse.json({ error: `No TakeScore for "${slug}" yet.` }, { status: 404, headers: API_CORS });

  return NextResponse.json(
    {
      slug: pack.film.slug,
      title: pack.film.title,
      year: pack.film.year ?? null,
      ...ts,
      scale: "Value = what the film delivers (higher better) · Cost = prior knowledge demanded · Risk = how it can fail as art (higher worse). Net TakeScore blends them.",
      url: filmUrl(pack.film.slug),
      methodology: "https://metatake.net/methodology#rankings",
      license: LICENSE,
      cite_as: citeAs(pack),
    },
    { headers: { ...API_CORS, "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800" } }
  );
}
