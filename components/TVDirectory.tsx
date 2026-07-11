"use client";

// TVDirectory — browse every METATAKE TV watch list. Two modes:
//  • full page (/tv/lists): SSR-seeded, own nav + header.
//  • embedded (bottom of /tv): no nav; fetches its own first page + summary on
//    mount so the lists aren't buried.
// Axis filter tabs (tv_directory_summary) + search + a paged card grid
// (tv_directory via /api/tv/directory). Each card links to /tv/list/[slug].
import { useCallback, useEffect, useRef, useState } from "react";
import SiteNavClient from "@/components/home2/SiteNavClient";

type Item = {
  slug: string; title: string; dek: string | null; kind: string; axis: string | null;
  cut: string | null; n_films: number | null; n_segments: number | null; total_ms: number | null; href: string | null;
};
type Sum = { axis: string; n: number }[];

const AXIS_LABEL: Record<string, string> = {
  lineage: "Lineage", director: "Directors", genre: "Genres", country: "Countries", decade: "Decades",
  theorist: "Theorists", trope: "Tropes", concept: "Concepts", archetype: "Archetypes", genre_topic: "Topic cuts", manual: "Featured",
};
const LIMIT = 48;

export default function TVDirectory({ initial = [], initialSummary = [], initialTotal = 0, embedded = false }: {
  initial?: Item[]; initialSummary?: Sum; initialTotal?: number; embedded?: boolean;
}) {
  const [summary, setSummary] = useState<Sum>(initialSummary);
  const [axis, setAxis] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>(initial);
  const [total, setTotal] = useState(initialTotal);
  const [offset, setOffset] = useState(initial.length);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const firstRun = useRef(!embedded); // embedded has no SSR seed → let the mount effect fetch

  const fetchPage = useCallback(async (a: string | null, query: string, off: number, append: boolean) => {
    const my = ++seq.current;
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (a) p.set("axis", a);
      if (query) p.set("q", query);
      p.set("offset", String(off));
      p.set("limit", String(LIMIT));
      const j = await fetch(`/api/tv/directory?${p.toString()}`).then((r) => r.json());
      if (my !== seq.current) return; // a newer request won
      if (j.summary?.length) setSummary(j.summary as Sum);
      const lists: Item[] = j.lists ?? [];
      setTotal(j.total ?? 0);
      setItems((prev) => (append ? [...prev, ...lists] : lists));
      setOffset(off + lists.length);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, []);

  // embedded: seed the first page + summary on mount
  useEffect(() => {
    if (embedded && !items.length) fetchPage(null, "", 0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded]);

  // refetch on axis/search change
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const t = setTimeout(() => fetchPage(axis, q, 0, false), q ? 280 : 0);
    return () => clearTimeout(t);
  }, [axis, q, fetchPage]);

  const totalAll = summary.reduce((s, x) => s + x.n, 0);

  const controls = (
    <>
      <div className="tvdir-controls">
        <input className="tvdir-q" type="search" placeholder="Search watch lists…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search watch lists" />
        <div className="tvdir-axes">
          <button className={`tvdir-axis${axis === null ? " on" : ""}`} onClick={() => setAxis(null)}>All <i>{totalAll.toLocaleString()}</i></button>
          {summary.filter((s) => s.axis !== "manual").sort((a, b) => b.n - a.n).map((s) => (
            <button key={s.axis} className={`tvdir-axis${axis === s.axis ? " on" : ""}`} onClick={() => setAxis((a) => (a === s.axis ? null : s.axis))}>
              {AXIS_LABEL[s.axis] ?? s.axis} <i>{s.n.toLocaleString()}</i>
            </button>
          ))}
        </div>
      </div>

      <p className="tvdir-count">{total.toLocaleString()} list{total === 1 ? "" : "s"}{axis ? ` · ${AXIS_LABEL[axis] ?? axis}` : ""}{q ? ` · “${q}”` : ""}</p>

      <div className="tvdir-grid">
        {items.map((it) => (
          <a key={it.slug} className="tvdir-card" href={`/tv/list/${it.slug}`}>
            <span className="tvdir-card__k">{AXIS_LABEL[it.axis ?? ""] ?? it.axis}{it.cut === "segments" ? " · topic cut" : ""}</span>
            <span className="tvdir-card__t">{it.title}</span>
            <span className="tvdir-card__m">
              {it.cut === "segments" ? `${it.n_segments ?? 0} chapters` : `${it.n_films ?? 0} film${it.n_films === 1 ? "" : "s"}`}
            </span>
          </a>
        ))}
      </div>

      {items.length < total ? (
        <button className="tvdir-more" disabled={loading} onClick={() => fetchPage(axis, q, offset, true)}>
          {loading ? "Loading…" : `Load more (${(total - items.length).toLocaleString()} left)`}
        </button>
      ) : null}
    </>
  );

  if (embedded) {
    return (
      <section className="tvdir tvdir--embed" id="tv-lists">
        <h2 className="tvdir-embed__h">Every watch list <span>{totalAll ? totalAll.toLocaleString() : ""}</span></h2>
        <p className="tvdir-embed__sub">Filter or search the full library — every director, canon, trope, concept and more, compiled into broadcasts.</p>
        {controls}
      </section>
    );
  }

  return (
    <div className="mt tvpg tvdir">
      <SiteNavClient />
      <div className="tvw-wrap">
        <header className="tvpg-head">
          <div className="tvpg-brand">
            <span className="tvpg-brand__n">METATAKE</span>
            <span className="tvpg-brand__tv">TV</span>
            <span className="tvpg-brand__live">● WATCH LISTS</span>
          </div>
          <p className="tvpg-tag">{totalAll.toLocaleString()} watch lists — every director, canon, trope, concept and more, compiled into broadcasts. No LLM.</p>
          <a className="tvpg-full" href="/tv/watch">Back to the channel ↗</a>
        </header>
        {controls}
      </div>
    </div>
  );
}
