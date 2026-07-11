"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import "./for-w-heo.css";

const IMG = "https://image.tmdb.org/t/p";

export type WHeoFilm = {
  slug: string;
  title: string;
  year: number | null;
  poster: string | null;
  genres: string[] | null;
  director: string | null;
  director_slug: string | null;
  verdict?: string | null;
  rec_date?: string | null;
};

const TIER_LABEL: Record<string, string> = {
  essential: "Essential",
  start_here: "Start here",
  deep_cut: "Deep cut",
};

type SortKey = "year_desc" | "year_asc" | "title" | "director";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "year_desc", label: "Newest first" },
  { key: "year_asc", label: "Oldest first" },
  { key: "title", label: "Title A–Z" },
  { key: "director", label: "Director A–Z" },
];

// Strip a leading article for title sorting ("The Godfather" → "godfather").
const titleKey = (t: string) => t.replace(/^(the|a|an)\s+/i, "").toLowerCase();

export default function ForWHeoList({ films }: { films: WHeoFilm[] }) {
  const [sort, setSort] = useState<SortKey>("year_desc");
  const [tier, setTier] = useState<string | null>(null);
  const [genre, setGenre] = useState<string | null>(null);
  const [director, setDirector] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [dirQuery, setDirQuery] = useState("");

  // Tier facet — how many of each recommendation tier are present.
  const tierCounts = useMemo(() => {
    const m: Record<string, number> = { essential: 0, start_here: 0, deep_cut: 0 };
    for (const f of films) if (f.verdict && f.verdict in m) m[f.verdict] += 1;
    return m;
  }, [films]);
  const hasTiers = films.some((f) => f.verdict);

  // Genre facet — every genre present, with counts, most common first.
  const genres = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of films) for (const g of f.genres ?? []) m.set(g, (m.get(g) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [films]);

  // Director facet — every director, with counts. Most films first, then name.
  const directors = useMemo(() => {
    const m = new Map<string, { name: string; slug: string | null; n: number }>();
    for (const f of films) {
      if (!f.director) continue;
      const key = f.director;
      const e = m.get(key) ?? { name: f.director, slug: f.director_slug, n: 0 };
      e.n += 1;
      m.set(key, e);
    }
    return [...m.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  }, [films]);

  const shownDirectors = useMemo(() => {
    const needle = dirQuery.trim().toLowerCase();
    return needle ? directors.filter((d) => d.name.toLowerCase().includes(needle)) : directors;
  }, [directors, dirQuery]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = films.filter((f) => {
      if (tier && f.verdict !== tier) return false;
      if (genre && !(f.genres ?? []).includes(genre)) return false;
      if (director && f.director !== director) return false;
      if (needle && !(f.title.toLowerCase().includes(needle) || (f.director ?? "").toLowerCase().includes(needle))) return false;
      return true;
    });
    out.sort((a, b) => {
      switch (sort) {
        case "year_asc": return (a.year ?? 9999) - (b.year ?? 9999) || titleKey(a.title).localeCompare(titleKey(b.title));
        case "title": return titleKey(a.title).localeCompare(titleKey(b.title));
        case "director": return (a.director ?? "~").localeCompare(b.director ?? "~") || (a.year ?? 0) - (b.year ?? 0);
        case "year_desc":
        default: return (b.year ?? 0) - (a.year ?? 0) || titleKey(a.title).localeCompare(titleKey(b.title));
      }
    });
    return out;
  }, [films, tier, genre, director, q, sort]);

  const activeFilters = tier || genre || director || q.trim();

  return (
    <div className="fwh">
      {/* ── Controls: search · sort · genre chips ── */}
      <div className="fwh-controls">
        <input
          className="fwh-search"
          type="search"
          placeholder="Search title or director…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search films"
        />
        <label className="fwh-sort">
          <span>Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
      </div>

      {hasTiers ? (
        <div className="fwh-tiers" role="group" aria-label="Filter by recommendation tier">
          <button className={`fwh-tierbtn${!tier ? " is-on" : ""}`} onClick={() => setTier(null)}>All tiers</button>
          {(["essential", "start_here", "deep_cut"] as const).map((t) => (
            tierCounts[t] > 0 ? (
              <button key={t} className={`fwh-tierbtn fwh-tierbtn--${t}${tier === t ? " is-on" : ""}`} onClick={() => setTier(tier === t ? null : t)}>
                {TIER_LABEL[t]}<span className="fwh-chip-n">{tierCounts[t]}</span>
              </button>
            ) : null
          ))}
        </div>
      ) : null}

      <div className="fwh-genres" role="group" aria-label="Filter by genre">
        <button className={`fwh-chip${!genre ? " is-on" : ""}`} onClick={() => setGenre(null)}>All genres</button>
        {genres.map(([g, n]) => (
          <button key={g} className={`fwh-chip${genre === g ? " is-on" : ""}`} onClick={() => setGenre(genre === g ? null : g)}>
            {g}<span className="fwh-chip-n">{n}</span>
          </button>
        ))}
      </div>

      <div className="fwh-body">
        {/* ── Director listing / filter ── */}
        <aside className="fwh-dirs" aria-label="Filter by director">
          <div className="fwh-dirs-h">
            <span>Directors<span className="fwh-dirs-tot">{directors.length}</span></span>
            {director ? <button className="fwh-clear" onClick={() => setDirector(null)}>clear</button> : null}
          </div>
          <input
            className="fwh-dirsearch"
            type="search"
            placeholder="Find a director…"
            value={dirQuery}
            onChange={(e) => setDirQuery(e.target.value)}
            aria-label="Find a director"
          />
          <ul className="fwh-dirlist">
            {shownDirectors.map((d) => (
              <li key={d.name}>
                <button
                  className={`fwh-dir${director === d.name ? " is-on" : ""}`}
                  onClick={() => setDirector(director === d.name ? null : d.name)}
                >
                  <span className="fwh-dir-name">{d.name}</span>
                  <span className="fwh-dir-n">{d.n}</span>
                </button>
              </li>
            ))}
            {shownDirectors.length === 0 ? <li className="fwh-dir-empty">No director matches “{dirQuery}”.</li> : null}
          </ul>
        </aside>

        {/* ── Film grid ── */}
        <div className="fwh-main">
          <div className="fwh-count">
            <b>{filtered.length}</b> {filtered.length === 1 ? "film" : "films"}
            {activeFilters ? (
              <button className="fwh-reset" onClick={() => { setTier(null); setGenre(null); setDirector(null); setQ(""); }}>
                Reset filters
              </button>
            ) : null}
          </div>
          {filtered.length === 0 ? (
            <p className="fwh-empty">No films match these filters. <button className="fwh-linkbtn" onClick={() => { setTier(null); setGenre(null); setDirector(null); setQ(""); }}>Clear them</button> to see all {films.length}.</p>
          ) : (
            <ul className="fwh-grid">
              {filtered.map((f) => (
                <li key={f.slug} className="fwh-card">
                  <Link href={`/film/${f.slug}`} className="fwh-poster-link">
                    {f.poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="fwh-poster" src={`${IMG}/w185${f.poster}`} alt={`${f.title} poster`} width={185} height={278} loading="lazy" />
                    ) : (
                      <span className="fwh-poster fwh-poster--e" aria-hidden="true" />
                    )}
                    {f.verdict && TIER_LABEL[f.verdict] ? (
                      <span className={`fwh-tierbadge fwh-tierbadge--${f.verdict}`}>{TIER_LABEL[f.verdict]}</span>
                    ) : null}
                  </Link>
                  <div className="fwh-meta">
                    <Link href={`/film/${f.slug}`} className="fwh-title">{f.title}</Link>
                    <div className="fwh-sub">
                      {f.year ? <span className="fwh-yr">{f.year}</span> : null}
                      {f.director ? (
                        f.director_slug
                          ? <Link href={`/director/${f.director_slug}`} className="fwh-dirlink">{f.director}</Link>
                          : <span className="fwh-dirlink">{f.director}</span>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
