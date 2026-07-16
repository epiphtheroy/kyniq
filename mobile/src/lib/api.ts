// Data paths (HANDOFF §7):
//  - one aggregate BFF endpoint per screen (film / director / tonight / services)
//  - search + user_movies go direct to Supabase (anon key + RLS)
//  - personalization (hide-seen) via /api/lens/* with a Bearer token
import { METATAKE_BASE } from "../config";
import type {
  DirectorCard,
  FilmCard,
  SearchRow,
  Service,
  TmdbFallbackRow,
  TonightPayload,
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
    opts?: { genres?: string[]; yearMin?: number; yearMax?: number; offset?: number },
  ): Promise<TonightPayload> {
    const q = new URLSearchParams({ country });
    if (providers.length) q.set("providers", providers.join(","));
    if (opts?.genres?.length) q.set("genres", opts.genres.join(","));
    if (opts?.yearMin) q.set("year_min", String(opts.yearMin));
    if (opts?.yearMax) q.set("year_max", String(opts.yearMax));
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
