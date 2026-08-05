"use client";

/**
 * MarqueeExplorer — the client heart of What to Watch ("The Marquee"), v2.1.
 *
 * All controls live in a single TOP bar (no sidebar): country, a "My services"
 * popover with Save-view beside it, a genres popover, year range, sort + direction,
 * and the VPN / US-library / hide-seen toggles. Below, the best you can watch is
 * ranked by TakeScore in a card grid — TakeScore on the left, the rating/seen/
 * watchlist controls overlaid on the poster, a director link, Where-to-watch +
 * Details buttons, and an expand to the real TakeScore appraisal (FilmCardPanel).
 *
 * Invariants: SSR is global (no personalization) — the client reads its prefs on
 * mount and re-ranks. Country, services and hide-seen are NOT local state: they
 * are the site-wide watch prefs (WatchPrefsProvider, editable in /settings and
 * shared with the app), so a setup chosen once holds everywhere. Only the
 * Marquee's own filters — genres, years, sort, VPN, US library — persist here in
 * `mt-marquee-cfg`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useUserFilms } from "@/components/UserFilmsProvider";
import { useConversion } from "@/components/conversion/ConversionProvider";
import { useWatchPrefs } from "@/components/WatchPrefsProvider";
import { useLocalTitles } from "@/lib/useLocalTitles";
import { CONTENT_LANGS, sameSetup, type ContentLang, type WatchPrefs } from "@/lib/watch-prefs";
import PosterActions from "@/components/PosterActions";
import FilmCardPanel from "@/components/screener/FilmCardPanel";
import ServicesPicker, { type Service } from "@/components/marquee/ServicesPicker";
import AccessBadges, { type AvailRow } from "@/components/marquee/AccessBadges";
import { SkFilmCards } from "@/components/Skeleton";
import type { ScrRow, Country } from "@/components/screener/ScreenerExplorer";
import { WTW_GENRES } from "@/lib/wtw_genres";
import { filmUrl, directorUrl, whereToUrl } from "@/lib/urls";
import { slugify } from "@/lib/slug";
import { displayTs } from "@/lib/cinecodex_dims";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const POSTER = "https://image.tmdb.org/t/p/w154";
const PAGE = 40;
const AX = { v: "#0F6E56", c: "#6b7280", r: "#C8102E" };
const VPN_COUNTRIES = ["US", "GB", "CA", "AU", "JP", "FR", "DE", "IN", "KR"];

type MqRow = ScrRow & { director_slug?: string | null };
type SortKey = "ts" | "alpha" | "director" | "country" | "year";
type Cfg = {
  country: string; providers: number[]; vpn: boolean; vpnCountries: string[]; usLib: boolean;
  hideSeen: boolean; genres: string[]; sinceYear: number | null; toYear: number | null;
  sortKey: SortKey; sortDir: "asc" | "desc";
  /** Production countries (ISO2, lowercase — `curation.film.country_code`).
   *  Empty = anywhere. Was a single string before migration 0132 taught the
   *  ranking RPC an array; applyCfg still accepts that shape. */
  madeIn: string[];
  /** Stop the ranking after N films. null = the whole list. */
  cap: number | null;
};
const DEFAULT_CFG: Cfg = {
  country: "KR", providers: [], vpn: false, vpnCountries: [], usLib: false,
  hideSeen: false, genres: [], sinceYear: 2000, toYear: null, sortKey: "ts", sortDir: "desc",
  madeIn: [], cap: null,
};
const SORTS: { key: SortKey; label: string }[] = [
  { key: "ts", label: "TakeScore" }, { key: "year", label: "Year" }, { key: "alpha", label: "Title A–Z" },
  { key: "director", label: "Director" }, { key: "country", label: "Country" },
];
/**
 * Top-N (the app's RANK_CAP, HANDOFF-앱에서-웹으로-이식 §2.2). It does NOT reorder —
 * it STOPS the current ranking after N, so it reads against whatever else is
 * live: "the top 100 on my services, made in Japan, since 2000".
 */
const CAPS: { v: number | null; label: string }[] = [
  { v: null, label: "All" }, { v: 100, label: "Top 100" }, { v: 500, label: "Top 500" }, { v: 1000, label: "Top 1000" },
];
const rpcSort = (k: SortKey) => (k === "ts" ? "u" : k === "year" ? "newest" : k);
const flag = (cc: string) =>
  cc && cc.length === 2 ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))) : "";
/** ISO2 → English country name. Node and browser ICU disagree, so this is only
 *  ever called on data fetched client-side (never during the SSR render). */
let _rn: Intl.DisplayNames | null = null;
const cname = (cc: string) => {
  try { _rn = _rn || new Intl.DisplayNames(["en"], { type: "region" }); return _rn.of(cc.toUpperCase()) || cc.toUpperCase(); }
  catch { return cc.toUpperCase(); }
};

type SavedView = { id: string; name: string; config: Cfg };

export default function MarqueeExplorer({
  initialRows, initialTotal, countries: initialCountries,
}: {
  initialRows: MqRow[];
  initialTotal: number;
  countries: Country[];
}) {
  const uf = useUserFilms();
  const uid = uf?.uid ?? null;
  const conv = useConversion();
  const seenSlugs = uf?.seenSlugs;

  // The three shared axes — one store for the whole site, not this page's copy.
  const { country, providers, hideSeen, setups, contentLang, ready: prefsReady, set: setPrefs } = useWatchPrefs();
  const setCountry = useCallback((cc: string) => setPrefs({ country: cc.toUpperCase() }), [setPrefs]);
  const setProviders = useCallback((ids: number[]) => setPrefs({ providers: ids }), [setPrefs]);

  const [vpn, setVpn] = useState(false);
  const [vpnCountries, setVpnCountries] = useState<string[]>([]);
  const [usLib, setUsLib] = useState(false);
  const [genres, setGenres] = useState<string[]>([]);
  const [sinceYear, setSinceYear] = useState<number | null>(DEFAULT_CFG.sinceYear);
  const [toYear, setToYear] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("ts");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [madeIn, setMadeIn] = useState<string[]>([]);
  const [cap, setCap] = useState<number | null>(null);
  /** Every production country with its film count, biggest first (RPC order). */
  const [originCatalog, setOriginCatalog] = useState<{ code: string; n: number }[]>([]);

  const [countries, setCountries] = useState<Country[]>(initialCountries);
  const [services, setServices] = useState<Service[]>([]);
  /** Which country `services` was loaded for — the prune above depends on it. */
  const [svcCountry, setSvcCountry] = useState<string | null>(null);
  const [rows, setRows] = useState<MqRow[]>(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [avail, setAvail] = useState<Record<string, AvailRow[]>>({});
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [views, setViews] = useState<SavedView[]>([]);
  const [genreOpen, setGenreOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [originOpen, setOriginOpen] = useState(false);

  const hydrated = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const genreBox = useRef<HTMLDivElement | null>(null);
  const moreBox = useRef<HTMLDivElement | null>(null);
  const originBox = useRef<HTMLDivElement | null>(null);

  const watchCountries = vpn ? Array.from(new Set([country, ...vpnCountries])) : [country];
  const provActive = providers.length > 0 || usLib;
  const rentSelected = providers.some((p) => services.find((s) => s.provider_id === p)?.label === "rent");

  const currentCfg = useCallback((): Cfg => ({
    country, providers, vpn, vpnCountries, usLib, hideSeen, genres, sinceYear, toYear, sortKey, sortDir,
    madeIn, cap,
  }), [country, providers, vpn, vpnCountries, usLib, hideSeen, genres, sinceYear, toYear, sortKey, sortDir, madeIn, cap]);

  /**
   * Apply a config. `shared` decides whether country/services/hide-seen ride
   * along: a SAVED VIEW names them and is an explicit request to switch setups,
   * so it writes through to the site-wide prefs — but restoring this page's own
   * localStorage must not, or a stale page cache would silently overwrite the
   * setup the viewer just made in /settings (or on their phone).
   */
  const applyCfg = useCallback((c: Partial<Cfg>, { shared = true }: { shared?: boolean } = {}) => {
    if (shared) {
      const patch: Partial<WatchPrefs> = {};
      if (c.country) patch.country = String(c.country).toUpperCase();
      if (Array.isArray(c.providers)) patch.providers = c.providers.filter((x) => typeof x === "number");
      if (typeof c.hideSeen === "boolean") patch.hideSeen = c.hideSeen;
      if (Object.keys(patch).length) setPrefs(patch);
    }
    if (typeof c.vpn === "boolean") setVpn(c.vpn);
    if (Array.isArray(c.vpnCountries)) setVpnCountries(c.vpnCountries.map((s) => String(s).toUpperCase()));
    if (typeof c.usLib === "boolean") setUsLib(c.usLib);
    if (Array.isArray(c.genres)) setGenres(c.genres.filter((x) => typeof x === "string"));
    if (c.sinceYear === null || typeof c.sinceYear === "number") setSinceYear(c.sinceYear);
    if (c.toYear === null || typeof c.toYear === "number") setToYear(c.toYear);
    if (c.sortKey) setSortKey(c.sortKey);
    if (c.sortDir === "asc" || c.sortDir === "desc") setSortDir(c.sortDir);
    // A saved view written before 0132 carries a single string, not a list.
    const mi = c.madeIn as unknown;
    if (Array.isArray(mi)) setMadeIn(mi.map((x) => String(x).toLowerCase()).filter(Boolean));
    else if (typeof mi === "string") setMadeIn(mi ? [mi.toLowerCase()] : []);
    if (c.cap === null || typeof c.cap === "number") setCap(c.cap);
  }, [setPrefs]);

  useEffect(() => {
    try {
      const full = JSON.parse(localStorage.getItem("mt-marquee-cfg") || "null");
      if (full && typeof full === "object") applyCfg(full as Partial<Cfg>, { shared: false });
    } catch { /* ignore */ }
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    // Only this page's own filters. The shared axes are persisted by
    // WatchPrefsProvider under `mt-watch-prefs`; writing them here too would give
    // them two owners and one of them would go stale.
    const { country: _c, providers: _p, hideSeen: _h, ...local } = currentCfg();
    try { localStorage.setItem("mt-marquee-cfg", JSON.stringify(local)); } catch { /* ignore */ }
  }, [currentCfg]);

  // Country options: SSR passes them, but if the ISR snapshot was rendered while
  // wtw_countries was empty/timed-out, fetch them client-side so the dropdown always
  // populates (independent of SSR/ISR timing).
  useEffect(() => {
    if (countries.length > 0) return;
    let alive = true;
    sb.rpc("wtw_countries").then(({ data }) => {
      if (!alive) return;
      const list = ((data as { code: string; n_films: number; n_prov: number }[] | null) ?? [])
        .map((c) => ({ code: c.code, n: c.n_films, label: `${flag(c.code)} ${cname(c.code)} (${c.n_films})` }));
      setCountries(list);
    });
    return () => { alive = false; };
  }, [countries.length]);

  // Production countries for the "Made in" filter. Same RPC (and therefore the
  // same population) the Screener's picker uses: counts come from
  // curation.film.country_code, which is exactly what p_country compares against,
  // so the list is ordered by how many films each choice will actually yield.
  useEffect(() => {
    let alive = true;
    sb.rpc("cinecodex_countries").then(({ data }) => {
      if (alive) setOriginCatalog(((data as { code: string; n: number }[] | null) ?? []).filter((c) => c.code));
    });
    return () => { alive = false; };
  }, []);

  // Prune services the current country doesn't carry (same rule as /settings and
  // the app): a provider id is TMDB's and therefore global, so a set left
  // unpruned after a country switch silently narrows the deck to nothing while
  // the picker shows selections that aren't on screen. An empty list is a
  // country with no provider data, not evidence — it keeps the selection.
  useEffect(() => {
    if (!prefsReady || svcCountry !== country || !services.length || !providers.length) return;
    const live = new Set(services.map((s) => s.provider_id));
    const kept = providers.filter((id) => live.has(id));
    if (kept.length !== providers.length) setPrefs({ providers: kept });
  }, [services, svcCountry, country, providers, prefsReady, setPrefs]);

  useEffect(() => {
    if (!uid) { setViews([]); return; }
    fetch("/api/wtw/views").then((r) => (r.ok ? r.json() : [])).then((d) => setViews(Array.isArray(d) ? d : []));
  }, [uid]);

  // click-outside for the two inline popovers
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (genreOpen && genreBox.current && !genreBox.current.contains(e.target as Node)) setGenreOpen(false);
      if (moreOpen && moreBox.current && !moreBox.current.contains(e.target as Node)) setMoreOpen(false);
      if (originOpen && originBox.current && !originBox.current.contains(e.target as Node)) setOriginOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [genreOpen, moreOpen, originOpen]);

  const saveView = async () => {
    const name = window.prompt("Name this view (e.g. \"Weeknight KR\")");
    if (!name || !name.trim()) return;
    const res = await fetch("/api/wtw/views", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), config: currentCfg() }),
    });
    if (res.ok) { const v = await res.json(); setViews((prev) => [v, ...prev.filter((x) => x.id !== v.id)]); }
  };
  const deleteView = async (id: string) => {
    await fetch(`/api/wtw/views?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setViews((prev) => prev.filter((v) => v.id !== id));
  };

  const decorate = useCallback(async (slugs: string[]) => {
    if (slugs.length === 0) return;
    const { data } = await sb.rpc("film_availability", {
      p_slugs: slugs, p_countries: watchCountries,
      p_providers: providers.length ? providers : null, p_include_us_library: usLib,
    });
    const rowsA = (data as { slug: string; tiers: AvailRow[] }[] | null) ?? [];
    setAvail((prev) => {
      const next = { ...prev };
      for (const s of slugs) next[s] = [];
      for (const a of rowsA) next[a.slug] = a.tiers ?? [];
      return next;
    });
  }, [watchCountries, providers, usLib]);

  const fetchPage = useCallback(async (reset: boolean) => {
    const off = reset ? 0 : offset + PAGE;
    // Top-N stops the ranking: never ask the server for rows past the cap.
    const want = cap == null ? PAGE : Math.min(PAGE, cap - off);
    if (want <= 0) return;
    setLoading(true);
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    if (reset) setAvail({});

    let res: { total: number; rows: MqRow[] } = { total: 0, rows: [] };
    try {
      if (hideSeen && uid) {
        const sp = new URLSearchParams({
          sort: rpcSort(sortKey), dir: sortDir, limit: String(want), offset: String(off), mode: "exclude",
          watch: country, watch_countries: watchCountries.join(","), us_lib: usLib ? "1" : "0",
          include_rent: rentSelected ? "1" : "0",
        });
        if (providers.length) sp.set("prov", providers.join(","));
        if (genres.length) sp.set("genres", genres.join(","));
        if (sinceYear != null) sp.set("year_min", String(sinceYear));
        if (toYear != null) sp.set("year_max", String(toYear));
        if (madeIn.length) sp.set("made_in", madeIn.join(","));
        const d = await fetch(`/api/lens/marquee?${sp.toString()}`, { signal: ac.signal }).then((r) => (r.ok ? r.json() : null));
        res = (d as typeof res) ?? { total: 0, rows: [] };
      } else {
        const { data } = await sb.rpc("cinecodex_ranked", {
          p_sort: rpcSort(sortKey), p_dir: sortDir,
          p_providers: providers.length ? providers : null,
          p_watch_country: country, p_watch_countries: watchCountries,
          p_include_us_library: usLib, p_include_rent: rentSelected,
          p_genres: genres.length ? genres : null,
          p_countries: madeIn.length ? madeIn : null, // 0132 — filtered server-side, so total and paging stay exact

          p_year_min: sinceYear, p_year_max: toYear,
          p_limit: want, p_offset: off,
        });
        res = (data as typeof res) ?? { total: 0, rows: [] };
      }
    } catch { if (!ac.signal.aborted) setLoading(false); return; }
    if (ac.signal.aborted) return;

    setTotal(res.total);
    setOffset(off);
    setRows((prev) => (reset ? res.rows : [...prev, ...res.rows]));
    setLoading(false);
    void decorate(res.rows.map((r) => r.slug));
  }, [offset, cap, madeIn, sortKey, sortDir, providers, country, watchCountries, usLib, rentSelected, genres, sinceYear, toYear, hideSeen, uid, decorate]);

  // Waits for the shared prefs too: firing once with the defaults and again with
  // the real country is a wasted ranking query on every page view.
  useEffect(() => {
    if (!hydrated.current || !prefsReady) return;
    const t = setTimeout(() => void fetchPage(true), 140);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsReady, sortKey, sortDir, providers, country, vpn, vpnCountries, usLib, rentSelected, genres, sinceYear, toYear, hideSeen, uid, madeIn, cap]);

  // Release titles in the viewer's language, painted over the English rows the
  // RPC returned (migration 0121). English costs no request.
  const titleOf = useLocalTitles(rows.map((r) => r.slug));

  const countryOpts = countries.map((c) => ({ code: c.code, label: c.label }));
  const countryLabel = countries.find((c) => c.code === country)?.label || `${flag(country)} ${country}`;
  const empty = !loading && rows.length === 0;
  const toggleGenre = (g: string) => setGenres((s) => (s.includes(g) ? s.filter((x) => x !== g) : [...s, g]));
  // Top-N bounds BOTH the grid and the paging. Slicing only the render would leave
  // "Load more" walking the whole catalogue behind a list that never grows — on
  // this project a silent client-side request flood is not a theoretical cost.
  const visible = cap == null ? rows : rows.slice(0, cap);
  const reachable = cap == null ? total : Math.min(total, cap);
  const madeInLabel = madeIn.map((cc) => `${flag(cc)} ${cname(cc)}`).join(" · ");
  const toggleOrigin = (cc: string) => setMadeIn((s) => (s.includes(cc) ? s.filter((x) => x !== cc) : [...s, cc]));
  /** Reset clears this page's filters — never the account-level watch setup. */
  const reset = () => applyCfg({ ...DEFAULT_CFG, country, providers, hideSeen }, { shared: false });

  return (
    <div className="mq2">
      <header className="mq-hero2">
        <div className="mq-hero2-in">
          <h1 className="mq-h1b">What to Watch <span className="mq-alias">The Marquee</span></h1>
          <p className="mq-witty">You already pay for these. Tell us your country and your subscriptions — we&apos;ll tell you what&apos;s actually worth tonight, ranked by TakeScore rather than the algorithm.</p>
        </div>
      </header>

      {/* ── TOP filter bar (no sidebar) ── */}
      <div className="mq-bar">
        <div className="mq-bar-in">
          <select className="mq-select mq-select--cc" value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country">
            {countryOpts.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>

          <ServicesPicker
            country={country}
            selected={providers}
            onChange={setProviders}
            onServices={(list, cc) => { setServices(list); setSvcCountry(cc); }}
          />

          {/* Saved setups — country+services pairings from /settings (home vs.
              travelling). Unlike "My views" below, these need no account. */}
          {setups.length ? (
            <select
              className="mq-select mq-select--sm"
              value={setups.find((s) => sameSetup(s, country, providers))?.id ?? ""}
              onChange={(e) => { const s = setups.find((x) => x.id === e.target.value); if (s) setPrefs({ country: s.country, providers: s.providers }); }}
              aria-label="My saved setups"
            >
              <option value="" disabled>My setups ({setups.length})</option>
              {setups.map((s) => <option key={s.id} value={s.id}>{s.label} · {s.providers.length}</option>)}
            </select>
          ) : null}

          {uid ? (
            <>
              <button type="button" className="mq-btn2" onClick={saveView}>＋ Save view</button>
              {views.length ? (
                <select className="mq-select mq-select--sm" value="" onChange={(e) => { const v = views.find((x) => x.id === e.target.value); if (v) applyCfg(v.config); }} aria-label="My saved views">
                  <option value="" disabled>My views ({views.length})</option>
                  {views.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              ) : null}
            </>
          ) : conv ? (
            // Anon → in-context sheet. If they've configured services, the highest-intent
            // moment: "keep your services" persists them to the account on sign-in (P4).
            <button type="button" className="mq-signin" onClick={() => conv.openAuth({ ctx: { kind: "claim", surface: providers.length ? "services" : "room" } })}>
              {providers.length ? "Sign in to keep your services" : "Sign in to save views"}
            </button>
          ) : <Link className="mq-signin" href={`/login?next=${encodeURIComponent("/what-to-watch")}`}>Sign in to save views</Link>}

          {/* The language films are NAMED in — the third axis, right where the
              titles are (its long-form home is /settings#titles). */}
          <select
            className="mq-select mq-select--sm"
            value={contentLang}
            onChange={(e) => setPrefs({ contentLang: e.target.value as ContentLang })}
            aria-label="Title language"
          >
            {CONTENT_LANGS.map((l) => <option key={l.code} value={l.code}>Titles: {l.label}</option>)}
          </select>

          {/* Where the country/services/title-language settings actually live. */}
          <Link className="mq-signin" href="/settings#watch">⚙ Settings</Link>

          <span className="mq-bar-sep" />

          {/* genres popover */}
          <div className="mq-pop" ref={genreBox}>
            <button type="button" className={`mq-popbtn${genres.length ? " on" : ""}`} onClick={() => setGenreOpen((o) => !o)} aria-expanded={genreOpen}>
              {genres.length ? `Genres · ${genres.length}` : "Genres"} <span aria-hidden>▾</span>
            </button>
            {genreOpen ? (
              <div className="mq-pop-panel" role="dialog" aria-label="Choose genres">
                <div className="mq-pop-head"><span>Genres</span>{genres.length ? <button type="button" className="mq-pop-clear" onClick={() => setGenres([])}>Clear</button> : null}</div>
                <div className="mq-genres">
                  {WTW_GENRES.map((g) => (
                    <button key={g} type="button" className={`mq-gchip${genres.includes(g) ? " on" : ""}`} onClick={() => toggleGenre(g)}>{g}</button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* made in — production country. Ordered by how many films each choice
              actually yields (cinecodex_countries), so the list reads as a map of
              the archive rather than an alphabet. */}
          <div className="mq-pop" ref={originBox}>
            <button type="button" className={`mq-popbtn${madeIn.length ? " on" : ""}`} onClick={() => setOriginOpen((o) => !o)} aria-expanded={originOpen}>
              {madeIn.length === 0
                ? "Made in"
                : madeIn.length === 1
                  ? `Made in · ${cname(madeIn[0])}`
                  : `Made in · ${madeIn.length}`} <span aria-hidden>▾</span>
            </button>
            {originOpen ? (
              <div className="mq-pop-panel" role="dialog" aria-label="Choose production countries">
                <div className="mq-pop-head">
                  <span>Made in</span>
                  {madeIn.length ? <button type="button" className="mq-pop-clear" onClick={() => setMadeIn([])}>Clear</button> : null}
                </div>
                {/* Ordered by how many films each choice actually yields, so the
                    list reads as a map of the archive rather than an alphabet. */}
                <div className="mq-genres">
                  {originCatalog.map((o) => (
                    <button key={o.code} type="button" className={`mq-gchip${madeIn.includes(o.code) ? " on" : ""}`} onClick={() => toggleOrigin(o.code)}>
                      {flag(o.code)} {cname(o.code)} <i>{o.n.toLocaleString("en-US")}</i>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* year */}
          <div className="mq-year">
            <input type="number" className="mq-ynum" placeholder="2000" value={sinceYear ?? ""} min={1900} max={2100}
              onChange={(e) => setSinceYear(e.target.value ? parseInt(e.target.value, 10) : null)} aria-label="From year" />
            <span className="mq-ydash">–</span>
            <input type="number" className="mq-ynum" placeholder="now" value={toYear ?? ""} min={1900} max={2100}
              onChange={(e) => setToYear(e.target.value ? parseInt(e.target.value, 10) : null)} aria-label="To year" />
          </div>

          {/* sort */}
          <div className="mq-sortbox">
            <span className="mq-sort-lab">Sort</span>
            <select className="mq-select mq-select--sm" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <button type="button" className="mq-dir" onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))} title={sortDir === "desc" ? "Descending" : "Ascending"}>{sortDir === "desc" ? "↓" : "↑"}</button>
            {/* Top-N sits beside Sort because it is a bound on that order, not a
                different one: it stops the list, it never re-ranks it. */}
            <select
              className={`mq-select mq-select--sm${cap != null ? " on" : ""}`}
              value={cap == null ? "" : String(cap)}
              onChange={(e) => setCap(e.target.value ? parseInt(e.target.value, 10) : null)}
              aria-label="Stop the ranking after N films"
            >
              {CAPS.map((c) => <option key={c.label} value={c.v == null ? "" : String(c.v)}>{c.label}</option>)}
            </select>
          </div>

          <span className="mq-bar-sep" />

          {/* more toggles popover (VPN / US library / hide-seen) */}
          <div className="mq-pop" ref={moreBox}>
            <button type="button" className={`mq-popbtn${vpn || usLib || hideSeen ? " on" : ""}`} onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen}>
              Options{[vpn, usLib, hideSeen].filter(Boolean).length ? ` · ${[vpn, usLib, hideSeen].filter(Boolean).length}` : ""} <span aria-hidden>▾</span>
            </button>
            {moreOpen ? (
              <div className="mq-pop-panel" role="dialog" aria-label="More options">
                <button type="button" className={`mq-optrow${vpn ? " on" : ""}`} onClick={() => setVpn((v) => !v)}>✈ VPN — other countries&apos; catalogues</button>
                {vpn ? (
                  <div className="mq-genres mq-optcc">
                    {VPN_COUNTRIES.filter((c) => c !== country).map((c) => (
                      <button key={c} type="button" className={`mq-gchip${vpnCountries.includes(c) ? " on" : ""}`}
                        onClick={() => setVpnCountries((s) => s.includes(c) ? s.filter((x) => x !== c) : [...s, c])}>{flag(c)} {c}</button>
                    ))}
                  </div>
                ) : null}
                <button type="button" className={`mq-optrow${usLib ? " on" : ""}`} onClick={() => setUsLib((v) => !v)}>🏛 US library (Kanopy / Hoopla, free)</button>
                <button type="button" className={`mq-optrow${hideSeen ? " on" : ""}`}
                  onClick={() => { if (!uid) { window.location.href = `/login?next=${encodeURIComponent("/what-to-watch")}`; return; } setPrefs({ hideSeen: !hideSeen }); }}>
                  ● Hide films I&apos;ve seen{uid ? "" : " (sign in)"}
                </button>
              </div>
            ) : null}
          </div>

          <button type="button" className="mq-reset" onClick={reset}>Reset</button>
        </div>
      </div>

      <div className="mq-wrap2">
        <div className="mq-summary">
          {/* With a cap the honest sentence is "the top N OF the m that match" —
              never just "N films", which would read as the whole answer. */}
          {cap != null
            ? <>The <b>top {Math.min(cap, total).toLocaleString("en-US")}</b> of {total.toLocaleString("en-US")} {total === 1 ? "film" : "films"}{provActive ? <> to watch in {countryLabel}</> : null}</>
            : provActive
              ? <><b>{total.toLocaleString("en-US")}</b> {total === 1 ? "film" : "films"} to watch in {countryLabel}</>
              : <>Top by TakeScore — <b>pick your services</b> to narrow to what you can watch now</>}
          {madeIn.length ? <span className="mq-summary-note"> · made in {madeInLabel}</span> : null}
          {vpn && vpnCountries.length ? <span className="mq-summary-note"> · incl. {vpnCountries.join(", ")} (VPN)</span> : null}
        </div>

        {views.length && uid ? (
          <div className="mq-viewchips">
            {views.map((v) => (
              <span key={v.id} className="mq-viewchip">
                <button type="button" onClick={() => applyCfg(v.config)}>{v.name}</button>
                <button type="button" className="mq-viewchip-x" title="Delete view" onClick={() => deleteView(v.id)}>×</button>
              </span>
            ))}
          </div>
        ) : null}

        {empty ? (
          <div className="mq-empty">
            <p><b>Nothing matched your filters yet.</b></p>
            <p>Loosen a genre, widen the years, or open <b>Options</b> for US library / other countries.</p>
          </div>
        ) : (
          <div className="mq-cards mo-stagger" aria-busy={loading}>
            {visible.map((f) => {
              const seen = seenSlugs?.has?.(f.slug);
              const ds = f.director_slug ?? (f.director ? slugify(f.director) : null);
              const isOpen = openSlug === f.slug;
              // Overlaid at RENDER time, never baked into the row: the English
              // title stays the one thing every other lookup keys on.
              const title = titleOf(f.slug, f.title);
              return (
                <article className={`mq-card${seen && !hideSeen ? " mq-card--seen" : ""}${isOpen ? " open" : ""}`} key={`${f.slug}-${f.rank}`}>
                  <div className="mq-card-body">
                    <div className="mq-poster">
                      <Link href={filmUrl(f.slug)} className="mq-poster-img" aria-label={title}>
                        {f.poster_path
                          ? // eslint-disable-next-line @next/next/no-img-element
                            <img src={`${POSTER}${f.poster_path}`} alt={`${title}${f.year ? ` (${f.year})` : ""} poster`} loading="lazy" width={80} height={120} />
                          : <span className="mq-poster--e" />}
                      </Link>
                      <PosterActions slug={f.slug} />
                    </div>
                    <div className="mq-card-mid">
                      <div className="mq-card-tsrow">
                        <span className="mq-ts"><b>{displayTs(f.u)}</b><i>TS</i></span>
                        <span className="mq-card-scores">
                          <b style={{ color: AX.v }}>V{Math.round(f.v)}</b>
                          <b style={{ color: AX.c }}>C{Math.round(f.c)}</b>
                          <b style={{ color: AX.r }}>R{Math.round(f.r)}</b>
                          {f.imdb_rating != null ? <i>IMDb {Number(f.imdb_rating).toFixed(1)}</i> : null}
                          {f.rt != null ? <i>RT {f.rt}%</i> : null}
                        </span>
                        {seen ? <span className="mq-seen-chip">✓ Seen</span> : null}
                      </div>
                      <div className="mq-card-title">
                        <Link href={filmUrl(f.slug)}>{title}</Link> <span className="mq-y">({f.year ?? "?"})</span>
                      </div>
                      <div className="mq-card-dir">
                        {f.director ? (ds ? <Link href={directorUrl(ds)}>{f.director}</Link> : <span>{f.director}</span>) : null}
                        {f.country_code ? <span className="mq-cc">· {flag(f.country_code)} {f.country_code}</span> : null}
                      </div>
                      <AccessBadges rows={avail[f.slug]} providers={providers} showFlags={vpn} />
                      <div className="mq-card-btns">
                        <Link className="mq-btn" href={whereToUrl(f.slug)}>Where to watch</Link>
                        <Link className="mq-btn" href={filmUrl(f.slug)}>Details →</Link>
                        <button type="button" className={`mq-btn mq-btn--exp${isOpen ? " on" : ""}`} onClick={() => setOpenSlug(isOpen ? null : f.slug)} aria-expanded={isOpen}>
                          {isOpen ? "Hide TakeScore ▲" : "TakeScore ▾"}
                        </button>
                      </div>
                    </div>
                  </div>
                  {isOpen ? (
                    <div className="mq-card-panel">
                      <FilmCardPanel slug={f.slug} watchCountry={country} fallbackTitle={f.title} fallbackPoster={f.poster_path} onClose={() => setOpenSlug(null)} />
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}

        {/* Same rule as the screener: only an append has nothing to show. */}
        {/* Same rule as the screener: only an append has nothing to show. */}
        {loading && rows.length > 0 ? <SkFilmCards count={4} label="Loading more films" /> : null}
        {!empty && visible.length < reachable ? (
          <div className="mq-more">
            <button type="button" onClick={() => void fetchPage(false)} disabled={loading}>
              {loading ? "Loading…" : `Load more (${visible.length.toLocaleString("en-US")} of ${reachable.toLocaleString("en-US")})`}
            </button>
          </div>
        ) : null}
        {/* A cap that quietly swallowed the rest would read as "that's all there
            is". Say what was set aside, and offer the way back. */}
        {!empty && cap != null && visible.length >= reachable && total > cap ? (
          <p className="mq-attr" style={{ marginTop: 4 }}>
            Stopped at the top {cap.toLocaleString("en-US")} — {(total - cap).toLocaleString("en-US")} more match these filters.{" "}
            <button type="button" className="mq-pop-clear" onClick={() => setCap(null)}>Show all</button>
          </p>
        ) : null}

        <p className="mq-attr">
          Availability via TMDB (data licensed through JustWatch). VPN and library results are shown for reference — check each service&apos;s terms; Kanopy/Hoopla require a participating US library card. External ratings via IMDb, Rotten Tomatoes and Metacritic.
        </p>
      </div>
    </div>
  );
}
