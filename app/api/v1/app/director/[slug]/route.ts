import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAndLog, API_CORS, TOO_MANY } from "@/lib/apiGuard";
import { appLocale, directorLabels, isProjected, pick } from "@/lib/i18n/appProjection";
import { locVal } from "@/lib/i18n/values";

/**
 * Mobile BFF — Director card (HANDOFF-모바일앱-프리워치.md §2.2).
 * Portrait + Where to Start + The Selection + availability-dot filmography
 * (the app's killer surface) + Who's Next + The Life.
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

  const db = createAdminClient();
  if (await guardAndLog(db, req, "app_director", slug)) {
    return NextResponse.json(TOO_MANY, { status: 429, headers: API_CORS });
  }

  // Locale projection — one batched content_i18n read, English wherever a row is
  // absent. Same table the web reads, so one translation serves both. Declared
  // here because the films query below selects a poster column by this name.
  const locale = appLocale(new URL(req.url).searchParams.get("locale"));
  // The app carries TWO language axes: `locale` is the chrome and the prose,
  // `content` is what films and people are NAMED in. A reader can want Korean
  // titles under English chrome. Names follow content; falls back to locale,
  // which is what a client that only knows one axis means anyway.
  const content = appLocale(new URL(req.url).searchParams.get("content") || null) || locale;

  try {
    const [filmsRes, dirRes, portraitRes, factsRes, picksRes, nextRes] = await Promise.all([
      db
        .from("films")
        .select("id, slug, title, year, poster_path")
        .eq("director_slug", slug)
        .eq("visible", true)
        .order("year"),
      db
        .from("directors")
        // Trailing name_* = migration 0139, resolved by locVal below. A literal:
        // supabase-js types the row from this text.
        .select("name, profile_path, birthday, place_of_birth, name_ko, name_es, name_ja, name_zh, name_fr, name_hi")
        .eq("slug", slug)
        .maybeSingle(),
      db.from("director_portrait").select("body").eq("director_slug", slug).maybeSingle(),
      db
        .from("director_facts")
        .select("name_meaning, intro, facts")
        .eq("director_slug", slug)
        .maybeSingle(),
      db
        .from("director_picks")
        .select("pos, film_slug, film_title, film_year, label, reason")
        .eq("director_slug", slug)
        .order("pos"),
      db
        .from("director_next")
        .select("pos, rec_name, reason, target_slug, profile_path")
        .eq("director_slug", slug)
        .order("pos"),
    ]);

    const films = (filmsRes.data ?? []) as {
      id: string;
      slug: string;
      title: string;
      year: number | null;
      poster_path: string | null;
    }[];
    const dir = dirRes.data as {
      name: string;
      profile_path: string | null;
      birthday: string | null;
      place_of_birth: string | null;
    } | null;

    if (!dir && !films.length) {
      return NextResponse.json({ error: "not_found" }, { status: 404, headers: API_CORS });
    }

    const slugs = films.map((f) => f.slug);
    const filmIds = films.map((f) => f.id);

    const [tsRes, availRes, honorsRes] = await Promise.all([
      slugs.length
        ? db.rpc("takescore_for_slugs", { p_slugs: slugs })
        : Promise.resolve({ data: [] }),
      slugs.length
        ? db.rpc("film_availability", {
            p_slugs: slugs,
            p_countries: [country],
            p_providers: null,
            p_include_us_library: false,
          })
        : Promise.resolve({ data: [] }),
      filmIds.length
        ? db
            .from("film_wd_honors")
            .select("film_id", { count: "exact", head: true })
            .in("film_id", filmIds)
        : Promise.resolve({ count: 0 }),
    ]);

    const tsMap = new Map(
      ((tsRes.data ?? []) as { slug: string; ts: number }[]).map((r) => [r.slug, r.ts]),
    );
    type AvailRow = { kind: string };
    const tierMap = new Map(
      ((availRes.data ?? []) as { slug: string; tiers: AvailRow[] }[]).map((r) => [
        r.slug,
        [...new Set((r.tiers ?? []).map((t) => t.kind))],
      ]),
    );

    const facts = factsRes.data as {
      name_meaning: string | null;
      intro: string | null;
      facts: { n: number; text: string; source?: string | null }[] | null;
    } | null;

    const i18n = await directorLabels(locale, slug);
    // The reader's own posters (0137) — a SEPARATE, failure-tolerant read rather
    // than columns on the films query above. A missing column there would empty
    // the filmography; here it costs the localized artwork and nothing else.
    const artOf = new Map<string, string>();
    if (isProjected(locale)) {
      const { data: art } = await db
        .from("films")
        .select("slug, poster_path_ko, poster_path_es, poster_path_ja, poster_path_zh, poster_path_fr, poster_path_hi")
        .eq("director_slug", slug)
        .eq("visible", true);
      for (const a of (art ?? []) as unknown as Record<string, unknown>[]) {
        const v = locVal(a, "poster_path", locale);
        if (v && typeof a.slug === "string") artOf.set(a.slug, v);
      }
    }

    return NextResponse.json(
      {
        v: 1,
        slug,
        name:
          (dir ? locVal(dir as unknown as Record<string, unknown>, "name", content) : null) ??
          films[0]?.title ??
          slug,
        profile_path: dir?.profile_path ?? null,
        birthday: dir?.birthday ?? null,
        place_of_birth: dir?.place_of_birth ?? null,
        portrait: pick(i18n?.portrait, locale, "director_portrait", slug, "body",
          (portraitRes.data?.body as string | null) ?? null),
        name_meaning: pick(i18n?.facts, locale, "director_fact", slug, "name_meaning",
          facts?.name_meaning ?? null),
        intro: pick(i18n?.facts, locale, "director_fact", slug, "intro", facts?.intro ?? null),
        facts: (facts?.facts ?? [])
          .slice()
          .sort((a, b) => a.n - b.n)
          .map((f) => ({
            n: f.n,
            text: pick(i18n?.facts, locale, "director_fact", `${slug}#${f.n}`, "fact", f.text) ?? f.text,
            source: f.source ?? null,
          })),
        picks: (picksRes.data ?? []) as unknown[],
        next: (nextRes.data ?? []) as unknown[],
        films: films.map((f) => ({
          film_id: f.id,
          slug: f.slug,
          title: f.title,
          year: f.year,
          poster_path: artOf.get(f.slug) ?? f.poster_path,
          ts: tsMap.get(f.slug) ?? null,
          tiers: tierMap.get(f.slug) ?? [],
        })),
        honors_count: honorsRes.count ?? 0,
      },
      { headers: { ...API_CORS, "cache-control": CACHE } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "app_director_failed" },
      { status: 500, headers: API_CORS },
    );
  }
}
