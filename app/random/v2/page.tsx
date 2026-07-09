"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SurpriseCard } from "@/components/home2/SurpriseStage";

const IMG = "https://image.tmdb.org/t/p";
const HOLD_MS = 12000; // ms each card holds before the channel advances
const NCOMP = 6;       // randomized editorial compositions

// Surprise-me v2 — "The Metatake Channel". A self-running broadcast over the film
// itself: the clip fills the frame, and the lens is composited on top as editorial
// broadcast furniture — a corner masthead (the film title, with weight, in the top
// corners), varied panels, hairline rules and a bold diagonal, an oversized glyph
// peeking from an edge, floating supers, an arrow. Each draw picks one of six
// randomized compositions, so it reads like a magazine that redesigns itself every
// few seconds. On-site only (embeds are legal); not a rebroadcast.
export default function ChannelPage() {
  const [hist, setHist] = useState<SurpriseCard[]>([]);
  const [comps, setComps] = useState<number[]>([]);
  const [idx, setIdx] = useState(-1);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [uiVisible, setUiVisible] = useState(true);
  const busy = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const card = idx >= 0 ? hist[idx] : null;
  const comp = idx >= 0 ? (comps[idx] ?? 0) : 0;

  const draw = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const r = await fetch(`/api/surprise/home?_=${Date.now()}`, { cache: "no-store" });
      const c = (await r.json()) as SurpriseCard;
      setHist((h) => [...h, c]);
      setComps((cs) => [...cs, Math.floor(Math.random() * NCOMP)]);
      setIdx((i) => i + 1);
    } catch { /* noop */ } finally { busy.current = false; }
  }, []);

  const prev = () => setIdx((i) => Math.max(0, i - 1));
  const next = () => { if (idx < hist.length - 1) setIdx((i) => i + 1); else draw(); };

  useEffect(() => { draw(); }, [draw]);

  // full-screen kiosk: lock the page so the site chrome can't scroll in
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // the channel clock — advances only while playing
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => { if (!busy.current) draw(); }, HOLD_MS);
    return () => clearInterval(t);
  }, [playing, draw]);

  const postYT = useCallback((func: string) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*");
  }, []);
  useEffect(() => { postYT(playing ? "playVideo" : "pauseVideo"); }, [playing, postYT, idx]);

  const wake = useCallback(() => {
    setUiVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setUiVisible(false), 3200);
  }, []);
  useEffect(() => { wake(); return () => { if (hideTimer.current) clearTimeout(hideTimer.current); }; }, [wake]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); setPlaying((p) => !p); wake(); }
      else if (e.code === "ArrowRight") { next(); wake(); }
      else if (e.code === "ArrowLeft") { prev(); wake(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, hist.length, wake]);

  const clipSrc = card?.clip
    ? `https://www.youtube-nocookie.com/embed/${card.clip}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&loop=1&playlist=${card.clip}&start=7&playsinline=1&modestbranding=1&rel=0&enablejsapi=1`
    : null;

  const filmLine = card ? [card.film_title, card.film_year ? `(${card.film_year})` : null].filter(Boolean).join(" ") : "";

  return (
    <div className={`svc svc-comp-${comp}${uiVisible ? " svc--ui" : ""}`} onMouseMove={wake} onClick={wake}>
      {/* the bed: the film clip, else a Ken-Burns backdrop */}
      <div className="svc-bed">
        {clipSrc ? (
          <iframe ref={iframeRef} key={card!.clip} className="svc-media" src={clipSrc}
            title={card?.film_title ?? "clip"} allow="autoplay; encrypted-media; picture-in-picture" />
        ) : card?.backdrop ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="svc-media svc-media--kb" key={card.film_slug ?? idx} src={`${IMG}/w1280${card.backdrop}`} alt="" />
        ) : <div className="svc-media svc-media--empty" aria-hidden="true" />}
      </div>
      <div className="svc-scrim" aria-hidden="true" />

      {/* editorial layer — corner masthead, rules, diagonal, peek, arrow, supers */}
      {card ? (
        <div className="svc-ed" aria-hidden="true">
          <div className="svc-ed-title">{card.film_title}</div>
          <div className="svc-ed-corner">
            {card.film_year ? <span className="svc-ed-yr">{card.film_year}</span> : null}
            {card.director ? <span className="svc-ed-dir">dir. {card.director}</span> : null}
          </div>
          {card.label ? <div className="svc-ed-label">{card.label}</div> : null}
          <span className="svc-ed-peek">{card.mode === "reception" || card.mode === "misreading" || card.mode === "theorist" ? "“" : "›"}</span>
          <span className="svc-ed-rule svc-ed-rule--a" />
          <span className="svc-ed-rule svc-ed-rule--b" />
          <svg className="svc-ed-arrow" viewBox="0 0 140 30" preserveAspectRatio="none">
            <path d="M2,15 L120,15 M120,15 L106,6 M120,15 L106,24" fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
          <span className="svc-ed-super svc-ed-super--1">{card.framework ?? card.director ?? card.label}</span>
          <span className="svc-ed-super svc-ed-super--2">No. {(idx % 99) + 1}</span>
          <span className="svc-ed-ticks" />
        </div>
      ) : null}

      {/* top progress bar */}
      <div className="svc-prog"><i key={idx} style={{ animationDuration: `${HOLD_MS}ms`, animationPlayState: playing ? "running" : "paused" }} /></div>

      {/* channel bug */}
      <div className="svc-bug">
        <span className="svc-bug__dot" data-live={playing ? "1" : "0"} />
        <span className="svc-bug__name">METATAKE</span>
        <span className="svc-bug__sub">{playing ? "ON AIR" : "PAUSED"}</span>
      </div>

      {/* the lens — a panel that moves and restyles per composition */}
      <div className="svc-stage">
        {card ? <Lens key={idx} card={card} filmLine={filmLine} /> : <div className="svc-boot">Tuning in…</div>}
      </div>

      {/* controls — auto-hide */}
      <div className="svc-ctrls">
        <button className="svc-btn" onClick={prev} aria-label="Previous" disabled={idx <= 0}>‹</button>
        <button className="svc-btn svc-btn--play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>{playing ? "❚❚" : "►"}</button>
        <button className="svc-btn" onClick={next} aria-label="Next">›</button>
        {clipSrc ? <button className="svc-btn" onClick={() => setMuted((v) => !v)} aria-label={muted ? "Unmute" : "Mute"}>{muted ? "🔇" : "🔊"}</button> : null}
        {card?.href ? <a className="svc-btn svc-btn--open" href={card.href}>Full info ↗</a> : null}
        <span className="svc-hint">Space = pause · ← → = skip</span>
      </div>
    </div>
  );
}

// The lens rendered as broadcast furniture (text over the film).
function Lens({ card, filmLine }: { card: SurpriseCard; filmLine: string }) {
  const m = card.mode;
  const kicker = [card.label, m === "misreading" || m === "theorist" ? card.framework : null]
    .filter(Boolean).join(" · ") + (card.theorist && (m === "misreading" || m === "theorist") ? ` · ${m === "misreading" ? "after " : ""}${card.theorist}` : "");
  const head = m === "misreading" ? card.line : card.subject;
  const items = (card.items ?? []).slice(0, 4);
  const chips = (card.chips ?? (card.groups ?? []).flatMap((g) => g.chips)).slice(0, 14);

  return (
    <div className="svc-lens">
      <div className="svc-film"><span className="svc-film__t">{filmLine}</span>{card.director ? <span className="svc-film__d"> · dir. {card.director}</span> : null}</div>
      {kicker ? <div className="svc-kicker">{kicker}</div> : null}
      {head ? <div className="svc-head">{head}</div> : null}
      {m === "misreading" ? (
        <>
          {card.body ? <p className="svc-sub">{card.body}</p> : null}
          {card.leap ? <p className="svc-leap"><span>The leap</span> {card.leap}</p> : null}
        </>
      ) : m === "theorist" ? (
        <>
          {card.intro ? <p className="svc-sub svc-sub--sm">{card.intro}</p> : null}
          {card.line ? <p className="svc-leap"><span>The reading</span> {card.line}</p> : null}
        </>
      ) : m === "reception" ? (
        <ul className="svc-quotes">
          {items.map((it, i) => (<li key={i}><span className="svc-q">“{it.text}”</span>{it.label ? <span className="svc-q__a"> — {it.label}{it.year ? ` · ${it.year}` : ""}</span> : null}</li>))}
        </ul>
      ) : m === "honors" ? (
        <ul className="svc-roll">{items.map((it, i) => <li key={i} className={it.won ? "is-won" : ""}><b>{it.won ? "🏆" : "◆"}</b> {it.text}{it.label ? <em> — {it.label}</em> : null}</li>)}</ul>
      ) : chips.length ? (
        <div className="svc-chips">{chips.map((c, i) => <span key={i} className="svc-chip">{c.text}</span>)}</div>
      ) : items.length ? (
        <ul className="svc-list">{items.map((it, i) => (<li key={i}><b>{it.title ?? it.name ?? it.text}{it.year ? ` (${it.year})` : ""}</b>{it.reason || it.label ? <span> — {it.reason ?? it.label}</span> : null}</li>))}</ul>
      ) : card.intro ? <p className="svc-sub">{card.intro}</p> : null}
    </div>
  );
}
