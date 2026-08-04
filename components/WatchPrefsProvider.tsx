"use client";

/**
 * WatchPrefsProvider — one home for "where I watch" and "what films are called".
 * (Port of the app's src/state/prefs.tsx — HANDOFF-모바일앱-프리워치.md ⭐③)
 *
 * Until now the web had no such thing: the Screener and the Marquee each kept
 * their own copy of country+providers in localStorage and wrote it back on every
 * change, so the two surfaces agreed only by accident and nothing else on the
 * site could read the answer. The app solved this a while ago — one store, three
 * axes, local-first with a server mirror. This is that store.
 *
 * Invariants:
 *   · HYDRATION — the first client render MUST match the server HTML, so state
 *     starts at the defaults and storage is applied in an effect. `ready` says
 *     whether that has happened; consumers gate their first fetch on it rather
 *     than firing once with defaults and again with the truth.
 *   · LOCAL-FIRST — localStorage is the source of truth. A signed-in viewer also
 *     gets their country+services mirrored to TWO server stores, because two
 *     already exist and they serve different readers:
 *       me_services / me_set_services (migration 0114) — the web account store
 *         the room and the navigator read. This provider is now its ONLY writer;
 *         the Marquee used to write it directly.
 *       user_prefs (migration 0106) — what the phone app and the availability
 *         push worker join on. Writing it is what makes a setup chosen in the
 *         browser show up in the app, and the other way round.
 *   · The user_prefs mirror writes ONLY country_code/provider_ids. `locale` and
 *     `push_enabled` in that row belong to the app's push delivery — an upsert
 *     that omits them cannot clobber them.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { loadAccountServices, saveAccountServices } from "@/lib/conversion/services";
import {
  DEFAULT_WATCH_PREFS,
  WATCH_PREFS_KEY,
  parseWatchPrefs,
  type WatchPrefs,
} from "@/lib/watch-prefs";

type Ctx = WatchPrefs & {
  /** True once stored prefs have been applied. Gate first fetches on this. */
  ready: boolean;
  set: (patch: Partial<WatchPrefs>) => void;
};

const WatchPrefsCtx = createContext<Ctx | null>(null);

/** One client for this module. A fresh one per call would add another
 *  GoTrueClient to the tab for a job that is two small queries. */
let _sb: ReturnType<typeof createBrowserClient> | null = null;
function sb() {
  if (!_sb) _sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return _sb;
}

/**
 * The visitor's own market, from the browser — availability scope only, and a
 * first guess the viewer can always overrule.
 *
 * The old Marquee read only `Intl.DateTimeFormat().resolvedOptions().locale`,
 * which on a Korean-language browser resolves to a bare "ko" — no region — so
 * every such visitor silently landed on the US catalogue. navigator.languages
 * carries the region ("ko-KR"), so try each tag until one has one.
 */
function guessCountry(): string | null {
  const tags: string[] = [];
  try { tags.push(new Intl.DateTimeFormat().resolvedOptions().locale); } catch { /* ignore */ }
  if (typeof navigator !== "undefined") {
    if (navigator.language) tags.push(navigator.language);
    if (Array.isArray(navigator.languages)) tags.push(...navigator.languages);
  }
  for (const tag of tags) {
    const cc = (tag.split("-")[1] || "").toUpperCase();
    // A script subtag ("zh-Hans-CN") is 4 letters — only a 2-letter one is ISO2.
    if (cc.length === 2) return cc;
  }
  return null;
}

export function WatchPrefsProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<WatchPrefs>(DEFAULT_WATCH_PREFS);
  const [ready, setReady] = useState(false);
  // Whether anything was ever stored locally. Only an untouched browser accepts
  // the server's copy — otherwise a stale phone row would overwrite a choice the
  // visitor just made here.
  const virgin = useRef(false);

  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(WATCH_PREFS_KEY); } catch { /* private mode */ }
    if (stored) {
      try { setPrefs(parseWatchPrefs(JSON.parse(stored))); } catch { /* keep defaults */ }
    } else {
      virgin.current = true;
      const cc = guessCountry();
      if (cc) setPrefs((p) => ({ ...p, country: cc }));
    }
    setReady(true);
  }, []);

  // Server mirror, read once: a first visit in this browser inherits whatever the
  // account (or the phone) already knows. The web account store wins over
  // user_prefs when both answer — it is the one a member edits on this site.
  useEffect(() => {
    if (!ready || !virgin.current) return;
    let alive = true;
    (async () => {
      const c = sb();
      // getSession reads storage; an anonymous visitor costs no network call.
      const { data: auth } = await c.auth.getSession();
      const uid = auth?.session?.user?.id;
      if (!uid) return;

      const acc = await loadAccountServices();
      if (!alive) return;
      if (acc && (acc.country || acc.providers.length)) {
        setPrefs((p) => ({
          ...p,
          country: acc.country?.length === 2 ? acc.country.toUpperCase() : p.country,
          providers: acc.providers.length ? acc.providers : p.providers,
        }));
        return;
      }

      const { data } = await c
        .from("user_prefs")
        .select("country_code, provider_ids")
        .eq("user_id", uid)
        .maybeSingle();
      if (!alive || !data) return;
      const row = data as { country_code: string | null; provider_ids: number[] | null };
      setPrefs((p) => ({
        ...p,
        country: row.country_code?.length === 2 ? row.country_code.toUpperCase() : p.country,
        providers: Array.isArray(row.provider_ids) ? row.provider_ids : p.providers,
      }));
    })();
    return () => { alive = false; };
  }, [ready]);

  // Another tab changed the settings — follow it rather than fighting it.
  useEffect(() => {
    const h = (e: StorageEvent) => {
      if (e.key !== WATCH_PREFS_KEY || !e.newValue) return;
      try { setPrefs(parseWatchPrefs(JSON.parse(e.newValue))); } catch { /* ignore */ }
    };
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
  }, []);

  const set = useCallback((patch: Partial<WatchPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(WATCH_PREFS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      virgin.current = false;
      // Mirror the availability axis when there is a session; a no-op otherwise.
      // Both stores or neither: a viewer whose room and whose phone disagreed
      // about their own services would have no way to tell which one is lying.
      if (patch.country !== undefined || patch.providers !== undefined) {
        (async () => {
          const c = sb();
          const { data: auth } = await c.auth.getSession();
          const uid = auth?.session?.user?.id;
          if (!uid) return;
          await Promise.all([
            saveAccountServices(next.country, next.providers), // fault-soft by design
            c.from("user_prefs").upsert(
              {
                user_id: uid,
                country_code: next.country,
                provider_ids: next.providers,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id" },
            ),
          ]);
        })().catch(() => { /* local prefs already stand */ });
      }
      return next;
    });
  }, []);

  const value = useMemo<Ctx>(() => ({ ...prefs, ready, set }), [prefs, ready, set]);
  return <WatchPrefsCtx.Provider value={value}>{children}</WatchPrefsCtx.Provider>;
}

/**
 * Watch prefs for a client surface. Returns the defaults (and ready=false)
 * outside the provider, so a component can be dropped anywhere without a crash.
 */
export function useWatchPrefs(): Ctx {
  const ctx = useContext(WatchPrefsCtx);
  const fallback = useMemo<Ctx>(() => ({ ...DEFAULT_WATCH_PREFS, ready: false, set: () => {} }), []);
  return ctx ?? fallback;
}
