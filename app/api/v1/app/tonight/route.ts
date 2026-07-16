import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAndLog, API_CORS, TOO_MANY } from "@/lib/apiGuard";

/**
 * Mobile BFF — Tonight feed (HANDOFF-모바일앱-프리워치.md §5.2).
 * cinecodex_ranked (Marquee v11 arg surface — new args must default to previous
 * behavior) + availability dots for the page. TakeScore comes from
 * takescore_for_slugs (the [{slug,ts}] canonical bulk contract).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const CACHE = "public, s-maxage=900, stale-while-revalidate=3600";
const PAGE = 40;

/** First sentence of an invitation, capped for a lobby card. */
function firstSentence(prose: string): string {
  const text = prose.trim().replace(/\s+/g, " ");
  const m = text.match(/^.{40,220}?[.!?](?=\s|$)/);
  if (m) return m[0];
  return text.length > 180 ? `${text.slice(0, 177).replace(/\s+\S*$/, "")}…` : text;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: API_CORS });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const country = (url.searchParams.get("country") || "US").toUpperCase().slice(0, 2);
  const providers = (url.searchParams.get("providers") || "")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter(Number.isFinite)
    .slice(0, 50);
  const genres = (url.searchParams.get("genres") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
  const num = (k: string) => {
    const v = parseInt(url.searchParams.get(k) ?? "", 10);
    return Number.isFinite(v) ? v : null;
  };
  const offset = Math.max(num("offset") ?? 0, 0);
  const limit = Math.min(Math.max(num("limit") ?? PAGE, 1), PAGE);

  const db = createAdminClient();
  if (await guardAndLog(db, req, "app_tonight", country)) {
    return NextResponse.json(TOO_MANY, { status: 429, headers: API_CORS });
  }

  try {
    const { data, error } = await db.rpc("cinecodex_ranked", {
      p_sort: "u",
      p_dir: "desc",
      p_providers: providers.length ? providers : null,
      p_watch_country: country,
      p_watch_countries: [country],
      p_include_us_library: false,
      p_include_rent: false,
      p_genres: genres.length ? genres : null,
      p_year_min: num("year_min"),
      p_year_max: num("year_max"),
      p_limit: limit,
      p_offset: offset,
    });
    if (error) throw error;

    type Row = {
      slug: string;
      title: string;
      year: number | null;
      poster_path: string | null;
      director: string | null;
      director_slug?: string | null;
    };
    const page = (data as { total: number; rows: Row[] } | null) ?? { total: 0, rows: [] };
    const slugs = page.rows.map((r) => r.slug);

    const [tsRes, availRes] = await Promise.all([
      slugs.length
        ? db.rpc("takescore_for_slugs", { p_slugs: slugs })
        : Promise.resolve({ data: [] }),
      slugs.length
        ? db.rpc("film_availability", {
            p_slugs: slugs,
            p_countries: [country],
            p_providers: providers.length ? providers : null,
            p_include_us_library: false,
          })
        : Promise.resolve({ data: [] }),
    ]);
    const tsMap = new Map(
      ((tsRes.data ?? []) as { slug: string; ts: number }[]).map((r) => [r.slug, r.ts]),
    );
    const tierMap = new Map(
      ((availRes.data ?? []) as { slug: string; tiers: { kind: string }[] }[]).map((r) => [
        r.slug,
        [...new Set((r.tiers ?? []).map((t) => t.kind))],
      ]),
    );

    // One-line invite per card (§5.2): the page's invitations in two batched
    // queries (films → figures → invitation takes), never per-film loops.
    // Tier-2 rows simply have no invitation and render without a lead.
    const leadMap = new Map<string, string>();
    const idMap = new Map<string, string>();
    if (slugs.length) {
      try {
        const { data: filmRows } = await db.from("films").select("id, slug").in("slug", slugs);
        const slugById = new Map(
          ((filmRows ?? []) as { id: string; slug: string }[]).map((f) => [f.id, f.slug]),
        );
        for (const [id, slug] of slugById) idMap.set(slug, id);
        if (slugById.size) {
          const { data: figRows } = await db
            .from("figures")
            .select("id, film_id")
            .in("film_id", [...slugById.keys()])
            .eq("status", "approved");
          const filmByFig = new Map(
            ((figRows ?? []) as { id: string; film_id: string }[]).map((f) => [f.id, f.film_id]),
          );
          if (filmByFig.size) {
            const { data: invRows } = await db
              .from("takes")
              .select("figure_id, rationale")
              .in("figure_id", [...filmByFig.keys()])
              .eq("status", "published")
              .eq("is_invitation", true);
            for (const t of (invRows ?? []) as { figure_id: string; rationale: string | null }[]) {
              const slug = slugById.get(filmByFig.get(t.figure_id) ?? "");
              if (!slug || !t.rationale || leadMap.has(slug)) continue;
              leadMap.set(slug, firstSentence(t.rationale));
            }
          }
        }
      } catch {
        /* leads are optional decoration — never fail the feed for them */
      }
    }

    return NextResponse.json(
      {
        v: 1,
        country,
        total: page.total,
        rows: page.rows.map((r) => ({
          film_id: idMap.get(r.slug) ?? null,
          slug: r.slug,
          title: r.title,
          year: r.year,
          poster_path: r.poster_path,
          director: r.director,
          director_slug: r.director_slug ?? null,
          ts: tsMap.get(r.slug) ?? null,
          tiers: tierMap.get(r.slug) ?? [],
          lead: leadMap.get(r.slug) ?? null,
        })),
      },
      { headers: { ...API_CORS, "cache-control": CACHE } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "app_tonight_failed" },
      { status: 500, headers: API_CORS },
    );
  }
}
