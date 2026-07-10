"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EntityMap from "@/components/EntityMap";
import FilmMap from "@/components/FilmMap";

const IMG = "https://image.tmdb.org/t/p";
const PATTERNS = ["air", "band", "ink", "wire"] as const;
const BUDGET_MS = 170_000; // in-film random-play budget: open + sampled chapters + close

// ── TVProgramPlayer — plays COMPILED programs (tv_segments beats straight from
// the DB; engine: tv_compile_film, migration 0056) over the film's trailer loop.
// A film's modules all exist in the DB; playback RANDOM-SAMPLES chapters within
// a duration budget (open + shuffled middle + close), so long films stay short
// on air and repeat visits see different cuts. Auto-advances across the
// playlist's entries. Reuses the METATAKE TV (.sv2-*) broadcast furniture.

export type TVBeat = {
  zone: "top" | "sub" | "quote" | "stack" | "chips" | "map" | "atlas";
  kicker?: string; text?: string; sub?: string; won?: boolean;
  chips?: string[]; mapApi?: string; mapFull?: string; hold: number;
};
export type TVSegment = {
  id: string; topic: string; seq: number; title: string;
  kicker?: string | null; accent?: string | null; beats: TVBeat[]; duration_ms: number;
};
export type TVFilm = {
  title?: string; year?: number | null; slug?: string; director?: string | null;
  director_slug?: string | null; poster?: string | null; backdrop?: string | null;
  clip?: string | null; clips?: string[];
};
export type TVEntry = { slug: string; title: string; dek?: string | null; film: TVFilm; segments: TVSegment[] };

// open + shuffled middle (≤ budget) + close — every module stays in the DB
function samplePlan(segs: TVSegment[], budget = BUDGET_MS): number[] {
  if (!segs.length) return [];
  const open = segs[0]?.topic === "open" ? 0 : -1;
  const close = segs[segs.length - 1]?.topic === "close" ? segs.length - 1 : -1;
  const mid = segs.map((_, i) => i).filter((i) => i !== open && i !== close);
  for (let i = mid.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [mid[i], mid[j]] = [mid[j], mid[i]]; }
  let spent = (open >= 0 ? segs[open].duration_ms : 0) + (close >= 0 ? segs[close].duration_ms : 0);
  const picked: number[] = [];
  for (const i of mid) {
    if (picked.length && spent + segs[i].duration_ms > budget) continue;
    picked.push(i); spent += segs[i].duration_ms;
  }
  picked.sort((a, b) => a - b); // keep editorial order within the cut
  return [...(open >= 0 ? [open] : []), ...picked, ...(close >= 0 ? [close] : [])];
}

export default function TVProgramPlayer({
  entries, entryIdx, onEntryEnd, onNow,
}: {
  entries: TVEntry[];
  entryIdx: number;
  onEntryEnd: () => void;                       // advance the playlist
  onNow?: (s: TVSegment | null) => void;        // surface the current chapter
}) {
  const entry = entries[entryIdx] ?? null;
  const [plan, setPlan] = useState<number[]>([]);
  const [pos, setPos] = useState(0);            // position within the plan
  const [beatIdx, setBeatIdx] = useState(0);
  const [nonce, setNonce] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const endRef = useRef(onEntryEnd); endRef.current = onEntryEnd;

  // new entry → fresh random cut
  useEffect(() => {
    setPlan(entry ? samplePlan(entry.segments) : []);
    setPos(0); setBeatIdx(0);
  }, [entry]);

  const seg = entry && plan.length ? entry.segments[plan[pos]] ?? null : null;
  const beats = useMemo(() => seg?.beats ?? [], [seg]);
  const beat = beats[beatIdx] ?? null;
  const acc = seg?.accent ?? "#C8102E";
  useEffect(() => { onNow?.(seg ?? null); /* eslint-disable-next-line */ }, [seg?.id]);

  const nextSeg = useCallback(() => {
    setBeatIdx(0);
    setPos((p) => {
      if (p < plan.length - 1) return p + 1;
      endRef.current();
      return p;
    });
  }, [plan.length]);
  const prevSeg = () => { setBeatIdx(0); setPos((p) => Math.max(0, p - 1)); };

  // the beat clock
  useEffect(() => {
    if (!playing || !beat) return;
    const t = setTimeout(() => {
      if (beatIdx < beats.length - 1) setBeatIdx((i) => i + 1);
      else nextSeg();
    }, beat.hold);
    return () => clearTimeout(t);
  }, [playing, beat, beatIdx, beats.length, nonce, nextSeg]);

  // pause/resume the trailer with the broadcast
  const postYT = useCallback((func: string) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*");
  }, []);
  useEffect(() => { postYT(playing ? "playVideo" : "pauseVideo"); }, [playing, postYT, entryIdx]);
  const togglePlay = () => setPlaying((p) => { if (!p) setNonce((n) => n + 1); return !p; });

  // chapter jump from the host page: play it now, keep the rest of the plan
  const jumpTo = useCallback((segIndex: number) => {
    setPlan((pl) => {
      const at = pl.indexOf(segIndex);
      if (at >= 0) { setPos(at); setBeatIdx(0); return pl; }
      const cur = pl.slice(0, posRef.current + 1);
      const rest = pl.slice(posRef.current + 1);
      const np = [...cur, segIndex, ...rest];
      setPos(cur.length); setBeatIdx(0);
      return np;
    });
  }, []);
  const posRef = useRef(pos); posRef.current = pos;
  // expose jump via a stable ref-y property on window-free API: host passes through onNow; simplest is an imperative handle via custom event
  useEffect(() => {
    const h = (e: Event) => { const d = (e as CustomEvent).detail; if (typeof d === "number") jumpTo(d); };
    window.addEventListener("tvw-jump", h);
    return () => window.removeEventListener("tvw-jump", h);
  }, [jumpTo]);

  const film = entry?.film;
  const clipSrc = film?.clip
    ? `https://www.youtube-nocookie.com/embed/${film.clip}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&loop=1&playlist=${film.clip}&start=5&playsinline=1&modestbranding=1&rel=0&enablejsapi=1`
    : null;

  const statement = beats[0]?.zone === "top" ? beats[0] : null;
  const stacked = beats.slice(0, beatIdx + 1).filter((x) => x.zone === "stack");
  const bk = `${entryIdx}-${pos}-${beatIdx}`;

  return (
    <div className={`tv-embed tv-embed--ui sv2 sv2-m-${seg?.topic ?? "boot"}`} style={{ "--acc": acc, "--ent": "#fff" } as React.CSSProperties}>
      <div className="svc-bed">
        {clipSrc ? (
          <iframe ref={iframeRef} key={`${entryIdx}-${film!.clip}`} className="svc-media" src={clipSrc}
            title={film?.title ?? "clip"} allow="autoplay; encrypted-media; picture-in-picture" />
        ) : <div className="svc-media svc-media--empty" aria-hidden="true" />}
      </div>
      <div className="svc-scrim" aria-hidden="true" />

      {film ? (
        <a className="sv2-mast" href={film.slug ? `/film/${film.slug}` : undefined}>
          {film.poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="sv2-mast__p" src={`${IMG}/w154${film.poster}`} alt="" />
          ) : null}
          <span className="sv2-mast__b">
            <span className="sv2-mast__t">{film.title}</span>
            <span className="sv2-mast__m">
              {film.year ? <b>{film.year}</b> : null}
              {film.director ? <i>dir. {film.director}</i> : null}
            </span>
          </span>
        </a>
      ) : null}

      <div className="sv2-tv" aria-hidden="true">
        <span className="sv2-tv__name">METATAKE</span>
        <span className="sv2-tv__box">TV</span>
        <span className="sv2-tv__live" data-live={playing ? "1" : "0"}>{playing ? "● ON AIR" : "❚❚ PAUSED"}</span>
      </div>

      {/* chapter rail — one cell per PLANNED segment */}
      <div className="sv2-segs" aria-hidden="true">
        {plan.map((si, i) => (
          <span key={i} className={`sv2-seg${i < pos ? " done" : ""}`}>
            {i === pos && seg ? (
              <i key={`${bk}-${nonce}`} style={{ animationDuration: `${seg.duration_ms}ms`, animationPlayState: playing ? "running" : "paused" }} />
            ) : null}
          </span>
        ))}
      </div>

      {statement ? (
        <div key={`st-${entryIdx}-${pos}`} className={`sv2-top${beatIdx > 0 ? " is-min" : ""}`}>
          {statement.kicker ? <span className="sv2-kick">{statement.kicker}</span> : null}
          <h2 className="sv2-state">{statement.text}</h2>
          {statement.sub && beatIdx === 0 ? <p className="sv2-dek">{statement.sub}</p> : null}
        </div>
      ) : null}

      {beat && beat.zone === "sub" ? (
        <div key={bk} className="sv2-sub" style={{ "--exit": `${Math.max(700, beat.hold - 520)}ms` } as React.CSSProperties}>
          <div className="sv2-band">
            {beat.kicker ? <span className="sv2-kick sv2-kick--sub">{beat.kicker}</span> : null}
            <p className="sv2-subtxt">{beat.text}</p>
            {beat.sub ? <p className="sv2-subsub">{beat.sub}</p> : null}
          </div>
        </div>
      ) : beat && beat.zone === "quote" ? (
        <figure key={bk} className="sv2-quote" style={{ "--exit": `${Math.max(700, beat.hold - 520)}ms` } as React.CSSProperties}>
          <span className="sv2-quote__mark" aria-hidden="true">“</span>
          <blockquote>{beat.text}</blockquote>
          {beat.sub ? <figcaption>— {beat.sub}</figcaption> : null}
        </figure>
      ) : beat && beat.zone === "chips" ? (
        <div key={bk} className="sv2-chips" style={{ "--exit": `${Math.max(700, beat.hold - 520)}ms` } as React.CSSProperties}>
          {(beat.chips ?? []).map((c, i) => (
            <span key={i} className="sv2-chip" style={{ animationDelay: `${i * 90}ms` }}>{c}</span>
          ))}
        </div>
      ) : beat && beat.zone === "map" && beat.mapApi ? (
        <div key={`map-${entryIdx}-${pos}`} className="sv2-map">
          <div className="sv2-map__h">
            <span className="sv2-kick sv2-kick--sub">{seg?.kicker ?? "The map"}</span>
            <a href={beat.mapFull ?? "/map"}>Explore ↗</a>
          </div>
          <EntityMap api={beat.mapApi} full={beat.mapFull ?? "/map"} height={230} />
        </div>
      ) : beat && beat.zone === "atlas" && film?.slug ? (
        <div key={`atlas-${entryIdx}-${pos}`} className="sv2-atlas">
          <div className="sv2-map__h">
            <span className="sv2-kick sv2-kick--sub">On the atlas</span>
            <a href={`/film/${film.slug}#df-atlas`}>Open ↗</a>
          </div>
          <FilmMap endpoint={`/api/geo?film=${film.slug}`} filmSlug={film.slug} height={210} panelSide="left" fitMaxZoom={14} />
        </div>
      ) : null}

      {stacked.length && beat?.zone === "stack" ? (
        <ul className="sv2-stack">
          {stacked.map((s, i) => (
            <li key={i} className={`sv2-stkrow${s.won ? " is-won" : ""}${i === stacked.length - 1 ? " is-new" : ""}`}>
              <b>{s.won ? "🏆" : "◆"}</b>
              <span className="sv2-stkrow__b">
                <span className="sv2-stkrow__t">{s.text}</span>
                {s.sub ? <span className="sv2-stkrow__s">{s.sub}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="svc-ctrls">
        <button className="svc-btn" onClick={prevSeg} aria-label="Previous chapter" disabled={pos <= 0}>‹</button>
        <button className="svc-btn svc-btn--play" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>{playing ? "❚❚" : "►"}</button>
        <button className="svc-btn" onClick={nextSeg} aria-label="Next chapter">›</button>
        {clipSrc ? <button className="svc-btn" onClick={() => setMuted((v) => !v)} aria-label={muted ? "Unmute" : "Mute"}>{muted ? "🔇" : "🔊"}</button> : null}
        {film?.slug ? <a className="svc-btn svc-btn--open" href={`/film/${film.slug}`}>Full info ↗</a> : null}
      </div>
    </div>
  );
}
