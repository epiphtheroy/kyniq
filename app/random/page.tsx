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

type GCard = { kind: string; line?: string; sub?: string | null; href?: string; backdrop?: string | null };

// 10 content types the corpus can surprise you with (2026-07-09 expansion).
const KINDS: [string, string][] = [
  ["any", "🎲 Surprise"],
  ["film", "Film"], ["reading", "Reading"], ["concept", "Concept"], ["director", "Director"],
  ["theorist", "Theorist"], ["trope", "Trope"], ["figure", "Figure"], ["location", "On location"],
  ["question", "Curious"], ["reception", "What critics said"],
];
// The types that "🎲 Surprise" draws from — user-customizable, persisted.
const MIX_TYPES: [string, string][] = KINDS.slice(1);
const IMG = "https://image.tmdb.org/t/p";
const MIX_KEY = "sm_mix_v1";

export default function SurprisePage() {
  const [kind, setKind] = useState("any");
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [set, setSet] = useState<GCard[]>([]);
  const [gridLoading, setGridLoading] = useState(true);
  const [mix, setMix] = useState<string[]>(() => MIX_TYPES.map(([k]) => k));
  const [showMix, setShowMix] = useState(false);
  const kindRef = useRef(kind); kindRef.current = kind;
  const mixRef = useRef(mix); mixRef.current = mix;
  const busy = useRef(false);

  // Load the saved mix once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(MIX_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        const valid = arr.filter((k) => MIX_TYPES.some(([t]) => t === k));
        if (valid.length) setMix(valid);
      }
    } catch { /* noop */ }
  }, []);

  // The mix query param — only meaningful for "any"; full mix ⇒ omit (server default).
  const mixParam = (k: string) =>
    k === "any" && mixRef.current.length && mixRef.current.length < MIX_TYPES.length
      ? `&mix=${mixRef.current.join(",")}` : "";

  const drawCard = useCallback(async (k?: string) => {
    if (busy.current) return;
    busy.current = true;
    const kk = k ?? kindRef.current;
    setLoading(true);
    try {
      const r = await fetch(`/api/surprise?kind=${kk}${mixParam(kk)}&_=${Date.now()}`, { cache: "no-store" });
      setCard((await r.json()) as Card);
    } catch { /* noop */ } finally { setLoading(false); busy.current = false; }
  }, []);

  const drawSet = useCallback(async (k?: string) => {
    const kk = k ?? kindRef.current;
    setGridLoading(true);
    try {
      const r = await fetch(`/api/surprise/set?kind=${kk}&n=30${mixParam(kk)}&_=${Date.now()}`, { cache: "no-store" });
      const j = await r.json();
      setSet(Array.isArray(j) ? (j as GCard[]) : []);
    } catch { /* noop */ } finally { setGridLoading(false); }
  }, []);

  const toggleMix = (t: string) => {
    setMix((cur) => {
      const next = cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t];
      const safe = next.length ? next : [t]; // never let the mix go empty
      try { localStorage.setItem(MIX_KEY, JSON.stringify(safe)); } catch { /* noop */ }
      mixRef.current = safe;
      return safe;
    });
  };

  useEffect(() => { drawCard("any"); drawSet("any"); }, [drawCard, drawSet]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target as HTMLElement)?.closest?.("input,textarea,a,button")) { e.preventDefault(); drawCard(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawCard]);

  const pick = (k: string) => { setKind(k); drawCard(k); drawSet(k); };

  const clipSrc = card?.clip
    ? `https://www.youtube-nocookie.com/embed/${card.clip}?autoplay=1&mute=1&controls=0&loop=1&playlist=${card.clip}&start=7&playsinline=1&modestbranding=1&rel=0`
    : null;

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
          <button className={`sm-tog sm-tog--mix${showMix ? " on" : ""}`} onClick={() => setShowMix((v) => !v)} title="Choose what Surprise draws from">
            ⚙ Your mix{mix.length < MIX_TYPES.length ? ` (${mix.length})` : ""}
          </button>
        </div>

        {showMix ? (
          <div className="sm-mix">
            <span className="sm-mixk">🎲 Surprise draws from:</span>
            {MIX_TYPES.map(([k, l]) => (
              <label key={k} className={`sm-mixc${mix.includes(k) ? " on" : ""}`}>
                <input type="checkbox" checked={mix.includes(k)} onChange={() => toggleMix(k)} />
                {l}
              </label>
            ))}
            <button className="sm-mixall" onClick={() => { const all = MIX_TYPES.map(([t]) => t); setMix(all); mixRef.current = all; try { localStorage.setItem(MIX_KEY, JSON.stringify(all)); } catch { /* noop */ } }}>All</button>
          </div>
        ) : null}

        <div className={`sm-card${loading ? " is-load" : ""}`}>
          {clipSrc ? (
            <iframe
              key={card!.clip}
              className="sm-bg"
              src={clipSrc}
              title={card?.line ?? "clip"}
              allow="autoplay; encrypted-media; picture-in-picture"
            />
          ) : card?.backdrop ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="sm-bg" src={`${IMG}/w1280${card.backdrop}`} alt="" />
          ) : <div className="sm-bg sm-bg--empty" aria-hidden="true" />}
        </div>

        <div className="sm-meta">
          {card?.portrait ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="sm-pic" src={`${IMG}/w185${card.portrait}`} alt="" />
          ) : null}
          <div className="sm-metabody">
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
            <div className="sm-actions">
              <button className="sm-again" onClick={() => drawCard()} disabled={loading}>
                ↻ Surprise me again <kbd>Space</kbd>
              </button>
              {card?.href ? <a className="sm-open" href={card.href}>Open ↗</a> : null}
            </div>
          </div>
        </div>

        <div className="sm-setbar">
          <span className="sm-setk">More to wander — 30 cards</span>
          <button className="sm-setbtn" onClick={() => drawSet()} disabled={gridLoading}>↻ Show another 30</button>
        </div>
        <div className="sm-grid">
          {set.map((c, i) => (
            <a
              key={i}
              className="sm-gcard"
              href={c.href}
              style={c.backdrop ? { backgroundImage: `linear-gradient(0deg,rgba(8,7,5,.9),rgba(8,7,5,.12)),url(${IMG}/w500${c.backdrop})` } : undefined}
            >
              <span className="sm-gkind">{c.kind}</span>
              <span className="sm-gline">{c.line}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
