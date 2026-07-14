"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fw } from "@/lib/frameworks";
import TermHighlight from "@/components/TermHighlight";

/**
 * ReadingsExplorer — client-side search / sort / filter over a concept's
 * readings list. Controls appear only when the list is long enough to need
 * them (>12); otherwise it renders the plain list. Card markup matches the
 * server-rendered .thr cards used across theory pages.
 */
export type ReadingItem = {
  take_id: string; take_title: string | null; framework: string | null; thesis: string | null; leap: string | null;
  theorist_name: string | null; theorist_slug: string | null; fig_label: string; fig_slug: string;
  film_title: string; film_slug: string; film_year: number | null; backdrop_path: string | null;
};

const IMG = "https://image.tmdb.org/t/p";

const sel: React.CSSProperties = {
  fontSize: 13, padding: "6px 10px", borderRadius: 8,
  border: "1px solid rgba(0,0,0,.18)", background: "transparent",
};

export default function ReadingsExplorer({ readings, about, listenEvent }: { readings: ReadingItem[]; about: string; listenEvent?: string }) {
  const [q, setQ] = useState("");
  // The sticky tab bar's in-page search drives this explorer (CustomEvent).
  useEffect(() => {
    if (!listenEvent) return;
    const onQ = (e: Event) => setQ(String((e as CustomEvent).detail ?? ""));
    window.addEventListener(listenEvent, onQ);
    return () => window.removeEventListener(listenEvent, onQ);
  }, [listenEvent]);
  const [frame, setFrame] = useState("");
  const [decade, setDecade] = useState("");
  const [sort, setSort] = useState<"relevance" | "year-desc" | "year-asc" | "film-az">("relevance");

  const frames = useMemo(
    () => [...new Set(readings.map((r) => fw(r.framework).label))].sort(),
    [readings],
  );
  const decades = useMemo(
    () => [...new Set(readings.map((r) => (r.film_year ? `${Math.floor(r.film_year / 10) * 10}s` : "")).filter(Boolean))].sort().reverse(),
    [readings],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = readings;
    if (needle) {
      out = out.filter((r) =>
        r.film_title.toLowerCase().includes(needle) ||
        (r.take_title ?? "").toLowerCase().includes(needle) ||
        (r.thesis ?? "").toLowerCase().includes(needle) ||
        (r.theorist_name ?? "").toLowerCase().includes(needle));
    }
    if (frame) out = out.filter((r) => fw(r.framework).label === frame);
    if (decade) out = out.filter((r) => r.film_year && `${Math.floor(r.film_year / 10) * 10}s` === decade);
    if (sort === "year-desc") out = [...out].sort((a, b) => (b.film_year ?? 0) - (a.film_year ?? 0));
    else if (sort === "year-asc") out = [...out].sort((a, b) => (a.film_year ?? 9999) - (b.film_year ?? 9999));
    else if (sort === "film-az") out = [...out].sort((a, b) => a.film_title.localeCompare(b.film_title));
    return out;
  }, [readings, q, frame, decade, sort]);

  const showControls = readings.length > 12;

  return (
    <div>
      {showControls && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "14px 0 0" }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${readings.length} readings — film, thesis, theorist…`}
              aria-label="Search readings"
              style={{ flex: "1 1 240px", maxWidth: 360, fontSize: 14, padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,.18)", background: "transparent" }}
            />
            <select value={frame} onChange={(e) => setFrame(e.target.value)} aria-label="Filter by framework" style={sel}>
              <option value="">All frameworks</option>
              {frames.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={decade} onChange={(e) => setDecade(e.target.value)} aria-label="Filter by decade" style={sel}>
              <option value="">All decades</option>
              {decades.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort readings" style={sel}>
              <option value="relevance">Most relevant</option>
              <option value="year-desc">Newest films</option>
              <option value="year-asc">Oldest films</option>
              <option value="film-az">Film A–Z</option>
            </select>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 13, opacity: 0.65 }}>
            Showing {filtered.length.toLocaleString()} of {readings.length.toLocaleString()} readings of {about}
          </p>
        </>
      )}
      <div className="th-readings">
        {filtered.map((r) => {
          const F = fw(r.framework);
          const href = `/film/${r.film_slug}/figure/${r.fig_slug}#t-${r.take_id}`;
          return (
            <article className="thr" key={r.take_id} id={`take-${r.take_id}`}>
              {r.backdrop_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <Link href={href} className="thr-th"><img src={`${IMG}/w300${r.backdrop_path}`} alt={`${r.film_title}${r.film_year ? ` (${r.film_year})` : ""} — still`} loading="lazy" /></Link>
              ) : null}
              <div className="thr-body">
                <div className="thr-top">
                  <span className="thr-fw" style={{ color: F.color }}>{F.label}</span>
                  <Link className="thr-film" href={`/film/${r.film_slug}`}>{r.film_title}{r.film_year ? ` (${r.film_year})` : ""}</Link>
                  {r.theorist_name ? (r.theorist_slug
                    ? <Link className="thr-concept" href={`/theorist/${r.theorist_slug}`}>{r.theorist_name}</Link>
                    : <span className="thr-concept">{r.theorist_name}</span>) : null}
                </div>
                <Link className="thr-title" href={href}><TermHighlight text={r.take_title ?? r.fig_label} terms={[about]} /></Link>
                {r.thesis ? <p className="thr-thesis"><TermHighlight text={r.thesis} terms={[about]} /></p> : null}
                {r.leap ? <p className="thr-leap"><span className="thr-leap__l">The leap</span> <TermHighlight text={r.leap} terms={[about]} /></p> : null}
                <Link className="thr-go" href={href}>Read the scene →</Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
