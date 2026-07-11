"use client";

// TVListView — the body of a standalone playlist page (/tv/list/[slug]). Plays a
// whole watch list (intro briefing entry first, then each film's broadcast,
// auto-advancing), lists its films, and links each to its own /tv/[film] page.
// Reuses the /tv/watch furniture (.tvw-*). LLM-free; compiled by the axis
// builders (tv_build_*_playlists).
import { useCallback, useMemo, useState } from "react";
import SiteNavClient from "@/components/home2/SiteNavClient";
import TVProgramPlayer, { type TVEntry, type TVSegment } from "@/components/TVProgramPlayer";
import TVDirectory from "@/components/TVDirectory";

const IMG = "https://image.tmdb.org/t/p";

export type PlaylistMeta = {
  slug: string; title: string; dek?: string | null; kind?: string | null;
  axis?: string | null; cut?: string | null; href?: string | null;
  n_films?: number | null; n_segments?: number | null; total_ms?: number | null;
};

const isIntro = (e: TVEntry) => e.slug.startsWith("intro-");

export default function TVListView({ playlist, entries }: { playlist: PlaylistMeta; entries: TVEntry[] }) {
  const [entryIdx, setEntryIdx] = useState(0);
  const [nowSeg, setNowSeg] = useState<TVSegment | null>(null);
  const entry = entries[entryIdx] ?? null;
  const advance = useCallback(() => setEntryIdx((i) => (entries.length ? (i + 1) % entries.length : 0)), [entries.length]);
  const chapters = useMemo(() => entry?.segments ?? [], [entry]);
  const jump = (i: number) => window.dispatchEvent(new CustomEvent("tvw-jump", { detail: i }));
  const films = useMemo(() => entries.filter((e) => !isIntro(e)), [entries]);

  return (
    <div className="mt tvpg tvw">
      <SiteNavClient />
      <div className="tvw-wrap">
        <header className="tvpg-head">
          <div className="tvpg-brand">
            <span className="tvpg-brand__n">METATAKE</span>
            <span className="tvpg-brand__tv">TV</span>
            <span className="tvpg-brand__live">● ON AIR</span>
          </div>
          <p className="tvpg-tag">{playlist.dek ?? "A METATAKE TV watch list — compiled from the Metatake record, no LLM. It opens with a briefing, then plays each film."}</p>
          <a className="tvpg-full" href={`/tv?list=${encodeURIComponent(playlist.slug)}`}>Open in the watch page ↗</a>
          {playlist.href ? <a className="tvpg-full" href={playlist.href}>Source page ↗</a> : null}
        </header>

        <div className="tvw-main">
          <div className="tvw-left">
            <div className="tvw-player">
              {entries.length
                ? <TVProgramPlayer entries={entries} entryIdx={entryIdx} onEntryEnd={advance} onNow={setNowSeg} />
                : <div className="tvw-tuning">Tuning in…</div>}
            </div>

            {entry ? (
              <div className="tvw-meta">
                <h1 className="tvw-title">{playlist.title}</h1>
                <p className="tvw-sub">
                  {isIntro(entry) ? "Briefing" : <>Now playing: {entry.film?.title}{entry.film?.year ? ` (${entry.film.year})` : ""}{entry.title ? <> — {entry.title}</> : null}</>}
                </p>
                <div className="tvw-chapters">
                  {chapters.map((s, i) => (
                    <button key={s.id} className={`tvw-chap${nowSeg?.id === s.id ? " on" : ""}`}
                      style={{ "--acc": s.accent ?? "#C8102E" } as React.CSSProperties}
                      onClick={() => jump(i)} title={s.title}>
                      <i /><span>{s.topic}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <aside className="tvw-next">
            <div className="tvw-next__h">
              <span>In this list · {films.length}</span>
              {playlist.dek ? <p>{playlist.dek}</p> : null}
            </div>
            <ul className="tvw-list">
              {films.map((e) => {
                const at = entries.indexOf(e);
                return (
                  <li key={e.slug}>
                    <button className={`tvw-item${at === entryIdx ? " on" : ""}`} onClick={() => setEntryIdx(at)}>
                      <span className="tvw-item__th" style={e.film?.backdrop ? { backgroundImage: `url(${IMG}/w500${e.film.backdrop})` } : undefined}>
                        {at === entryIdx ? <b>▶</b> : null}
                      </span>
                      <span className="tvw-item__b">
                        <span className="tvw-item__t">{e.film?.title}{e.film?.year ? ` (${e.film.year})` : ""}</span>
                        <span className="tvw-item__f">{e.title}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>

        {/* every film links to its own broadcast page — internal linking for SEO */}
        <section className="tvw-shelves">
          <h2 className="tvw-shelf__h">Every broadcast in this list</h2>
          <div className="tvw-progrid">
            {films.map((e) => (
              <a key={e.slug} className="tvw-prog" href={`/tv/${e.film?.slug ?? e.slug}`}>
                <span className="tvw-prog__th" style={e.film?.backdrop ? { backgroundImage: `url(${IMG}/w500${e.film.backdrop})` } : undefined} />
                <span className="tvw-prog__t">{e.film?.title}{e.film?.year ? ` (${e.film.year})` : ""}</span>
                <span className="tvw-prog__f">{e.title}</span>
              </a>
            ))}
          </div>
        </section>

        {/* the same searchable library as /tv — the browse surface travels with
            every list page instead of dead-ending here */}
        <TVDirectory embedded />
      </div>
    </div>
  );
}
