import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * TMDB proxy for the Credits explorer (/credits).
 * Visitors never need a TMDB key — the server token stays here.
 * Strict path allowlist; responses are cached by Next's data cache (24h)
 * and at the edge via s-maxage, so repeat exploration is nearly free.
 */
const ALLOW: RegExp[] = [
  /^\/search\/movie$/,
  /^\/search\/person$/,
  /^\/movie\/\d+$/,
  /^\/movie\/\d+\/credits$/,
  /^\/person\/\d+$/,
  /^\/person\/\d+\/movie_credits$/,
];

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams.get("p") || "";
  if (!ALLOW.some((rx) => rx.test(p))) {
    return NextResponse.json({ error: "path not allowed" }, { status: 400 });
  }
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "TMDB not configured" }, { status: 503 });
  }

  const isSearch = p.startsWith("/search/");
  const params = new URLSearchParams();
  if (isSearch) {
    const q = (req.nextUrl.searchParams.get("query") || "").trim().slice(0, 200);
    if (q.length < 2) return NextResponse.json({ results: [] });
    params.set("query", q);
    params.set("include_adult", "false");
  } else if (/^\/movie\/\d+$/.test(p)) {
    params.set("append_to_response", "credits");
  }

  const v4 = token.length > 40;
  if (!v4) params.set("api_key", token);
  const url = `https://api.themoviedb.org/3${p}${params.size ? `?${params}` : ""}`;

  const doFetch = () =>
    fetch(url, {
      headers: v4 ? { Authorization: `Bearer ${token}`, accept: "application/json" } : { accept: "application/json" },
      next: { revalidate: isSearch ? 3600 : 86400 },
    });

  try {
    let r = await doFetch();
    if (r.status === 429) {
      const ra = Math.min(+(r.headers.get("retry-after") || 1) || 1, 3);
      await new Promise((s) => setTimeout(s, ra * 1000));
      r = await doFetch();
    }
    if (!r.ok) {
      return NextResponse.json({ error: `TMDB ${r.status}` }, { status: r.status === 404 ? 404 : 502 });
    }
    const data = await r.json();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": isSearch
          ? "public, s-maxage=3600, stale-while-revalidate=86400"
          : "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return NextResponse.json({ error: "TMDB unreachable" }, { status: 502 });
  }
}
