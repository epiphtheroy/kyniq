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
      tsMin?: number; // score floor — compound criteria (server ts_min)
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
    if (opts?.tsMin) q.set("ts_min", String(opts.tsMin));
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
    const res = await fetch(`${METATAKE_BASE}/api/import/parse`, {
      method: "POST",
      headers: { ...auth, accept: "application/json" }, // content-type set by FormData
      body: form,
    });
    if (!res.ok) throw new Error(`parse ${res.status}`);
    return (await res.json()) as ImportParseResult;
  },

  /** Parse pasted text (Watcha clipboard flow — server has an LLM fallback). */
  async parseText(text: string): Promise<ImportParseResult> {
    const auth = await bearerHeaders();
    return getJSON(`/api/import/parse`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
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
      const res = await getJSON<{ results?: ImportMatch[] } | ImportMatch[]>(`/api/import/match`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ rows: chunk }),
      });
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
  ): Promise<{ jobId: string | null; committed: number }> {
    const auth = await bearerHeaders();
    let jobId: string | null = null;
    let committed = 0;
    for (let from = 0; from < rows.length; from += 50) {
      const chunk = rows.slice(from, from + 50);
      const res: { job_id?: string; added?: number; updated?: number } = await getJSON(`/api/import/commit`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ job_id: jobId, source, filename, rows: chunk }),
      });
      jobId = res.job_id ?? jobId;
      committed += (res.added ?? 0) + (res.updated ?? 0);
      onChunk?.(committed, rows.length);
    }
    return { jobId, committed };
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
    return getJSON(`/api/connect/${provider}/sync`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({}),
    });
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
