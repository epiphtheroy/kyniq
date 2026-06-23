"use client";

/**
 * ReadingFeed — search-first, faceted, infinite feed of Strong Misreadings for one
 * framework (or "all"). SSR seeds the first page; the client refetches /api/readings
 * on any filter change and appends pages on scroll.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fw } from "@/lib/frameworks";

export type FeedRow = {
  id: string; tt: string | null; fw: string; snip: string;
  fig: string; figslug: string | null; film: string; filmslug: string; year: number | null;
  trope: string | null; tropeslug: string | null;
};
export type Facets = {
  total: number;
  decades: { d: number; n: number }[];
  top_tropes: { slug: string; title: string; n: number }[];
};
type Init = { total: number; rows: FeedRow[] };

const LIMIT = 24;
const SORTS: [string, string][] = [
  ["film", "Film A–Z"], ["year_desc", "Newest film"], ["year_asc", "Oldest film"],
  ["bold", "Boldest"], ["recent", "Just added"],
];

export default function ReadingFeed(
  { fwSlug, isAll, initial, facets }: { fwSlug: string; isAll: boolean; initial: Init; facets: Facets }
) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("film");
  const [decade, setDecade] = useState<number | null>(null);
  const [trope, setTrope] = useState<string | null>(null);
  const [rows, setRows] = useState<FeedRow[]>(initial.rows);
  const [total, setTotal] = useState(initial.total);
  const [offset, setOffset] = useState(initial.rows.length);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(initial.rows.length >= initial.total);
  const pristine = useRef(true);
  const sentinel = useRef<HTMLDivElement>(null);
  const debTimer = useRef<number | undefined>(undefined);

  const buildUrl = useCallback((off: number) => {
    const p = new URLSearchParams();
    p.set("fw", fwSlug);
    if (q) p.set("q", q);
    if (sort) p.set("sort", sort);
    if (decade != null) p.set("decade", String(decade));
    if (trope) p.set("trope", trope);
    p.set("limit", String(LIMIT));
    p.set("offset", String(off));
    return `/api/readings?${p.toString()}`;
  }, [fwSlug, q, sort, decade, trope]);

  // Refetch page 0 on any filter change (skip first render — SSR already seeded it).
  useEffect(() => {
    if (pristine.current) { pristine.current = false; return; }
    let cancelled = false;
    setLoading(true);
    fetch(buildUrl(0)).then((r) => r.json()).then((d) => {
      if (cancelled) return;
      const rs: FeedRow[] = d.rows ?? [];
      setRows(rs); setTotal(d.total ?? 0); setOffset(rs.length);
      setDone(rs.length >= (d.total ?? 0)); setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [buildUrl]);

  // Infinite scroll.
  useEffect(() => {
    const el = sentinel.current; if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !loading && !done) {
          setLoading(true);
          fetch(buildUrl(offset)).then((r) => r.json()).then((d) => {
            const rs: FeedRow[] = d.rows ?? [];
            setRows((prev) => [...prev, ...rs]);
            setOffset((o) => o + rs.length);
            setDone(rs.length < LIMIT || offset + rs.length >= (d.total ?? total));
            setLoading(false);
          }).catch(() => setLoading(false));
        }
      });
    }, { rootMargin: "700px" });
    io.observe(el);
    return () => io.disconnect();
  }, [buildUrl, offset, loading, done, total]);

  const onSearch = (v: string) => {
    window.clearTimeout(debTimer.current);
    debTimer.current = window.setTimeout(() => setQ(v.trim()), 300);
  };

  return (
    <>
      <div className="sm-controls">
        <input className="sm-feedsearch" type="search" placeholder="Search these readings…"
          defaultValue="" onChange={(e) => onSearch(e.target.value)} aria-label="Search readings" />
        <label className="sm-sortwrap">Sort
          <select className="sm-sort" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>

      {(facets.top_tropes.length > 0 || facets.decades.length > 0) && (
        <div className="sm-facets">
          {facets.top_tropes.length > 0 && (
            <div className="sm-facetrow">
              <span className="sm-facetlbl">Trope</span>
              <button className={`sm-chip${trope === null ? " on" : ""}`} onClick={() => setTrope(null)}>All</button>
              {facets.top_tropes.map((t) => (
                <button key={t.slug} className={`sm-chip${trope === t.slug ? " on" : ""}`}
                  onClick={() => setTrope(trope === t.slug ? null : t.slug)}>{t.title} <span className="n">{t.n}</span></button>
              ))}
            </div>
          )}
          {facets.decades.length > 0 && (
            <div className="sm-facetrow">
              <span className="sm-facetlbl">Decade</span>
              <button className={`sm-chip${decade === null ? " on" : ""}`} onClick={() => setDecade(null)}>All</button>
              {facets.decades.map((d) => (
                <button key={d.d} className={`sm-chip${decade === d.d ? " on" : ""}`}
                  onClick={() => setDecade(decade === d.d ? null : d.d)}>{d.d}s <span className="n">{d.n}</span></button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="sm-count">
        <b>{total.toLocaleString()}</b> {total === 1 ? "reading" : "readings"}{q ? <> matching “{q}”</> : null}
      </div>

      <ul className="sm-list">
        {rows.map((r) => {
          const F = fw(r.fw);
          const href = r.figslug ? `/film/${r.filmslug}/figure/${r.figslug}` : `/film/${r.filmslug}`;
          return (
            <li className="sm-row" key={r.id}>
              <div className="sm-row__top">
                {isAll ? <span className="sm-row__fw" style={{ color: F.color }}>{F.label}</span> : null}
                <Link className="sm-row__film" href={`/film/${r.filmslug}`}>{r.film}</Link>
                {r.year ? <span className="sm-row__yr">({r.year})</span> : null}
                <span className="sm-row__via">via <Link href={href}>{r.fig}</Link></span>
              </div>
              <Link className="sm-row__tt" href={href}>{r.tt ?? r.fig}<span className="arr"> →</span></Link>
              {r.snip ? <p className="sm-row__snip">{r.snip}…</p> : null}
              {r.trope && r.tropeslug ? (
                <Link className="sm-row__trope" href={`/trope/${r.tropeslug}`}># {r.trope}</Link>
              ) : null}
            </li>
          );
        })}
      </ul>

      {rows.length === 0 && !loading ? <p className="sm-empty">No readings match that.</p> : null}
      {!done ? <div className="sm-loader" ref={sentinel}>{loading ? "Loading…" : "Scroll for more"}</div>
             : rows.length > 0 ? <div className="sm-end">— all {total.toLocaleString()} shown —</div> : null}
    </>
  );
}
