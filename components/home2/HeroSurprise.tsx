"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Card = {
  kind: string; line?: string; sub?: string; body?: string; leap?: string; label?: string;
  framework?: string; theorist?: string; native?: string; fact?: string;
  film?: string; year?: number; title?: string; href?: string;
  backdrop?: string | null; clip?: string | null; portrait?: string | null;
};

const IMG = "https://image.tmdb.org/t/p";

// Home hero — "Surprise me". One random draw at a time (film · reading · idea ·
// director). Video/backdrop on the left, a long red space-bar beneath it (with
// small prev/next arrows), the full text of the card in the right panel. The 30-
// candidate rotation keeps running underneath; we never show what's next.
export default function HeroSurprise() {
  const [hist, setHist] = useState<Card[]>([]);
  const [idx, setIdx] = useState(-1);
  const [loading, setLoading] = useState(true);
  const busy = useRef(false);
  const card = idx >= 0 ? hist[idx] : null;

  const draw = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const r = await fetch(`/api/surprise?kind=any&_=${Date.now()}`, { cache: "no-store" });
      const c = (await r.json()) as Card;
      setHist((h) => [...h, c]);
      setIdx((i) => i + 1);
    } catch { /* noop */ } finally { setLoading(false); busy.current = false; }
  }, []);

  const prev = () => setIdx((i) => Math.max(0, i - 1));
  const next = () => { if (idx < hist.length - 1) setIdx((i) => i + 1); else draw(); };

  useEffect(() => { draw(); }, [draw]);

  // Space draws again (unless typing / on a control).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target as HTMLElement)?.closest?.("input,textarea,a,button")) { e.preventDefault(); draw(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draw]);

  // Gentle auto-rotation; pauses while the reader hovers the hero.
  const paused = useRef(false);
  useEffect(() => {
    const t = setInterval(() => { if (!paused.current && !busy.current) draw(); }, 13000);
    return () => clearInterval(t);
  }, [draw]);

  const clipSrc = card?.clip
    ? `https://www.youtube-nocookie.com/embed/${card.clip}?autoplay=1&mute=1&controls=0&loop=1&playlist=${card.clip}&start=7&playsinline=1&modestbranding=1&rel=0`
    : null;

  const chip = card ? [card.label, card.framework].filter(Boolean).join(" · ") : "";

  return (
    <div className="hero" onMouseEnter={() => (paused.current = true)} onMouseLeave={() => (paused.current = false)}>
      <div className="wrap">
        <div className="vh">
          <div className="hs-left">
            <div
              className={`vmain hs-main${loading ? " is-load" : ""}`}
              onClick={() => { if (card?.href) window.location.href = card.href; }}
            >
              <div className="vbadge">metatake · Surprise me</div>
              {clipSrc ? (
                <iframe key={card!.clip} className="hs-media" src={clipSrc} title={card?.line ?? "clip"} allow="autoplay; encrypted-media; picture-in-picture" />
              ) : card?.backdrop ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="hs-media" src={`${IMG}/w1280${card.backdrop}`} alt="" />
              ) : <div className="hs-media hs-media--empty" aria-hidden="true" />}
              {!clipSrc ? <div className="vplay" title="Open">▶</div> : null}
            </div>

            <div className="hs-bar">
              <button className="hs-nav" onClick={prev} disabled={idx <= 0} aria-label="Previous">‹</button>
              <button className="hs-draw" onClick={draw} disabled={loading}>↻ Surprise me — hit <kbd>Space</kbd></button>
              <button className="hs-nav" onClick={next} aria-label="Next">›</button>
            </div>
          </div>

          <aside className="upnext hs-text">
            <div className="hs-textwrap">
              {chip ? <span className="hs-chip">{chip}{card?.theorist ? ` · after ${card.theorist}` : ""}</span> : null}
              <div className="hs-line">
                {card?.line}
                {card?.native ? <span className="hs-native"> {card.native}</span> : null}
              </div>
              {card?.sub ? <div className="hs-sub">{card.sub}</div> : null}
              {card?.body ? <p className="hs-body">{card.body}</p> : null}
              {card?.leap ? <p className="hs-leap"><span>The leap</span> {card.leap}</p> : null}
              {card?.fact ? <p className="hs-leap"><span>The life</span> {card.fact}</p> : null}
              {card?.kind === "director" && card?.film ? <div className="hs-sub">Where to start · {card.film}</div> : null}
              {card?.href ? <a className="hs-open" href={card.href}>Open this ↗</a> : null}
            </div>
          </aside>
        </div>

        <div className="topicchips">
          <Link className="tc" href="/strong-misreadings">Strong Misreadings <span className="ch">›</span></Link>
          <Link className="tc" href="/search?q=grief">Films about grief <span className="ch">›</span></Link>
          <Link className="tc" href="/director">Auteur fingerprints <span className="ch">›</span></Link>
          <Link className="tc" href="/map">The whole map <span className="ch">›</span></Link>
          <Link className="tc" href="/idea">The Real (le réel) <span className="ch">›</span></Link>
        </div>
      </div>
    </div>
  );
}
