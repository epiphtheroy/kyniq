import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { hasKorean, normTitle } from "@/lib/import/normalize";
import type { MatchCandidate, MatchResult } from "@/lib/import/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 25;
const POOL = 5;

type InRow = { i: number; title: string; year?: number; tmdb_id?: number; imdb_id?: string };
type TmdbMovie = { id: number; title?: string; original_title?: string; release_date?: string; poster_path: string | null; popularity?: number };

function cand(m: TmdbMovie): MatchCandidate {
  return { tmdb_id: m.id, title: m.title || m.original_title || "", year: (m.release_date || "").slice(0, 4), poster_path: m.poster_path };
}

async function tmdbGet(path: string, params: URLSearchParams): Promise<Record<string, unknown> | null> {
  const TMDB = process.env.TMDB_READ_TOKEN;
  if (!TMDB) return null;
  const v4 = TMDB.length > 40;
  if (!v4) params.set("api_key", TMDB);
  const r = await fetch(`https://api.themoviedb.org/3${path}?${params}`, {
    headers: v4 ? { Authorization: `Bearer ${TMDB}`, accept: "application/json" } : { accept: "application/json" },
  });
  return r.ok ? r.json() : null;
}

async function searchTmdb(title: string, year?: number): Promise<TmdbMovie[]> {
  const params = new URLSearchParams({ query: title, include_adult: "false", page: "1" });
  if (hasKorean(title)) { params.set("language", "ko-KR"); params.set("region", "KR"); }
  if (year) params.set("year", String(year));
  let d = await tmdbGet("/search/movie", params);
  let results = (d?.results as TmdbMovie[] | undefined) ?? [];
  if (!results.length && year) {           // retry without year constraint
    params.delete("year");
    d = await tmdbGet("/search/movie", params);
    results = (d?.results as TmdbMovie[] | undefined) ?? [];
  }
  return results;
}

async function matchOne(row: InRow): Promise<MatchResult> {
  if (row.tmdb_id) {
    return { i: row.i, status: "matched", match: { tmdb_id: row.tmdb_id, title: row.title, year: String(row.year ?? ""), poster_path: null } };
  }
  if (row.imdb_id) {
    const d = await tmdbGet(`/find/${row.imdb_id}`, new URLSearchParams({ external_source: "imdb_id" }));
    const hit = ((d?.movie_results as TmdbMovie[] | undefined) ?? [])[0];
    if (hit) return { i: row.i, status: "matched", match: cand(hit) };
  }
  if (!row.title) return { i: row.i, status: "none" };

  const results = await searchTmdb(row.title, row.year);
  if (!results.length) return { i: row.i, status: "none" };

  const nt = normTitle(row.title);
  const exact = results.filter((m) => {
    const tOk = normTitle(m.title || "") === nt || normTitle(m.original_title || "") === nt;
    const y = Number((m.release_date || "").slice(0, 4));
    const yOk = !row.year || !y || Math.abs(y - row.year) <= 1;
    return tOk && yOk;
  });
  if (exact.length === 1) return { i: row.i, status: "matched", match: cand(exact[0]) };
  if (exact.length > 1) return { i: row.i, status: "ambiguous", candidates: exact.slice(0, 5).map(cand) };
  if (results.length === 1) return { i: row.i, status: "matched", match: cand(results[0]) };
  return { i: row.i, status: "ambiguous", candidates: results.slice(0, 5).map(cand) };
}

/** Batch-match normalized rows to TMDB. Local films table first, then TMDB. */
export async function POST(req: NextRequest) {
  const ssr = await createServerClient();
  const { data: auth } = await ssr.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const body = await req.json().catch(() => null) as { rows?: InRow[] } | null;
  const rows = (body?.rows ?? []).slice(0, BATCH);
  if (!rows.length) return NextResponse.json({ error: "no rows" }, { status: 400 });

  // 1) local films pre-match by exact title (+year) — saves TMDB calls
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const titles = rows.filter((r) => !r.tmdb_id && !r.imdb_id && r.title).map((r) => r.title);
  const localByKey = new Map<string, { tmdb_id: number; title: string; year: number | null; poster_path: string | null }>();
  if (titles.length) {
    const { data } = await admin.from("films")
      .select("tmdb_id, title, original_title, year, poster_path")
      .or(titles.map((t) => `title.ilike."${t.replace(/[",]/g, "")}"`).join(","))
      .not("tmdb_id", "is", null).limit(200);
    for (const f of data ?? []) {
      for (const t of [f.title, f.original_title]) {
        if (t) localByKey.set(`${normTitle(t)}|${f.year ?? ""}`, f);
      }
    }
  }

  const pre: MatchResult[] = [];
  const remaining: InRow[] = [];
  for (const r of rows) {
    const local = r.title && r.year ? localByKey.get(`${normTitle(r.title)}|${r.year}`) : undefined;
    if (!r.tmdb_id && !r.imdb_id && local) {
      pre.push({ i: r.i, status: "matched", match: { tmdb_id: local.tmdb_id, title: local.title, year: String(local.year ?? ""), poster_path: local.poster_path } });
    } else {
      remaining.push(r);
    }
  }

  // 2) TMDB with limited concurrency
  const matched: MatchResult[] = [...pre];
  for (let p = 0; p < remaining.length; p += POOL) {
    const batch = remaining.slice(p, p + POOL);
    const res = await Promise.all(batch.map((r) => matchOne(r).catch(() => ({ i: r.i, status: "none" as const }))));
    matched.push(...res);
  }
  matched.sort((a, b) => a.i - b.i);
  return NextResponse.json({ results: matched });
}
