/**
 * GET /api/v1/films?q=&year=&limit=  — search Metatake's corpus (public, authless).
 * Returns compact matches with slug, year, director, TakeScore, and film URL.
 * Backs the Custom GPT Action, the browser extension, and any REST consumer.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callerPrefix, harvestBlocked, API_CORS, TOO_MANY } from "@/lib/apiGuard";
import { filmUrl } from "@/lib/apiv1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: API_CORS });
}

type FilmRow = { slug: string; title: string; original_title: string | null; year: number | null; director: string | null; is_analyzed: boolean | null };

export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") || u.searchParams.get("query") || "").trim().replace(/[,()%*]/g, " ").slice(0, 80);
  const yearRaw = u.searchParams.get("year");
  const year = yearRaw && /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : null;
  const limit = Math.min(Math.max(Number(u.searchParams.get("limit")) || 10, 1), 25);

  if (!q) {
    return NextResponse.json({ error: "Missing ?q= (film title, original title, or director)." }, { status: 400, headers: API_CORS });
  }

  const db = createAdminClient();
  const { prefix, trusted } = callerPrefix(req);
  if (await harvestBlocked(db, prefix, trusted)) {
    return NextResponse.json(TOO_MANY, { status: 429, headers: API_CORS });
  }

  const { data, error } = await db.rpc("films_basic_search", { p_q: q, p_year: year });
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: API_CORS });
  const films = (Array.isArray(data) ? data : []).slice(0, limit) as FilmRow[];

  // Attach TakeScores in one bulk call (best-effort).
  const ts = new Map<string, number>();
  if (films.length) {
    try {
      const { data: rows } = await db.rpc("takescore_for_slugs", { p_slugs: films.map((f) => f.slug) });
      for (const r of Array.isArray(rows) ? rows : []) {
        const rec = r as Record<string, unknown>;
        if (typeof rec.slug === "string" && typeof rec.ts === "number") ts.set(rec.slug, rec.ts);
      }
    } catch { /* scores optional */ }
  }

  return NextResponse.json(
    {
      query: q,
      count: films.length,
      films: films.map((f) => ({
        slug: f.slug,
        title: f.title,
        original_title: f.original_title,
        year: f.year,
        director: f.director,
        takescore: ts.get(f.slug) ?? null,
        analyzed: f.is_analyzed === true,
        url: filmUrl(f.slug),
      })),
      license: "CC BY-NC 4.0 (attribution required)",
      docs: "https://metatake.net/api",
    },
    { headers: { ...API_CORS, "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
  );
}
