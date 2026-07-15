/**
 * GET /api/v1/films/{slug} — full public film record: metadata, TakeScore
 * breakdown, critical readings, figures, tropes, kindred films. Reuses
 * film_context_pack (the single pack source) so the API never drifts from
 * copy / download / MCP. Authless, rate-guarded, CC BY-NC 4.0 with attribution.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAndLog, API_CORS, TOO_MANY } from "@/lib/apiGuard";
import { shapeFilm } from "@/lib/apiv1";
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

  if (await guardAndLog(db, req, "film", slug)) {
    return NextResponse.json(TOO_MANY, { status: 429, headers: API_CORS });
  }

  const { data, error } = await db.rpc("film_context_pack", { p_slug: slug, p_tier: "full" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: API_CORS });
  if (!data) return NextResponse.json({ error: `No film found for slug "${slug}". Try GET /api/v1/films?q=...` }, { status: 404, headers: API_CORS });

  const pack = data as FilmPack;
  return NextResponse.json(shapeFilm(pack), {
    headers: { ...API_CORS, "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
