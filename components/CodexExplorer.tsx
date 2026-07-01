"use client";

/** Metatake Score explorer — server-paginated over ALL scored films. Search, sort, λ dial,
 *  year + country + cost filters, compact 3-column list, load-more. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { codeToFlag } from "@/lib/lineageBodies";

const IMG = "https://image.tmdb.org/t/p/w92";
const PAGE = 60;
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export type CodexRow = { slug: string; title: string; year: number | null; poster_path: string | null; director: string | null; v: number; c: number; r: number; u: number; sharpe: number; country_code?: string | null };
type Country = { code: string; n: number };

const SORTS = [
  { id: "u", label: "Net (MTS)" }, { id: "v", label: "Value" },
  { id: "sharpe", label: "Efficiency" }, { id: "lowrisk", label: "Lowest risk" },
  { id: "newest", label: "Newest" }, { id: "oldest", label: "Oldest" },
];
let RN: Intl.DisplayNames | null = null;
const cname = (cc: string) => { try { RN = RN || new Intl.DisplayNames(["en"], { type: "region" }); return RN.of(cc.toUpperCase()) || cc.toUpperCase(); } catch { return cc.toUpperCase(); } };

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

  // refetch (reset) when any filter changes (debounced)
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => fetchPage(true), 280);
    return () => clearTimeout(t);
  }, [sort, lam, q, country, decade]); // eslint-disable-line react-hooks/exhaustive-deps

  const decades = useMemo(() => { const a: string[] = []; for (let d = 2020; d >= 1910; d -= 10) a.push(String(d)); return a; }, []);

  return (
    <>
      <div className="cx-bar">
        <input className="cx-search" placeholder="Search a film…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="cx-seg">
          {SORTS.map((s) => <button key={s.id} className={sort === s.id ? "on" : ""} onClick={() => setSort(s.id)}>{s.label}</button>)}
        </div>
        <select className="cx-sel" value={decade} onChange={(e) => setDecade(e.target.value)}>
          <option value="">Any decade</option>{decades.map((d) => <option key={d} value={d}>{d}s</option>)}
        </select>
        <select className="cx-sel" value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">Any country</option>{countries.map((c) => <option key={c.code} value={c.code}>{codeToFlag(c.code)} {cname(c.code)} ({c.n})</option>)}
        </select>
        {sort === "u" ? (
          <label className="cx-dial">λ <b>{lam.toFixed(1)}</b><input type="range" min={0} max={2} step={0.1} value={lam} onChange={(e) => setLam(parseFloat(e.target.value))} /></label>
        ) : null}
      </div>

      <div className="cx-legend2">
        <span><b>MTS</b> net value</span><span className="cx-lv">V value ↑</span><span className="cx-lc">C cost</span><span className="cx-lr">R risk ↓</span>
        <Link className="cx-help" href="/codex/about">How the Metatake Score works →</Link>
        <span className="cx-total">{total.toLocaleString()} films</span>
      </div>

      <div className="cx-grid">
        {rows.map((f, i) => (
          <Link className="cx-row" href={`/film/${f.slug}`} key={f.slug + i}>
            {f.poster_path
              ? // eslint-disable-next-line @next/next/no-img-element
                <img className="cx-th" src={`${IMG}${f.poster_path}`} alt="" loading="lazy" />
              : <div className="cx-th cx-th--e" />}
            <div className="cx-info">
              <div className="cx-t">{f.title} <span className="cx-sub">({f.year ?? "?"}{f.director ? `, ${f.director}` : ""})</span></div>
              <div className="cx-nums"><b>MTS {sort === "u" ? Math.round(f.v - lam * f.r) : f.u}</b><span className="cx-lv">V{f.v}</span><span className="cx-lc">C{f.c}</span><span className="cx-lr">R{f.r}</span></div>
            </div>
          </Link>
        ))}
      </div>
      {rows.length < total ? (
        <div className="cx-more"><button onClick={() => fetchPage(false)} disabled={loading}>{loading ? "Loading…" : `Load more (${rows.length}/${total.toLocaleString()})`}</button></div>
      ) : null}
    </>
  );
}
