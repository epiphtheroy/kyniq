"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SiteNavClient from "@/components/home2/SiteNavClient";
import SurpriseStage from "@/components/home2/SurpriseStage";
import "@/app/home2.css";

type GCard = { kind: string; line?: string; sub?: string | null; href?: string; backdrop?: string | null };

// The wander-wall content types (drive surprise_set, user-customizable). The
// hero above uses surprise_home — the same curated, film-anchored lenses as the
// home page — so /random opens with the exact home experience, then lets you
// browse a wall of a chosen type below.
const KINDS: [string, string][] = [
  ["any", "🎲 Surprise"],
  ["film", "Film"], ["reading", "Reading"], ["concept", "Concept"], ["director", "Director"],
  ["theorist", "Theorist"], ["trope", "Trope"], ["figure", "Figure"], ["location", "On location"],
  ["question", "Curious"], ["reception", "What critics said"],
];
const MIX_TYPES: [string, string][] = KINDS.slice(1);
const IMG = "https://image.tmdb.org/t/p";
const MIX_KEY = "sm_mix_v1";

export default function SurprisePage() {
  const [kind, setKind] = useState("any");
  const [set, setSet] = useState<GCard[]>([]);
  const [gridLoading, setGridLoading] = useState(true);
  const [mix, setMix] = useState<string[]>(() => MIX_TYPES.map(([k]) => k));
  const [showMix, setShowMix] = useState(false);
  const kindRef = useRef(kind); kindRef.current = kind;
  const mixRef = useRef(mix); mixRef.current = mix;

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

  useEffect(() => { drawSet("any"); }, [drawSet]);

  const pick = (k: string) => { setKind(k); drawSet(k); };

  return (
    <div className="mt sm-page sm-rand">
      <SiteNavClient />

      <div className="sm-head">
        <h1 className="sm-h1">Surprise me</h1>
        <p className="sm-tag">A film through one lens you didn’t expect — its critics, its honors, its map, a bold misreading. Hit <kbd>Space</kbd> to draw again.</p>
      </div>

      {/* The hero: identical to the home "Surprise me" — a curated, film-anchored lens */}
      <div className="mthome sm-rand-hero">
        <div className="hero">
          <div className="wrap">
            <SurpriseStage />
          </div>
        </div>
      </div>

      {/* Below: a wall you can steer by type */}
      <div className="sm-wrap">
        <div className="sm-morehd">
          <h2 className="sm-h2">Or wander by type</h2>
          <p className="sm-tag">Choose what the wall pulls from — your pick is remembered.</p>
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

        <div className="sm-setbar">
          <span className="sm-setk">30 cards to wander</span>
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
