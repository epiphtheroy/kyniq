"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const isIntro = (e: TVEntry) => e.slug.startsWith("intro-");

function shuffled<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

// Playback order over entry indices. The intro briefing (if any) stays pinned
// first; a deep-linked start entry begins playing immediately.
function buildQueue(es: TVEntry[], doShuffle: boolean, startSlug: string | null): { queue: number[]; pos: number } {
  const intro = es.length && isIntro(es[0]) ? [0] : [];
  const rest = es.map((_, i) => i).slice(intro.length);
  const start = startSlug != null ? rest.find((i) => es[i].slug === startSlug) : undefined;
  const body = doShuffle
    ? [...(start != null ? [start] : []), ...shuffled(rest.filter((i) => i !== start))]
    : rest;
  const queue = [...intro, ...body];
  return { queue, pos: start != null ? Math.max(0, queue.indexOf(start)) : 0 };
}

// TVWatch — the main METATAKE TV watch interface (served at /tv; /watch and
// /tv/watch 308 here): the player up front, an editable "Up next" queue beside
// it (shuffle by default, reorder, remove), a chapter strip beneath, and the
// full watch-list library + all programs below. Picking a list from the library
// swaps the player in place — the browse surface never disappears. Everything
// it plays was compiled by the LLM-free production engine.
export default function TVWatch() {
  return (
    <Suspense fallback={<div className="mt tvpg"><div className="tvpg-wrap"><div className="tvd--skel tvd">Tuning in…</div></div></div>}>
      <Watch />
    </Suspense>
  );
}

function Watch() {
  const sp = useSearchParams();
  const [sel, setSel] = useState<{ list: string | null; v: string | null }>({ list: sp.get("list"), v: sp.get("v") });
  const listSlug = sel.list ?? (sel.v ? null : "palme-files");

  const [shelf, setShelf] = useState<Shelf | null>(null);
  const [entries, setEntries] = useState<TVEntry[]>([]);
  const [playlist, setPlaylist] = useState<{ slug: string; title: string; dek?: string | null; kind?: string } | null>(null);
  const [queue, setQueue] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const [shuffle, setShuffle] = useState(true); // random is the default
  const [theater, setTheater] = useState(false);
  const [nowSeg, setNowSeg] = useState<TVSegment | null>(null);
  const shuffleRef = useRef(shuffle);
  shuffleRef.current = shuffle;

  useEffect(() => {
    (async () => {
      try { setShelf(await (await fetch(`/api/tv/watch`)).json()); } catch { /* noop */ }
    })();
  }, []);

  // back/forward restores whatever selection the URL describes
  useEffect(() => {
    const onPop = () => {
      const p = new URLSearchParams(window.location.search);
      setSel({ list: p.get("list"), v: p.get("v") });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // load the selected list (or single program) and build a fresh queue
  useEffect(() => {
    (async () => {
      try {
        const url = sel.v && !sel.list
          ? `/api/tv/watch?v=${encodeURIComponent(sel.v)}`
          : `/api/tv/watch?list=${encodeURIComponent(listSlug ?? "palme-files")}`;
        const j = await fetch(url).then((r) => r.json());
        const es: TVEntry[] = j.entries ?? [];
        setEntries(es);
        setPlaylist(j.playlist ?? null);
        const built = buildQueue(es, shuffleRef.current, sel.v);
        setQueue(built.queue);
        setPos(built.pos);
      } catch { /* noop */ }
    })();
  }, [sel, listSlug]);

  // stable per-entry objects → reordering the queue never restarts the player
  const ordered = useMemo(() => queue.map((i) => entries[i]).filter(Boolean), [queue, entries]);
  const entry = ordered[pos] ?? null;
  const advance = useCallback(() => setPos((p) => (queue.length ? (p + 1) % queue.length : 0)), [queue.length]);
  const jumpChapter = (i: number) => window.dispatchEvent(new CustomEvent("tvw-jump", { detail: i }));
  const chapters = useMemo(() => entry?.segments ?? [], [entry]);

  const toggleShuffle = () => {
    const next = !shuffle;
    setShuffle(next);
    if (!entries.length || !queue.length) return;
    const cur = queue[pos];
    if (next) {
      // keep what's playing, reshuffle everything after it
      const rest = queue.filter((_, i) => i !== pos);
      setQueue([cur, ...shuffled(rest)]);
      setPos(0);
    } else {
      // restore the compiled order, staying on the current program
      const orig = entries.map((_, i) => i);
      setQueue(orig);
      setPos(Math.max(0, orig.indexOf(cur)));
    }
  };

  const moveBy = (qi: number, d: -1 | 1) => {
    const ti = qi + d;
    if (ti < 0 || ti >= queue.length) return;
    setQueue((q) => { const r = [...q]; [r[qi], r[ti]] = [r[ti], r[qi]]; return r; });
    setPos((p) => (p === qi ? ti : p === ti ? qi : p));
  };

  const removeAt = (qi: number) => {
    if (queue.length <= 1) return;
    const newLen = queue.length - 1;
    setQueue((q) => q.filter((_, i) => i !== qi));
    setPos((p) => Math.min(qi < p ? p - 1 : p, newLen - 1));
  };

  // picking a list from the library below swaps the player without leaving /tv
  const selectList = useCallback((slug: string) => {
    setSel({ list: slug, v: null });
    window.history.pushState(null, "", `/tv?list=${encodeURIComponent(slug)}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className={`mt tvpg tvw${theater ? " tvw--theater" : ""}`}>
      <SiteNavClient />
      <div className="tvw-wrap">
        <header className="tvpg-head">
          <a className="tvpg-brand" href="/tv">
            <span className="tvpg-brand__n">METATAKE</span>
            <span className="tvpg-brand__tv">TV</span>
            <span className="tvpg-brand__live">● ON AIR</span>
          </a>
          <p className="tvpg-tag">Programs compiled per film by the production engine — bundled into watch lists. Leave it on.</p>
          <a className="tvpg-full tvpg-onair" href="/tv/fullscreen" title="The endless broadcast — nothing to pick, just leave it on"><b>●</b> On Air ↗</a>
        </header>

        <div className="tvw-main">
          <div className="tvw-left">
            <div className="tvw-player">
              {ordered.length ? (
                <TVProgramPlayer entries={ordered} entryIdx={pos} onEntryEnd={advance} onNow={setNowSeg} />
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
              <div className="tvw-qbar">
                <button className={`tvw-qbtn${shuffle ? " on" : ""}`} onClick={toggleShuffle} title="Play in random order">⇄ Shuffle{shuffle ? " · on" : ""}</button>
                <button className={`tvw-qbtn${theater ? " on" : ""}`} onClick={() => setTheater((t) => !t)} title="Big player">⛶ Theater</button>
                <span className="tvw-qn">{queue.length} program{queue.length === 1 ? "" : "s"}</span>
                {listSlug ? <a className="tvw-qlink" href={`/tv/list/${listSlug}`}>List page ↗</a> : null}
              </div>
            </div>
            <ul className="tvw-list">
              {ordered.map((e, qi) => (
                <li key={`${e.slug}-${qi}`} className="tvw-qrow">
                  <button className={`tvw-item${qi === pos ? " on" : ""}`} onClick={() => setPos(qi)}>
                    <span className="tvw-item__th" style={e.film?.backdrop ? { backgroundImage: `url(${IMG}/w500${e.film.backdrop})` } : undefined}>
                      {qi === pos ? <b>▶</b> : null}
                    </span>
                    <span className="tvw-item__b">
                      <span className="tvw-item__t">{e.title}</span>
                      <span className="tvw-item__f">{e.film?.title}{e.film?.year ? ` (${e.film.year})` : ""}</span>
                    </span>
                  </button>
                  <span className="tvw-qops">
                    <button aria-label="Play earlier" title="Move up" onClick={() => moveBy(qi, -1)} disabled={qi === 0}>↑</button>
                    <button aria-label="Play later" title="Move down" onClick={() => moveBy(qi, 1)} disabled={qi === queue.length - 1}>↓</button>
                    <button aria-label="Remove from the queue" title="Remove" onClick={() => removeAt(qi)} disabled={queue.length <= 1}>✕</button>
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        </div>

        {/* the full, filterable watch-list library — always present; picking a
            list swaps the player above instead of leaving the page */}
        <TVDirectory embedded onSelect={selectList} />

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
