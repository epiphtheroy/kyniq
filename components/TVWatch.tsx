"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import SiteNavClient from "@/components/home2/SiteNavClient";
import TVProgramPlayer, { type TVEntry, type TVSegment } from "@/components/TVProgramPlayer";
import TVDirectory from "@/components/TVDirectory";
import TVListPicker from "@/components/TVListPicker";
import TVRecommended from "@/components/TVRecommended";
import SaveButton from "@/components/SaveButton";
import VideoMiniDock from "@/components/VideoMiniDock";
import { deleteList, fetchMyLists, renameList, type TVUserList } from "@/lib/tvUserLists";

const IMG = "https://image.tmdb.org/t/p";

type Shelf = {
  n_playlists?: number;
  playlists: { slug: string; title: string; dek?: string | null; kind: string; n: number }[];
  programs: { slug: string; title: string; dek?: string | null; seg_count: number; duration_ms: number; film: TVEntry["film"] }[];
};

type Playlist = { slug: string | null; title: string; dek?: string | null; kind?: string } | null;
export type TVSeed = { playlist: Playlist; entry: TVEntry } | null;

const isPseudo = (e: TVEntry) => e.slug.startsWith("intro-") || e.slug.startsWith("seg-");

function shuffled<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

// Playback order over entry indices. The intro briefing (if any) stays pinned
// first; a deep-linked/seeded start entry begins playing immediately.
function buildQueue(es: TVEntry[], doShuffle: boolean, startSlug: string | null): { queue: number[]; pos: number } {
  const intro = es.length && es[0].slug.startsWith("intro-") ? [0] : [];
  const rest = es.map((_, i) => i).slice(intro.length);
  const start = startSlug != null ? rest.find((i) => es[i].slug === startSlug) : undefined;
  const body = doShuffle
    ? [...(start != null ? [start] : []), ...shuffled(rest.filter((i) => i !== start))]
    : rest;
  const queue = [...intro, ...body];
  return { queue, pos: start != null ? Math.max(0, queue.indexOf(start)) : 0 };
}

// TVWatch — the main METATAKE TV watch interface (served at /tv; /watch and
// /tv/watch 308 here). YouTube-shaped: player + editable "Up next" queue
// (shuffle by default, reorder, remove, save-to-list), an action row under the
// title (Save / Save list), the visitor's own lists as a shelf, and the full
// searchable library below — picking anything swaps the player in place.
// `seed` (SSR-provided first entry) starts playback instantly, before the full
// list arrives.
export default function TVWatch({ seed = null }: { seed?: TVSeed }) {
  return (
    <Suspense fallback={<div className="mt tvpg"><div className="tvpg-wrap"><div className="tvd--skel tvd">Tuning in…</div></div></div>}>
      <Watch seed={seed} />
    </Suspense>
  );
}

type Sel = { list: string | null; v: string | null; mylist: string | null };

function Watch({ seed }: { seed: TVSeed }) {
  const sp = useSearchParams();
  const [sel, setSel] = useState<Sel>({ list: sp.get("list"), v: sp.get("v"), mylist: sp.get("mylist") });
  const listSlug = sel.list ?? (sel.v || sel.mylist ? null : "palme-files");
  const seedApplies = !!seed?.entry && !sel.list && !sel.v && !sel.mylist;

  const [shelf, setShelf] = useState<Shelf | null>(null);
  const [entries, setEntries] = useState<TVEntry[]>(seedApplies ? [seed!.entry] : []);
  const [playlist, setPlaylist] = useState<Playlist>(seedApplies ? seed!.playlist : null);
  const [queue, setQueue] = useState<number[]>(seedApplies ? [0] : []);
  const [pos, setPos] = useState(0);
  const [shuffle, setShuffle] = useState(true); // random is the default
  const [theater, setTheater] = useState(false);
  const [nowSeg, setNowSeg] = useState<TVSegment | null>(null);
  const [picker, setPicker] = useState<string[] | null>(null); // program slugs being saved
  const [myLists, setMyLists] = useState<TVUserList[] | null | undefined>(undefined);
  const shuffleRef = useRef(shuffle);
  shuffleRef.current = shuffle;
  const seedRef = useRef<TVEntry | null>(seedApplies ? seed!.entry : null); // consumed on first full load

  const refreshMyLists = useCallback(() => { fetchMyLists().then(setMyLists).catch(() => {}); }, []);
  useEffect(() => { refreshMyLists(); }, [refreshMyLists]);

  useEffect(() => {
    (async () => {
      try { setShelf(await (await fetch(`/api/tv/watch`)).json()); } catch { /* noop */ }
    })();
  }, []);

  // back/forward restores whatever selection the URL describes
  useEffect(() => {
    const onPop = () => {
      const p = new URLSearchParams(window.location.search);
      setSel({ list: p.get("list"), v: p.get("v"), mylist: p.get("mylist") });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // load the selection (curated list / single program / personal list) and
  // build a fresh queue; the SSR seed keeps playing seamlessly through the swap
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let es: TVEntry[] = [];
        let pl: Playlist = null;
        if (sel.mylist) {
          const lists = await fetchMyLists();
          const L = lists?.find((x) => x.id === sel.mylist);
          if (!L || !L.slugs.length) {
            if (alive) setSel({ list: null, v: null, mylist: null });
            return;
          }
          const j = await fetch(`/api/tv/watch?films=${encodeURIComponent(L.slugs.slice(0, 60).join(","))}`).then((r) => r.json());
          es = j.entries ?? [];
          pl = { slug: null, title: L.title, dek: `Your list · ${es.length} program${es.length === 1 ? "" : "s"}`, kind: "mine" };
        } else if (sel.v && !sel.list) {
          const j = await fetch(`/api/tv/watch?v=${encodeURIComponent(sel.v)}`).then((r) => r.json());
          es = j.entries ?? [];
          pl = j.playlist ?? null;
        } else {
          const j = await fetch(`/api/tv/watch?list=${encodeURIComponent(listSlug ?? "palme-files")}`).then((r) => r.json());
          es = j.entries ?? [];
          pl = j.playlist ?? null;
        }
        if (!alive) return;
        const sd = seedRef.current;
        let startSlug = sel.v;
        if (sd) {
          // reuse the seeded object so entry identity survives → no restart
          es = es.map((e) => (e.slug === sd.slug ? sd : e));
          if (es.some((e) => e === sd)) startSlug = sd.slug;
          seedRef.current = null;
        }
        setEntries(es);
        setPlaylist(pl);
        const built = buildQueue(es, shuffleRef.current, startSlug);
        setQueue(built.queue);
        setPos(built.pos);
      } catch { /* noop */ }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  // stable per-entry objects → reordering the queue never restarts the player
  const ordered = useMemo(() => queue.map((i) => entries[i]).filter(Boolean), [queue, entries]);
  const entry = ordered[pos] ?? null;
  const advance = useCallback(() => setPos((p) => (queue.length ? (p + 1) % queue.length : 0)), [queue.length]);
  const jumpChapter = (i: number) => window.dispatchEvent(new CustomEvent("tvw-jump", { detail: i }));
  const chapters = useMemo(() => entry?.segments ?? [], [entry]);
  const realQueueSlugs = useMemo(() => ordered.filter((e) => !isPseudo(e)).map((e) => e.slug), [ordered]);

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

  // picking anything below swaps the player without leaving /tv
  const goto = useCallback((next: Sel, url: string) => {
    setSel(next);
    window.history.pushState(null, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const selectList = useCallback((slug: string) => goto({ list: slug, v: null, mylist: null }, `/tv?list=${encodeURIComponent(slug)}`), [goto]);
  const selectVideo = useCallback((slug: string) => goto({ list: null, v: slug, mylist: null }, `/tv?v=${encodeURIComponent(slug)}`), [goto]);
  const selectMyList = useCallback((id: string) => goto({ list: null, v: null, mylist: id }, `/tv?mylist=${encodeURIComponent(id)}`), [goto]);

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
            <VideoMiniDock>
              <div className="tvw-player">
                {ordered.length ? (
                  <TVProgramPlayer entries={ordered} entryIdx={pos} onEntryEnd={advance} onNow={setNowSeg} />
                ) : <div className="tvw-tuning">Tuning in…</div>}
              </div>
            </VideoMiniDock>

            {entry ? (
              <div className="tvw-meta">
                <h1 className="tvw-title">{entry.title}</h1>
                <p className="tvw-sub">
                  {entry.film?.title}{entry.film?.year ? ` (${entry.film.year})` : ""}
                  {entry.film?.director ? <> · dir. {entry.film.director}</> : null}
                  {entry.dek ? <> — {entry.dek}</> : null}
                </p>
                <div className="tvw-actions">
                  {!isPseudo(entry) ? (
                    <button className="tvw-act" onClick={() => setPicker([entry.slug])} title="Save this program to one of your lists">＋ Save</button>
                  ) : null}
                  {listSlug ? (
                    <SaveButton entityType="tv_list" entityRef={listSlug} label="Save list" labelOn="List saved" />
                  ) : null}
                  {!isPseudo(entry) ? (
                    <a className="tvw-act tvw-act--lnk" href={`/tv/${entry.slug}`}>Broadcast page ↗</a>
                  ) : null}
                </div>
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
                {realQueueSlugs.length > 1 ? (
                  <button className="tvw-qbtn" onClick={() => setPicker(realQueueSlugs)} title="Save the whole queue as one of your lists">＋ Save queue</button>
                ) : null}
                <span className="tvw-qn">{queue.length} program{queue.length === 1 ? "" : "s"}</span>
                {sel.list || (!sel.v && !sel.mylist) ? <a className="tvw-qlink" href={`/tv/list/${listSlug}`}>List page ↗</a> : null}
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
                    {!isPseudo(e) ? (
                      <button aria-label="Save to list" title="Save to list" onClick={() => setPicker([e.slug])}>＋</button>
                    ) : null}
                    <button aria-label="Remove from the queue" title="Remove" onClick={() => removeAt(qi)} disabled={queue.length <= 1}>✕</button>
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        </div>

        {/* watch-next with reasons — follows whatever is playing */}
        <TVRecommended program={entry && !isPseudo(entry) ? entry.slug : null} onPick={selectVideo} />

        {/* the visitor's own lists, YouTube-library style */}
        {myLists && myLists.length ? (
          <section className="tvw-shelves tvw-mine">
            <h2 className="tvw-shelf__h">Your lists</h2>
            <div className="tvw-minegrid">
              {myLists.map((l) => (
                <div key={l.id} className={`tvw-minecard${sel.mylist === l.id ? " on" : ""}`}>
                  <button className="tvw-minecard__play" onClick={() => selectMyList(l.id)} title="Play this list">
                    <span className="tvw-minecard__t">{l.title}</span>
                    <span className="tvw-minecard__m">{l.slugs.length} program{l.slugs.length === 1 ? "" : "s"} · ▶ Play</span>
                  </button>
                  <span className="tvw-minecard__ops">
                    <button title="Rename" onClick={async () => {
                      const t = window.prompt("Rename list", l.title);
                      if (t && t.trim()) { await renameList(l.id, t.trim()); refreshMyLists(); }
                    }}>✎</button>
                    <button title="Delete" onClick={async () => {
                      if (window.confirm(`Delete “${l.title}”?`)) {
                        await deleteList(l.id);
                        refreshMyLists();
                        if (sel.mylist === l.id) goto({ list: null, v: null, mylist: null }, "/tv");
                      }
                    }}>✕</button>
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* the full, filterable library — always present; picking a list or a
            broadcast swaps the player above instead of leaving the page */}
        <TVDirectory embedded onSelect={selectList} onSelectVideo={selectVideo} />

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

      {picker ? <TVListPicker slugs={picker} onClose={() => setPicker(null)} onChanged={refreshMyLists} /> : null}
    </div>
  );
}
