"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SiteNavClient from "@/components/home2/SiteNavClient";
import TVProgramPlayer, { type TVEntry, type TVSegment } from "@/components/TVProgramPlayer";
import TVDirectory from "@/components/TVDirectory";

const IMG = "https://image.tmdb.org/t/p";

type Shelf = {
  n_playlists?: number;
  playlists: { slug: string; title: string; dek?: string | null; kind: string; n: number }[];
  programs: { slug: string; title: string; dek?: string | null; seg_count: number; duration_ms: number; film: TVEntry["film"] }[];
};

// TVWatch — the main METATAKE TV watch interface (served at /tv; /watch and
// /tv/watch 308 here): the player up front, an "Up next" rail beside it, a chapter strip
// beneath, and watch-list + all-programs shelves below. Everything it plays was
// compiled by the LLM-free production engine (tv_compile_film / tv_segments).
export default function TVWatch() {
  return (
    <Suspense fallback={<div className="mt tvpg"><div className="tvpg-wrap"><div className="tvd--skel tvd">Tuning in…</div></div></div>}>
      <Watch />
    </Suspense>
  );
}

function Watch() {
  const sp = useSearchParams();
  const list = sp.get("list") ?? "palme-files";
  const v = sp.get("v");

  const [shelf, setShelf] = useState<Shelf | null>(null);
  const [entries, setEntries] = useState<TVEntry[]>([]);
  const [playlist, setPlaylist] = useState<{ slug: string; title: string; dek?: string | null; kind?: string } | null>(null);
  const [entryIdx, setEntryIdx] = useState(0);
  const [nowSeg, setNowSeg] = useState<TVSegment | null>(null);

  useEffect(() => {
    (async () => {
      try { setShelf(await (await fetch(`/api/tv/watch`)).json()); } catch { /* noop */ }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const url = v && !sp.get("list") ? `/api/tv/watch?v=${v}` : `/api/tv/watch?list=${list}`;
        const j = await fetch(url).then((r) => r.json());
        const es: TVEntry[] = j.entries ?? [];
        setEntries(es);
        setPlaylist(j.playlist ?? null);
        const at = v ? Math.max(0, es.findIndex((e) => e.slug === v)) : 0;
        setEntryIdx(at);
      } catch { /* noop */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, v]);

  const entry = entries[entryIdx] ?? null;
  const advance = useCallback(() => setEntryIdx((i) => (entries.length ? (i + 1) % entries.length : 0)), [entries.length]);
  const jumpChapter = (i: number) => window.dispatchEvent(new CustomEvent("tvw-jump", { detail: i }));

  const chapters = useMemo(() => entry?.segments ?? [], [entry]);

  return (
    <div className="mt tvpg tvw">
      <SiteNavClient />
      <div className="tvw-wrap">
        <header className="tvpg-head">
          <a className="tvpg-brand" href="/tv">
            <span className="tvpg-brand__n">METATAKE</span>
            <span className="tvpg-brand__tv">TV</span>
            <span className="tvpg-brand__live">● ON AIR</span>
          </a>
          <p className="tvpg-tag">Programs compiled per film by the production engine — bundled into watch lists. Leave it on.</p>
          <a className="tvpg-full" href="/tv/fullscreen">Full page ↗</a>
        </header>

        <div className="tvw-main">
          <div className="tvw-left">
            <div className="tvw-player">
              {entries.length ? (
                <TVProgramPlayer entries={entries} entryIdx={entryIdx} onEntryEnd={advance} onNow={setNowSeg} />
              ) : <div className="tvw-tuning">Tuning in…</div>}
            </div>

            {entry ? (
              <div className="tvw-meta">
                <h1 className="tvw-title">{entry.title}</h1>
                <p className="tvw-sub">
                  {entry.film?.title}{entry.film?.year ? ` (${entry.film.year})` : ""}
                  {entry.film?.director ? <> · dir. {entry.film.director}</> : null}
                  {entry.dek ? <> — {entry.dek}</> : null}
                </p>
                <div className="tvw-chapters">
                  {chapters.map((s, i) => (
                    <button key={s.id} className={`tvw-chap${nowSeg?.id === s.id ? " on" : ""}`}
                      style={{ "--acc": s.accent ?? "#C8102E" } as React.CSSProperties}
                      onClick={() => jumpChapter(i)} title={s.title}>
                      <i /><span>{s.topic}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <aside className="tvw-next">
            <div className="tvw-next__h">
              <span>Up next · {playlist?.title ?? "…"}</span>
              {playlist?.dek ? <p>{playlist.dek}</p> : null}
            </div>
            <ul className="tvw-list">
              {entries.map((e, i) => (
                <li key={e.slug}>
                  <button className={`tvw-item${i === entryIdx ? " on" : ""}`} onClick={() => setEntryIdx(i)}>
                    <span className="tvw-item__th" style={e.film?.backdrop ? { backgroundImage: `url(${IMG}/w500${e.film.backdrop})` } : undefined}>
                      {i === entryIdx ? <b>▶</b> : null}
                    </span>
                    <span className="tvw-item__b">
                      <span className="tvw-item__t">{e.title}</span>
                      <span className="tvw-item__f">{e.film?.title}{e.film?.year ? ` (${e.film.year})` : ""}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>

        {/* the full, filterable watch-list library (replaces the flat "Watch lists" shelf) */}
        <TVDirectory embedded />

        {/* every individual film broadcast */}
        {shelf ? (
          <section className="tvw-shelves">
            <h2 className="tvw-shelf__h">All programs</h2>
            <div className="tvw-progrid">
              {shelf.programs.map((p) => (
                <a key={p.slug} className="tvw-prog" href={`/tv/${p.slug}`}>
                  <span className="tvw-prog__th" style={p.film?.backdrop ? { backgroundImage: `url(${IMG}/w500${p.film.backdrop})` } : undefined} />
                  <span className="tvw-prog__t">{p.title}</span>
                  <span className="tvw-prog__f">{p.film?.title}{p.film?.year ? ` (${p.film.year})` : ""} · {p.seg_count} chapters</span>
                </a>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
