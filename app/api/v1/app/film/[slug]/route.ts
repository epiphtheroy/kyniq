import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAndLog, API_CORS, TOO_MANY } from "@/lib/apiGuard";
import { mergePins, type GeoPin } from "@/lib/locations";
import { CODEX_DIMS } from "@/lib/cinecodex_dims";
import { filmBackdropPaths } from "@/lib/read-media";

/**
 * Mobile BFF — Film card (HANDOFF-모바일앱-프리워치.md §7).
 * One aggregate payload per screen: TS + invitation (Fantasia fallback) +
 * availability (country-scoped) + lineage + locations + The Life preview.
 * PAYLOAD v2 (v4 judgment signals, §7/§16.1): rank + vcr + standing + dims
 * (cinecodex_card) and kindred (film_affinities.shared_meta_take_ids —
 * service-role only, this BFF is the sole exposure path).
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
        "id, slug, title, original_title, year, director, director_slug, poster_path, backdrop_path, runtime, genres, is_analyzed, tmdb_id",
      )
      .eq("slug", slug)
      .maybeSingle();
    if (filmErr) throw filmErr;
    if (!film) {
      return NextResponse.json({ error: "not_found" }, { status: 404, headers: API_CORS });
    }
    // Hero pager + mid-page figures (owner directive 2026-07-20): a handful of
    // TMDB backdrops, kicked off early and awaited at payload time. Fail-soft.
    const imagesP: Promise<string[]> = filmBackdropPaths(
      (film as { tmdb_id?: number | null }).tmdb_id ?? null,
      8,
    ).catch(() => [] as string[]);

    const [tsRes, figRes, availRes, linRes, geoRes, cardRes, affRes, tvRes] = await Promise.all([
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
      db.rpc("cinecodex_card", { p_slug: slug }),
      db
        .from("film_affinities")
        .select("related_film_id, score, shared_meta_take_ids")
        .eq("film_id", film.id)
        .order("score", { ascending: false })
        .limit(8),
      // Metatake TV (owner 07-30): the film's own program. tv_* carries no RLS
      // policy for anon, so the app cannot read it directly — it comes through
      // here, on the service-role client, like every other aggregate.
      db
        .from("tv_programs")
        .select("slug, title, dek, seg_count, duration_ms")
        .eq("film_id", film.id)
        .eq("status", "published")
        .limit(1),
    ]);

    type TvProgramRow = {
      slug: string;
      title: string | null;
      dek: string | null;
      seg_count: number | null;
      duration_ms: number | null;
    };
    const tvProgram = ((tvRes.data ?? []) as TvProgramRow[])[0] ?? null;

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

    // Same fusion the web film page applies (mergePins), plus a
    // diacritic-insensitive pass mergePins can't do (its name key is byte-wise,
    // so "Shochiku Ōfuna Studio" and "Shochiku Ofuna Studio" survived as two
    // pins at the same coordinates).
    const geoRows = mergePins((geoRes.data ?? []) as GeoPin[]);
    const seenLoc = new Set<string>();
    const fused = geoRows.filter((p) => {
      const seg = (p.name ?? "")
        .split(",")[0]
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .trim()
        .toLowerCase();
      const key = `${seg}:${(p.country ?? "").trim()}:${p.layer}`;
      if (seenLoc.has(key)) return false;
      seenLoc.add(key);
      return true;
    });
    const locations = {
      count: fused.length,
      pins: fused.slice(0, 12).map((p) => ({
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

    // ── v4 judgment signals (PAYLOAD v2) ─────────────────────────────────
    // cinecodex_card returns null/empty json for unscored (Tier-2) films —
    // mirror the /takescore/film page's validity check and emit nulls then,
    // never fake zeros (§13-17 evidence honesty).
    type Card = {
      slug?: string | null;
      v?: number | null;
      c?: number | null;
      r?: number | null;
      u?: number | null;
      rank?: number | null;
      rank_total?: number | null;
      subs?: Record<string, number | null> | null;
      standing?: { prestige: number | null; labels: string[] | null } | null;
    };
    const cardRaw = (cardRes.data ?? null) as Card | null;
    const card = cardRaw && cardRaw.slug && cardRaw.v != null && cardRaw.u != null ? cardRaw : null;
    const vcr =
      card && card.v != null && card.c != null && card.r != null
        ? { v: Number(card.v), c: Number(card.c), r: Number(card.r) }
        : null;
    // 13 subs → expectation chips, in the CODEX_DIMS registry order with the
    // registry's human labels (lib/cinecodex_dims.ts is the single vocabulary).
    const dimRows = card?.subs
      ? CODEX_DIMS.flatMap((d) => {
          const val = card.subs?.[d.key];
          return val == null ? [] : [{ key: d.key, label: d.label, val: Number(val) }];
        })
      : [];
    const dims = dimRows.length ? dimRows : null;

    // kindred — film_affinities is service-role only (shared_meta_take_ids
    // never crosses an anon surface); shared = count of shared figure-type
    // meta-takes. Two-step join, same idiom as /movies-like.
    type AffRow = { related_film_id: string; score: number; shared_meta_take_ids: string[] | null };
    const aff = (affRes.data ?? []) as AffRow[];
    let kindred: { slug: string; title: string; year: number | null; shared: number }[] | null =
      null;
    if (aff.length) {
      const { data: rel } = await db
        .from("films")
        .select("id, slug, title, year")
        .in("id", aff.map((a) => a.related_film_id));
      const relMap = new Map(
        ((rel ?? []) as { id: string; slug: string; title: string; year: number | null }[]).map(
          (f) => [f.id, f],
        ),
      );
      const rows = aff.flatMap((a) => {
        const f = relMap.get(a.related_film_id);
        return f
          ? [
              {
                slug: f.slug,
                title: f.title,
                year: f.year ?? null,
                shared: a.shared_meta_take_ids?.length ?? 0,
              },
            ]
          : [];
      });
      kindred = rows.length ? rows : null;
    }

    // The lists this film's program rides in. Two hops (items → playlists) and
    // fail-soft: TV is a bonus shelf, never a reason for the brief to 500.
    let tvLists: { slug: string; title: string; kind: string | null }[] = [];
    if (tvProgram) {
      try {
        const { data: progIdRow } = await db
          .from("tv_programs")
          .select("id")
          .eq("slug", tvProgram.slug)
          .limit(1);
        const progId = ((progIdRow ?? []) as { id: string }[])[0]?.id ?? null;
        if (progId) {
          const { data: items } = await db
            .from("tv_playlist_items")
            .select("playlist_id")
            .eq("program_id", progId)
            .limit(12);
          const ids = [...new Set(((items ?? []) as { playlist_id: string }[]).map((i) => i.playlist_id))];
          if (ids.length) {
            const { data: pls } = await db
              .from("tv_playlists")
              .select("slug, title, kind, n_films")
              .in("id", ids)
              .order("n_films", { ascending: false })
              .limit(4);
            tvLists = ((pls ?? []) as { slug: string; title: string; kind: string | null }[]).map(
              (pl) => ({ slug: pl.slug, title: pl.title, kind: pl.kind }),
            );
          }
        }
      } catch {
        /* the shelf simply comes back without its lists */
      }
    }

    return NextResponse.json(
      {
        v: 2,
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
        rank: card?.rank ?? null,
        rank_total: card?.rank_total ?? null,
        vcr,
        standing: card?.standing?.prestige ?? null,
        dims,
        kindred,
        // Additive (PAYLOAD v2-compatible): clients that don't know `images`
        // ignore it; the app renders the hero pager + figures only when present.
        images: await imagesP.then((a) => (a.length ? a : null)),
        // Additive: older clients ignore `tv`; the app renders the shelf only
        // when a published program exists for this film.
        tv: tvProgram
          ? {
              slug: tvProgram.slug,
              title: tvProgram.title ?? film.title,
              dek: tvProgram.dek ?? null,
              segments: tvProgram.seg_count ?? null,
              duration_ms: tvProgram.duration_ms ?? null,
              lists: tvLists,
            }
          : null,
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
