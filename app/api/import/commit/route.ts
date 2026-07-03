import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { resolveFilms } from "@/lib/filmResolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 50;

type CommitRow = {
  tmdb_id: number;
  title: string;
  year?: number;
  rating?: number;
  watched_at?: string;
  note?: string;
  tags?: string[];
  rewatch?: boolean;
  to_watchlist?: boolean;
  raw?: Record<string, unknown>;
};
type Body = {
  job_id?: string;
  source?: string;
  filename?: string;
  overwrite?: boolean; // imported rating/note win over existing user_movies values
  rows?: CommitRow[];
};

/** Commit reviewed rows: films lazy-resolve → lossless user_watch_log inserts
 * → aggregated user_movies upsert. Chunked by the client (≤50 rows/call). */
export async function POST(req: NextRequest) {
  const ssr = await createServerClient();
  const { data: auth } = await ssr.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const body = await req.json().catch(() => null) as Body | null;
  const rows = (body?.rows ?? []).filter((r) => r?.tmdb_id && r?.title).slice(0, BATCH);
  if (!rows.length) return NextResponse.json({ error: "no rows" }, { status: 400 });
  const source = body?.source || "unknown";

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // import job (created on first chunk, reused after)
  let jobId = body?.job_id ?? null;
  if (!jobId) {
    const { data: job, error } = await admin.from("user_import_jobs")
      .insert({ user_id: user.id, source, filename: body?.filename ?? null })
      .select("id").single();
    if (error || !job) return NextResponse.json({ error: "job insert failed" }, { status: 500 });
    jobId = job.id as string;
  }

  // resolve films (creates Tier-2 rows for unknown tmdb_ids)
  const films = await resolveFilms(admin, rows.map((r) => r.tmdb_id));
  const failed = rows.filter((r) => !films.has(r.tmdb_id)).map((r) => r.title);
  const ok = rows.filter((r) => films.has(r.tmdb_id));

  // 1) lossless log — skip exact duplicates from previous imports
  const { data: dupes } = await admin.from("user_watch_log")
    .select("tmdb_id, watched_at, source")
    .eq("user_id", user.id)
    .in("tmdb_id", ok.map((r) => r.tmdb_id));
  const dupeKeys = new Set((dupes ?? []).map((d) => `${d.tmdb_id}|${d.watched_at ?? ""}|${d.source}`));
  const logRows = ok
    .filter((r) => !dupeKeys.has(`${r.tmdb_id}|${r.watched_at ?? ""}|${source}`))
    .map((r) => ({
      user_id: user.id,
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
  let logged = 0;
  if (logRows.length) {
    const { error } = await admin.from("user_watch_log").insert(logRows);
    if (error) return NextResponse.json({ error: "log insert failed" }, { status: 500 });
    logged = logRows.length;
  }

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
        if (r.rating != null) a.rating = r.rating;     // rating of the latest watch wins
        if (r.note) a.note = r.note;
      }
      if (a.rating == null && r.rating != null) a.rating = r.rating;
      if (!a.watched_at && r.watched_at) a.watched_at = r.watched_at;
      if (!a.note && r.note) a.note = r.note;
    }
    agg.set(film.id, a);
  }

  const filmIds = [...agg.keys()];
  const { data: existingRows } = await admin.from("user_movies")
    .select("film_id, rating, watched_at, note, seen, watchlist")
    .eq("user_id", user.id).in("film_id", filmIds);
  const existing = new Map((existingRows ?? []).map((e) => [e.film_id as string, e]));

  const overwrite = !!body?.overwrite;
  let added = 0, updated = 0;
  const upserts = filmIds.map((fid) => {
    const a = agg.get(fid)!;
    const ex = existing.get(fid);
    if (ex) updated++; else added++;
    const keep = <T,>(imported: T | undefined | null, current: T | undefined | null): T | null =>
      overwrite ? (imported ?? current ?? null) : (current ?? imported ?? null);
    return {
      user_id: user.id,
      film_id: fid,
      seen: (ex?.seen ?? false) || a.seen,
      watchlist: a.seen ? (ex?.watchlist ?? false) : ((ex?.watchlist ?? false) || a.watchlist),
      rating: keep(a.rating, ex?.rating as number | null),
      watched_at: keep(a.watched_at, ex?.watched_at as string | null),
      note: keep(a.note, ex?.note as string | null),
    };
  });
  const { error: upErr } = await admin.from("user_movies").upsert(upserts, { onConflict: "user_id,film_id" });
  if (upErr) return NextResponse.json({ error: "upsert failed" }, { status: 500 });

  // per-chunk stats accumulate on the job row
  const { data: jobRow } = await admin.from("user_import_jobs").select("stats").eq("id", jobId).single();
  const s = (jobRow?.stats ?? {}) as Record<string, number>;
  await admin.from("user_import_jobs").update({
    stats: { added: (s.added ?? 0) + added, updated: (s.updated ?? 0) + updated, logged: (s.logged ?? 0) + logged, failed: (s.failed ?? 0) + failed.length },
  }).eq("id", jobId);

  return NextResponse.json({ job_id: jobId, added, updated, logged, skipped_dupes: ok.length - logged, failed });
}
