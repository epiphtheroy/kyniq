"use client";

/**
 * ScreenerExplorer — the /takescore Screener. One client instrument over the
 * whole scored catalog: a black hero with instant-answer search, a film tab tray
 * (pin many, compare), a sticky control bar (Hide-seen · year-since · made-in ·
 * my services · sort · dimension ranges), a TakeScore distribution brush, and a
 * dense results grid (rank · poster · TS/V/C/R + IMDb/RT inline · one-tap save).
 * Every filter is serialized to the URL, so back/forward/share all work.
 * Spec: HANDOFF-테이크스코어-스크리너.md. Personalization is client-only.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useLens } from "@/components/LensProvider";
import { useUserFilms } from "@/components/UserFilmsProvider";
import { useWatchPrefs } from "@/components/WatchPrefsProvider";
import { useLocalTitles } from "@/lib/useLocalTitles";
import PosterActions from "@/components/PosterActions";
import { CODEX_DIMS, takescoreDimUrl, displayTs } from "@/lib/cinecodex_dims";
import { verdictSentence, verdictShort } from "@/lib/takescore_prose";
import { TAKESCORE_PRESETS } from "@/lib/takescore_presets";
import ScoreBrush, { type Bucket } from "@/components/screener/ScoreBrush";
import ProviderPicker from "@/components/screener/ProviderPicker";
import FilmCardPanel from "@/components/screener/FilmCardPanel";
import { SkFilmRows } from "@/components/Skeleton";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const POSTER = "https://image.tmdb.org/t/p/w154";
const PAGE = 60;
const AX = { v: "#0F6E56", c: "#6b7280", r: "#C8102E" };
const MAX_PINS = 12;

export type ScrRow = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  v: number; c: number; r: number; u: number; sharpe: number; country_code?: string | null;
  imdb_rating: number | null; imdb_votes: number | null; rt: number | null; rank: number;
};
export type Country = { code: string; n: number; label: string };
export type DimHist = Record<string, Bucket[]>;

const SORTS = [
  { id: "u", label: "TakeScore" }, { id: "v", label: "Value" }, { id: "c", label: "Lowest cost" },
  { id: "lowrisk", label: "Lowest risk" }, { id: "sharpe", label: "Efficiency" },
  { id: "newest", label: "Newest" }, { id: "oldest", label: "Oldest" }, { id: "alpha", label: "A–Z" },
];
const GENRES = ["Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama",
  "Family", "Fantasy", "History", "Horror", "Music", "Mystery", "Romance", "Science Fiction",
  "Thriller", "War", "Western"];
const SINCE = ["", "2020", "2010", "2000", "1990", "1970"];
const WATCH_COUNTRIES = ["KR", "US", "GB", "CA", "AU", "IN", "FR", "DE", "JP", "BR", "MX", "ES", "IT", "NL", "SE"];

let RN: Intl.DisplayNames | null = null;
const cname = (cc: string) => { try { RN = RN || new Intl.DisplayNames(["en"], { type: "region" }); return RN.of(cc.toUpperCase()) || cc.toUpperCase(); } catch { return cc.toUpperCase(); } };
const codeToFlag = (cc: string) => cc.length === 2 ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))) : "";

// dims grouped for the range panel
const DGROUPS = (["value", "cost", "risk"] as const).map((g) => ({
  group: g, tone: g === "value" ? AX.v : g === "cost" ? AX.c : AX.r,
  items: CODEX_DIMS.filter((d) => d.group === g),
}));

/* ---- URL <-> state helpers ---- */
function parseRange(s: string | null): [number, number] | null {
  if (!s) return null;
  const m = s.match(/^(-?\d+)-(-?\d+)$/); if (!m) return null;
  return [parseInt(m[1]), parseInt(m[2])];
}
function parseDims(s: string | null): Record<string, [number, number]> {
  const o: Record<string, [number, number]> = {};
  if (!s) return o;
  for (const part of s.split(",")) { const [k, r] = part.split(":"); const rg = parseRange(r); if (k && rg) o[k] = rg; }
  return o;
}
function dimsToStr(d: Record<string, [number, number]>): string {
  return Object.entries(d).map(([k, [a, b]]) => `${k}:${a}-${b}`).join(",");
}

export default function ScreenerExplorer({
  initialRows, initialTotal, countries, dimHist, heroBackdrop, heroFilm,
}: {
  initialRows: ScrRow[]; initialTotal: number; countries: Country[];
  dimHist: DimHist; heroBackdrop: string | null; heroFilm: string | null;
}) {
  const router = useRouter();
  const lens = useLens();
  const uf = useUserFilms();

  // ---- state starts at defaults so SSR matches hydration (page stays static/
  //      cached). The mount effect below reads window.location to apply any
  //      shared/bookmarked filters, then the refetch effect narrows the grid. ----
  const [sort, setSort] = useState("u");
  const [lam, setLam] = useState(1);
  const [since, setSince] = useState("");
  const [to, setTo] = useState("");
  const [country, setCountry] = useState("");     // made-in
  const [genre, setGenre] = useState("");
  const [q, setQ] = useState("");
  const [ts, setTs] = useState<[number, number] | null>(null);
  const [dims, setDims] = useState<Record<string, [number, number]>>({});
  const [maxVotes, setMaxVotes] = useState("");
  const [hideSeen, setHideSeen] = useState(false);
  const [showDims, setShowDims] = useState(false);

  // ---- watch prefs: the site-wide store (WatchPrefsProvider), not a local copy.
  //      Set once in /settings (or here, or on the phone) and every ranked
  //      surface agrees. ----
  const { country: watchCountry, providers, set: setPrefs } = useWatchPrefs();
  const setWatchCountry = useCallback((cc: string) => setPrefs({ country: cc.toUpperCase() }), [setPrefs]);
  const setProviders = useCallback((ids: number[]) => setPrefs({ providers: ids }), [setPrefs]);
  // ---- pins (URL ?pin= wins, else localStorage) ----
  const [pins, setPins] = useState<string[]>([]);
  const [pinMeta, setPinMeta] = useState<Record<string, { title: string; poster: string | null }>>({});
  const [activePin, setActivePin] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null); // slug whose inline curtain is expanded
  const hydrated = useRef(false);

  useEffect(() => {
    // one-time client hydration: apply URL filters (shared/bookmarked links) +
    // localStorage-backed prefs. Runs after the default-state SSR paint.
    const url = new URLSearchParams(window.location.search);
    const g = (k: string) => url.get(k) || "";
    if (g("sort")) setSort(g("sort"));
    if (g("lam")) setLam(parseFloat(g("lam")) || 1);
    if (g("since")) setSince(g("since"));
    if (g("to")) setTo(g("to"));
    if (g("country")) setCountry(g("country"));
    if (g("genre")) setGenre(g("genre"));
    if (g("q")) setQ(g("q"));
    const tsr = parseRange(g("ts")); if (tsr) setTs(tsr);
    const dm = parseDims(g("dims")); if (Object.keys(dm).length) { setDims(dm); setShowDims(true); }
    if (g("mv")) setMaxVotes(g("mv"));
    if (g("hide") === "seen") setHideSeen(true);
    // (country + services are the provider's business now — including the
    // first-visit guess from the browser's region.)
    const urlPins = g("pin").split(",").map((s) => s.trim()).filter(Boolean);
    if (urlPins.length) setPins(urlPins.slice(0, MAX_PINS));
    else { try { const t = JSON.parse(localStorage.getItem("mt-ts-tray") || "[]"); if (Array.isArray(t)) setPins(t.slice(0, MAX_PINS)); } catch { /* */ } }
    hydrated.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (hydrated.current) try { localStorage.setItem("mt-ts-tray", JSON.stringify(pins)); } catch { /* */ } }, [pins]);

  // ---- rows ----
  const [rows, setRows] = useState<ScrRow[]>(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [offset, setOffset] = useState(initialRows.length);
  const [loading, setLoading] = useState(false);
  const [hist, setHist] = useState<Bucket[]>([]);
  const first = useRef(true);
  const abort = useRef<AbortController | null>(null);

  const yearMin = since ? parseInt(since) : null;
  const provActive = providers.length > 0;
  const onlyMode = !!lens && lens.mode === "only" && lens.seenCount > 0;
  // Personal modes need auth (service-role mirror). A shared ?hide=seen link
  // opened logged-out falls back to the global ranking, never an empty grid.
  const personalMode: "exclude" | "only" | null =
    hideSeen && uf?.uid ? "exclude" : (onlyMode ? "only" : null);

  const subJson = useMemo(() => {
    const o: Record<string, { min: number; max: number }> = {};
    for (const [k, [a, b]] of Object.entries(dims)) if (a > 0 || b < 100) o[k] = { min: a, max: b };
    return o;
  }, [dims]);
  const activeDims = Object.keys(subJson).length;

  // build the URL from state (debounced). Skip the first settled render so we
  // never write the URL before localStorage-backed pins have hydrated.
  const urlArmed = useRef(false);
  useEffect(() => {
    if (!hydrated.current) return;
    if (!urlArmed.current) { urlArmed.current = true; return; }
    const sp = new URLSearchParams();
    if (sort !== "u") sp.set("sort", sort);
    if (lam !== 1) sp.set("lam", String(lam));
    if (since) sp.set("since", since);
    if (to) sp.set("to", to);
    if (country) sp.set("country", country);
    if (genre) sp.set("genre", genre);
    if (q) sp.set("q", q);
    if (ts) sp.set("ts", `${ts[0]}-${ts[1]}`);
    if (activeDims) sp.set("dims", dimsToStr(dims));
    if (maxVotes) sp.set("mv", maxVotes);
    if (hideSeen) sp.set("hide", "seen");
    if (pins.length) sp.set("pin", pins.join(","));
    const s = sp.toString();
    const t = setTimeout(() => router.replace(s ? `/takescore?${s}` : "/takescore", { scroll: false }), 350);
    return () => clearTimeout(t);
  }, [sort, lam, since, to, country, genre, q, ts, dims, maxVotes, hideSeen, pins, activeDims, router]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPage = useCallback(async (reset: boolean) => {
    setLoading(true);
    const off = reset ? 0 : offset;
    abort.current?.abort();
    const ac = new AbortController(); abort.current = ac;
    let res: { total: number; rows: ScrRow[] } = { total: 0, rows: [] };
    try {
      if (personalMode) {
        const sp = new URLSearchParams({ sort, lambda: String(lam), limit: String(PAGE), offset: String(off), mode: personalMode });
        if (q) sp.set("q", q);
        if (yearMin != null) sp.set("year_min", String(yearMin));
        if (to) sp.set("year_max", to);
        if (country) sp.set("country", country);
        if (genre) sp.set("genre", genre);
        if (ts) { sp.set("ts_min", String(ts[0])); sp.set("ts_max", String(ts[1])); }
        if (activeDims) sp.set("sub", JSON.stringify(subJson));
        if (maxVotes) sp.set("max_votes", maxVotes);
        if (provActive) { sp.set("prov", providers.join(",")); sp.set("watch", watchCountry); }
        const d = await fetch(`/api/lens/takescore?${sp.toString()}`, { signal: ac.signal }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        res = (d as typeof res) ?? { total: 0, rows: [] };
      } else {
        const { data } = await sb.rpc("cinecodex_ranked", {
          p_sort: sort, p_lambda: lam, p_q: q || null,
          p_year_min: yearMin, p_year_max: to ? parseInt(to) : null, p_country: country || null,
          p_max_cost: 100, p_sub: subJson,
          p_ts_min: ts ? ts[0] : null, p_ts_max: ts ? ts[1] : null,
          p_providers: provActive ? providers : null, p_watch_country: provActive ? watchCountry : null,
          p_max_votes: maxVotes ? parseInt(maxVotes) : null, p_genre: genre || null,
          p_limit: PAGE, p_offset: off,
        });
        res = (data as typeof res) ?? { total: 0, rows: [] };
      }
    } catch { if (ac.signal.aborted) return; }
    if (ac.signal.aborted) return;
    setTotal(res.total);
    setRows((prev) => reset ? res.rows : [...prev, ...res.rows]);
    setOffset(off + res.rows.length);
    setLoading(false);
  }, [sort, lam, q, yearMin, to, country, genre, ts, subJson, activeDims, maxVotes, provActive, providers, watchCountry, personalMode, offset]);

  const fetchHist = useCallback(async () => {
    const { data } = await sb.rpc("cinecodex_histogram", {
      p_lambda: lam, p_q: q || null, p_year_min: yearMin, p_year_max: to ? parseInt(to) : null,
      p_country: country || null, p_max_cost: 100, p_sub: subJson,
      p_providers: provActive ? providers : null, p_watch_country: provActive ? watchCountry : null,
      p_max_votes: maxVotes ? parseInt(maxVotes) : null, p_genre: genre || null,
    });
    const d = data as { buckets: Bucket[] } | null;
    setHist(d?.buckets ?? []);
  }, [lam, q, yearMin, to, country, genre, subJson, provActive, providers, watchCountry, maxVotes]);

  // refetch on any filter change (debounced). The SSR seed is the default sort-u
  // top 60, so only refetch on first paint when the URL carried a non-default
  // filter (a shared/bookmarked link) or a personal mode is active.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      fetchHist();
      const stale = sort !== "u" || !!since || !!to || !!country || !!genre || !!q || !!ts || activeDims > 0 || !!maxVotes || provActive || !!personalMode;
      if (stale) fetchPage(true);
      return;
    }
    const t = setTimeout(() => { fetchPage(true); fetchHist(); }, 320);
    return () => clearTimeout(t);
  }, [sort, lam, q, yearMin, to, country, genre, ts, subJson, maxVotes, provActive, providers, watchCountry, personalMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Release titles in the reader's chosen language (migration 0121), overlaid on
  // the English rows at render time. English costs no request.
  const titleOf = useLocalTitles(rows.map((r) => r.slug));

  // ---- pin helpers ----
  const pin = useCallback((slug: string, title: string, poster: string | null) => {
    setPinMeta((m) => ({ ...m, [slug]: { title, poster } }));
    setPins((p) => (p.includes(slug) ? p : [...p, slug].slice(-MAX_PINS)));
    setActivePin(slug); setCompare(false);
  }, []);
  const unpin = (slug: string) => {
    setPins((p) => p.filter((s) => s !== slug));
    setActivePin((a) => (a === slug ? null : a));
  };

  const setDimRange = (k: string, lo: number, hi: number) =>
    setDims((p) => { const n = { ...p }; if (lo <= 0 && hi >= 100) delete n[k]; else n[k] = [lo, hi]; return n; });

  const seenCount = lens?.seenCount ?? 0;

  return (
    <div className="scr">
      {/* ── Black hero ── */}
      <header className="scr-hero" style={heroBackdrop ? { ["--bd" as string]: `url(https://image.tmdb.org/t/p/w1280${heroBackdrop})` } : undefined}>
        <div className="scr-hero-in">
          <h1 className="scr-hero-h1">
            <Link href="/takescore/about" className="scr-hero-brand">TakeScore<sup>™</sup></Link>
            <span className="scr-hero-sub-title">The Screener</span>
          </h1>
          <p className="scr-hero-sub">Every film scored on durable value, not popularity. Search one, compare many, screen the whole catalog by your own rules. An AI-computed metric for cinephiles, designed by <Link href="/editor" style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 2 }}>Wonwoo Yoon</Link>.</p>
          <HeroSearch onPin={pin} />
          <div className="scr-presets">
            {TAKESCORE_PRESETS.map((p) => (
              <button key={p.key} type="button" className="scr-preset" title={p.blurb}
                onClick={() => {
                  setSort(p.q.sort || "u"); setSince(p.q.since || ""); setTs(parseRange(p.q.ts || null));
                  setDims(parseDims(p.q.dims || null)); setMaxVotes(p.q.maxVotes || ""); setShowDims(!!p.q.dims);
                }}>{p.label}</button>
            ))}
          </div>
          {heroFilm ? <div className="scr-hero-cap">Backdrop from <i>{heroFilm}</i> · #1 by TakeScore · via TMDB</div> : null}
        </div>
      </header>

      <div className="scr-body">
      {/* ── Film tab tray ── */}
      {pins.length > 0 ? (
        <div className="scr-tray">
          <div className="scr-tabs" role="tablist">
            {pins.map((s) => {
              const meta = pinMeta[s];
              return (
                <div key={s} className={`scr-tab${activePin === s && !compare ? " on" : ""}`}>
                  <button className="scr-tab-b" onClick={() => { setActivePin(s); setCompare(false); }} role="tab" aria-selected={activePin === s}>
                    {meta?.poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`https://image.tmdb.org/t/p/w92${meta.poster}`} alt="" width={18} height={27} />
                    ) : null}
                    <span className="scr-tab-t">{meta?.title ?? s}</span>
                  </button>
                  <button className="scr-tab-x" onClick={() => unpin(s)} aria-label="Remove">×</button>
                </div>
              );
            })}
          </div>
          {pins.length > 1 ? (
            <button className={`scr-cmp${compare ? " on" : ""}`} onClick={() => setCompare((c) => !c)}>{compare ? "Close compare" : `Compare ${pins.length}`}</button>
          ) : null}
        </div>
      ) : null}

      {/* card panel(s) */}
      {compare && pins.length > 1 ? (
        <div className="scr-compare">
          {pins.map((s) => <FilmCardPanel key={s} slug={s} watchCountry={watchCountry} fallbackTitle={pinMeta[s]?.title} fallbackPoster={pinMeta[s]?.poster} compare />)}
        </div>
      ) : activePin ? (
        <FilmCardPanel slug={activePin} watchCountry={watchCountry} fallbackTitle={pinMeta[activePin]?.title} fallbackPoster={pinMeta[activePin]?.poster} onClose={() => setActivePin(null)} />
      ) : null}

      {/* ── Control bar ── */}
      <div className="scr-controls">
        <button type="button" className={`scr-hideseen${hideSeen ? " on" : ""}`} disabled={!uf?.uid}
          onClick={() => { if (!uf?.uid) return; setHideSeen((h) => !h); }}
          title={uf?.uid ? "" : "Sign in and mark films seen to use this"}>
          <span className="scr-hideseen-dot" aria-hidden />{hideSeen ? "Showing unseen only" : "Hide films I've seen"}{seenCount ? ` (${seenCount})` : ""}
        </button>

        <div className="scr-ctl">
          <span className="scr-ctl-l">Since</span>
          <div className="scr-chips">
            {SINCE.map((y) => <button key={y || "all"} className={since === y ? "on" : ""} onClick={() => setSince(y)}>{y ? `${y}` : "All"}</button>)}
          </div>
        </div>

        <div className="scr-ctl">
          <span className="scr-ctl-l">Sort</span>
          <select className="scr-sel" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          {sort === "u" ? (
            <span className="scr-lam" title="TakeScore = Value − λ·Risk. Higher λ punishes risky films.">
              λ<input type="range" min={0} max={2} step={0.1} value={lam} onChange={(e) => setLam(parseFloat(e.target.value))} /><b>{lam.toFixed(1)}</b>
            </span>
          ) : null}
        </div>

        <div className="scr-ctl">
          <span className="scr-ctl-l">Genre</span>
          <select className="scr-sel" value={genre} onChange={(e) => setGenre(e.target.value)}>
            <option value="">Any genre</option>
            {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div className="scr-ctl">
          <span className="scr-ctl-l">Made in</span>
          <select className="scr-sel" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">Any country</option>
            {countries.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </div>

        <ProviderPicker country={watchCountry} countries={WATCH_COUNTRIES.map((c) => ({ code: c, label: `${codeToFlag(c)} ${cname(c)}` }))}
          selected={providers} onChange={setProviders} onCountry={setWatchCountry} />

        <button type="button" className={`scr-ctlbtn${activeDims ? " on" : ""}`} onClick={() => setShowDims((s) => !s)} aria-expanded={showDims}>
          Dimensions{activeDims ? ` · ${activeDims}` : ""} <span aria-hidden>{showDims ? "▴" : "▾"}</span>
        </button>

        <span className="scr-count">{total.toLocaleString("en-US")} films</span>
      </div>

      {/* dimension range panel */}
      {showDims ? (
        <div className="scr-dims">
          {activeDims ? <button className="scr-dims-clear" onClick={() => setDims({})}>Reset dimensions</button> : null}
          {DGROUPS.map((g) => (
            <div className="scr-dimg" key={g.group}>
              <div className="scr-dimg-l" style={{ color: g.tone }}>{g.group}</div>
              {g.items.map((d) => {
                const [lo, hi] = dims[d.key] ?? [0, 100];
                return (
                  <div className="scr-dimrow" key={d.key}>
                    <Link className="scr-dimn" href={takescoreDimUrl(d.slug)} title={d.question}>{d.label}</Link>
                    <ScoreBrush buckets={dimHist[d.key] ?? []} domain={[0, 100]} step={5}
                      value={dims[d.key] ?? null} onChange={(rg) => setDimRange(d.key, rg?.[0] ?? 0, rg?.[1] ?? 100)}
                      height={26} color={g.tone} label={d.label} />
                    <span className="scr-dimv">{lo}–{hi}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}

      {/* TakeScore distribution brush */}
      <div className={`scr-brushwrap${ts ? " sel" : ""}`}>
        <div className="scr-brush-head">
          <span className="scr-brush-title">TakeScore distribution</span>
          {ts
            ? <button className="scr-brush-clear" onClick={() => setTs(null)}>Showing {ts[0]}–{ts[1]} · clear ✕</button>
            : <span className="scr-brush-hint"><span aria-hidden>⇤</span> drag across the bars to filter by score <span aria-hidden>⇥</span></span>}
        </div>
        <ScoreBrush buckets={hist} domain={[-20, 90]} step={5} value={ts} onChange={setTs} height={64} color={AX.v} label="TakeScore range" hint={!ts} />
      </div>

      {/* results grid — click a row to drop its verdict curtain */}
      <div className="scr-grid mo-stagger">
        {rows.length === 0 && !loading ? (
          // Note: "Reset filters" clears this page's filters only — the services
          // are an account-level setting now, so wiping them from here would
          // silently reconfigure every other surface.
          <p className="scr-empty">No films match these filters. <button className="scr-empty-reset" onClick={() => { setTs(null); setDims({}); setMaxVotes(""); setHideSeen(false); setGenre(""); setCountry(""); }}>Reset filters</button></p>
        ) : rows.map((f) => {
          const isOpen = openRow === f.slug;
          const title = titleOf(f.slug, f.title);
          return (
          <div className={`scr-rowwrap${isOpen ? " open" : ""}`} key={`${f.slug}-${f.rank}`}>
            <div className="scr-row" role="button" tabIndex={0} aria-expanded={isOpen}
              onClick={() => setOpenRow(isOpen ? null : f.slug)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenRow(isOpen ? null : f.slug); } }}>
              <span className="scr-rank" title={`#${f.rank} by ${SORTS.find((s) => s.id === sort)?.label ?? "TakeScore"}`}>{f.rank}</span>
              <span className="scr-row-poster">
                {f.poster_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${POSTER}${f.poster_path}`} alt={`${title}${f.year ? ` (${f.year})` : ""} poster`} loading="lazy" width={66} height={99} />
                ) : <span className="scr-row-poster--e" />}
              </span>
              <div className="scr-row-mid">
                <div className="scr-row-title">
                  {title} <span className="scr-row-y">({f.year ?? "?"}{f.director ? `, ${f.director}` : ""})</span>
                </div>
                <div className="scr-row-band">
                  <b style={{ color: AX.v }}>V {Math.round(f.v)}</b>
                  <b style={{ color: AX.c }}>C {Math.round(f.c)}</b>
                  <b style={{ color: AX.r }}>R {Math.round(f.r)}</b>
                  {f.imdb_rating != null ? <span>IMDb {Number(f.imdb_rating).toFixed(1)}</span> : null}
                  {f.rt != null ? <span>RT {f.rt}%</span> : null}
                </div>
                <div className="scr-row-verdict">{verdictShort(f.v, f.c, f.r, f.u)}</div>
              </div>
              <span className="scr-row-ts"><b>{displayTs(f.u)}</b><i>TS</i></span>
              <span className="scr-row-save" onClick={(e) => e.stopPropagation()}><PosterActions slug={f.slug} rating={false} compact /></span>
              <span className="scr-row-chev" aria-hidden>{isOpen ? "▲" : "▼"}</span>
            </div>
            {isOpen ? (
              <div className="scr-curtain">
                <p className="scr-curtain-verdict">{verdictSentence(f.v, f.c, f.r, f.u, title)}</p>
                <div className="scr-curtain-row">
                  <div className="scr-curtain-scores">
                    <span className="scr-cs" style={{ color: AX.v }}><b>{Math.round(f.v)}</b><i>Value</i></span>
                    <span className="scr-cs" style={{ color: AX.c }}><b>{Math.round(f.c)}</b><i>Cost</i></span>
                    <span className="scr-cs" style={{ color: AX.r }}><b>{Math.round(f.r)}</b><i>Risk</i></span>
                    <span className="scr-cs scr-cs--ts"><b>{displayTs(f.u)}</b><i>TakeScore</i></span>
                    {f.imdb_rating != null ? <span className="scr-cs scr-cs--ext"><b>{Number(f.imdb_rating).toFixed(1)}</b><i>IMDb</i></span> : null}
                    {f.rt != null ? <span className="scr-cs scr-cs--ext"><b>{f.rt}%</b><i>RT</i></span> : null}
                  </div>
                  <div className="scr-curtain-act" onClick={(e) => e.stopPropagation()}>
                    <PosterActions slug={f.slug} rating={false} compact />
                    <button className="scr-curtain-pin" onClick={() => pin(f.slug, f.title, f.poster_path)}>＋ Compare</button>
                    <Link className="scr-curtain-appr" href={`/takescore/film/${f.slug}`}>Full appraisal →</Link>
                    <Link className="scr-curtain-film" href={`/film/${f.slug}`}>Film page →</Link>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          );
        })}
      </div>
      {/* The page that is on its way, in the shape it will land in. A filter
          change keeps the old rows up instead (they are still true until the
          new ones arrive) — only an append has nothing to show. */}
      {loading && rows.length > 0 ? <SkFilmRows count={4} label="Loading more films" /> : null}
      {rows.length < total ? (
        <div className="scr-more"><button onClick={() => fetchPage(false)} disabled={loading}>{loading ? "Loading…" : `Load more (${rows.length}/${total.toLocaleString("en-US")})`}</button></div>
      ) : null}

      {/* My strip (logged-in only; client render keeps SSR global) */}
      {uf?.uid ? <MyStrip /> : null}
      </div>
    </div>
  );
}

/* ── Hero instant search: scored results straight from cinecodex_ranked(p_q),
   so each row carries its TakeScore + verdict + a save button — the most
   important surface. Fast (title ilike, 110ms debounce, no embedding). ── */
type SHit = { slug: string; title: string; year: number | null; poster_path: string | null; v: number; c: number; r: number; u: number; imdb_rating: number | null; rt: number | null };
function HeroSearch({ onPin }: { onPin: (slug: string, title: string, poster: string | null) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); setLoading(false); setOpen(false); return; }
    const ac = new AbortController();
    setLoading(true); setOpen(true);
    const t = setTimeout(async () => {
      const { data } = await sb.rpc("cinecodex_ranked", { p_sort: "u", p_lambda: 1.0, p_q: q.trim(), p_limit: 8, p_offset: 0 });
      if (ac.signal.aborted) return;
      setHits(((data as { rows?: SHit[] } | null)?.rows) ?? []); setLoading(false); setOpen(true);
    }, 110);
    return () => { clearTimeout(t); ac.abort(); };
  }, [q]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const choose = (h: SHit) => { onPin(h.slug, h.title, h.poster_path); setQ(""); setHits([]); setOpen(false); };
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (hits.length) choose(hits[0]); };

  return (
    <form className="scr-search" ref={box} role="search" onSubmit={submit}>
      <span className="scr-search-ic" aria-hidden>⌕</span>
      <input className="scr-search-in" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => q.trim().length >= 2 && setOpen(true)}
        placeholder="Search any film to see its score…" aria-label="Search a film by title" autoComplete="off" />
      <button type="submit" className="scr-search-btn" aria-label="Search">Search</button>
      {open && q.trim().length >= 2 ? (
        <div className="scr-search-drop">
          {hits.length ? hits.map((h) => (
            <div key={h.slug} className="scr-hit" onClick={() => choose(h)} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") choose(h); }}>
              {h.poster_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="scr-hit-p" src={`https://image.tmdb.org/t/p/w92${h.poster_path}`} alt="" width={38} height={57} />
              ) : <span className="scr-hit-p scr-hit-p--e" />}
              <div className="scr-hit-mid">
                <div className="scr-hit-t">{h.title} <span className="scr-hit-y">({h.year ?? "?"})</span></div>
                <div className="scr-hit-v">{verdictShort(h.v, h.c, h.r, h.u)}</div>
                <div className="scr-hit-band">
                  <b style={{ color: AX.v }}>V {Math.round(h.v)}</b><b style={{ color: AX.c }}>C {Math.round(h.c)}</b><b style={{ color: AX.r }}>R {Math.round(h.r)}</b>
                  {h.imdb_rating != null ? <span>IMDb {Number(h.imdb_rating).toFixed(1)}</span> : null}
                  {h.rt != null ? <span>RT {h.rt}%</span> : null}
                </div>
              </div>
              <span className="scr-hit-ts"><b>{displayTs(h.u)}</b><i>TS</i></span>
              <span className="scr-hit-save" onClick={(e) => e.stopPropagation()}><PosterActions slug={h.slug} rating={false} compact /></span>
            </div>
          )) : <div className="scr-search-empty">{loading ? "Searching…" : "No scored films match — try another title."}</div>}
        </div>
      ) : null}
    </form>
  );
}

/* ── My strip: watchlist + seen teasers into /room ── */
function MyStrip() {
  const lens = useLens();
  const seen = lens?.seenCount ?? 0;
  return (
    <section className="scr-mystrip" aria-label="Your lists">
      <h2 className="scr-mystrip-h">Your terminal</h2>
      <div className="scr-mystrip-cards">
        <Link className="scr-mycard" href="/room/slate">
          <b>My Slate</b><span>Your watchlist, screened by TakeScore — what to watch next</span>
        </Link>
        <Link className="scr-mycard" href="/room/ledger">
          <b>My Ledger{seen ? ` · ${seen} seen` : ""}</b><span>Your ratings against the TakeScore — where you agree and clash</span>
        </Link>
        <Link className="scr-mycard" href="/room">
          <b>The Terminal →</b><span>Your full My Room: holdings, coverage, signature</span>
        </Link>
      </div>
    </section>
  );
}
