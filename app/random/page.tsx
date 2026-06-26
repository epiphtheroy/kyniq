"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SiteNavClient from "@/components/home2/SiteNavClient";
import "@/app/home2.css";

type Card = {
  kind: string; line?: string; sub?: string; leap?: string; label?: string;
  framework?: string; theorist?: string; native?: string; fact?: string;
  film?: string; example?: string; href?: string;
  backdrop?: string | null; clip?: string | null; portrait?: string | null;
};

const KINDS: [string, string][] = [
  ["any", "Surprise"], ["film", "Film"], ["reading", "Reading"],
  ["trope", "Trope"], ["idea", "Idea"], ["director", "Director"],
];
const IMG = "https://image.tmdb.org/t/p";

export default function SurprisePage() {
  const [kind, setKind] = useState("any");
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [trail, setTrail] = useState<Card[]>([]);
  const kindRef = useRef(kind); kindRef.current = kind;
  const busy = useRef(false);

  const draw = useCallback(async (k?: string) => {
    if (busy.current) return;
    busy.current = true;
    const kk = k ?? kindRef.current;
    setLoading(true);
    try {
      const r = await fetch(`/api/surprise?kind=${kk}&_=${Date.now()}`, { cache: "no-store" });
      const j = (await r.json()) as Card;
      setCard((prev) => { if (prev?.line) setTrail((t) => [prev, ...t].slice(0, 6)); return j; });
    } catch { /* noop */ } finally { setLoading(false); busy.current = false; }
  }, []);

  useEffect(() => { draw("any"); }, [draw]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target as HTMLElement)?.closest?.("input,textarea")) { e.preventDefault(); draw(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draw]);

  const pick = (k: string) => { setKind(k); draw(k); };

  return (
    <div className="mt sm-page">
      <SiteNavClient />
      <div className="sm-wrap">
        <div className="sm-head">
          <h1 className="sm-h1">Surprise me</h1>
          <p className="sm-tag">One card at a time. Hit <kbd>Space</kbd> to draw again.</p>
        </div>

        <div className="sm-toggles">
          {KINDS.map(([k, l]) => (
            <button key={k} className={`sm-tog${kind === k ? " on" : ""}`} onClick={() => pick(k)}>{l}</button>
          ))}
        </div>

        <div className={`sm-card${loading ? " is-load" : ""}`}>
          {card?.clip ? (
            <iframe
              key={card.clip}
              className="sm-bg"
              src={`https://www.youtube-nocookie.com/embed/${card.clip}?autoplay=1&mute=1&controls=0&loop=1&playlist=${card.clip}&playsinline=1&modestbranding=1&rel=0`}
              title={card.line ?? "clip"}
              allow="autoplay; encrypted-media; picture-in-picture"
            />
          ) : card?.backdrop ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="sm-bg" src={`${IMG}/w1280${card.backdrop}`} alt="" />
          ) : <div className="sm-bg sm-bg--empty" aria-hidden="true" />}

          <div className="sm-grad" />

          {card?.portrait ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="sm-portrait" src={`${IMG}/w185${card.portrait}`} alt="" />
          ) : null}

          <div className="sm-body">
            {card?.label ? (
              <span className="sm-chip">{card.label}{card.theorist ? ` · after ${card.theorist}` : ""}</span>
            ) : null}
            <div className="sm-line">
              {card?.line}
              {card?.native ? <span className="sm-native"> {card.native}</span> : null}
            </div>
            {card?.sub ? <div className="sm-sub">{card.sub}</div> : null}
            {card?.leap ? <div className="sm-leap"><span>The leap</span> {card.leap}</div> : null}
            {card?.fact ? <div className="sm-leap"><span>The life</span> {card.fact}</div> : null}
            {card?.kind === "director" && card?.film ? <div className="sm-sub">Where to start · {card.film}</div> : null}
            {card?.kind === "trope" && card?.example ? <div className="sm-sub">e.g. {card.example}</div> : null}
          </div>
        </div>

        <div className="sm-actions">
          <button className="sm-again" onClick={() => draw()} disabled={loading}>
            ↻ Surprise me again <kbd>Space</kbd>
          </button>
          {card?.href ? <a className="sm-open" href={card.href}>Open ↗</a> : null}
        </div>

        {trail.length ? (
          <div className="sm-trail">
            <span className="sm-trail__k">Just drawn</span>
            {trail.map((c, i) => (
              <button
                key={i}
                className="sm-thumb"
                title={c.line}
                onClick={() => setCard(c)}
                style={c.backdrop ? { backgroundImage: `url(${IMG}/w300${c.backdrop})` } : undefined}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
