/* Shared commit core — resolveFilms → lossless user_watch_log → user_movies.
 * Extracted from /api/import/commit so the Connect sync path (server-side,
 * OAuth-fetched rows) writes through the EXACT same ledger logic (invariant
 * §6-4: one ledger, no shadow store). Rows must already carry a tmdb_id
 * (Trakt/TMDB/Simkl provide it natively; file imports resolve it in /match). */
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveFilms } from "@/lib/filmResolver";

export type CommitRow = {
  title: string;
  tmdb_id: number;
  year?: number;
  rating?: number; // 0.5–5
  watched_at?: string; // YYYY-MM-DD
  note?: string;
  tags?: string[];
  rewatch?: boolean;
  to_watchlist?: boolean;
  raw?: Record<string, unknown>;
};

export type CommitStats = {
  added: number;
  updated: number;
  logged: number;
  skipped_dupes: number;
  failed: number;
};

/** Commit a batch of tmdb-resolved rows for one user under one source label.
 * Idempotent on (tmdb_id, watched_at, source) — safe to re-run for sync diffs. */
export async function commitNormalizedRows(
  admin: SupabaseClient,
  userId: string,
  rows: CommitRow[],
  source: string,
  opts: { jobId?: string | null; overwrite?: boolean } = {},
): Promise<{ jobId: string | null; stats: CommitStats }> {
  const clean = rows.filter((r) => r?.tmdb_id && r?.title);
  const stats: CommitStats = { added: 0, updated: 0, logged: 0, skipped_dupes: 0, failed: 0 };
  if (!clean.length) return { jobId: opts.jobId ?? null, stats };

  // import job (created on first chunk, reused after)
  let jobId = opts.jobId ?? null;
  if (!jobId) {
    const { data: job } = await admin
      .from("user_import_jobs")
      .insert({ user_id: userId, source, filename: null })
      .select("id")
      .single();
    jobId = (job?.id as string) ?? null;
  }

  const films = await resolveFilms(admin, clean.map((r) => r.tmdb_id));
  const failed = clean.filter((r) => !films.has(r.tmdb_id)).map((r) => r.title);
  stats.failed = failed.length;
  const ok = clean.filter((r) => films.has(r.tmdb_id));

  // 1) lossless log — skip exact duplicates from previous imports/syncs.
  // Scope the dedup read to THIS source, and page past the PostgREST 1000-row
  // cap: a full re-sync of a large library would otherwise read only the first
  // 1000 existing keys and re-insert everything beyond them as duplicates every
  // day. Query in ≤200-id chunks (URL length) with a .range() page inside each.
  const okIds = [...new Set(ok.map((r) => r.tmdb_id))];
  const dupeKeys = new Set<string>();
  for (let i = 0; i < okIds.length; i += 200) {
    const idChunk = okIds.slice(i, i + 200);
    for (let from = 0; from < 100000; from += 1000) {
      const { data, error } = await admin
        .from("user_watch_log")
        .select("tmdb_id, watched_at, source")
        .eq("user_id", userId)
        .eq("source", source)
        .in("tmdb_id", idChunk)
        .range(from, from + 999);
      if (error || !data) break;
      for (const d of data) dupeKeys.add(`${d.tmdb_id}|${d.watched_at ?? ""}|${d.source}`);
      if (data.length < 1000) break;
    }
  }
  const logRows = ok
    .filter((r) => !dupeKeys.has(`${r.tmdb_id}|${r.watched_at ?? ""}|${source}`))
    .map((r) => ({
      user_id: userId,
      film_id: films.get(r.tmdb_id)!.id,
      tmdb_id: r.tmdb_id,
      title_raw: r.title,
      year_raw: r.year ?? null,
      rating: r.rating ?? null,
      watched_at: r.watched_at ?? null,
      note: r.note ?? null,
      tags: r.tags?.length ? r.tags : null,
      rewatch: r.rewatch ?? null,
      source,
      import_job_id: jobId,
      raw: r.raw ?? {},
    }));
  if (logRows.length) {
    const { error } = await admin.from("user_watch_log").insert(logRows);
    if (!error) stats.logged = logRows.length;
  }
  stats.skipped_dupes = ok.length - stats.logged;

  // 2) aggregate into user_movies (one row per film — current state)
  type Agg = { film_id: string; rating?: number; watched_at?: string; note?: string; seen: boolean; watchlist: boolean };
  const agg = new Map<string, Agg>();
  for (const r of ok) {
    const film = films.get(r.tmdb_id)!;
    const a = agg.get(film.id) ?? { film_id: film.id, seen: false, watchlist: false };
    if (r.to_watchlist) a.watchlist = true;
    else {
      a.seen = true;
      if (r.watched_at && (!a.watched_at || r.watched_at > a.watched_at)) {
        a.watched_at = r.watched_at;
        if (r.rating != null) a.rating = r.rating;
        if (r.note) a.note = r.note;
      }
      if (a.rating == null && r.rating != null) a.rating = r.rating;
      if (!a.watched_at && r.watched_at) a.watched_at = r.watched_at;
      if (!a.note && r.note) a.note = r.note;
    }
    agg.set(film.id, a);
  }

  const filmIds = [...agg.keys()];
  const { data: existingRows } = await admin
    .from("user_movies")
    .select("film_id, rating, watched_at, note, seen, watchlist")
    .eq("user_id", userId)
    .in("film_id", filmIds);
  const existing = new Map((existingRows ?? []).map((e) => [e.film_id as string, e]));

  const overwrite = !!opts.overwrite;
  const upserts = filmIds.map((fid) => {
    const a = agg.get(fid)!;
    const ex = existing.get(fid);
    if (ex) stats.updated++;
    else stats.added++;
    const keep = <T,>(imported: T | undefined | null, current: T | undefined | null): T | null =>
      overwrite ? (imported ?? current ?? null) : (current ?? imported ?? null);
    return {
      user_id: userId,
      film_id: fid,
      seen: (ex?.seen ?? false) || a.seen,
      watchlist: a.seen ? (ex?.watchlist ?? false) : ((ex?.watchlist ?? false) || a.watchlist),
      rating: keep(a.rating, ex?.rating as number | null),
      watched_at: keep(a.watched_at, ex?.watched_at as string | null),
      note: keep(a.note, ex?.note as string | null),
    };
  });
  if (upserts.length) {
    await admin.from("user_movies").upsert(upserts, { onConflict: "user_id,film_id" });
  }

  // accumulate stats on the job row
  if (jobId) {
    const { data: jobRow } = await admin.from("user_import_jobs").select("stats").eq("id", jobId).single();
    const s = (jobRow?.stats ?? {}) as Record<string, number>;
    await admin.from("user_import_jobs").update({
      stats: {
        added: (s.added ?? 0) + stats.added,
        updated: (s.updated ?? 0) + stats.updated,
        logged: (s.logged ?? 0) + stats.logged,
        failed: (s.failed ?? 0) + stats.failed,
      },
    }).eq("id", jobId);
  }

  return { jobId, stats };
}
