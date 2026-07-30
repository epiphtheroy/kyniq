// Data paths (HANDOFF §7):
//  - one aggregate BFF endpoint per screen (film / director / tonight / services)
//  - search + user_movies go direct to Supabase (anon key + RLS)
//  - personalization (hide-seen) via /api/lens/* with a Bearer token
import { METATAKE_BASE } from "../config";
import type {
  AuteurConquestRow,
  BlindspotRow,
  CollectionRow,
  CoverageRow,
  DirectorCard,
  FilmCard,
  NavActive,
  NavCatalog,
  NavCatalogEntry,
  NavDest,
  NavDestinations,
  NavigatorPayload,
  NavPickDest,
  NavPref,
  OdyMapLite,
  RateStats,
  SearchRow,
  Service,
  TmdbFallbackRow,
  TonightPayload,
  TowComment,
  WatchlistScoredRow,
  WwiRow,
} from "../types";
import { supabase } from "./supabase";

// `accept` only — every header here must stay CORS-safelisted. A custom header
// (x-metatake-app) turns each GET into a preflighted request, and the public API's
// allow-headers is content-type only, so the browser preview would fail on every
// read. Nothing server-side consumed it (guardAndLog ledgers the user-agent), so
// the version travels in the UA instead.
const HEADERS: Record<string, string> = {
  accept: "application/json",
};

async function getJSON<T>(path: string, init?: RequestInit, timeoutMs = 15000): Promise<T> {
  // Bound every request: a stalled mobile connection must reject (→ the screen's
  // error+retry path), not hang a spinner forever with no way back. Long-running
  // import/sync calls pass a bigger budget — a first Trakt sync or a big Watcha
  // paste legitimately runs the server for minutes (QA 07-29: the blanket 15s was
  // aborting client-side while the server finished and wrote anyway).
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${METATAKE_BASE}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { ...HEADERS, ...(init?.headers as Record<string, string> | undefined) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

const enc = encodeURIComponent;

export const api = {
  film(slug: string, country: string, locale: string): Promise<FilmCard> {
    return getJSON(`/api/v1/app/film/${enc(slug)}?country=${enc(country)}&locale=${enc(locale)}`);
  },

  director(slug: string, country: string): Promise<DirectorCard> {
    return getJSON(`/api/v1/app/director/${enc(slug)}?country=${enc(country)}`);
  },

  /**
   * The Navigator drive view (HANDOFF-navigator §5.3). A destination is either a
   * director conquest ({ dir }) or a canon list ({ lineage, label }); nothing set
   * falls back server-side to the canon default. The chevron position is ledger-
   * derived server-side, so we send the app's Bearer token when signed in;
   * anonymous callers get a not-yet-started drive (full route from film 1).
   * `pref` only sets which route is the top-level convenience block — all three
   * routes come back either way, so the switch is instant with no refetch.
   */
  async navigator(dest: NavDest, country: string, pref?: NavPref): Promise<NavigatorPayload> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const q = new URLSearchParams({ country });
    if (dest.lineage) {
      q.set("lineage", dest.lineage);
      if (dest.label) q.set("label", dest.label);
    } else if (dest.dir) {
      q.set("dir", dest.dir);
    }
    if (pref) q.set("pref", pref);
    return getJSON(`/api/v1/app/navigator?${q.toString()}`, {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
    });
  },

  /**
   * The odyssey plane artifact (map v3) — a public static JSON on the web origin.
   * The drive idealises the route into a hero lane over this map's faded lineages
   * and stations. Fetched once, cached in component state; callers silent-catch and
   * fall back to the synthetic overworld, so a miss never breaks the drive.
   */
  odysseyMap(): Promise<OdyMapLite> {
    return getJSON(`/odyssey/map.v1.json`);
  },

  /** The /journey availability artifact (country → slug → provider list) — the same
   * public JSON the web deck filters its deal with. Callers silent-catch. */
  odysseyAvail(): Promise<Record<string, Record<string, unknown[]>>> {
    return getJSON(`/odyssey/avail.v1.json`);
  },

  /**
   * The "Where to?" picker lists (§5.1) — destinations the viewer is mid-journey on.
   * Built client-side from the auth.uid()-scoped me_* RPCs (me_coverage + me_auteur_
   * conquest) — the same rows /room/navigator's picker uses, with the same gates.
   * These are personal reads called directly with the user's JWT (no BFF hop, no
   * `*_mine` — §13-4). Signed-out callers get empty lists (the screen shows the CTA).
   */
  async navigatorDestinations(): Promise<NavDestinations> {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return { directors: [], canon: [] };
    const NUM = (v: number | string | null | undefined): number =>
      v == null ? 0 : typeof v === "string" ? parseFloat(v) || 0 : v;
    const [cov, aut] = await Promise.all([
      me.coverage(5, 300).catch(() => [] as CoverageRow[]),
      me.auteurConquest(60).catch(() => null),
    ]);
    const directors: NavPickDest[] = ((aut as AuteurConquestRow[] | null) ?? [])
      .map((a) => ({
        kind: "dir" as const,
        key: a.slug,
        label: a.name ?? a.slug,
        seen: NUM(a.seen),
        total: NUM(a.total),
        pct: Math.round(NUM(a.pct)),
      }))
      .filter((d) => d.pct < 100 && d.seen > 0 && d.total >= 8)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 16);
    // The full coverage list — every drivable lineage not yet complete (parity with
    // /room/navigator's relaxed rail: drop the seen>0 and total≤60 caps so unstarted
    // and larger canons appear too; in-progress ranks first, then total). Capped 40.
    const canon: NavPickDest[] = (cov as CoverageRow[])
      .map((c) => ({
        kind: "lineage" as const,
        key: c.slug,
        label: c.label,
        facet: c.facet,
        seen: NUM(c.seen),
        total: NUM(c.total),
        pct: Math.round(NUM(c.pct)),
      }))
      .filter((d) => d.pct < 100 && d.total >= 8)
      .sort((a, b) => b.pct - a.pct || b.total - a.total)
      .slice(0, 40);
    return { directors, canon };
  },

  /**
   * Lineage lists only, with the viewer's progress overlaid — the light payload behind
   * Explore's Collections rail (owner 07-29: lists must be browsable and inviting).
   * Same rows/mapping as navigatorCatalog's lineage leg, without the heavy directors blob.
   */
  async lineageCatalog(): Promise<NavCatalogEntry[]> {
    const NUM = (v: number | string | null | undefined): number =>
      v == null ? 0 : typeof v === "string" ? parseFloat(v) || 0 : v;
    const [linRes, cov] = await Promise.all([
      supabase.rpc("lineage_index"),
      me.coverage(0, 3000).catch(() => [] as CoverageRow[]),
    ]);
    const covBySlug = new Map<string, { seen: number; pct: number }>();
    for (const c of (cov as CoverageRow[])) covBySlug.set(c.slug, { seen: NUM(c.seen), pct: Math.round(NUM(c.pct)) });
    type LinRow = { facet: string; slug: string; label: string; parent_label: string | null; country: string | null; film_count: number | string | null };
    return ((linRes.data ?? []) as LinRow[])
      .map((l) => {
        const c = covBySlug.get(l.slug);
        return {
          kind: "lineage" as const,
          key: l.slug,
          label: l.label,
          facet: l.facet,
          total: NUM(l.film_count),
          seen: c?.seen ?? 0,
          pct: c?.pct ?? 0,
          search: `${l.label} ${l.parent_label ?? ""} ${l.facet ?? ""} ${l.country ?? ""}`.toLowerCase(),
        };
      })
      .filter((l) => !!l.key && l.total >= 5);
  },

  /**
   * The FULL browsable catalog — every director oeuvre + every lineage/list — for the
   * Navigator tab's list search (owner 07-29). Unlike navigatorDestinations (personal
   * in-progress only), this browses the whole vocabulary via anon RPCs (lineage_index +
   * directors_catalogue_v2) and overlays the viewer's progress by slug. Signed-out still
   * gets the full catalog with zeroed rings. Loaded lazily (only when the user searches).
   */
  async navigatorCatalog(): Promise<NavCatalog> {
    const NUM = (v: number | string | null | undefined): number =>
      v == null ? 0 : typeof v === "string" ? parseFloat(v) || 0 : v;
    const [linRes, dirRes, cov, aut] = await Promise.all([
      supabase.rpc("lineage_index"),
      supabase.rpc("directors_catalogue_v2"),
      me.coverage(0, 3000).catch(() => [] as CoverageRow[]),
      me.auteurConquest(3000).catch(() => null),
    ]);
    const covBySlug = new Map<string, { seen: number; pct: number }>();
    for (const c of (cov as CoverageRow[])) covBySlug.set(c.slug, { seen: NUM(c.seen), pct: Math.round(NUM(c.pct)) });
    const autBySlug = new Map<string, { seen: number; pct: number }>();
    for (const a of ((aut as AuteurConquestRow[] | null) ?? [])) autBySlug.set(a.slug, { seen: NUM(a.seen), pct: Math.round(NUM(a.pct)) });

    type LinRow = { facet: string; slug: string; label: string; parent_label: string | null; country: string | null; film_count: number | string | null };
    const lineages: NavCatalogEntry[] = ((linRes.data ?? []) as LinRow[])
      .map((l) => {
        const c = covBySlug.get(l.slug);
        return {
          kind: "lineage" as const,
          key: l.slug,
          label: l.label,
          facet: l.facet,
          total: NUM(l.film_count),
          seen: c?.seen ?? 0,
          pct: c?.pct ?? 0,
          search: `${l.label} ${l.parent_label ?? ""} ${l.facet ?? ""} ${l.country ?? ""}`.toLowerCase(),
        };
      })
      .filter((l) => !!l.key && l.total >= 2)
      .sort((a, b) => b.pct - a.pct || b.total - a.total);

    type DirRow = { slug: string; name: string; country: string | null; films: number | string | null };
    const dirBlob = (dirRes.data ?? {}) as { items?: DirRow[] };
    const directors: NavCatalogEntry[] = (dirBlob.items ?? [])
      .map((d) => {
        const a = autBySlug.get(d.slug);
        return {
          kind: "dir" as const,
          key: d.slug,
          label: d.name,
          total: NUM(d.films),
          seen: a?.seen ?? 0,
          pct: a?.pct ?? 0,
          search: `${d.name ?? ""} ${d.country ?? ""}`.toLowerCase(),
        };
      })
      .filter((d) => !!d.key && !!d.label && d.total >= 2)
      .sort((a, b) => b.pct - a.pct || b.total - a.total);
    return { directors, lineages };
  },

  tonight(
    country: string,
    providers: number[],
    opts?: {
      genres?: string[];
      yearMin?: number;
      yearMax?: number;
      tsMin?: number; // score floor — compound criteria (server ts_min)
      offset?: number;
      preset?: string; // comma-list — chips compose (multi-select)
      sort?: string; // u | year | title (cinecodex_ranked v11 axes)
      dir?: "asc" | "desc";
      /** Production countries (ISO2, lowercase). Multi-select; the BFF fans out. */
      countries?: string[];
    },
  ): Promise<TonightPayload> {
    const q = new URLSearchParams({ country });
    if (providers.length) q.set("providers", providers.join(","));
    if (opts?.genres?.length) q.set("genres", opts.genres.join(","));
    if (opts?.yearMin) q.set("year_min", String(opts.yearMin));
    if (opts?.yearMax) q.set("year_max", String(opts.yearMax));
    if (opts?.tsMin) q.set("ts_min", String(opts.tsMin));
    if (opts?.preset) q.set("preset", opts.preset);
    if (opts?.sort) q.set("sort", opts.sort);
    if (opts?.dir) q.set("dir", opts.dir);
    if (opts?.countries?.length) q.set("countries", opts.countries.join(","));
    if (opts?.offset) q.set("offset", String(opts.offset));
    return getJSON(`/api/v1/app/tonight?${q.toString()}`);
  },

  /** Production countries with film counts, already ordered by count desc.
   *  Returns [] on an older server — the caller hides the filter in that case. */
  async filmCountries(): Promise<{ code: string; count: number }[]> {
    try {
      const out = await getJSON<{ countries?: { code: string; count: number }[] }>(
        `/api/v1/app/countries`,
      );
      return out.countries ?? [];
    } catch {
      return [];
    }
  },

  services(country: string): Promise<{ services: Service[] }> {
    return getJSON(`/api/v1/app/services?country=${enc(country)}`);
  },

  /** Mint a logged-in web URL for the in-app reader (invariant §13-12). */
  async handoffUrl(next: string): Promise<string> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return `${METATAKE_BASE}${next}`; // anonymous reader
    try {
      const out = await getJSON<{ url: string }>(`/api/v1/app/handoff`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ next }),
      });
      return out.url;
    } catch {
      return `${METATAKE_BASE}${next}`; // fail-open to anonymous
    }
  },

  /** Personalized ranked feed (hide seen) — lens route with Bearer fallback auth. */
  async tonightMine(
    country: string,
    providers: number[],
    limit = 40,
    offset = 0,
  ): Promise<{ total: number; rows: unknown[] } | null> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    const q = new URLSearchParams({
      watch_countries: country,
      sort: "u",
      dir: "desc",
      mode: "exclude",
      limit: String(limit),
      offset: String(offset),
    });
    if (providers.length) q.set("prov", providers.join(","));
    try {
      return await getJSON(`/api/lens/marquee?${q.toString()}`, {
        headers: { authorization: `Bearer ${token}` },
      });
    } catch {
      return null;
    }
  },

  /** Omni search — direct anon RPC (fast path, no BFF). */
  async search(qRaw: string): Promise<SearchRow[]> {
    const q = qRaw.trim().replace(/\s+/g, " ").slice(0, 200);
    if (!q) return [];
    const { data, error } = await supabase.rpc("search_all", { p_q: q, p_limit: 40 });
    if (error) throw error;
    return (data ?? []) as SearchRow[];
  },

  /**
   * Very-fuzzy, 1-char-capable, MULTILINGUAL film search (film_catalog_search, migration
   * 0116) — accent-insensitive across title / original_title / title_ko. search_all gates
   * at length>=2 and ignores title_ko, so this fills what it misses (1 char, Korean/accented
   * titles). Returned as SearchRow (kind:"film") to merge into the Explore results. Fails
   * soft to []. */
  async searchFuzzy(qRaw: string, limit = 30): Promise<SearchRow[]> {
    const q = qRaw.trim().replace(/\s+/g, " ").slice(0, 200);
    if (!q) return [];
    const { data, error } = await supabase.rpc("film_catalog_search", { p_q: q, p_limit: limit });
    if (error) return [];
    type FCRow = {
      slug: string;
      title: string;
      original_title: string | null;
      title_ko: string | null;
      year: number | null;
      director: string | null;
      poster_path: string | null;
      is_catalog: boolean;
      score: number;
    };
    return ((data ?? []) as FCRow[]).map((r) => ({
      kind: "film",
      slug: r.slug,
      film_slug: r.slug,
      title: r.title,
      // Year FIRST in the subtitle (owner 07-29: every film row must show year + TS)
      // — mirrors search_all's "1994 · Wong Kar-wai" format.
      sub: [r.year, r.director ?? r.original_title].filter(Boolean).join(" · "),
      poster: r.poster_path,
      year: r.year,
      score: r.score,
      is_catalog: r.is_catalog,
    }));
  },

  /**
   * to.W — the curator's letter for one film ("to. WY. Heo / from. Metatake AI
   * Editorial", LLM-0 template over curation.v_film_comment). Same anon tow_comment
   * RPC the web TowCard uses. Null is a real state (curation-less films show nothing).
   */
  async towComment(slug: string): Promise<TowComment | null> {
    const { data, error } = await supabase.rpc("tow_comment", { p_slug: slug });
    if (error) return null;
    return (data as TowComment | null) ?? null;
  },

  /** Bulk TakeScore for search rows. */
  async takescores(slugs: string[]): Promise<Map<string, number>> {
    if (!slugs.length) return new Map();
    const { data } = await supabase.rpc("takescore_for_slugs", { p_slugs: slugs });
    const m = new Map<string, number>();
    for (const r of (data ?? []) as { slug: string; ts: number }[]) m.set(r.slug, r.ts);
    return m;
  },

  /** Availability dots for a batch of slugs in one country. */
  async availability(
    slugs: string[],
    country: string,
  ): Promise<Map<string, string[]>> {
    if (!slugs.length) return new Map();
    const { data } = await supabase.rpc("film_availability", {
      p_slugs: slugs,
      p_countries: [country],
      p_providers: null,
      p_include_us_library: false,
    });
    const m = new Map<string, string[]>();
    for (const row of (data ?? []) as { slug: string; tiers: { kind: string }[] }[]) {
      m.set(row.slug, [...new Set((row.tiers ?? []).map((t) => t.kind))]);
    }
    return m;
  },

  /** TMDB no-result fallback (§5.3) — proxied via BFF to keep TMDB tokens server-side. */
  tmdbFallback(q: string): Promise<{ results: TmdbFallbackRow[] }> {
    return getJSON(`/api/v1/app/tmdb-search?q=${enc(q)}`);
  },

  /** Register the device push token (own-row RLS insert). */
  async registerPushToken(
    token: string,
    country: string,
    locale: string,
    platform: string,
  ): Promise<boolean> {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) return false;
    const { error } = await supabase.from("push_tokens").upsert(
      {
        token,
        user_id: uid,
        country_code: country,
        locale,
        platform,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    );
    return !error;
  },

  /** Persist edition prefs server-side (push worker join key). */
  async syncPrefs(prefs: {
    country: string;
    locale: string;
    providerIds: number[];
    pushEnabled: boolean;
  }): Promise<void> {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) return;
    await supabase.from("user_prefs").upsert(
      {
        user_id: uid,
        country_code: prefs.country,
        locale: prefs.locale,
        provider_ids: prefs.providerIds,
        push_enabled: prefs.pushEnabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  },
};

const wwiMemo = new Map<string, Promise<WwiRow[]>>();

// ---------------------------------------------------------------------------
// v4 personal reads — the `me_*` family, called directly with the user's JWT
// (auth.uid()-scoped SECURITY DEFINER; authenticated EXECUTE verified live
// 2026-07-17). Small per-user payloads, so no BFF hop. Ledger WRITES live in
// src/state/films.tsx — screens must mutate through the provider, not here.
export const me = {
  /** Personal ranked candidates + reason chips. λ: 1.4 cautious / 1.0 balanced / 0.6 bold. */
  async recommend(lambda: number, limit: number): Promise<WwiRow[]> {
    const { data, error } = await supabase.rpc("me_recommend_wwi", {
      p_lambda: lambda,
      p_limit: limit,
    });
    if (error) throw error;
    return (data ?? []) as WwiRow[];
  },

  /**
   * Session-memoized wwi — one fetch per λ powers Tonight reason chips, the
   * film brief's For You section, and the Bold pick source without re-querying.
   * Resolves to [] when signed out or on error (callers render nothing — §13-17).
   */
  recommendCached(lambda: number, limit = 60): Promise<WwiRow[]> {
    const key = `${lambda}:${limit}`;
    const hit = wwiMemo.get(key);
    if (hit) return hit;
    const p = this.recommend(lambda, limit).catch(() => [] as WwiRow[]);
    wwiMemo.set(key, p);
    return p;
  },

  /** Drop wwi memos — call after judgments change what should be recommended. */
  invalidateRecommend(): void {
    wwiMemo.clear();
  },

  /** Shelf queue — watchlist rows with scores + availability + added_at. */
  async watchlistScored(): Promise<WatchlistScoredRow[]> {
    const out: WatchlistScoredRow[] = [];
    // TABLE-returning RPC obeys the PostgREST 1000-row cap — page with .range().
    for (let from = 0; from < 5000; from += 1000) {
      const { data, error } = await supabase.rpc("me_watchlist_scored").range(from, from + 999);
      if (error || !data) break;
      out.push(...(data as WatchlistScoredRow[]));
      if ((data as unknown[]).length < 1000) break;
    }
    return out;
  },

  /** Seen positions (rating + prestige → verdict recap). Pages the 1000-row cap. */
  async collection(maxRows = 4000): Promise<CollectionRow[]> {
    const out: CollectionRow[] = [];
    for (let from = 0; from < maxRows; from += 1000) {
      const { data, error } = await supabase.rpc("me_collection").range(from, from + 999);
      if (error || !data) break;
      out.push(...(data as CollectionRow[]));
      if ((data as unknown[]).length < 1000) break;
    }
    return out;
  },

  async rateStats(): Promise<RateStats | null> {
    const { data, error } = await supabase.rpc("me_rate_stats");
    if (error || !data) return null;
    const row = Array.isArray(data) ? data[0] : data;
    return (row ?? null) as RateStats | null;
  },

  async coverage(minTotal = 5, limit = 40): Promise<CoverageRow[]> {
    const { data, error } = await supabase.rpc("me_coverage", {
      p_min_total: minTotal,
      p_limit: limit,
    });
    if (error) return [];
    return (data ?? []) as CoverageRow[];
  },

  async blindspots(limit = 3, minTotal = 10, minAw = 0): Promise<BlindspotRow[]> {
    const { data, error } = await supabase.rpc("me_blindspots", {
      p_limit: limit,
      p_min_total: minTotal,
      p_min_aw: minAw,
    });
    if (error) return [];
    return (data ?? []) as BlindspotRow[];
  },

  /** Director oeuvre conquest — returns the /room JSON blob as-is. */
  async auteurConquest(limit = 6): Promise<unknown> {
    const { data, error } = await supabase.rpc("me_auteur_conquest", { p_limit: limit });
    if (error) return null;
    return data;
  },

  /**
   * The director the user is mid-conquest on — most-invested started oeuvre with
   * films still to go — for the Navigator's default destination (§3). Null when
   * signed out or nothing started; the screen then falls back to a canon default.
   * me_auteur_conquest returns a single JSON array (cap-safe), so no paging.
   */
  async midConquestDirector(): Promise<string | null> {
    const { data, error } = await supabase.rpc("me_auteur_conquest", { p_limit: 30 });
    if (error || !data) return null;
    const num = (x: number | string | null): number => {
      const n = typeof x === "string" ? parseFloat(x) : x;
      return Number.isFinite(n as number) ? (n as number) : 0;
    };
    const rows = (data as AuteurConquestRow[])
      .map((r) => ({ slug: r.slug, seen: num(r.seen), total: num(r.total) }))
      .filter((r) => r.slug && r.seen >= 1 && r.total > r.seen) // started, not complete
      .sort((a, b) => b.seen - a.seen); // most invested first
    return rows[0]?.slug ?? null;
  },

  // ── Resume — persist WHICH destination is being driven so the picker
  //    can offer a Resume card. Position/progress stay ledger-derived (§10-1): these
  //    RPCs store only the destination descriptor + pref, never the chevron. Called
  //    directly with the user's JWT (me_*, not *_mine — §13-4). Fire-and-forget from
  //    the drive; a failed write must never break the screen.

  /** Upsert the active drive (there IS a next turn). */
  async navStart(p: {
    dest_kind: string;
    dest_key: string;
    dest_label: string;
    route_pref: string;
  }): Promise<void> {
    await supabase.rpc("me_nav_start", {
      p_dest_kind: p.dest_kind,
      p_dest_key: p.dest_key,
      p_dest_label: p.dest_label,
      p_route_pref: p.route_pref,
    });
  },

  /** Retire the active drive (arrived — no next turn). */
  async navArrive(p: { dest_kind: string; dest_key: string }): Promise<void> {
    await supabase.rpc("me_nav_arrive", {
      p_dest_kind: p.dest_kind,
      p_dest_key: p.dest_key,
    });
  },

  /** The member's single active drive (or null). me_nav_active returns ≤1 row. */
  async navActive(): Promise<NavActive | null> {
    const { data, error } = await supabase.rpc("me_nav_active");
    if (error || !data) return null;
    const row = Array.isArray(data) ? data[0] : data;
    return (row ?? null) as NavActive | null;
  },
};

// ---------------------------------------------------------------------------
// Connect I1 — the existing /me/import pipeline (parse → match → commit),
// called with the app session's Bearer token (the routes gained an additive
// Bearer fallback; cookie path on the web is untouched).

async function bearerHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("auth");
  return { authorization: `Bearer ${token}` };
}

export type ImportRow = {
  i: number;
  title: string;
  year?: number;
  rating?: number;
  watched_at?: string;
  note?: string;
  rewatch?: boolean;
  tmdb_id?: number;
  imdb_id?: string;
  to_watchlist?: boolean;
  raw?: Record<string, unknown>;
};
export type ImportParseResult = { source: string; rows: ImportRow[]; warnings: string[] };
export type ImportMatch = {
  i: number;
  status: "matched" | "ambiguous" | "none";
  match?: { tmdb_id: number; title: string; year: string; poster_path: string | null };
  candidates?: { tmdb_id: number; title: string; year: string; poster_path: string | null }[];
};

export const importApi = {
  /** Parse a picked file (ZIP/CSV/XLSX). RN FormData file part: {uri, name, type}. */
  async parseFile(file: { uri: string; name: string; mimeType?: string }): Promise<ImportParseResult> {
    const auth = await bearerHeaders();
    const form = new FormData();
    // React Native's FormData file part — not a web File object.
    form.append("file", {
      uri: file.uri,
      name: file.name,
      type: file.mimeType ?? "application/octet-stream",
    } as unknown as Blob);
    // Bound the upload (QA 07-29: this was the one unbounded fetch — a stalled
    // cellular upload hung "Reading the file…" forever). Generous: big ZIPs are real.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 180_000);
    let res: Response;
    try {
      res = await fetch(`${METATAKE_BASE}/api/import/parse`, {
        method: "POST",
        headers: { ...auth, accept: "application/json" }, // content-type set by FormData
        body: form,
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new Error(`parse ${res.status}`);
    return (await res.json()) as ImportParseResult;
  },

  /** Parse pasted text (Watcha clipboard flow — server has an LLM fallback). */
  async parseText(text: string): Promise<ImportParseResult> {
    const auth = await bearerHeaders();
    return getJSON(
      `/api/import/parse`,
      {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ text }),
      },
      180_000, // Watcha paste runs a sequential LLM fallback server-side — minutes, not 15s
    );
  },

  /** TMDB matching — imdb_id (tt…) rows resolve exactly. The server route CAPS
   * each request at 25 rows (it does not paginate), so chunk client-side and
   * concatenate — otherwise a >25-film history silently loses everything past
   * the 25th. onChunk drives the "matching…" progress. */
  async match(rows: ImportRow[], onChunk?: (done: number, total: number) => void): Promise<ImportMatch[]> {
    const auth = await bearerHeaders();
    const out: ImportMatch[] = [];
    for (let from = 0; from < rows.length; from += 25) {
      const chunk = rows.slice(from, from + 25);
      const res = await getJSON<{ results?: ImportMatch[] } | ImportMatch[]>(
        `/api/import/match`,
        {
          method: "POST",
          headers: { ...auth, "content-type": "application/json" },
          body: JSON.stringify({ rows: chunk }),
        },
        60_000, // 25 TMDB lookups on a slow link outrun 15s
      );
      out.push(...(Array.isArray(res) ? res : (res.results ?? [])));
      onChunk?.(Math.min(from + 25, rows.length), rows.length);
    }
    return out;
  },

  /** Commit in ≤50-row chunks (server contract); returns totals + job id.
   * `committed` is the truthful net write count (added+updated), never the raw
   * chunk length — re-importing an all-duplicate history must not report writes. */
  async commit(
    rows: ImportRow[],
    source: string,
    filename: string | null,
    onChunk?: (committed: number, total: number) => void,
  ): Promise<{ jobId: string | null; committed: number; failed: { title: string; year?: number | null }[] }> {
    const auth = await bearerHeaders();
    let jobId: string | null = null;
    let committed = 0;
    const failed: { title: string; year?: number | null }[] = [];
    for (let from = 0; from < rows.length; from += 50) {
      const chunk = rows.slice(from, from + 50);
      const res: { job_id?: string; added?: number; updated?: number; failed?: { title: string; year?: number | null }[] } = await getJSON(
        `/api/import/commit`,
        {
          method: "POST",
          headers: { ...auth, "content-type": "application/json" },
          body: JSON.stringify({ job_id: jobId, source, filename, rows: chunk }),
        },
        60_000, // per-chunk Tier-2 film resolution hits TMDB — needs headroom
      );
      jobId = res.job_id ?? jobId;
      committed += (res.added ?? 0) + (res.updated ?? 0);
      failed.push(...(res.failed ?? [])); // unresolvable films — surfaced as honest leftovers
      onChunk?.(committed, rows.length);
    }
    return { jobId, committed, failed };
  },
};

// ---------------------------------------------------------------------------
// Connect I2 — OAuth connectors (Trakt / TMDB / Simkl). The app never touches
// provider tokens (§6-3): it opens the system browser, hands the returned
// code/request_token to the server, and the server holds the tokens + runs the
// sync (parse → match → commit into the same ledger, §6-4). Every route is
// env-gated server-side — a provider with no credentials answers 503, which we
// surface as a friendly "coming soon" rather than an error.

export type ConnectProvider = "trakt" | "tmdb" | "simkl";

/** Token-free connection row from the me_connections() RPC (§4). */
export type ConnectionRow = {
  provider: ConnectProvider;
  status: "connected" | "error" | "revoked";
  last_sync_at: string | null;
  synced_films: number | null;
  error: string | null;
  created_at: string;
};

/** Raised when the owner hasn't configured a provider's credentials yet (503). */
export const NOT_CONFIGURED = "not_configured";

export const connectApi = {
  /**
   * Begin the OAuth dance. Returns the provider's authorize URL and a `pending`
   * carry (TMDB's request_token; null for the code-flow providers) that must be
   * echoed back to callback(). Throws NOT_CONFIGURED on a 503 (unset env).
   */
  async start(
    provider: ConnectProvider,
    redirectUri: string,
  ): Promise<{ url: string; pending: string | null }> {
    const auth = await bearerHeaders();
    const res = await fetch(`${METATAKE_BASE}/api/connect/${provider}/start`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ redirect_uri: redirectUri }),
    });
    if (res.status === 503) throw new Error(NOT_CONFIGURED);
    if (!res.ok) throw new Error(`connect start ${res.status}`);
    const out = (await res.json()) as { url: string; pending?: string | null };
    return { url: out.url, pending: out.pending ?? null };
  },

  /** Exchange the browser result (code / request_token) + carry for stored tokens. */
  async callback(
    provider: ConnectProvider,
    args: { code?: string; request_token?: string; pending: string | null },
  ): Promise<{ ok: boolean }> {
    const auth = await bearerHeaders();
    return getJSON(`/api/connect/${provider}/callback`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({
        code: args.code ?? null,
        request_token: args.request_token ?? null,
        pending: args.pending,
      }),
    });
  },

  /** Server-side pull of the member's library into the shared ledger. */
  async sync(
    provider: ConnectProvider,
  ): Promise<{ ok: boolean; added: number; updated: number; films: number }> {
    const auth = await bearerHeaders();
    return getJSON(
      `/api/connect/${provider}/sync`,
      {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({}),
      },
      120_000, // first sync pulls + commits the entire provider library in one request
    );
  },

  /** Revoke + delete the stored tokens (§6-3). Imported ledger rows remain. */
  async disconnect(provider: ConnectProvider): Promise<void> {
    const auth = await bearerHeaders();
    await getJSON(`/api/connect/${provider}/disconnect`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({}),
    });
  },

  /** Token-free connection states for the signed-in user (own-row via RPC). */
  async states(): Promise<ConnectionRow[]> {
    const { data, error } = await supabase.rpc("me_connections");
    if (error) return [];
    return (data ?? []) as ConnectionRow[];
  },
};
