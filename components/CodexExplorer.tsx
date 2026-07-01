"use client";

/** Metatake Score explorer — server-paginated over ALL scored films.
 *  Top control panel (sort chips, decade chip-bar, country, λ dial + explainer),
 *  compact rows that expand IN PLACE (curtain) to show the sub-scores, load-more. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { codeToFlag } from "@/lib/lineageBodies";

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
  { id: "u", label: "Net (MTS)" }, { id: "v", label: "Value" },
  { id: "sharpe", label: "Efficiency" }, { id: "lowrisk", label: "Lowest risk" },
  { id: "newest", label: "Newest" }, { id: "oldest", label: "Oldest" },
];
const VALUE = ["Cognitive", "Affective", "Formal", "Moral", "Durability"];
const COST = ["Intertextual", "Formal radicalism", "Extratextual", "Auteur oeuvre"];
const RISK = ["Bankruptcy", "Insincerity", "Cowardice", "Polarization"];

let RN: Intl.DisplayNames | null = null;
const cname = (cc: string) => { try { RN = RN || new Intl.DisplayNames(["en"], { type: "region" }); return RN.of(cc.toUpperCase()) || cc.toUpperCase(); } catch { return cc.toUpperCase(); } };

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

function Curtain({ slug }: { slug: string }) {
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
  return (
    <div className="cxd">
      <div className="cxd-cols">
        <SubGroup label="Value" names={VALUE} sub={d.sub} tone="cx-lv" />
        <SubGroup label="Cost" names={COST} sub={d.sub} tone="cx-lc" />
        <SubGroup label="Risk" names={RISK} sub={d.sub} tone="cx-lr" />
      </div>
      {(ext.imdb || ext.rt || ext.metascore) ? (
        <div className="cxd-ext">
          <span className="cxd-extl">Alongside — not part of the score:</span>
          {ext.imdb ? <span className="cxd-chip">IMDb {ext.imdb}</span> : null}
          {ext.rt ? <span className="cxd-chip">RT {ext.rt}%</span> : null}
          {ext.metascore ? <span className="cxd-chip">Metascore {ext.metascore}</span> : null}
        </div>
      ) : null}
      <div className="cxd-foot">
        <span className="cxd-src">AI-estimated (rubric {d.panel}{d.n_samples ? `, n=${d.n_samples}` : ""}{d.sd_v != null ? `, ±${Math.round(Number(d.sd_v))}` : ""}) — a judgment, not a fact.</span>
        <Link className="cxd-open" href={`/film/${slug}#df-codex`}>Open the film →</Link>
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
  const [rows, setRows] = useState<CodexRow[]>(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [offset, setOffset] = useState(initialRows.length);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const first = useRef(true);

  const years = decade ? { min: parseInt(decade), max: parseInt(decade) + 9 } : { min: null as number | null, max: null as number | null };

  const fetchPage = useCallback(async (reset: boolean) => {
    setLoading(true);
    const off = reset ? 0 : offset;
    const { data } = await sb.rpc("cinecodex_ranked", {
      p_sort: sort, p_lambda: lam, p_q: q || null,
      p_year_min: years.min, p_year_max: years.max, p_country: country || null,
      p_max_cost: 100, p_limit: PAGE, p_offset: off,
    });
    const res = (data as { total: number; rows: CodexRow[] } | null) ?? { total: 0, rows: [] };
    setTotal(res.total);
    setRows((prev) => reset ? res.rows : [...prev, ...res.rows]);
    setOffset(off + res.rows.length);
    setLoading(false);
  }, [sort, lam, q, country, decade, offset]); // eslint-disable-line react-hooks/exhaustive-deps

  // refetch (reset) when any filter changes (debounced); self-heal if the
  // server render came back empty (e.g. stale ISR built before data landed).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      if (initialRows.length === 0) fetchPage(true);
      return;
    }
    setOpen(null);
    const t = setTimeout(() => fetchPage(true), 280);
    return () => clearTimeout(t);
  }, [sort, lam, q, country, decade]); // eslint-disable-line react-hooks/exhaustive-deps

  const decades = useMemo(() => { const a: string[] = []; for (let d = 2020; d >= 1910; d -= 10) a.push(String(d)); return a; }, []);

  return (
    <>
      {/* ── Control panel: everything you can tune, up top ── */}
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
              ? "MTS = Value − λ·Risk. Raise λ to punish risky films; lower it to reward ambition."
              : "λ only shapes the Net (MTS) ranking. Switch Sort to “Net” to use it."}
          </span>
        </div>
      </div>

      <div className="cx-legend2">
        <span><b>MTS</b> net value</span><span className="cx-lv">V value ↑</span><span className="cx-lc">C cost</span><span className="cx-lr">R risk ↓</span>
        <Link className="cx-help" href="/score/about">How the Metatake Score works →</Link>
        <span className="cx-total">{total.toLocaleString()} films</span>
      </div>

      <div className="cx-grid">
        {rows.map((f, i) => {
          const isOpen = open === f.slug + i;
          const mts = sort === "u" ? Math.round(f.v - lam * f.r) : f.u;
          return (
            <div className={`cx-item${isOpen ? " open" : ""}`} key={f.slug + i}>
              <button className="cx-row" onClick={() => setOpen(isOpen ? null : f.slug + i)} aria-expanded={isOpen}>
                {f.poster_path
                  ? // eslint-disable-next-line @next/next/no-img-element
                    <img className="cx-th" src={`${IMG}${f.poster_path}`} alt="" loading="lazy" />
                  : <div className="cx-th cx-th--e" />}
                <div className="cx-info">
                  <div className="cx-t">{f.title} <span className="cx-sub">({f.year ?? "?"}{f.director ? `, ${f.director}` : ""})</span></div>
                  <div className="cx-nums"><b>MTS {mts}</b><span className="cx-lv">V{f.v}</span><span className="cx-lc">C{f.c}</span><span className="cx-lr">R{f.r}</span></div>
                </div>
                <span className="cx-chev" aria-hidden>{isOpen ? "▾" : "▸"}</span>
              </button>
              {isOpen ? <Curtain slug={f.slug} /> : null}
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
