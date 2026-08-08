import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAndLog, API_CORS, TOO_MANY } from "@/lib/apiGuard";
import { mergePins, type GeoPin } from "@/lib/locations";
import { CODEX_DIMS } from "@/lib/cinecodex_dims";
import { filmBackdropPaths } from "@/lib/read-media";
import { appLocale, filmLabels, isProjected, pick } from "@/lib/i18n/appProjection";
import { locVal } from "@/lib/i18n/values";

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

// One hour at the edge, a day of stale-while-revalidate. The brief is anonymous
// and its inputs move on the order of days (availability daily at worst) — and
// every MISS pays cinecodex_card, the database's single heaviest temp-file
// writer (0118 tunes it, the edge should still absorb repeats).
const CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: API_CORS });
}

type Params = { params: Promise<{ slug: string }> };

export async function GET(req: Request, { params }: Params) {
  const { slug: rawSlug } = await params;
  const slug = (rawSlug || "").slice(0, 120);
  const url = new URL(req.url);
  const country = (url.searchParams.get("country") || "US").toUpperCase().slice(0, 2);
  const locale = appLocale(url.searchParams.get("locale"));
  // Two axes. `locale` is the chrome and the PROSE — the Invitation, the
  // director's life. `content` is what a film is NAMED and PICTURED in: its
  // release title and the artwork that carries that title, in that title's
  // typeface. A reader who asks for English titles under Korean chrome must not
  // get the Korean one-sheet over "In the Mood for Love".
  //
  // Tests the RAW param: appLocale answers "en" for a missing value, and "en" is
  // truthy, so `appLocale(x) || locale` can never reach the fallback.
  const rawContent = url.searchParams.get("content");
  const content = rawContent ? appLocale(rawContent) : locale;

  const db = createAdminClient();
  if (await guardAndLog(db, req, "app_film", slug)) {
    return NextResponse.json(TOO_MANY, { status: 429, headers: API_CORS });
  }

  try {
    const { data: film, error: filmErr } = await db
      .from("films")
      .select(
        // The trailing poster_path_* are migration 0137 — the reader's own
        // artwork, resolved by locVal below. Listed as a LITERAL, not built by
        // concatenation: supabase-js derives the row type from the select
        // string, and a runtime-built one erases it (every field on this row
        // becomes an error). Six short, usually-NULL text columns on one row is
        // not a cost worth losing the types over.
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

    const [tsRes, figRes, availRes, linRes, geoRes, cardRes, affRes, tvRes, leadRes] =
      await Promise.all([
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
      // App-parity lead: written prose for films that never got an invitation take.
      // Fetched unconditionally so it costs no extra round trip — it is a primary-key
      // lookup, and whether we use it is decided below.
      db.from("film_leads").select("lead").eq("film_id", film.id).limit(1),
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

    // Tier-2 films have no invitation take, so the section used to disappear. The
    // lead is an additive layer (migration 0140): written for exactly these films,
    // and shadowed automatically the day one of them is promoted and earns a real
    // take. It sits ABOVE the Fantasia fallback deliberately — sentences stitched
    // from the corpus are a last resort, prose written for the film is not.
    if (!invitation) {
      invitation = ((leadRes.data ?? []) as { lead: string }[])[0]?.lead ?? null;
    }

    // The Embedding Fantasia fallback that used to fill this slot is gone. It
    // stitched two corpus sentences together for films with no invitation, which
    // was the best available answer when nothing had been written for them. Now
    // something has: film_leads covers every catalogue film whose record could
    // support a paragraph. The 198 that remain are the ones the writer read and
    // declined — the record was too thin to say anything true — and answering that
    // judgement with assembled sentences is exactly the overclaim it avoided.
    // No lead, no section: the same rule the rest of this brief follows.

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

    // The reader's own poster (migration 0137) — a SEPARATE, failure-tolerant
    // read, deliberately not part of the select above.
    //
    // That select is load-bearing: `if (filmErr) throw filmErr` turns any error
    // on it into a 500 for every film in the app. Naming a column there couples
    // this deploy to that migration, and gets the order wrong exactly once. Here
    // a missing column costs the localized poster and nothing else.
    let localPoster: string | null = null;
    if (isProjected(content)) {
      const { data: art } = await db
        .from("films")
        .select("poster_path_ko, poster_path_es, poster_path_ja, poster_path_zh, poster_path_fr, poster_path_hi")
        .eq("slug", slug)
        .maybeSingle();
      if (art) localPoster = locVal(art as Record<string, unknown>, "poster_path", content);
    }

    // ── locale projection ────────────────────────────────────────────────
    // One batched read of content_i18n; English stands wherever a row is absent.
    const i18n = await filmLabels(locale, slug, (film.director_slug as string | null) ?? null);
    if (i18n) {
      invitation = pick(i18n.invitation, locale, "invitation", slug, "rationale", invitation);
      if (theLife && film.director_slug) {
        const ds = film.director_slug as string;
        theLife.intro = pick(i18n.facts, locale, "director_fact", ds, "intro", theLife.intro);
        theLife.facts = theLife.facts.map((f) => ({
          n: f.n,
          text: pick(i18n.facts, locale, "director_fact", `${ds}#${f.n}`, "fact", f.text) ?? f.text,
        }));
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
        // locVal falls back to films.poster_path, which is what most films will
        // use: TMDB has localized artwork for the widely-released, and English
        // is the right answer for the rest — never a blank.
        poster_path: localPoster ?? film.poster_path ?? null,
        backdrop_path: film.backdrop_path ?? null,
        runtime: film.runtime ?? null,
        genres: Array.isArray(film.genres) ? (film.genres as string[]) : null,
        ts,
        analyzed: !!film.is_analyzed,
        invitation,
        // lead_fallback is retired but still emitted empty: the shipped app reads
        // `invitation || lead_fallback.join(" ")`, and a version that has not been
        // updated would join undefined. An empty array is falsy in that expression
        // and costs nothing; drop the field once no build in the wild reads it.
        lead_fallback: [] as string[],
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
