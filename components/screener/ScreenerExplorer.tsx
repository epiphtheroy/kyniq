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
import PosterActions from "@/components/PosterActions";
import { CODEX_DIMS, takescoreDimUrl } from "@/lib/cinecodex_dims";
import { TAKESCORE_PRESETS } from "@/lib/takescore_presets";
import ScoreBrush, { type Bucket } from "@/components/screener/ScoreBrush";
import ProviderPicker from "@/components/screener/ProviderPicker";
import FilmCardPanel from "@/components/screener/FilmCardPanel";

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
export type Country = { code: string; n: number };
export type DimHist = Record<string, Bucket[]>;

const SORTS = [
  { id: "u", label: "TakeScore" }, { id: "v", label: "Value" }, { id: "c", label: "Lowest cost" },
  { id: "lowrisk", label: "Lowest risk" }, { id: "sharpe", label: "Efficiency" },
  { id: "newest", label: "Newest" }, { id: "oldest", label: "Oldest" },
];
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

export type InitialParams = {
  sort: string; lam: string; since: string; to: string; country: string;
  q: string; ts: string; dims: string; mv: string; hide: string; pin: string;
};

export default function ScreenerExplorer({
  initialRows, initialTotal, countries, dimHist, heroBackdrop, heroFilm, initialParams,
}: {
  initialRows: ScrRow[]; initialTotal: number; countries: Country[];
  dimHist: DimHist; heroBackdrop: string | null; heroFilm: string | null; initialParams: InitialParams;
}) {
  const router = useRouter();
  const lens = useLens();
  const uf = useUserFilms();

  // ---- state seeded from the URL (read on the SERVER → passed as props, so the
  //      hero + first grid page are in the SSR HTML; no useSearchParams) ----
  const [sort, setSort] = useState(initialParams.sort || "u");
  const [lam, setLam] = useState(parseFloat(initialParams.lam || "1") || 1);
  const [since, setSince] = useState(initialParams.since || "");
  const [to, setTo] = useState(initialParams.to || "");
  const [country, setCountry] = useState(initialParams.country || "");     // made-in
  const [q, setQ] = useState(initialParams.q || "");
  const [ts, setTs] = useState<[number, number] | null>(parseRange(initialParams.ts || null));
  const [dims, setDims] = useState<Record<string, [number, number]>>(parseDims(initialParams.dims || null));
  const [maxVotes, setMaxVotes] = useState(initialParams.mv || "");
  const [hideSeen, setHideSeen] = useState(initialParams.hide === "seen");
  const [showDims, setShowDims] = useState(Object.keys(parseDims(initialParams.dims || null)).length > 0);

  // ---- watch prefs (localStorage, no login) ----
  const [watchCountry, setWatchCountry] = useState("US");
  const [providers, setProviders] = useState<number[]>([]);
  // ---- pins (URL ?pin= wins, else localStorage) ----
  const [pins, setPins] = useState<string[]>([]);
  const [pinMeta, setPinMeta] = useState<Record<string, { title: string; poster: string | null }>>({});
  const [activePin, setActivePin] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    // one-time client hydration of localStorage-backed prefs
    try {
      const wp = JSON.parse(localStorage.getItem("mt-watch-prefs") || "{}");
      if (wp.country) setWatchCountry(wp.country);
      else { const loc = (new Intl.DateTimeFormat().resolvedOptions().locale.split("-")[1] || "").toUpperCase(); if (loc) setWatchCountry(loc); }
      if (Array.isArray(wp.providers)) setProviders(wp.providers);
    } catch { /* defaults */ }
    const urlPins = (params.get("pin") || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (urlPins.length) setPins(urlPins.slice(0, MAX_PINS));
    else { try { const t = JSON.parse(localStorage.getItem("mt-ts-tray") || "[]"); if (Array.isArray(t)) setPins(t.slice(0, MAX_PINS)); } catch { /* */ } }
    hydrated.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (hydrated.current) try { localStorage.setItem("mt-watch-prefs", JSON.stringify({ country: watchCountry, providers })); } catch { /* */ } }, [watchCountry, providers]);
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

  // build the URL from state (debounced)
  useEffect(() => {
    if (!hydrated.current) return;
    const sp = new URLSearchParams();
    if (sort !== "u") sp.set("sort", sort);
    if (lam !== 1) sp.set("lam", String(lam));
    if (since) sp.set("since", since);
    if (to) sp.set("to", to);
    if (country) sp.set("country", country);
    if (q) sp.set("q", q);
    if (ts) sp.set("ts", `${ts[0]}-${ts[1]}`);
    if (activeDims) sp.set("dims", dimsToStr(dims));
    if (maxVotes) sp.set("mv", maxVotes);
    if (hideSeen) sp.set("hide", "seen");
    if (pins.length) sp.set("pin", pins.join(","));
    const s = sp.toString();
    const t = setTimeout(() => router.replace(s ? `/takescore?${s}` : "/takescore", { scroll: false }), 350);
    return () => clearTimeout(t);
  }, [sort, lam, since, to, country, q, ts, dims, maxVotes, hideSeen, pins, activeDims, router]); // eslint-disable-line react-hooks/exhaustive-deps

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
          p_max_votes: maxVotes ? parseInt(maxVotes) : null,
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
  }, [sort, lam, q, yearMin, to, country, ts, subJson, activeDims, maxVotes, provActive, providers, watchCountry, personalMode, offset]);

  const fetchHist = useCallback(async () => {
    const { data } = await sb.rpc("cinecodex_histogram", {
      p_lambda: lam, p_q: q || null, p_year_min: yearMin, p_year_max: to ? parseInt(to) : null,
      p_country: country || null, p_max_cost: 100, p_sub: subJson,
      p_providers: provActive ? providers : null, p_watch_country: provActive ? watchCountry : null,
      p_max_votes: maxVotes ? parseInt(maxVotes) : null,
    });
    const d = data as { buckets: Bucket[] } | null;
    setHist(d?.buckets ?? []);
  }, [lam, q, yearMin, to, country, subJson, provActive, providers, watchCountry, maxVotes]);

  // refetch on any filter change (debounced) — SSR seed serves the untouched first paint
  useEffect(() => {
    if (first.current) { first.current = false; fetchHist(); if (personalMode) fetchPage(true); return; }
    const t = setTimeout(() => { fetchPage(true); fetchHist(); }, 320);
    return () => clearTimeout(t);
  }, [sort, lam, q, yearMin, to, country, ts, subJson, maxVotes, provActive, providers, watchCountry, personalMode]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <div className="scr-hero-kick">TakeScore™</div>
          <h1 className="scr-hero-h1">The Screener</h1>
          <p className="scr-hero-sub">Every film scored on durable value, not popularity. Search one, compare many, screen the whole catalog by your own rules.</p>
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
          <span className="scr-ctl-l">Made in</span>
          <select className="scr-sel" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">Any country</option>
            {countries.map((c) => <option key={c.code} value={c.code}>{codeToFlag(c.code)} {cname(c.code)} ({c.n})</option>)}
          </select>
        </div>

        <ProviderPicker country={watchCountry} countries={WATCH_COUNTRIES.map((c) => ({ code: c, label: `${codeToFlag(c)} ${cname(c)}` }))}
          selected={providers} onChange={setProviders} onCountry={setWatchCountry} />

        <button type="button" className={`scr-ctlbtn${activeDims ? " on" : ""}`} onClick={() => setShowDims((s) => !s)} aria-expanded={showDims}>
          Dimensions{activeDims ? ` · ${activeDims}` : ""} <span aria-hidden>{showDims ? "▴" : "▾"}</span>
        </button>

        <span className="scr-count">{total.toLocaleString()} films</span>
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
      <div className="scr-brushwrap">
        <div className="scr-brush-head">
          <span>TakeScore distribution</span>
          {ts ? <button className="scr-brush-clear" onClick={() => setTs(null)}>{ts[0]}–{ts[1]} · clear</button> : <span className="scr-brush-hint">drag to filter by score</span>}
        </div>
        <ScoreBrush buckets={hist} domain={[-20, 90]} step={5} value={ts} onChange={setTs} height={60} color={AX.v} label="TakeScore range" />
      </div>

      {/* results grid */}
      <div className="scr-grid">
        {rows.length === 0 && !loading ? (
          <p className="scr-empty">No films match these filters. <button className="scr-empty-reset" onClick={() => { setTs(null); setDims({}); setMaxVotes(""); setProviders([]); setHideSeen(false); }}>Reset filters</button></p>
        ) : rows.map((f) => (
          <div className="scr-row" key={`${f.slug}-${f.rank}`}>
            <span className="scr-rank" title={`#${f.rank} by ${SORTS.find((s) => s.id === sort)?.label ?? "TakeScore"}`}>{f.rank}</span>
            <button className="scr-row-poster" onClick={() => pin(f.slug, f.title, f.poster_path)} aria-label={`Pin ${f.title}`}>
              {f.poster_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${POSTER}${f.poster_path}`} alt="" loading="lazy" width={66} height={99} />
              ) : <span className="scr-row-poster--e" />}
            </button>
            <div className="scr-row-mid">
              <button className="scr-row-title" onClick={() => pin(f.slug, f.title, f.poster_path)}>
                {f.title} <span className="scr-row-y">({f.year ?? "?"}{f.director ? `, ${f.director}` : ""})</span>
              </button>
              <div className="scr-row-band">
                <b style={{ color: AX.v }}>V {Math.round(f.v)}</b>
                <b style={{ color: AX.c }}>C {Math.round(f.c)}</b>
                <b style={{ color: AX.r }}>R {Math.round(f.r)}</b>
                {f.imdb_rating != null ? <span>IMDb {Number(f.imdb_rating).toFixed(1)}</span> : null}
                {f.rt != null ? <span>RT {f.rt}%</span> : null}
              </div>
            </div>
            <Link className="scr-row-ts" href={`/takescore/film/${f.slug}`} title="Full appraisal →" onClick={(e) => e.stopPropagation()}>
              <b>{Math.round(f.u)}</b><i>TS</i>
            </Link>
            <div className="scr-row-save"><PosterActions slug={f.slug} rating={false} compact /></div>
          </div>
        ))}
      </div>
      {rows.length < total ? (
        <div className="scr-more"><button onClick={() => fetchPage(false)} disabled={loading}>{loading ? "Loading…" : `Load more (${rows.length}/${total.toLocaleString()})`}</button></div>
      ) : null}

      {/* My strip (logged-in only; client render keeps SSR global) */}
      {uf?.uid ? <MyStrip /> : null}
      </div>
    </div>
  );
}

/* ── Hero instant search: /api/search films → pin ── */
function HeroSearch({ onPin }: { onPin: (slug: string, title: string, poster: string | null) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ slug: string; title: string; year: number | null; poster: string | null }[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const ac = new AbortController();
    const t = setTimeout(async () => {
      const d = await fetch(`/api/search?q=${encodeURIComponent(q)}&kinds=film&limit=6`, { signal: ac.signal }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const hs = ((d?.hits ?? []) as { slug: string; title: string; year: number | null; poster: string | null }[]).map((h) => ({ slug: h.slug, title: h.title, year: h.year, poster: h.poster }));
      setHits(hs); setOpen(true);
    }, 250);
    return () => { clearTimeout(t); ac.abort(); };
  }, [q]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="scr-search" ref={box}>
      <input className="scr-search-in" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => hits.length && setOpen(true)}
        placeholder="Search any film to see its score…" aria-label="Search a film" autoComplete="off" />
      {open && hits.length ? (
        <div className="scr-search-drop">
          {hits.map((h) => (
            <button key={h.slug} className="scr-search-hit" onClick={() => { onPin(h.slug, h.title, h.poster); setQ(""); setOpen(false); }}>
              {h.poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`https://image.tmdb.org/t/p/w92${h.poster}`} alt="" width={30} height={45} />
              ) : <span className="scr-search-hit--e" />}
              <span className="scr-search-hit-t">{h.title} <i>({h.year ?? "?"})</i></span>
              <span className="scr-search-hit-pin">Pin →</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
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
