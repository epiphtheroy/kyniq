import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAndLog, API_CORS, TOO_MANY } from "@/lib/apiGuard";

/**
 * Mobile BFF — TMDB search fallback (HANDOFF-모바일앱-프리워치.md §5.3).
 * The app's no-result dead-end killer: when a film isn't in the Metatake canon,
 * show TMDB title/year/poster with "Not in the canon yet". Proxied here so the
 * TMDB token stays server-side. Mirrors the lib/read-media.ts token idiom.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: API_CORS });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").replace(/[%*]/g, "").trim().slice(0, 80);
  if (!q) {
    return NextResponse.json({ error: "missing_q" }, { status: 400, headers: API_CORS });
  }

  const db = createAdminClient();
  if (await guardAndLog(db, req, "app_tmdb_search", q)) {
    return NextResponse.json(TOO_MANY, { status: 429, headers: API_CORS });
  }

  const token = process.env.TMDB_READ_TOKEN;
  if (!token) {
    return NextResponse.json({ v: 1, results: [] }, { headers: API_CORS });
  }

  try {
    const useBearer = token.length > 40;
    const base = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(q)}&include_adult=false&language=en-US&page=1`;
    const tmdbUrl = useBearer ? base : `${base}&api_key=${token}`;
    const res = await fetch(tmdbUrl, {
      headers: useBearer ? { authorization: `Bearer ${token}` } : undefined,
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`tmdb_${res.status}`);
    const json = (await res.json()) as {
      results?: { id: number; title: string; release_date?: string; poster_path?: string | null }[];
    };
    const results = (json.results ?? []).slice(0, 10).map((r) => ({
      tmdb_id: r.id,
      title: r.title,
      year: r.release_date ? parseInt(r.release_date.slice(0, 4), 10) || null : null,
      poster_path: r.poster_path ?? null,
    }));
    return NextResponse.json(
      { v: 1, results },
      { headers: { ...API_CORS, "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "tmdb_failed" },
      { status: 500, headers: API_CORS },
    );
  }
}
