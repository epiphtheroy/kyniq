// Data paths (HANDOFF §7):
//  - one aggregate BFF endpoint per screen (film / director / tonight / services)
//  - search + user_movies go direct to Supabase (anon key + RLS)
//  - personalization (hide-seen) via /api/lens/* with a Bearer token
import { METATAKE_BASE } from "../config";
import type {
  BlindspotRow,
  CollectionRow,
  CoverageRow,
  DirectorCard,
  FilmCard,
  RateStats,
  SearchRow,
  Service,
  TmdbFallbackRow,
  TonightPayload,
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

async function getJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${METATAKE_BASE}${path}`, {
    ...init,
    headers: { ...HEADERS, ...(init?.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
  return (await res.json()) as T;
}

const enc = encodeURIComponent;

export const api = {
  film(slug: string, country: string, locale: string): Promise<FilmCard> {
    return getJSON(`/api/v1/app/film/${enc(slug)}?country=${enc(country)}&locale=${enc(locale)}`);
  },

  director(slug: string, country: string): Promise<DirectorCard> {
    return getJSON(`/api/v1/app/director/${enc(slug)}?country=${enc(country)}`);
  },

  tonight(
    country: string,
    providers: number[],
    opts?: {
      genres?: string[];
      yearMin?: number;
      yearMax?: number;
      offset?: number;
      preset?: string; // comma-list — chips compose (multi-select)
      sort?: string; // u | year | title (cinecodex_ranked v11 axes)
      dir?: "asc" | "desc";
    },
  ): Promise<TonightPayload> {
    const q = new URLSearchParams({ country });
    if (providers.length) q.set("providers", providers.join(","));
    if (opts?.genres?.length) q.set("genres", opts.genres.join(","));
    if (opts?.yearMin) q.set("year_min", String(opts.yearMin));
    if (opts?.yearMax) q.set("year_max", String(opts.yearMax));
    if (opts?.preset) q.set("preset", opts.preset);
    if (opts?.sort) q.set("sort", opts.sort);
    if (opts?.dir) q.set("dir", opts.dir);
    if (opts?.offset) q.set("offset", String(opts.offset));
    return getJSON(`/api/v1/app/tonight?${q.toString()}`);
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
};
