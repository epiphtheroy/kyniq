"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TermHighlight from "@/components/TermHighlight";

/**
 * DeskExplorer — the curious-desk essays on a concept page, rendered as full
 * cards (backdrop + excerpt) with client-side search / desk filter / sort
 * once the list is long enough to need them (>8).
 */
export type DeskLink = {
  film_slug: string; film_title: string; film_year: number | null; backdrop_path: string | null;
  desk_key: string; essay_title: string; excerpt: string | null; mode: string | null;
};

const IMG = "https://image.tmdb.org/t/p";

const DESK_META: Record<string, { label: string; color: string }> = {
  decoder: { label: "Decoder", color: "#8A5A2B" },
  theories: { label: "Fan Theories", color: "#5B4DAF" },
  debates: { label: "Debates", color: "#B03A48" },
  contested: { label: "Contested", color: "#8C3B6E" },
  "reception-story": { label: "Reception", color: "#2E7D6B" },
  "parallel-lives": { label: "Parallel Lives", color: "#3E6DB5" },
  "field-test": { label: "Field Test", color: "#71701F" },
  exegesis: { label: "Exegesis", color: "#4A4A8F" },
};
export const deskMeta = (k: string) => DESK_META[k] ?? { label: "Essay", color: "#666" };
const mdStrip = (s: string) => s.replace(/\*\*?|__|`/g, "").trim();

const sel: React.CSSProperties = {
  fontSize: 13, padding: "6px 10px", borderRadius: 8,
  border: "1px solid rgba(0,0,0,.18)", background: "transparent",
};

export default function DeskExplorer({ desks, about, listenEvent }: { desks: DeskLink[]; about: string; listenEvent?: string }) {
  const [q, setQ] = useState("");
  useEffect(() => {
    if (!listenEvent) return;
    const onQ = (e: Event) => setQ(String((e as CustomEvent).detail ?? ""));
    window.addEventListener(listenEvent, onQ);
    return () => window.removeEventListener(listenEvent, onQ);
  }, [listenEvent]);
  const [desk, setDesk] = useState("");
  const [sort, setSort] = useState<"relevance" | "year-desc" | "year-asc" | "film-az">("relevance");

  const deskKeys = useMemo(() => [...new Set(desks.map((d) => d.desk_key))].sort(), [desks]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = desks;
    if (needle) {
      out = out.filter((d) =>
        d.film_title.toLowerCase().includes(needle) ||
        d.essay_title.toLowerCase().includes(needle) ||
        (d.excerpt ?? "").toLowerCase().includes(needle));
    }
    if (desk) out = out.filter((d) => d.desk_key === desk);
    if (sort === "year-desc") out = [...out].sort((a, b) => (b.film_year ?? 0) - (a.film_year ?? 0));
    else if (sort === "year-asc") out = [...out].sort((a, b) => (a.film_year ?? 9999) - (b.film_year ?? 9999));
    else if (sort === "film-az") out = [...out].sort((a, b) => a.film_title.localeCompare(b.film_title));
    return out;
  }, [desks, q, desk, sort]);

  const showControls = desks.length > 8;

  return (
    <div>
      {showControls && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "12px 0 0" }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${desks.length} essays — film, title, text…`}
              aria-label="Search desk essays"
              style={{ flex: "1 1 220px", maxWidth: 340, fontSize: 14, padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,.18)", background: "transparent" }}
            />
            <select value={desk} onChange={(e) => setDesk(e.target.value)} aria-label="Filter by desk" style={sel}>
              <option value="">All desks</option>
              {deskKeys.map((k) => <option key={k} value={k}>{deskMeta(k).label}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort essays" style={sel}>
              <option value="relevance">Most relevant</option>
              <option value="year-desc">Newest films</option>
              <option value="year-asc">Oldest films</option>
              <option value="film-az">Film A–Z</option>
            </select>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 13, opacity: 0.65 }}>
            Showing {filtered.length} of {desks.length} essays on {about}
          </p>
        </>
      )}
      <div className="th-readings">
        {filtered.map((d) => {
          const M = deskMeta(d.desk_key);
          const href = `/film/${d.film_slug}/${d.desk_key}`;
          return (
            <article className="thr" key={`${d.film_slug}/${d.desk_key}`}>
              {d.backdrop_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <Link href={href} className="thr-th"><img src={`${IMG}/w300${d.backdrop_path}`} alt="" loading="lazy" /></Link>
              ) : null}
              <div className="thr-body">
                <div className="thr-top">
                  <span className="thr-fw" style={{ color: M.color }}>{M.label}</span>
                  <Link className="thr-film" href={`/film/${d.film_slug}`}>{d.film_title}{d.film_year ? ` (${d.film_year})` : ""}</Link>
                </div>
                <Link className="thr-title" href={href}><TermHighlight text={mdStrip(d.essay_title)} terms={[about]} /></Link>
                {d.excerpt ? <p className="thr-thesis"><TermHighlight text={mdStrip(d.excerpt)} terms={[about]} /></p> : null}
                <Link className="thr-go" href={href}>Read the essay →</Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
