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
 * Invariants: SSR is global (no personalization) — the client reads localStorage on
 * mount and re-ranks. Country/services also mirror the shared `mt-watch-prefs` key.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useUserFilms } from "@/components/UserFilmsProvider";
import PosterActions from "@/components/PosterActions";
import FilmCardPanel from "@/components/screener/FilmCardPanel";
import ServicesPicker, { type Service } from "@/components/marquee/ServicesPicker";
import AccessBadges, { type AvailRow } from "@/components/marquee/AccessBadges";
import type { ScrRow, Country } from "@/components/screener/ScreenerExplorer";
import { WTW_GENRES } from "@/lib/wtw_genres";
import { filmUrl, directorUrl, whereToUrl } from "@/lib/urls";
import { slugify } from "@/lib/slug";

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
};
const DEFAULT_CFG: Cfg = {
  country: "KR", providers: [], vpn: false, vpnCountries: [], usLib: false,
  hideSeen: false, genres: [], sinceYear: 2000, toYear: null, sortKey: "ts", sortDir: "desc",
};
const SORTS: { key: SortKey; label: string }[] = [
  { key: "ts", label: "TakeScore" }, { key: "year", label: "Year" }, { key: "alpha", label: "Title A–Z" },
  { key: "director", label: "Director" }, { key: "country", label: "Country" },
];
const rpcSort = (k: SortKey) => (k === "ts" ? "u" : k === "year" ? "newest" : k);
const flag = (cc: string) =>
  cc && cc.length === 2 ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))) : "";

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
  const seenSlugs = uf?.seenSlugs;

  const [country, setCountry] = useState(DEFAULT_CFG.country);
  const [providers, setProviders] = useState<number[]>([]);
  const [vpn, setVpn] = useState(false);
  const [vpnCountries, setVpnCountries] = useState<string[]>([]);
  const [usLib, setUsLib] = useState(false);
  const [hideSeen, setHideSeen] = useState(false);
  const [genres, setGenres] = useState<string[]>([]);
  const [sinceYear, setSinceYear] = useState<number | null>(DEFAULT_CFG.sinceYear);
  const [toYear, setToYear] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("ts");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [countries, setCountries] = useState<Country[]>(initialCountries);
  const [services, setServices] = useState<Service[]>([]);
  const [rows, setRows] = useState<MqRow[]>(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [avail, setAvail] = useState<Record<string, AvailRow[]>>({});
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [views, setViews] = useState<SavedView[]>([]);
  const [genreOpen, setGenreOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const hydrated = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const genreBox = useRef<HTMLDivElement | null>(null);
  const moreBox = useRef<HTMLDivElement | null>(null);

  const watchCountries = vpn ? Array.from(new Set([country, ...vpnCountries])) : [country];
  const provActive = providers.length > 0 || usLib;
  const rentSelected = providers.some((p) => services.find((s) => s.provider_id === p)?.label === "rent");

  const currentCfg = useCallback((): Cfg => ({
    country, providers, vpn, vpnCountries, usLib, hideSeen, genres, sinceYear, toYear, sortKey, sortDir,
  }), [country, providers, vpn, vpnCountries, usLib, hideSeen, genres, sinceYear, toYear, sortKey, sortDir]);

  const applyCfg = useCallback((c: Partial<Cfg>) => {
    if (c.country) setCountry(String(c.country).toUpperCase());
    if (Array.isArray(c.providers)) setProviders(c.providers.filter((x) => typeof x === "number"));
    if (typeof c.vpn === "boolean") setVpn(c.vpn);
    if (Array.isArray(c.vpnCountries)) setVpnCountries(c.vpnCountries.map((s) => String(s).toUpperCase()));
    if (typeof c.usLib === "boolean") setUsLib(c.usLib);
    if (typeof c.hideSeen === "boolean") setHideSeen(c.hideSeen);
    if (Array.isArray(c.genres)) setGenres(c.genres.filter((x) => typeof x === "string"));
    if (c.sinceYear === null || typeof c.sinceYear === "number") setSinceYear(c.sinceYear);
    if (c.toYear === null || typeof c.toYear === "number") setToYear(c.toYear);
    if (c.sortKey) setSortKey(c.sortKey);
    if (c.sortDir === "asc" || c.sortDir === "desc") setSortDir(c.sortDir);
  }, []);

  useEffect(() => {
    try {
      const full = JSON.parse(localStorage.getItem("mt-marquee-cfg") || "null");
      if (full && typeof full === "object") applyCfg(full as Partial<Cfg>);
      else {
        const wp = JSON.parse(localStorage.getItem("mt-watch-prefs") || "{}");
        if (wp.country) setCountry(String(wp.country).toUpperCase());
        else {
          const loc = (new Intl.DateTimeFormat().resolvedOptions().locale.split("-")[1] || "").toUpperCase();
          if (loc) setCountry(loc);
        }
        if (Array.isArray(wp.providers)) setProviders(wp.providers.filter((x: unknown) => typeof x === "number"));
      }
    } catch { /* ignore */ }
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem("mt-marquee-cfg", JSON.stringify(currentCfg()));
      localStorage.setItem("mt-watch-prefs", JSON.stringify({ country, providers }));
    } catch { /* ignore */ }
  }, [currentCfg, country, providers]);

  // Country options: SSR passes them, but if the ISR snapshot was rendered while
  // wtw_countries was empty/timed-out, fetch them client-side so the dropdown always
  // populates (independent of SSR/ISR timing).
  useEffect(() => {
    if (countries.length > 0) return;
    let alive = true;
    let rn: Intl.DisplayNames | null = null;
    try { rn = new Intl.DisplayNames(["en"], { type: "region" }); } catch { rn = null; }
    sb.rpc("wtw_countries").then(({ data }) => {
      if (!alive) return;
      const list = ((data as { code: string; n_films: number; n_prov: number }[] | null) ?? [])
        .map((c) => ({ code: c.code, n: c.n_films, label: `${flag(c.code)} ${rn?.of(c.code.toUpperCase()) || c.code.toUpperCase()} (${c.n_films})` }));
      setCountries(list);
    });
    return () => { alive = false; };
  }, [countries.length]);

  useEffect(() => {
    if (!uid) { setViews([]); return; }
    fetch("/api/wtw/views").then((r) => (r.ok ? r.json() : [])).then((d) => setViews(Array.isArray(d) ? d : []));
  }, [uid]);

  // click-outside for the two inline popovers
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (genreOpen && genreBox.current && !genreBox.current.contains(e.target as Node)) setGenreOpen(false);
      if (moreOpen && moreBox.current && !moreBox.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [genreOpen, moreOpen]);

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
    setLoading(true);
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    if (reset) setAvail({});

    let res: { total: number; rows: MqRow[] } = { total: 0, rows: [] };
    try {
      if (hideSeen && uid) {
        const sp = new URLSearchParams({
          sort: rpcSort(sortKey), dir: sortDir, limit: String(PAGE), offset: String(off), mode: "exclude",
          watch: country, watch_countries: watchCountries.join(","), us_lib: usLib ? "1" : "0",
          include_rent: rentSelected ? "1" : "0",
        });
        if (providers.length) sp.set("prov", providers.join(","));
        if (genres.length) sp.set("genres", genres.join(","));
        if (sinceYear != null) sp.set("year_min", String(sinceYear));
        if (toYear != null) sp.set("year_max", String(toYear));
        const d = await fetch(`/api/lens/marquee?${sp.toString()}`, { signal: ac.signal }).then((r) => (r.ok ? r.json() : null));
        res = (d as typeof res) ?? { total: 0, rows: [] };
      } else {
        const { data } = await sb.rpc("cinecodex_ranked", {
          p_sort: rpcSort(sortKey), p_dir: sortDir,
          p_providers: providers.length ? providers : null,
          p_watch_country: country, p_watch_countries: watchCountries,
          p_include_us_library: usLib, p_include_rent: rentSelected,
          p_genres: genres.length ? genres : null,
          p_year_min: sinceYear, p_year_max: toYear,
          p_limit: PAGE, p_offset: off,
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
  }, [offset, sortKey, sortDir, providers, country, watchCountries, usLib, rentSelected, genres, sinceYear, toYear, hideSeen, uid, decorate]);

  useEffect(() => {
    if (!hydrated.current) return;
    const t = setTimeout(() => void fetchPage(true), 140);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey, sortDir, providers, country, vpn, vpnCountries, usLib, rentSelected, genres, sinceYear, toYear, hideSeen, uid]);

  const countryOpts = countries.map((c) => ({ code: c.code, label: c.label }));
  const countryLabel = countries.find((c) => c.code === country)?.label || `${flag(country)} ${country}`;
  const empty = !loading && rows.length === 0;
  const toggleGenre = (g: string) => setGenres((s) => (s.includes(g) ? s.filter((x) => x !== g) : [...s, g]));
  const reset = () => applyCfg({ ...DEFAULT_CFG, country });

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

          <ServicesPicker country={country} selected={providers} onChange={setProviders} onServices={setServices} />

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
          ) : <Link className="mq-signin" href={`/login?next=${encodeURIComponent("/what-to-watch")}`}>Sign in to save views</Link>}

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
                  onClick={() => { if (!uid) { window.location.href = `/login?next=${encodeURIComponent("/what-to-watch")}`; return; } setHideSeen((v) => !v); }}>
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
          {provActive
            ? <><b>{total.toLocaleString("en-US")}</b> {total === 1 ? "film" : "films"} to watch in {countryLabel}</>
            : <>Top by TakeScore — <b>pick your services</b> to narrow to what you can watch now</>}
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
          <div className="mq-cards" aria-busy={loading}>
            {rows.map((f) => {
              const seen = seenSlugs?.has?.(f.slug);
              const ds = f.director_slug ?? (f.director ? slugify(f.director) : null);
              const isOpen = openSlug === f.slug;
              return (
                <article className={`mq-card${seen && !hideSeen ? " mq-card--seen" : ""}${isOpen ? " open" : ""}`} key={`${f.slug}-${f.rank}`}>
                  <div className="mq-card-body">
                    <div className="mq-poster">
                      <Link href={filmUrl(f.slug)} className="mq-poster-img" aria-label={f.title}>
                        {f.poster_path
                          ? // eslint-disable-next-line @next/next/no-img-element
                            <img src={`${POSTER}${f.poster_path}`} alt="" loading="lazy" width={80} height={120} />
                          : <span className="mq-poster--e" />}
                      </Link>
                      <PosterActions slug={f.slug} />
                    </div>
                    <div className="mq-card-mid">
                      <div className="mq-card-tsrow">
                        <span className="mq-ts"><b>{Math.round(f.u)}</b><i>TS</i></span>
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
                        <Link href={filmUrl(f.slug)}>{f.title}</Link> <span className="mq-y">({f.year ?? "?"})</span>
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

        {!empty && rows.length < total ? (
          <div className="mq-more">
            <button type="button" onClick={() => void fetchPage(false)} disabled={loading}>
              {loading ? "Loading…" : `Load more (${rows.length.toLocaleString("en-US")} of ${total.toLocaleString("en-US")})`}
            </button>
          </div>
        ) : null}

        <p className="mq-attr">
          Availability via TMDB (data licensed through JustWatch). VPN and library results are shown for reference — check each service&apos;s terms; Kanopy/Hoopla require a participating US library card. External ratings via IMDb, Rotten Tomatoes and Metacritic.
        </p>
      </div>
    </div>
  );
}
