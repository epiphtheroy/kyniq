import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAndLog, API_CORS, TOO_MANY } from "@/lib/apiGuard";
import { loadDirectorDestination } from "@/lib/navigator/load";
import { turnReason, type NavFilm, type Route, type RoutePref } from "@/lib/navigator/route";

/**
 * Mobile BFF — The Navigator drive view (HANDOFF-내비게이터-시네필터바이턴.md §5.3).
 * Given ?dir=<slug>&country=<cc> and the caller's auth, assembles the destination
 * (director conquest, v1) + three deterministic routes + trip stats, shaped so the
 * app can render the drive: green turn card (next film), the road signposts (stops),
 * and the trip meter (traveled vs remaining). Position stays ledger-derived
 * (invariant §10-1): seen is computed here from the authed user's user_movies, never
 * stored. Anonymous callers get a not-yet-started drive (empty seen).
 *
 * Auth mirrors /api/lens/marquee: cookie session first, then a Bearer fallback for
 * the app. The route reuses the proven director data paths via loadDirectorDestination
 * — no `*_mine` RPC (invariant §13-4).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const PREFS: RoutePref[] = ["fewest", "fastest", "no_tolls"];
const DEFAULT_DIR = "stanley-kubrick"; // §3 v1 fallback destination

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: API_CORS });
}

type Turn = {
  slug: string;
  title: string;
  year: number | null;
  poster_path: string | null;
  runtime: number | null;
  availability: NavFilm["availability"];
  leavingSoon: boolean;
  reason: string; // turnReason() — server-computed facts only (§10-2)
};
type Stop = {
  slug: string;
  title: string;
  year: number | null;
  poster_path: string | null;
  runtime: number | null;
  availability: NavFilm["availability"];
  toll: boolean;
};

function toTurn(f: NavFilm, reason: string): Turn {
  return {
    slug: f.slug,
    title: f.title,
    year: f.year,
    poster_path: f.poster_path,
    runtime: f.runtime,
    availability: f.availability,
    leavingSoon: !!f.leavingSoon,
    reason,
  };
}
function toStop(f: NavFilm, toll: boolean): Stop {
  return {
    slug: f.slug,
    title: f.title,
    year: f.year,
    poster_path: f.poster_path,
    runtime: f.runtime,
    availability: f.availability,
    toll,
  };
}
function sumRuntime(xs: { runtime: number | null }[]): number | null {
  const known = xs.filter((f) => f.runtime != null);
  return known.length ? known.reduce((s, f) => s + (f.runtime as number), 0) : null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const dir = (url.searchParams.get("dir") || DEFAULT_DIR).slice(0, 120);
  const country = (url.searchParams.get("country") || "US").toUpperCase().slice(0, 2);
  const wantPref = (url.searchParams.get("pref") || "fewest") as RoutePref;
  const defaultPref: RoutePref = PREFS.includes(wantPref) ? wantPref : "fewest";

  const db = createAdminClient();
  if (await guardAndLog(db, req, "app_navigator", dir)) {
    return NextResponse.json(TOO_MANY, { status: 429, headers: API_CORS });
  }

  // Auth is OPTIONAL: cookie session (web) → Bearer (app) → anonymous (fresh drive).
  let userId: string | null = null;
  try {
    const ssr = await createServerClient();
    const { data: auth } = await ssr.auth.getUser();
    userId = auth?.user?.id ?? null;
  } catch {
    /* no cookie context (app) — fall through to Bearer */
  }
  if (!userId) {
    const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (bearer) {
      const { data: tok } = await db.auth.getUser(bearer);
      userId = tok?.user?.id ?? null;
    }
  }

  try {
    // Director name for the destination label (falls back to slug).
    const { data: dirRow } = await db
      .from("directors")
      .select("name")
      .eq("slug", dir)
      .maybeSingle();

    // Seen set + pace are ledger-derived. Bound the seen query to this director's
    // films (≤ a filmography) rather than pulling the whole ledger.
    const { data: filmRows } = await db
      .from("films")
      .select("id, slug")
      .eq("director_slug", dir)
      .eq("visible", true);
    const films = (filmRows ?? []) as { id: string; slug: string }[];

    const seenSlugs = new Set<string>();
    let pacePerWeek: number | null = null;
    if (userId && films.length) {
      const idToSlug = new Map(films.map((f) => [f.id, f.slug]));
      const { data: seenRows } = await db
        .from("user_movies")
        .select("film_id")
        .eq("user_id", userId)
        .eq("seen", true)
        .in("film_id", films.map((f) => f.id));
      for (const r of (seenRows ?? []) as { film_id: string }[]) {
        const s = idToSlug.get(r.film_id);
        if (s) seenSlugs.add(s);
      }
    }
    if (userId) {
      // Pace = last-90-day seen / week (§4.3). ETA hides when pace is 0.
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { count } = await db
        .from("user_movies")
        .select("film_id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("seen", true)
        .gte("watched_at", cutoff);
      if (count && count > 0) pacePerWeek = count / (90 / 7);
    }

    const load = await loadDirectorDestination(db, {
      slug: dir,
      name: dirRow?.name ?? dir,
      country,
      seenSlugs,
      pacePerWeek,
    });
    if (!load) {
      return NextResponse.json({ error: "not_found" }, { status: 404, headers: API_CORS });
    }

    const { destination, routes, stats } = load;
    const seenFilms = destination.films.filter((f) => f.seen);

    // Per-pref render blocks (the app switches 최단/최속/무료도로 with no refetch).
    const routeBlock = (r: Route) => {
      const next = r.next;
      const then = r.stops[1]?.film ?? null;
      return {
        pref: r.pref,
        next: next ? toTurn(next, turnReason(next, destination, stats)) : null,
        then: then ? toTurn(then, turnReason(then, destination, stats)) : null,
        stops: r.stops.map((s) => toStop(s.film, s.toll)),
        tollCount: r.tollCount,
        runtimeRemaining: sumRuntime(r.stops.map((s) => s.film)),
        etaWeeks: stats.etaWeeks,
      };
    };
    const blocks = {
      fewest: routeBlock(routes.fewest),
      fastest: routeBlock(routes.fastest),
      no_tolls: routeBlock(routes.no_tolls),
    } as const;
    const sel = blocks[defaultPref];

    return NextResponse.json(
      {
        v: 1,
        dir,
        country,
        label: destination.label,
        family: destination.family,
        defaultPref,
        // Trip meter (shared across prefs) — the bottom sheet.
        seenCount: stats.seenCount,
        total: stats.total,
        remaining: stats.remaining,
        runtimeTraveled: stats.runtimeTraveled,
        runtimeRemaining: stats.runtimeRemaining,
        subCoverage: stats.subCoverage,
        etaWeeks: stats.etaWeeks,
        // The passed segment (grey signposts / traveled strip), chronological.
        seen: seenFilms.map((f) => toStop(f, false)),
        // Selected-pref convenience (contract top-level), mirrors routes[defaultPref].
        next: sel.next,
        then: sel.then,
        stops: sel.stops,
        // All three routes for the instant pref switch.
        routes: blocks,
      },
      { headers: { ...API_CORS, "cache-control": "private, no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "app_navigator_failed" },
      { status: 500, headers: API_CORS },
    );
  }
}
