import { NextResponse } from "next/server";
import { upsertFilm } from "@/lib/tmdb";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/films/backfill
 * Upserts a single film by TMDB ID. Called from the ask flow (client-side)
 * when a user selects a film from search results.
 *
 * Hardening (HANDOFF-컨텍스트팩-실행.md §6.5c): the caller is a browser, so a
 * shared secret is impossible. Instead we gate on same-origin, validate the id,
 * short-circuit films we already have (shrinking the write/TMDB-fetch surface),
 * and apply a soft per-IP rate limit. The write path still uses the service-role
 * admin client internally (upsertFilm). A proper fix is to move this to a server
 * action; that is out of W1 scope.
 */

// Soft in-memory rate limit: 5 upserts / IP / minute. Per-isolate only (a warm
// Vercel lambda) — good enough to blunt abuse, not a hard guarantee.
const HITS = new Map<string, number[]>();
const LIMIT = 5;
const WINDOW = 60_000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (HITS.get(ip) ?? []).filter((t) => now - t < WINDOW);
  arr.push(now);
  HITS.set(ip, arr);
  if (HITS.size > 5000) {
    for (const [k, v] of HITS) if (!v.some((t) => now - t < WINDOW)) HITS.delete(k);
  }
  return arr.length > LIMIT;
}

function sameOrigin(request: Request): boolean {
  const host = request.headers.get("host") ?? "";
  const src = request.headers.get("origin") ?? request.headers.get("referer") ?? "";
  // No Origin/Referer at all (e.g. curl) → reject; browser fetches send one.
  if (!src) return false;
  try {
    const h = new URL(src).host;
    return (
      h === host ||
      h === "metatake.net" ||
      h === "www.metatake.net" ||
      h.endsWith(".vercel.app") ||
      h.startsWith("localhost") ||
      h.startsWith("127.0.0.1")
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    if (rateLimited(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const tmdbId = body.tmdb_id;

    if (
      typeof tmdbId !== "number" ||
      !Number.isInteger(tmdbId) ||
      tmdbId <= 0 ||
      tmdbId >= 1_000_000_000
    ) {
      return NextResponse.json(
        { error: "tmdb_id (positive integer) is required" },
        { status: 400 }
      );
    }

    // Already have it? Return the existing row without re-fetching TMDB / writing.
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("films")
      .select("*")
      .eq("tmdb_id", tmdbId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ data: existing });
    }

    const film = await upsertFilm(tmdbId);
    return NextResponse.json({ data: film });
  } catch (err) {
    console.error("Film backfill error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backfill failed" },
      { status: 500 }
    );
  }
}
