"use client";

/** TakeScore explorer — server-paginated over ALL scored films.
 *  Control panel: sort, decade chips, country, λ dial, and a collapsible
 *  table of RANGE filters for every one of the thirteen sub-dimensions.
 *  Rows are compact with a big TS box on the right and expand IN PLACE
 *  (curtain) to show the sub-scores. Load-more pagination. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { codeToFlag } from "@/lib/lineageBodies";
import { dimByKey, takescoreDimUrl } from "@/lib/cinecodex_dims";
import { useLens } from "@/components/LensProvider";
import ScoreDonut from "@/components/ScoreDonut";

/* Axis colors — the public light-theme TakeScore palette (globals.css cx-* /
 * takescore-film.css tsf-*). Rings use the bar hues so the curtain reads as a
 * miniature of the appraisal page. */
const AX = { v: "#0F6E56", c: "#9ca3af", r: "#C8102E" };

const IMG = "https://image.tmdb.org/t/p/w92";
const PAGE = 60;
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export type CodexRow = { slug: string; title: string; year: number | null; poster_path: string | null; director: string | null; v: number; c: number; r: number; u: number; sharpe: number; country_code?: string | null };
type Country = { code: string; n: number };
type Detail = {
  v: number; c: number; r: number; u: number; sharpe: number;
  sub: Record<string, number>;
  n_samples: number | null; sd_v: number | null; panel: string; flagged: boolean;
  ext: { imdb: number | null; rt: number | null; metascore: number | null };
};

const SORTS = [
  { id: "u", label: "TakeScore" }, { id: "v", label: "Value" },
  { id: "c", label: "Lowest cost" }, { id: "lowrisk", label: "Lowest risk" },
  { id: "sharpe", label: "Efficiency" }, { id: "newest", label: "Newest" }, { id: "oldest", label: "Oldest" },
];

// key ↔ readable label, grouped by axis. Keys match cinecodex.scores columns.
const DIMS: { group: string; tone: string; items: { key: string; label: string }[] }[] = [
  { group: "Value", tone: "cx-lv", items: [
    { key: "cog", label: "Cognitive" }, { key: "aff", label: "Affective" }, { key: "form", label: "Formal" },
    { key: "moral", label: "Moral" }, { key: "dur", label: "Durability" } ] },
  { group: "Cost", tone: "cx-lc", items: [
    { key: "itx", label: "Intertextual" }, { key: "fr", label: "Formal radicalism" },
    { key: "etx", label: "Extratextual" }, { key: "ctx", label: "Auteur oeuvre" } ] },
  { group: "Risk", tone: "cx-lr", items: [
    { key: "bank", label: "Hollowness" }, { key: "insincere", label: "Insincerity" },
    { key: "coward", label: "Cowardice" }, { key: "polar", label: "Polarization" } ] },
];
const VALUE_L = DIMS[0].items.map((i) => i.label);
const COST_L = DIMS[1].items.map((i) => i.label);
const RISK_L = DIMS[2].items.map((i) => i.label);

let RN: Intl.DisplayNames | null = null;
const cname = (cc: string) => { try { RN = RN || new Intl.DisplayNames(["en"], { type: "region" }); return RN.of(cc.toUpperCase()) || cc.toUpperCase(); } catch { return cc.toUpperCase(); } };

/** Dual-thumb range 0–100. */
function DualRange({ lo, hi, onChange }: { lo: number; hi: number; onChange: (lo: number, hi: number) => void }) {
  return (
    <div className="cxr">
      <div className="cxr-track"><div className="cxr-fill" style={{ left: `${lo}%`, right: `${100 - hi}%` }} /></div>
      <input type="range" min={0} max={100} value={lo} onChange={(e) => onChange(Math.min(+e.target.value, hi), hi)} />
      <input type="range" min={0} max={100} value={hi} onChange={(e) => onChange(lo, Math.max(+e.target.value, lo))} />
    </div>
  );
}

function SubGroup({ label, names, sub, tone }: { label: string; names: string[]; sub: Record<string, number>; tone: string }) {
  return (
    <div className="cxd-g">
      <div className={`cxd-gl ${tone}`}>{label}</div>
      {names.map((n) => (
        <div className="cxd-row" key={n}>
          <span className="cxd-n">{n}</span>
          <span className="cxd-bar"><i className={tone} style={{ width: `${Math.max(0, Math.min(100, sub[n] ?? 0))}%` }} /></span>
          <span className="cxd-v">{sub[n] ?? 0}</span>
        </div>
      ))}
    </div>
  );
}

function Curtain({ slug, lam }: { slug: string; lam: number }) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let live = true;
    sb.rpc("cinecodex_for", { p_slug: slug }).then(({ data, error }) => {
      if (!live) return;
      if (error || !data) { setErr(true); return; }
      setD(data as Detail);
    });
    return () => { live = false; };
  }, [slug]);

  if (err) return <div className="cxd cxd--msg">Couldn’t load the sub-scores.</div>;
  if (!d) return <div className="cxd cxd--msg">Loading sub-scores…</div>;
  const ext = d.ext || { imdb: null, rt: null, metascore: null };
  const ts = Math.round(d.v - lam * d.r);
  return (
    <div className="cxd">
      {/* hero band — the appraisal page in miniature: three ring gauges + TS */}
      <div className="cxd-hero">
        <div className="cxd-hero-dons">
          <ScoreDonut val={d.v} color={AX.v} label="Value" size={64} />
          <ScoreDonut val={d.c} color={AX.c} label="Cost" size={64} />
          <ScoreDonut val={d.r} color={AX.r} label="Risk" size={64} />
        </div>
        <div className="cxd-ts">
          <span className="n">{ts}</span>
          <span className="lab">
            <span className="k">TS TakeScore</span>
            <span className="d">= V − λ·R (λ {lam.toFixed(1)})</span>
          </span>
        </div>
      </div>
      <div className="cxd-cols">
        <SubGroup label="Value" names={VALUE_L} sub={d.sub} tone="cx-lv" />
        <SubGroup label="Cost" names={COST_L} sub={d.sub} tone="cx-lc" />
        <SubGroup label="Risk" names={RISK_L} sub={d.sub} tone="cx-lr" />
      </div>
      {(ext.imdb || ext.rt || ext.metascore) ? (
        <div className="cxd-ext">
          <span className="cxd-extl">Alongside — not part of the score:</span>
          {ext.imdb ? <span className="cxd-chip">IMDb {ext.imdb}</span> : null}
          {ext.rt ? <span className="cxd-chip">Rotten Tomatoes {ext.rt}%</span> : null}
          {ext.metascore ? <span className="cxd-chip">Metascore {ext.metascore}</span> : null}
        </div>
      ) : null}
      <div className="cxd-foot">
        <span className="cxd-src">AI-estimated (rubric {d.panel}{d.n_samples ? `, n=${d.n_samples}` : ""}{d.sd_v != null ? `, ±${Math.round(Number(d.sd_v))}` : ""}) — a judgment, not a fact.</span>
        <Link className="cxd-open" href={`/film/${slug}#df-codex`}>Open the film →</Link>
        <Link className="cxd-appr" href={`/takescore/film/${slug}`}>Full appraisal →</Link>
      </div>
    </div>
  );
}

export default function CodexExplorer({ initialRows, initialTotal, countries }: { initialRows: CodexRow[]; initialTotal: number; countries: Country[] }) {
  const [sort, setSort] = useState("u");
  const [lam, setLam] = useState(1.0);
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [decade, setDecade] = useState("");
  const [ranges, setRanges] = useState<Record<string, [number, number]>>({});
  const [showDims, setShowDims] = useState(true);
  const [rows, setRows] = useState<CodexRow[]>(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [offset, setOffset] = useState(initialRows.length);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const first = useRef(true);

  const years = decade ? { min: parseInt(decade), max: parseInt(decade) + 9 } : { min: null as number | null, max: null as number | null };

  // build p_sub jsonb from any dimension whose range narrowed from [0,100]
  const subFilter = useMemo(() => {
    const o: Record<string, { min: number; max: number }> = {};
    for (const [k, [lo, hi]] of Object.entries(ranges)) if (lo > 0 || hi < 100) o[k] = { min: lo, max: hi };
    return o;
  }, [ranges]);
  const activeDims = Object.keys(subFilter).length;

  // My Films lens, only-mode: the ranking (and its load-more pagination) swaps
  // to the authed per-user endpoint — TakeScore over the films you've seen,
  // with every filter passing through. SSR-seeded rows are global, so entering
  // in only-mode refetches page 0.
  const lens = useLens();
  const mine = !!lens && lens.mode === "only" && lens.seenCount > 0;

  const fetchPage = useCallback(async (reset: boolean) => {
    setLoading(true);
    const off = reset ? 0 : offset;
    let res: { total: number; rows: CodexRow[] };
    if (mine) {
      const p = new URLSearchParams({ sort, lambda: String(lam), limit: String(PAGE), offset: String(off) });
      if (q) p.set("q", q);
      if (years.min != null) p.set("year_min", String(years.min));
      if (years.max != null) p.set("year_max", String(years.max));
      if (country) p.set("country", country);
      if (activeDims) p.set("sub", JSON.stringify(subFilter));
      const d = await fetch(`/api/lens/takescore?${p.toString()}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      res = (d as { total: number; rows: CodexRow[] } | null) ?? { total: 0, rows: [] };
    } else {
      const { data } = await sb.rpc("cinecodex_ranked", {
        p_sort: sort, p_lambda: lam, p_q: q || null,
        p_year_min: years.min, p_year_max: years.max, p_country: country || null,
        p_sub: subFilter, p_max_cost: 100, p_limit: PAGE, p_offset: off,
      });
      res = (data as { total: number; rows: CodexRow[] } | null) ?? { total: 0, rows: [] };
    }
    setTotal(res.total);
    setRows((prev) => reset ? res.rows : [...prev, ...res.rows]);
    setOffset(off + res.rows.length);
    setLoading(false);
  }, [sort, lam, q, country, decade, subFilter, offset, mine]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (first.current) {
      first.current = false;
      if (initialRows.length === 0 || mine) fetchPage(true);
      return;
    }
    setOpen(null);
    const t = setTimeout(() => fetchPage(true), 300);
    return () => clearTimeout(t);
  }, [sort, lam, q, country, decade, subFilter, mine]); // eslint-disable-line react-hooks/exhaustive-deps

  const decades = useMemo(() => { const a: string[] = []; for (let d = 2020; d >= 1910; d -= 10) a.push(String(d)); return a; }, []);
  const setRange = (k: string, lo: number, hi: number) => setRanges((p) => ({ ...p, [k]: [lo, hi] }));

  return (
    <>
      {/* dimension "?" tooltip — scoped here so the popover escapes .cx-dimn's overflow:hidden */}
      <style>{`
        .cx-dimn2{display:flex; align-items:center; gap:5px; min-width:0}
        .cx-dimn-t{font-family:var(--font-ui); font-size:11.5px; color:var(--ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
        .cx-qwrap{position:relative; display:inline-flex; flex:0 0 auto}
        .cx-q{display:inline-flex; align-items:center; justify-content:center; width:13px; height:13px; border:1px solid var(--hairline-2); border-radius:50%; font-family:var(--font-ui); font-size:9px; line-height:1; color:var(--muted); text-decoration:none}
        .cx-qwrap:hover .cx-q, .cx-qwrap:focus-within .cx-q{border-color:var(--ink); color:var(--ink)}
        .cx-qtip{position:absolute; left:-8px; top:100%; z-index:60; padding-top:7px; display:none; width:min(250px,74vw)}
        .cx-qwrap:hover .cx-qtip, .cx-qwrap:focus-within .cx-qtip{display:block}
        .cx-qtip-in{display:block; padding:8px 10px; border:1px solid var(--hairline-2); border-radius:8px; background:#fff; box-shadow:0 4px 14px rgba(0,0,0,.1); font-family:var(--font-ui); font-size:11.5px; line-height:1.45; color:var(--ink); white-space:normal}
        .cx-qmore{color:var(--accent,#C8102E); text-decoration:none; white-space:nowrap}
        /* row: the toggle is a stretched button behind the content; the TS box is a
           real link to the per-film appraisal page sitting above it */
        .cx-row{position:relative}
        .cx-rowbtn{position:absolute; inset:0; width:100%; border:0; background:transparent; cursor:pointer; padding:0}
        a.cx-tsbox{position:relative; z-index:1; text-decoration:none}
        a.cx-tsbox:hover, a.cx-tsbox:focus-visible{filter:brightness(1.08); box-shadow:0 0 0 1px #fff, 0 0 0 2.5px #0F6E56}
        .cxd-appr{font-family:var(--font-ui); font-size:12.5px; font-weight:600; color:#fff; background:var(--accent,#C8102E); border-radius:7px; padding:5px 11px; text-decoration:none; white-space:nowrap}
        .cxd-appr:hover{filter:brightness(1.08)}
        /* curtain hero — three ring gauges + the TS number (appraisal-page miniature) */
        .cxd-hero{display:flex; align-items:center; gap:22px; flex-wrap:wrap; padding:14px 2px 13px; border-bottom:1px solid var(--hairline)}
        .cxd-hero-dons{display:flex; align-items:flex-start; gap:20px}
        .cxd-ts{display:flex; align-items:baseline; gap:10px; margin-left:auto; padding-left:20px; border-left:1px solid var(--hairline)}
        .cxd-ts .n{font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:38px; font-weight:600; line-height:.9; color:#0F6E56; font-variant-numeric:tabular-nums}
        .cxd-ts .lab{display:flex; flex-direction:column; gap:3px}
        .cxd-ts .k{font-family:var(--font-ui); font-size:10.5px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:var(--ink)}
        .cxd-ts .d{font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:10.5px; color:var(--muted)}
        @media(max-width:560px){.cxd-ts{margin-left:0; padding-left:0; border-left:0; flex-basis:100%}}
      `}</style>
      {/* ── Control panel ── */}
      <div className="cx-panel">
        <input className="cx-search" placeholder="Search a film by title…" value={q} onChange={(e) => setQ(e.target.value)} />

        <div className="cx-ctl">
          <span className="cx-lbl">Sort</span>
          <div className="cx-chips">
            {SORTS.map((s) => <button key={s.id} className={sort === s.id ? "on" : ""} onClick={() => setSort(s.id)}>{s.label}</button>)}
          </div>
        </div>

        <div className="cx-ctl">
          <span className="cx-lbl">Decade</span>
          <div className="cx-chips">
            <button className={decade === "" ? "on" : ""} onClick={() => setDecade("")}>All</button>
            {decades.map((d) => <button key={d} className={decade === d ? "on" : ""} onClick={() => setDecade(d)}>{d}s</button>)}
          </div>
        </div>

        <div className="cx-ctl">
          <span className="cx-lbl">Country</span>
          <select className="cx-sel" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">All countries</option>
            {countries.map((c) => <option key={c.code} value={c.code}>{codeToFlag(c.code)} {cname(c.code)} ({c.n})</option>)}
          </select>
        </div>

        <div className="cx-ctl cx-ctl--dial">
          <span className="cx-lbl">Risk aversion (λ)</span>
          <div className="cx-dialwrap">
            <input type="range" min={0} max={2} step={0.1} value={lam} onChange={(e) => setLam(parseFloat(e.target.value))} disabled={sort !== "u"} />
            <b className="cx-lamv">{lam.toFixed(1)}</b>
          </div>
          <span className="cx-hint">
            {sort === "u"
              ? "TakeScore = Value − λ·Risk. Raise λ to punish risky films; lower it to reward ambition."
              : "λ only shapes the TakeScore ranking. Switch Sort to “TakeScore” to use it."}
          </span>
        </div>

        {/* range table over all thirteen sub-dimensions */}
        <div className="cx-ctl cx-ctl--dims">
          <button className="cx-dimtoggle" onClick={() => setShowDims((s) => !s)} aria-expanded={showDims}>
            {showDims ? "▾" : "▸"} Filter by dimension — set a range on any of the thirteen{activeDims ? ` · ${activeDims} active` : ""}
          </button>
          {activeDims ? <button className="cx-dimclear" onClick={() => setRanges({})}>Reset ranges</button> : null}
        </div>
        {showDims ? (
          <div className="cx-dims">
            {DIMS.map((g) => (
              <div className="cx-dimg" key={g.group}>
                <div className={`cx-dimgl ${g.tone}`}>{g.group}</div>
                {g.items.map((it) => {
                  const [lo, hi] = ranges[it.key] ?? [0, 100];
                  const dim = dimByKey.get(it.key);
                  return (
                    <div className="cx-dimrow" key={it.key}>
                      <span className="cx-dimn2">
                        <span className="cx-dimn-t">{it.label}</span>
                        {dim ? (
                          <span className="cx-qwrap">
                            <Link
                              href={takescoreDimUrl(dim.slug)}
                              className="cx-q"
                              aria-label={`About ${it.label}`}
                              aria-describedby={`cx-qtip-${it.key}`}
                            >
                              ?
                            </Link>
                            <span className="cx-qtip" role="tooltip" id={`cx-qtip-${it.key}`}>
                              <span className="cx-qtip-in">
                                {dim.question}{" "}
                                <Link className="cx-qmore" href={takescoreDimUrl(dim.slug)}>Read more →</Link>
                              </span>
                            </span>
                          </span>
                        ) : null}
                      </span>
                      <DualRange lo={lo} hi={hi} onChange={(a, b) => setRange(it.key, a, b)} />
                      <span className="cx-dimv">{lo}–{hi}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="cx-legend2">
        <span><b>TS</b> TakeScore</span><span className="cx-lv">Value ↑</span><span className="cx-lc">Cost</span><span className="cx-lr">Risk ↓</span>
        <Link className="cx-help" href="/takescore/about">How the TakeScore works →</Link>
        <span className="cx-total">{total.toLocaleString()} films</span>
      </div>

      <div className="cx-grid">
        {rows.map((f, i) => {
          const isOpen = open === f.slug + i;
          const ts = Math.round(f.v - lam * f.r);
          return (
            <div className={`cx-item${isOpen ? " open" : ""}`} key={f.slug + i}>
              <div className="cx-row">
                <button
                  className="cx-rowbtn"
                  onClick={() => setOpen(isOpen ? null : f.slug + i)}
                  aria-expanded={isOpen}
                  aria-label={`Toggle sub-scores for ${f.title}`}
                />
                {f.poster_path
                  ? // eslint-disable-next-line @next/next/no-img-element
                    <img className="cx-th" src={`${IMG}${f.poster_path}`} alt="" loading="lazy" />
                  : <div className="cx-th cx-th--e" />}
                <div className="cx-info">
                  <div className="cx-t">{f.title} <span className="cx-sub">({f.year ?? "?"}{f.director ? `, ${f.director}` : ""})</span></div>
                  <div className="cx-nums"><span className="cx-lv">Value {Math.round(f.v)}</span><span className="cx-lc">Cost {Math.round(f.c)}</span><span className="cx-lr">Risk {Math.round(f.r)}</span></div>
                </div>
                <Link
                  className="cx-tsbox"
                  href={`/takescore/film/${f.slug}`}
                  title="Full appraisal →"
                  aria-label={`Open the ${f.title} appraisal`}
                  onClick={(e) => e.stopPropagation()}
                ><b>{ts}</b><i>TS</i></Link>
                <span className="cx-chev" aria-hidden>{isOpen ? "▾" : "▸"}</span>
              </div>
              {isOpen ? <Curtain slug={f.slug} lam={lam} /> : null}
            </div>
          );
        })}
      </div>
      {rows.length < total ? (
        <div className="cx-more"><button onClick={() => fetchPage(false)} disabled={loading}>{loading ? "Loading…" : `Load more (${rows.length}/${total.toLocaleString()})`}</button></div>
      ) : null}
    </>
  );
}
