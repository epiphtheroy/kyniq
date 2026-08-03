/* Connect provider adapters — Trakt / TMDB / Simkl (HANDOFF-커넥트 §1, §3).
 * Each encapsulates its OAuth quirks and normalizes the member's library into
 * CommitRow[] (tmdb_id native to all three → direct catalog join). Tokens flow
 * only through these adapters, server-side; the app never sees them (§6-3).
 *
 * Owner console (env, all optional — a missing provider env-gates its tile off):
 *   TRAKT_CLIENT_ID / TRAKT_CLIENT_SECRET   (trakt.tv/oauth/applications)
 *   TMDB_READ_TOKEN                          (already set — themoviedb.org/settings/api)
 *   SIMKL_CLIENT_ID / SIMKL_CLIENT_SECRET    (simkl.com/settings/developer)
 */
import type { CommitRow } from "@/lib/import/commit-core";
import { cred } from "./env";

export type ProviderId = "trakt" | "tmdb" | "simkl";

export type ProviderTokens = {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null; // ISO
  accountRef?: string | null;
  scope?: string | null;
};

export type FetchResult = { rows: CommitRow[]; cursor?: string | null };

export interface Provider {
  id: ProviderId;
  configured(): boolean;
  /** Begin auth: the URL to open + an opaque `carry` to persist server-side
   * (TMDB's request_token; empty for code-flow providers). */
  beginAuth(redirectUri: string, state: string): Promise<{ url: string; carry: string | null }>;
  /** Complete from the callback: `code` = ?code= (Trakt/Simkl) or the approved
   * request_token drawn from `carry` (TMDB). */
  completeAuth(p: { code?: string; carry?: string | null; redirectUri: string }): Promise<ProviderTokens>;
  /** Refresh (Trakt only); null when not supported/needed. */
  refresh(t: ProviderTokens, redirectUri: string): Promise<ProviderTokens | null>;
  /** Pull the member's library, incremental via `cursor` where supported. */
  fetchLibrary(t: ProviderTokens, cursor?: string | null): Promise<FetchResult>;
}

/** 10-point (or 0.5–10) rating → Metatake's 0.5–5 in 0.5 steps. */
function halve(r: number | null | undefined): number | undefined {
  if (r == null) return undefined;
  const v = Math.round((r / 2) * 2) / 2;
  return Math.min(5, Math.max(0.5, v)) || undefined;
}
function isoDate(s: string | null | undefined): string | undefined {
  if (!s) return undefined;
  const d = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined;
}

// --------------------------------------------------------------------- Trakt

type TraktIds = { tmdb?: number | null; imdb?: string | null };
type TraktMovie = { title?: string; year?: number | null; ids?: TraktIds };

const trakt: Provider = {
  id: "trakt",
  configured: () => !!(cred("TRAKT_CLIENT_ID") && cred("TRAKT_CLIENT_SECRET")),
  async beginAuth(redirectUri, state) {
    const q = new URLSearchParams({
      response_type: "code",
      client_id: cred("TRAKT_CLIENT_ID")!,
      redirect_uri: redirectUri,
      state,
    });
    return { url: `https://trakt.tv/oauth/authorize?${q}`, carry: null };
  },
  async completeAuth({ code, redirectUri }) {
    const r = await fetch("https://api.trakt.tv/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: cred("TRAKT_CLIENT_ID"),
        client_secret: cred("TRAKT_CLIENT_SECRET"),
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!r.ok) throw new Error(`trakt token ${r.status}`);
    const j = await r.json();
    return {
      accessToken: j.access_token,
      refreshToken: j.refresh_token ?? null,
      expiresAt: j.created_at && j.expires_in
        ? new Date((j.created_at + j.expires_in) * 1000).toISOString()
        : null,
      scope: j.scope ?? null,
    };
  },
  async refresh(t, redirectUri) {
    if (!t.refreshToken) return null;
    const r = await fetch("https://api.trakt.tv/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        refresh_token: t.refreshToken,
        client_id: cred("TRAKT_CLIENT_ID"),
        client_secret: cred("TRAKT_CLIENT_SECRET"),
        redirect_uri: redirectUri,
        grant_type: "refresh_token",
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return {
      accessToken: j.access_token,
      refreshToken: j.refresh_token ?? t.refreshToken,
      expiresAt: j.created_at && j.expires_in
        ? new Date((j.created_at + j.expires_in) * 1000).toISOString()
        : null,
    };
  },
  async fetchLibrary(t) {
    const headers = {
      "content-type": "application/json",
      "trakt-api-version": "2",
      "trakt-api-key": cred("TRAKT_CLIENT_ID")!,
      authorization: `Bearer ${t.accessToken}`,
    };
    const [watchedRes, ratingsRes] = await Promise.all([
      fetch("https://api.trakt.tv/sync/watched/movies", { headers }),
      fetch("https://api.trakt.tv/sync/ratings/movies", { headers }),
    ]);
    if (!watchedRes.ok && !ratingsRes.ok) throw new Error("trakt fetch failed");
    const watched = watchedRes.ok
      ? ((await watchedRes.json()) as { last_watched_at?: string; movie?: TraktMovie }[])
      : [];
    const ratings = ratingsRes.ok
      ? ((await ratingsRes.json()) as { rated_at?: string; rating?: number; movie?: TraktMovie }[])
      : [];
    const byTmdb = new Map<number, CommitRow>();
    for (const w of watched) {
      const id = w.movie?.ids?.tmdb;
      if (!id) continue;
      byTmdb.set(id, {
        title: w.movie?.title ?? `TMDB ${id}`,
        tmdb_id: id,
        year: w.movie?.year ?? undefined,
        watched_at: isoDate(w.last_watched_at),
        raw: { trakt: "watched" },
      });
    }
    for (const rt of ratings) {
      const id = rt.movie?.ids?.tmdb;
      if (!id) continue;
      const row = byTmdb.get(id) ?? {
        title: rt.movie?.title ?? `TMDB ${id}`,
        tmdb_id: id,
        year: rt.movie?.year ?? undefined,
        raw: { trakt: "rated" },
      };
      row.rating = halve(rt.rating);
      if (!row.watched_at) row.watched_at = isoDate(rt.rated_at);
      byTmdb.set(id, row);
    }
    return { rows: [...byTmdb.values()] };
  },
};

// ---------------------------------------------------------------------- TMDB

const tmdb: Provider = {
  id: "tmdb",
  configured: () => !!cred("TMDB_READ_TOKEN"),
  async beginAuth(redirectUri) {
    const r = await fetch("https://api.themoviedb.org/4/auth/request_token", {
      method: "POST",
      headers: { authorization: `Bearer ${cred("TMDB_READ_TOKEN")}`, "content-type": "application/json" },
      body: JSON.stringify({ redirect_to: redirectUri }),
    });
    if (!r.ok) throw new Error(`tmdb request_token ${r.status}`);
    const j = await r.json();
    const rt = j.request_token as string;
    return { url: `https://www.themoviedb.org/auth/access?request_token=${rt}`, carry: rt };
  },
  async completeAuth({ carry }) {
    const r = await fetch("https://api.themoviedb.org/4/auth/access_token", {
      method: "POST",
      headers: { authorization: `Bearer ${cred("TMDB_READ_TOKEN")}`, "content-type": "application/json" },
      body: JSON.stringify({ request_token: carry }),
    });
    if (!r.ok) throw new Error(`tmdb access_token ${r.status}`);
    const j = await r.json();
    return { accessToken: j.access_token, accountRef: j.account_id ?? null };
  },
  async refresh() {
    return null; // v4 access tokens don't expire (revoke-only)
  },
  async fetchLibrary(t) {
    const rows: CommitRow[] = [];
    const acct = t.accountRef;
    if (!acct) return { rows };
    const head = { authorization: `Bearer ${t.accessToken}`, "content-type": "application/json" };
    // rated movies (seen + rating). paginate to total_pages.
    for (let page = 1; page <= 50; page++) {
      const r = await fetch(
        `https://api.themoviedb.org/4/account/${acct}/movie/rated?page=${page}`,
        { headers: head },
      );
      if (!r.ok) break;
      const j = await r.json();
      const results = (j.results ?? []) as {
        id: number;
        title?: string;
        release_date?: string;
        account_rating?: { value?: number };
      }[];
      for (const m of results) {
        rows.push({
          title: m.title ?? `TMDB ${m.id}`,
          tmdb_id: m.id,
          year: Number((m.release_date || "").slice(0, 4)) || undefined,
          rating: halve(m.account_rating?.value ?? null),
          raw: { tmdb: "rated" },
        });
      }
      if (page >= (j.total_pages ?? 1)) break;
    }
    // watchlist → to_watchlist
    for (let page = 1; page <= 50; page++) {
      const r = await fetch(
        `https://api.themoviedb.org/4/account/${acct}/movie/watchlist?page=${page}`,
        { headers: head },
      );
      if (!r.ok) break;
      const j = await r.json();
      const results = (j.results ?? []) as { id: number; title?: string; release_date?: string }[];
      for (const m of results) {
        rows.push({
          title: m.title ?? `TMDB ${m.id}`,
          tmdb_id: m.id,
          year: Number((m.release_date || "").slice(0, 4)) || undefined,
          to_watchlist: true,
          raw: { tmdb: "watchlist" },
        });
      }
      if (page >= (j.total_pages ?? 1)) break;
    }
    return { rows };
  },
};

// --------------------------------------------------------------------- Simkl

type SimklIds = { tmdb?: string | number | null; imdb?: string | null };
type SimklMovie = { title?: string; year?: number | null; ids?: SimklIds };

const simkl: Provider = {
  id: "simkl",
  configured: () => !!(cred("SIMKL_CLIENT_ID") && cred("SIMKL_CLIENT_SECRET")),
  async beginAuth(redirectUri, state) {
    const q = new URLSearchParams({
      response_type: "code",
      client_id: cred("SIMKL_CLIENT_ID")!,
      redirect_uri: redirectUri,
      state,
    });
    return { url: `https://simkl.com/oauth/authorize?${q}`, carry: null };
  },
  async completeAuth({ code, redirectUri }) {
    const r = await fetch("https://api.simkl.com/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: cred("SIMKL_CLIENT_ID"),
        client_secret: cred("SIMKL_CLIENT_SECRET"),
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!r.ok) throw new Error(`simkl token ${r.status}`);
    const j = await r.json();
    return { accessToken: j.access_token }; // ~5yr, no refresh
  },
  async refresh() {
    return null;
  },
  async fetchLibrary(t, cursor) {
    const headers = {
      "content-type": "application/json",
      authorization: `Bearer ${t.accessToken}`,
      "simkl-api-key": cred("SIMKL_CLIENT_ID")!,
    };
    // Covenant (§6-6): check activities first; only pull if movies changed, and
    // pass date_from for incremental sync — else the client_id gets suspended.
    let dateFrom: string | null = null;
    const act = await fetch("https://api.simkl.com/sync/activities", { headers });
    let newCursor: string | null = cursor ?? null;
    if (act.ok) {
      const a = await act.json();
      const stamp = a?.movies?.all ?? a?.movies?.rated_at ?? a?.all ?? null;
      newCursor = stamp ?? newCursor;
      if (cursor && stamp && stamp <= cursor) return { rows: [], cursor }; // nothing new
      if (cursor) dateFrom = cursor;
    }
    const url = new URL("https://api.simkl.com/sync/all-items/movies");
    url.searchParams.set("extended", "full");
    if (dateFrom) url.searchParams.set("date_from", dateFrom);
    const r = await fetch(url.toString(), { headers });
    if (!r.ok) throw new Error(`simkl all-items ${r.status}`);
    const body = await r.json();
    const movies = (body?.movies ?? []) as {
      last_watched_at?: string;
      user_rating?: number | null;
      status?: string;
      movie?: SimklMovie;
    }[];
    const rows: CommitRow[] = [];
    for (const it of movies) {
      const idRaw = it.movie?.ids?.tmdb;
      const id = typeof idRaw === "string" ? parseInt(idRaw, 10) : idRaw;
      if (!id || !Number.isFinite(id)) continue;
      const watchlist = it.status === "plantowatch";
      rows.push({
        title: it.movie?.title ?? `TMDB ${id}`,
        tmdb_id: id,
        year: it.movie?.year ?? undefined,
        rating: halve(it.user_rating ?? null),
        watched_at: watchlist ? undefined : isoDate(it.last_watched_at),
        to_watchlist: watchlist || undefined,
        raw: { simkl: it.status ?? "movie" },
      });
    }
    return { rows, cursor: newCursor };
  },
};

const PROVIDERS: Record<ProviderId, Provider> = { trakt, tmdb, simkl };

export function getProvider(id: string): Provider | null {
  return (PROVIDERS as Record<string, Provider>)[id] ?? null;
}

export function configuredProviders(): ProviderId[] {
  return (Object.keys(PROVIDERS) as ProviderId[]).filter((id) => PROVIDERS[id].configured());
}
