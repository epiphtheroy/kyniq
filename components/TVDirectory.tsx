"use client";

// TVDirectory — browse + search every METATAKE TV watch list AND individual
// broadcast, YouTube-style. Two modes:
//  • full page (/tv/lists): SSR-seeded, own nav + header.
//  • embedded (bottom of /tv): no nav; fetches its own first page on mount.
// Browsing shows a YouTube grid (clean thumbnail, text BELOW the image, count
// badge on the thumb). Searching switches to YouTube result rows — playlists
// with the stacked-count overlay, videos with a duration badge — and covers
// individual programs as well as lists (`videos` from /api/tv/directory).
import { useCallback, useEffect, useRef, useState } from "react";
import SiteNavClient from "@/components/home2/SiteNavClient";

type Item = {
  slug: string; title: string; dek: string | null; kind: string; axis: string | null;
  cut: string | null; n_films: number | null; n_segments: number | null; total_ms: number | null; href: string | null;
  backdrop?: string | null;
};
type Vid = {
  slug: string; title: string; dek: string | null; seg_count: number | null; duration_ms: number | null;
  film: { title: string | null; year: number | null; backdrop: string | null } | null;
};
type Sum = { axis: string; n: number }[];
const IMG = "https://image.tmdb.org/t/p";

const AXIS_LABEL: Record<string, string> = {
  lineage: "Lineage", director: "Directors", genre: "Genres", country: "Countries", decade: "Decades",
  theorist: "Theorists", trope: "Tropes", concept: "Concepts", archetype: "Archetypes", genre_topic: "Topic cuts", manual: "Featured",
};
const LIMIT = 48;

const bg = (b?: string | null) => (b ? { backgroundImage: `url(${IMG}/w500${b})` } : undefined);
const countOf = (it: Item) =>
  it.cut === "segments" ? `${it.n_segments ?? 0} chapters` : `${it.n_films ?? 0} film${it.n_films === 1 ? "" : "s"}`;
const fmtDur = (ms?: number | null) => {
  if (!ms) return null;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function TVDirectory({ initial = [], initialSummary = [], initialTotal = 0, embedded = false, onSelect, onSelectVideo }: {
  initial?: Item[]; initialSummary?: Sum; initialTotal?: number; embedded?: boolean;
  // when set (the /tv embed), picking a card/row plays it in place instead of
  // navigating; plain hrefs are kept for SEO and modifier-clicks
  onSelect?: (slug: string) => void;
  onSelectVideo?: (slug: string) => void;
}) {
  const [summary, setSummary] = useState<Sum>(initialSummary);
  const [axis, setAxis] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>(initial);
  const [videos, setVideos] = useState<Vid[]>([]);
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
      // one retry: a cold /api hit can 500 on the anon statement timeout, and a
      // silently dropped search response leaves stale unfiltered results on screen
      let j: { summary?: Sum; lists?: Item[]; videos?: Vid[]; total?: number; error?: string } | null = null;
      for (let attempt = 0; attempt < 2 && !j?.lists; attempt++) {
        try {
          const r = await fetch(`/api/tv/directory?${p.toString()}`);
          const body = await r.json();
          if (r.ok && !body.error) j = body;
        } catch { /* retry */ }
        if (my !== seq.current) return; // a newer request won
      }
      if (!j) return;
      if (j.summary?.length) setSummary(j.summary);
      const lists: Item[] = j.lists ?? [];
      setTotal(j.total ?? 0);
      setItems((prev) => (append ? [...prev, ...lists] : lists));
      if (!append) setVideos(j.videos ?? []);
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
  const searching = q.trim().length > 0;

  const pickList = onSelect
    ? (slug: string) => (e: React.MouseEvent) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        onSelect(slug);
      }
    : () => undefined;
  const pickVideo = onSelectVideo
    ? (slug: string) => (e: React.MouseEvent) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        onSelectVideo(slug);
      }
    : () => undefined;

  const listCard = (it: Item) => (
    <a key={it.slug} className="tvyt-card" href={`/tv/list/${it.slug}`} onClick={pickList(it.slug)}>
      <span className={`tvyt-th${it.backdrop ? "" : " tvyt-th--noimg"}`} style={bg(it.backdrop)}>
        <span className="tvyt-count">≣ {countOf(it)}</span>
      </span>
      <span className="tvyt-b">
        <span className="tvyt-t">{it.title}</span>
        <span className="tvyt-m">{AXIS_LABEL[it.axis ?? ""] ?? it.axis ?? "Watch list"}{it.cut === "segments" ? " · topic cut" : ""} · Watch list</span>
      </span>
    </a>
  );

  const listRow = (it: Item) => (
    <a key={`l-${it.slug}`} className="tvyt-row" href={`/tv/list/${it.slug}`} onClick={pickList(it.slug)}>
      <span className={`tvyt-row__th${it.backdrop ? "" : " tvyt-th--noimg"}`} style={bg(it.backdrop)}>
        <span className="tvyt-row__ov"><i>≣</i>{it.cut === "segments" ? it.n_segments ?? 0 : it.n_films ?? 0}</span>
      </span>
      <span className="tvyt-row__b">
        <span className="tvyt-row__t">{it.title}</span>
        <span className="tvyt-row__m">Watch list · {AXIS_LABEL[it.axis ?? ""] ?? it.axis} · {countOf(it)}</span>
        {it.dek ? <span className="tvyt-row__d">{it.dek}</span> : null}
      </span>
    </a>
  );

  const videoRow = (v: Vid) => (
    <a key={`v-${v.slug}`} className="tvyt-row" href={`/tv/${v.slug}`} onClick={pickVideo(v.slug)}>
      <span className={`tvyt-row__th${v.film?.backdrop ? "" : " tvyt-th--noimg"}`} style={bg(v.film?.backdrop)}>
        {fmtDur(v.duration_ms) ? <b className="tvyt-dur">{fmtDur(v.duration_ms)}</b> : null}
      </span>
      <span className="tvyt-row__b">
        <span className="tvyt-row__t">{v.title}</span>
        <span className="tvyt-row__m">
          Broadcast · {v.film?.title}{v.film?.year ? ` (${v.film.year})` : ""}{v.seg_count ? ` · ${v.seg_count} chapters` : ""}
        </span>
        {v.dek ? <span className="tvyt-row__d">{v.dek}</span> : null}
      </span>
    </a>
  );

  const controls = (
    <>
      <div className="tvdir-controls">
        <input className="tvdir-q" type="search" placeholder="Search lists and broadcasts…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search watch lists and broadcasts" />
        <div className="tvdir-axes">
          <button className={`tvdir-axis${axis === null ? " on" : ""}`} onClick={() => setAxis(null)}>All <i>{totalAll.toLocaleString()}</i></button>
          {summary.filter((s) => s.axis !== "manual").sort((a, b) => b.n - a.n).map((s) => (
            <button key={s.axis} className={`tvdir-axis${axis === s.axis ? " on" : ""}`} onClick={() => setAxis((a) => (a === s.axis ? null : s.axis))}>
              {AXIS_LABEL[s.axis] ?? s.axis} <i>{s.n.toLocaleString()}</i>
            </button>
          ))}
        </div>
      </div>

      <p className="tvdir-count">
        {searching
          ? `${(total + videos.length).toLocaleString()} result${total + videos.length === 1 ? "" : "s"} · “${q}”`
          : `${total.toLocaleString()} list${total === 1 ? "" : "s"}${axis ? ` · ${AXIS_LABEL[axis] ?? axis}` : ""}`}
      </p>

      {searching ? (
        <div className="tvyt-rows">
          {items.map(listRow)}
          {videos.map(videoRow)}
          {!loading && !items.length && !videos.length ? <p className="tvdir-count">Nothing matches — try a film, director, trope or concept.</p> : null}
        </div>
      ) : (
        <div className="tvyt-grid">{items.map(listCard)}</div>
      )}

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
        <p className="tvdir-embed__sub">Filter or search the full library — every director, canon, trope, concept and every single broadcast.</p>
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
          <a className="tvpg-full" href="/tv">Back to the channel ↗</a>
        </header>
        {controls}
      </div>
    </div>
  );
}
