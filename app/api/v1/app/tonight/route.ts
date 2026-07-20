import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAndLog, API_CORS, TOO_MANY } from "@/lib/apiGuard";
import { TAKESCORE_PRESETS } from "@/lib/takescore_presets";

/**
 * Mobile BFF — Tonight feed (HANDOFF-모바일앱-프리워치.md §5.2).
 * cinecodex_ranked (Marquee v11 arg surface — new args must default to previous
 * behavior) + availability dots for the page. TakeScore comes from
 * takescore_for_slugs (the [{slug,ts}] canonical bulk contract).
 * PAYLOAD v2: optional &preset=safe|gems|century|ninety situation chips
 * (§5.2/§16.4) — absent or unknown preset keeps exactly the v1 behavior.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const CACHE = "public, s-maxage=900, stale-while-revalidate=3600";
const PAGE = 40;

/* ── Situation presets (§5.2 / §16.4) ─────────────────────────────────────
 * safe / gems / century reuse the screener registry (lib/takescore_presets.ts
 * is the single definition — §16.4); ninety is app-defined (§5.2 table is its
 * canon: runtime is not a cinecodex_ranked argument, so it post-filters).
 * The "safe" dims filter DOES have a server path (§12-9 resolved): the
 * screener sends the same ranges as cinecodex_ranked's p_sub jsonb
 * ({key:{min,max}} — see ScreenerExplorer.subJson + migration 0096), so the
 * BFF reuses that arg rather than approximating with ts_min.
 */
const APP_PRESETS = new Set(["safe", "gems", "century", "ninety"]);
const REGISTRY = new Map(TAKESCORE_PRESETS.map((p) => [p.key, p]));

type PresetArgs = {
  yearMin?: number;
  tsMin?: number;
  tsMax?: number;
  maxVotes?: number;
  sub?: Record<string, { min: number; max: number }>;
  maxRuntime?: number;
};

/** "bank:0-22,coward:0-30" (registry dims syntax) → p_sub shape. */
function dimsToSub(dims: string): Record<string, { min: number; max: number }> {
  const sub: Record<string, { min: number; max: number }> = {};
  for (const part of dims.split(",")) {
    const m = part.trim().match(/^([a-z]+):(\d{1,3})-(\d{1,3})$/);
    if (m) sub[m[1]] = { min: parseInt(m[2], 10), max: parseInt(m[3], 10) };
  }
  return sub;
}

function presetArgs(preset: string | null): PresetArgs {
  if (!preset) return {};
  // ts floor 75, not the planning doc's 85: the live TS ceiling is ~86, so
  // ts>=85 ∩ runtime<=95 is empty in practice (smoke-tested 0 rows). 75 keeps
  // the chip honest ("a great film that fits the evening") and non-empty.
  if (preset === "ninety") return { tsMin: 75, maxRuntime: 95 };
  const reg = REGISTRY.get(preset);
  if (!reg) return {};
  const out: PresetArgs = {};
  if (reg.q.since) out.yearMin = parseInt(reg.q.since, 10);
  if (reg.q.ts) {
    const m = reg.q.ts.match(/^(\d{1,3})-(\d{1,3})$/);
    if (m) {
      out.tsMin = parseInt(m[1], 10);
      out.tsMax = parseInt(m[2], 10);
    }
  }
  if (reg.q.maxVotes) out.maxVotes = parseInt(reg.q.maxVotes, 10);
  if (reg.q.dims) out.sub = dimsToSub(reg.q.dims);
  return out;
}

/** Chips compose (multi-select, 2026-07-18): every constraint holds, so merge
 *  with intersection semantics — floors take the max, ceilings take the min. */
function mergedPresetArgs(presets: string[]): PresetArgs {
  const out: PresetArgs = {};
  for (const p of presets) {
    const a = presetArgs(p);
    if (a.tsMin != null) out.tsMin = Math.max(out.tsMin ?? -Infinity, a.tsMin);
    if (a.tsMax != null) out.tsMax = Math.min(out.tsMax ?? Infinity, a.tsMax);
    if (a.yearMin != null) out.yearMin = Math.max(out.yearMin ?? -Infinity, a.yearMin);
    if (a.maxVotes != null) out.maxVotes = Math.min(out.maxVotes ?? Infinity, a.maxVotes);
    if (a.maxRuntime != null) out.maxRuntime = Math.min(out.maxRuntime ?? Infinity, a.maxRuntime);
    if (a.sub) out.sub = { ...(out.sub ?? {}), ...a.sub };
  }
  return out;
}

// Sort axes the app exposes — v11's ACTUAL tokens (0096: u·v·c·r·sharpe·
// lowrisk·newest·oldest·alpha·director·country). "newest"/"oldest" bake the
// direction in; an unknown token silently falls back to u with the dir sign
// applied, which surfaces the WORST films on asc — hence the whitelist.
const SORTS = new Set(["u", "newest", "oldest", "alpha"]);

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

  // preset: comma-list — chips are multi-select and compose (2026-07-18).
  const presets = (url.searchParams.get("preset") || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => APP_PRESETS.has(s))
    .slice(0, 4);
  const pa = mergedPresetArgs(presets);
  const sortRaw = url.searchParams.get("sort");
  const sort = sortRaw && SORTS.has(sortRaw) ? sortRaw : "u";
  const dir = url.searchParams.get("dir") === "asc" ? "asc" : "desc";
  // year_min: intersection when both a preset (century=2000) and an explicit
  // filter are present — both constraints hold, so the tighter one wins.
  const yearMinParam = num("year_min");
  const yearMin =
    pa.yearMin != null && yearMinParam != null
      ? Math.max(pa.yearMin, yearMinParam)
      : pa.yearMin ?? yearMinParam;
  // ts_min/ts_max: explicit score-floor filters (owner directive 2026-07-20 —
  // compound criteria like "TS ≥ 70, newest first"). Same intersection rule as
  // year_min: when a preset also constrains TS, the tighter bound wins.
  const tsMinParam = num("ts_min");
  const tsMin =
    pa.tsMin != null && tsMinParam != null ? Math.max(pa.tsMin, tsMinParam) : pa.tsMin ?? tsMinParam;
  const tsMaxParam = num("ts_max");
  const tsMax =
    pa.tsMax != null && tsMaxParam != null ? Math.min(pa.tsMax, tsMaxParam) : pa.tsMax ?? tsMaxParam;

  const db = createAdminClient();
  if (await guardAndLog(db, req, "app_tonight", country)) {
    return NextResponse.json(TOO_MANY, { status: 429, headers: API_CORS });
  }

  try {
    const { data, error } = await db.rpc("cinecodex_ranked", {
      p_sort: sort,
      p_dir: dir,
      p_providers: providers.length ? providers : null,
      p_watch_country: country,
      p_watch_countries: [country],
      p_include_us_library: false,
      p_include_rent: false,
      p_genres: genres.length ? genres : null,
      p_year_min: yearMin,
      p_year_max: num("year_max"),
      p_ts_min: tsMin ?? null,
      p_ts_max: tsMax ?? null,
      p_max_votes: pa.maxVotes ?? null,
      p_sub: pa.sub ?? {},
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

    // "90 in 90 min" (app-defined, HANDOFF §5.2/§12-9): runtime is not a
    // cinecodex_ranked argument, so post-filter the returned page on
    // films.runtime. The page may come back short of `limit` (acceptable —
    // the client just paginates on), and `total` stays the unfiltered RPC
    // count. Unknown runtime is excluded: the chip promises ≤95 min, and we
    // never guess (§13-17).
    if (pa.maxRuntime != null && page.rows.length) {
      const { data: rtRows } = await db
        .from("films")
        .select("slug, runtime")
        .in("slug", page.rows.map((r) => r.slug));
      const rtMap = new Map(
        ((rtRows ?? []) as { slug: string; runtime: number | null }[]).map((f) => [
          f.slug,
          f.runtime,
        ]),
      );
      const cap = pa.maxRuntime;
      page.rows = page.rows.filter((r) => {
        const rt = rtMap.get(r.slug);
        return rt != null && rt <= cap;
      });
    }

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
        v: 2,
        country,
        preset: presets.length ? presets.join(",") : null,
        sort,
        dir,
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
