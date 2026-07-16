import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAndLog, API_CORS, TOO_MANY } from "@/lib/apiGuard";

/**
 * Mobile BFF — Film card (HANDOFF-모바일앱-프리워치.md §7).
 * One aggregate payload per screen: TS + invitation (Fantasia fallback) +
 * availability (country-scoped) + lineage + locations + The Life preview.
 * Payload contract mirrors mobile/src/types.ts (bump `v` on breaking change).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const CACHE = "public, s-maxage=300, stale-while-revalidate=3600";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: API_CORS });
}

type Params = { params: Promise<{ slug: string }> };

export async function GET(req: Request, { params }: Params) {
  const { slug: rawSlug } = await params;
  const slug = (rawSlug || "").slice(0, 120);
  const url = new URL(req.url);
  const country = (url.searchParams.get("country") || "US").toUpperCase().slice(0, 2);
  const locale = (url.searchParams.get("locale") || "en").toLowerCase().slice(0, 5);

  const db = createAdminClient();
  if (await guardAndLog(db, req, "app_film", slug)) {
    return NextResponse.json(TOO_MANY, { status: 429, headers: API_CORS });
  }

  try {
    const { data: film, error: filmErr } = await db
      .from("films")
      .select(
        "id, slug, title, original_title, year, director, director_slug, poster_path, backdrop_path, runtime, genres, is_analyzed",
      )
      .eq("slug", slug)
      .maybeSingle();
    if (filmErr) throw filmErr;
    if (!film) {
      return NextResponse.json({ error: "not_found" }, { status: 404, headers: API_CORS });
    }

    const [tsRes, figRes, availRes, linRes, geoRes] = await Promise.all([
      db.rpc("takescore_for_slugs", { p_slugs: [slug] }),
      db.from("figures").select("id").eq("film_id", film.id).eq("status", "approved"),
      db.rpc("film_availability", {
        p_slugs: [slug],
        p_countries: [country],
        p_providers: null,
        p_include_us_library: false,
      }),
      db.rpc("film_lineage_for", { p_film_id: film.id }),
      db.rpc("film_geo", { p_slug: slug }),
    ]);

    const ts =
      ((tsRes.data ?? []) as { slug: string; ts: number }[]).find((r) => r.slug === slug)?.ts ??
      null;

    // Invitation — first published is_invitation take (text = rationale)
    let invitation: string | null = null;
    const figIds = ((figRes.data ?? []) as { id: string }[]).map((f) => f.id);
    if (figIds.length) {
      const { data: inv } = await db
        .from("takes")
        .select("rationale")
        .in("figure_id", figIds)
        .eq("status", "published")
        .eq("is_invitation", true)
        .limit(1);
      invitation = (inv?.[0]?.rationale as string | undefined) ?? null;
    }

    // Fantasia fallback lead — EN only (locale projection owner decision)
    let leadFallback: string[] = [];
    if (!invitation && locale === "en") {
      try {
        const { data: sent } = await db.rpc("film_sentences_for", {
          p_slug: slug,
          p_limit: 4,
          p_per_pattern: 1,
        });
        leadFallback = ((sent ?? []) as { sentence: string }[])
          .map((s) => s.sentence)
          .filter(Boolean)
          .slice(0, 2);
      } catch {
        /* optional */
      }
    }

    type AvailRow = { kind: string; pid: number; name: string; logo: string | null; cc: string };
    const availability =
      ((availRes.data ?? []) as { slug: string; tiers: AvailRow[] }[]).find((r) => r.slug === slug)
        ?.tiers ?? [];

    type LinRow = {
      facet: string;
      list_slug: string;
      list_label: string;
      result: string | null;
      rank: number | null;
      edition_year: number | null;
      rank_max: number | null;
    };
    const lineage = ((linRes.data ?? []) as LinRow[]).map((l) => ({
      facet: l.facet,
      list_slug: l.list_slug,
      list_label: l.list_label,
      result: l.result,
      rank: l.rank,
      edition_year: l.edition_year,
      rank_max: l.rank_max,
    }));

    type Pin = {
      id: number | string;
      name: string;
      lat: number;
      lng: number;
      country: string | null;
      layer: string;
    };
    const geoRows = (geoRes.data ?? []) as Pin[];
    const locations = {
      count: geoRows.length,
      pins: geoRows.slice(0, 12).map((p) => ({
        id: p.id,
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        country: p.country ?? null,
        layer: p.layer,
      })),
    };

    // The Life preview (director)
    let theLife: {
      name: string;
      slug: string;
      profile_path: string | null;
      intro: string | null;
      facts: { n: number; text: string }[];
    } | null = null;
    if (film.director_slug) {
      const [{ data: dir }, { data: facts }] = await Promise.all([
        db.from("directors").select("profile_path").eq("slug", film.director_slug).maybeSingle(),
        db
          .from("director_facts")
          .select("intro, facts")
          .eq("director_slug", film.director_slug)
          .maybeSingle(),
      ]);
      if (dir || facts) {
        const factRows = ((facts?.facts ?? []) as { n: number; text: string }[])
          .slice()
          .sort((a, b) => a.n - b.n)
          .slice(0, 4)
          .map((f) => ({ n: f.n, text: f.text }));
        theLife = {
          name: film.director ?? "",
          slug: film.director_slug,
          profile_path: (dir?.profile_path as string | null) ?? null,
          intro: (facts?.intro as string | null) ?? null,
          facts: factRows,
        };
      }
    }

    return NextResponse.json(
      {
        v: 1,
        film_id: film.id,
        slug: film.slug,
        title: film.title,
        original_title: film.original_title ?? null,
        year: film.year ?? null,
        director: film.director ?? null,
        director_slug: film.director_slug ?? null,
        poster_path: film.poster_path ?? null,
        backdrop_path: film.backdrop_path ?? null,
        runtime: film.runtime ?? null,
        genres: Array.isArray(film.genres) ? (film.genres as string[]) : null,
        ts,
        analyzed: !!film.is_analyzed,
        invitation,
        lead_fallback: leadFallback,
        availability,
        lineage,
        locations,
        the_life: theLife,
      },
      { headers: { ...API_CORS, "cache-control": CACHE } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "app_film_failed" },
      { status: 500, headers: API_CORS },
    );
  }
}
