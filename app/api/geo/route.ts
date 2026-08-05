import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/geo?film=slug | ?director=slug | ?country=slug | ?mode=overview (1 pin/film)
//   | ?bbox=w,s,e,n (viewport detail) | (none → full dump, kept as fallback)
// Returns located pins (lat/lng present) for the geographic Atlas.
// All jsonb-aggregating RPCs return one row, so PostgREST's 1000-row cap can't truncate them.
//
// 스코프·레이트리밋 (LOGIC-AUDIT §2.9 P1): 파라미터 화이트리스트(slug 정규식·bbox 범위·mode enum)
// + 인스턴스 단위 IP 토큰버킷(분당 30회, LRU 캡) — edge 캐시(s-maxage)와 겹으로 방어.

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,119}$/;

/* 간단 IP 레이트리밋 — 인메모리(인스턴스당), 분당 RATE_MAX회, 최대 RATE_KEYS IP 추적 */
const RATE_MAX = 30;
const RATE_WINDOW_MS = 60_000;
const RATE_KEYS = 5_000;
const hits = new Map<string, { n: number; t: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > RATE_WINDOW_MS) {
    if (hits.size >= RATE_KEYS) {
      const first = hits.keys().next().value;
      if (first !== undefined) hits.delete(first);
    }
    hits.set(ip, { n: 1, t: now });
    return false;
  }
  h.n += 1;
  return h.n > RATE_MAX;
}

function bad(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export async function GET(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "anon").split(",")[0].trim();
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429, headers: { "retry-after": "60" } });
  }

  const u = new URL(req.url);
  const film = u.searchParams.get("film");
  const director = u.searchParams.get("director");
  const country = u.searchParams.get("country");
  const bbox = u.searchParams.get("bbox");
  const mode = u.searchParams.get("mode");

  // 파라미터 화이트리스트 — 검증 실패는 조용한 빈 배열이 아니라 400
  if (film && !SLUG_RE.test(film)) return bad("invalid film slug");
  if (director && !SLUG_RE.test(director)) return bad("invalid director slug");
  if (country && !SLUG_RE.test(country)) return bad("invalid country slug");
  if (mode && mode !== "overview") return bad("invalid mode");

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  /**
   * An empty map is a legitimate answer here; a failed query is not. Reading only
   * `.data` collapsed the two, and this response is cached for ten minutes and
   * served stale for an hour — so on 2026-08-06 one timed-out RPC put an empty
   * array in front of every visitor's map long after the database had recovered.
   * The home map was blank and nothing in it looked broken.
   *
   * 503 instead: an error is never cached, and the map retries rather than
   * drawing a world with no places in it.
   */
  let rows: unknown = [];
  let err: unknown = null;
  let where = "overview";
  if (film) ({ data: rows, error: err } = await db.rpc("film_geo", { p_slug: film })), (where = "film");
  else if (director) ({ data: rows, error: err } = await db.rpc("director_geo", { p_slug: director })), (where = "director");
  else if (country) ({ data: rows, error: err } = await db.rpc("country_geo", { p_slug: country })), (where = "country");
  else if (bbox) {
    const parts = bbox.split(",").map(Number);
    if (parts.length !== 4 || !parts.every(Number.isFinite)) return bad("invalid bbox");
    const [w, s, e, n] = parts;
    if (w < -180 || e > 180 || s < -90 || n > 90 || w >= e || s >= n) return bad("bbox out of range");
    ({ data: rows, error: err } = await db.rpc("geo_bbox_json", { p_w: w, p_s: s, p_e: e, p_n: n, p_limit: 4000 }));
    where = "bbox";
  } else if (mode === "overview") {
    ({ data: rows, error: err } = await db.rpc("geo_overview_sample_json"));
  } else {
    ({ data: rows, error: err } = await db.rpc("geo_overview_json", { p_limit: 30000 }));
    if (!err && !Array.isArray(rows)) {
      ({ data: rows, error: err } = await db.rpc("geo_overview", { p_limit: 5000 })); // fallback
    }
    where = "full";
  }
  if (err) {
    console.error(`[api/geo] ${where} failed`, err);
    return NextResponse.json({ error: `geo(${where}) upstream failure` }, {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  }
  return NextResponse.json(rows ?? [], { headers: { "cache-control": "public, max-age=300, s-maxage=600, stale-while-revalidate=3600" } });
}
