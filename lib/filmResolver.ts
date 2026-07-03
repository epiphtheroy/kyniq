/* Resolve (or lazily create) films rows by tmdb_id.
 * Extracted from /api/track so single adds and bulk imports share one path.
 * New films are Tier-2: visible=false, is_analyzed=false. */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ResolvedFilm = { id: string; slug: string | null; tmdb_id: number };

function tmdbHeaders(token: string, v4: boolean): Record<string, string> {
  return v4 ? { Authorization: `Bearer ${token}`, accept: "application/json" } : { accept: "application/json" };
}

export async function resolveFilmByTmdbId(admin: SupabaseClient, tmdb_id: number): Promise<ResolvedFilm | null> {
  const { data: existing } = await admin.from("films").select("id, slug, tmdb_id").eq("tmdb_id", tmdb_id).maybeSingle();
  if (existing) return existing as ResolvedFilm;

  const TMDB = process.env.TMDB_READ_TOKEN;
  if (!TMDB) return null;
  const v4 = TMDB.length > 40;
  const det = `https://api.themoviedb.org/3/movie/${tmdb_id}?append_to_response=credits${v4 ? "" : `&api_key=${TMDB}`}&language=en-US`;
  const r = await fetch(det, { headers: tmdbHeaders(TMDB, v4) });
  if (!r.ok) return null;
  const m = await r.json();
  const director = (m.credits?.crew || []).find((c: { job?: string }) => c.job === "Director")?.name || null;
  const row = {
    id: crypto.randomUUID(),
    tmdb_id,
    title: m.title || m.original_title || `TMDB ${tmdb_id}`,
    year: Number((m.release_date || "").slice(0, 4)) || null,
    poster_path: m.poster_path || null,
    director,
    slug: `tmdb-${tmdb_id}`,
    is_analyzed: false,
    visible: false,
  };
  const { error } = await admin.from("films").insert(row);
  if (error) {
    // lost a race — someone else inserted it
    const re = await admin.from("films").select("id, slug, tmdb_id").eq("tmdb_id", tmdb_id).maybeSingle();
    return (re.data as ResolvedFilm) ?? null;
  }
  return { id: row.id, slug: row.slug, tmdb_id };
}

/** Resolve many tmdb_ids with limited concurrency. Returns map tmdb_id → film. */
export async function resolveFilms(admin: SupabaseClient, tmdbIds: number[]): Promise<Map<number, ResolvedFilm>> {
  const ids = [...new Set(tmdbIds)];
  const out = new Map<number, ResolvedFilm>();

  const { data: existing } = await admin.from("films").select("id, slug, tmdb_id").in("tmdb_id", ids);
  for (const f of (existing ?? []) as ResolvedFilm[]) out.set(f.tmdb_id, f);

  const missing = ids.filter((id) => !out.has(id));
  const POOL = 5;
  for (let p = 0; p < missing.length; p += POOL) {
    const batch = missing.slice(p, p + POOL);
    const results = await Promise.all(batch.map((id) => resolveFilmByTmdbId(admin, id)));
    results.forEach((f, j) => { if (f) out.set(batch[j], f); });
  }
  return out;
}
