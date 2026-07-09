"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ReelCard = {
  title: string; year?: number | null; director?: string | null; slug?: string | null;
  backdrop?: string | null; line?: string | null; framework?: string | null; leap?: string | null;
};

const IMG = "https://image.tmdb.org/t/p";
const SLOT_MS = 6000; // 6s per film × 5 = 30s
const N = 5;

// The Metatake Reel — a 30-second prototype for a YouTube Short. Five films cross
// quickly: each film's backdrop drifts (Ken Burns), a strong misreading lands as a
// kinetic headline, an AI voice (browser SpeechSynthesis — no paid API) reads it in
// a short intermittent burst over a continuous, self-generated ambient bed (Web
// Audio, zero-copyright). No film footage or film audio is used — stills + our own
// criticism + our own sound — which is the rights-safe basis we agreed on. Screen-
// record this to get an MP4; later it can be rendered headlessly.
export default function ReelPage() {
  const [cards, setCards] = useState<ReelCard[]>([]);
  const [phase, setPhase] = useState<"idle" | "playing" | "done">("idle");
  const [i, setI] = useState(-1);

  const cardsRef = useRef<ReelCard[]>([]);
  cardsRef.current = cards;
  const slotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acRef = useRef<AudioContext | null>(null);
  const stopMusic = useRef<() => void>(() => {});
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/reel?n=${N}&_=${Date.now()}`, { cache: "no-store" });
      const j = await r.json();
      if (Array.isArray(j) && j.length) setCards(j.slice(0, N));
    } catch { /* noop */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  // full-screen lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // pick a natural English voice (voices can load async)
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const pick = () => {
      const vs = speechSynthesis.getVoices();
      if (!vs.length) return;
      voiceRef.current =
        vs.find((v) => /en[-_]US/i.test(v.lang) && /Samantha|Ava|Allison|Zoe|Google US|Nathan/i.test(v.name)) ||
        vs.find((v) => /en[-_](US|GB)/i.test(v.lang)) ||
        vs.find((v) => /^en/i.test(v.lang)) || vs[0] || null;
    };
    pick();
    speechSynthesis.addEventListener("voiceschanged", pick);
    return () => speechSynthesis.removeEventListener("voiceschanged", pick);
  }, []);

  const speak = (text: string) => {
    try {
      if (!("speechSynthesis" in window)) return;
      const u = new SpeechSynthesisUtterance(text);
      if (voiceRef.current) u.voice = voiceRef.current;
      u.rate = 0.97; u.pitch = 1.0; u.volume = 1;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch { /* noop */ }
  };

  // a soft, self-generated ambient pad — original audio, no licensing
  const startMusic = () => {
    try {
      const AC: typeof AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ac = new AC();
      acRef.current = ac;
      const master = ac.createGain(); master.gain.value = 0.0001; master.connect(ac.destination);
      const filter = ac.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 800; filter.Q.value = 0.7; filter.connect(master);
      const freqs = [110, 164.81, 196, 246.94, 293.66]; // A2 · E3 · G3 · B3 · D4 (minor-9 pad)
      const oscs = freqs.map((f, idx) => {
        const o = ac.createOscillator(); o.type = idx % 2 ? "sine" : "triangle"; o.frequency.value = f;
        const g = ac.createGain(); g.gain.value = idx === 0 ? 0.5 : 0.2; o.connect(g); g.connect(filter); o.start();
        return o;
      });
      const lfo = ac.createOscillator(); lfo.frequency.value = 0.05;
      const lg = ac.createGain(); lg.gain.value = 320; lfo.connect(lg); lg.connect(filter.frequency); lfo.start();
      master.gain.linearRampToValueAtTime(0.075, ac.currentTime + 2);
      stopMusic.current = () => {
        try {
          master.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 0.8);
          oscs.forEach((o) => o.stop(ac.currentTime + 1)); lfo.stop(ac.currentTime + 1);
          setTimeout(() => { try { ac.close(); } catch { /* noop */ } }, 1300);
        } catch { /* noop */ }
      };
    } catch { /* noop */ }
  };

  const clearTimers = () => {
    if (slotTimer.current) clearTimeout(slotTimer.current);
    if (speakTimer.current) clearTimeout(speakTimer.current);
  };

  const playSlot = useCallback((n: number) => {
    const list = cardsRef.current;
    if (n >= list.length) { setPhase("done"); try { speechSynthesis.cancel(); } catch { /* noop */ } stopMusic.current(); return; }
    setI(n);
    const line = list[n]?.line;
    speakTimer.current = setTimeout(() => { if (line) speak(line); }, 550);
    slotTimer.current = setTimeout(() => playSlot(n + 1), SLOT_MS);
  }, []);

  const start = () => { if (!cards.length) return; setPhase("playing"); startMusic(); playSlot(0); };
  const restart = () => { clearTimers(); try { speechSynthesis.cancel(); } catch { /* noop */ } stopMusic.current(); setI(-1); setPhase("idle"); };
  const another = async () => { restart(); await load(); };

  useEffect(() => () => { clearTimers(); try { speechSynthesis.cancel(); } catch { /* noop */ } stopMusic.current(); }, []);

  const card = i >= 0 ? cards[i] : null;

  return (
    <div className="svchan reel">
      {/* bed */}
      <div className="svc-bed">
        {card?.backdrop ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="svc-media svc-media--kb" key={i} src={`${IMG}/w1280${card.backdrop}`} alt="" />
        ) : phase === "playing" ? <div className="svc-media svc-media--empty" aria-hidden="true" />
          : cards[0]?.backdrop ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="svc-media" src={`${IMG}/w1280${cards[0].backdrop}`} alt="" style={{ opacity: 0.5 }} />
          ) : <div className="svc-media svc-media--empty" aria-hidden="true" />}
      </div>
      <div className="svc-scrim" aria-hidden="true" />

      {/* progress: fills across the whole 30s while playing */}
      {phase === "playing" ? (
        <div className="svc-prog"><i key="run" style={{ animationDuration: `${SLOT_MS * N}ms` }} /></div>
      ) : null}

      {/* channel bug */}
      <div className="svc-bug">
        <span className="svc-bug__dot" data-live={phase === "playing" ? "1" : "0"} />
        <span className="svc-bug__name">METATAKE</span>
        <span className="svc-bug__sub">THE REEL</span>
      </div>

      {phase === "playing" && card ? (
        <>
          <div className="reel-count">{i + 1} / {cards.length}</div>
          <div className="svc-stage">
            <div className="svc-lens" key={i}>
              <div className="svc-film">
                <span className="svc-film__t">{[card.title, card.year ? `(${card.year})` : null].filter(Boolean).join(" ")}</span>
                {card.director ? <span className="svc-film__d"> · dir. {card.director}</span> : null}
              </div>
              {card.framework ? <div className="svc-kicker">Strong Misreading · {card.framework}</div> : <div className="svc-kicker">Strong Misreading</div>}
              {card.line ? <div className="svc-head">{card.line}</div> : null}
              {card.leap ? <p className="svc-sub svc-sub--sm">{card.leap}</p> : null}
            </div>
          </div>
        </>
      ) : phase === "done" ? (
        <div className="reel-cover">
          <div className="reel-end">That’s the reel.</div>
          <div className="reel-sub">Five films, thirty seconds — a Metatake Short.</div>
          <div className="reel-actions">
            <button className="reel-btn" onClick={start}>↻ Play again</button>
            <button className="reel-btn reel-btn--ghost" onClick={another}>Five new films</button>
          </div>
          <div className="reel-note">Screen-record this to get an MP4. Stills + our own criticism + our own sound — no film footage or film audio.</div>
        </div>
      ) : (
        <div className="reel-cover">
          <div className="reel-kick">A 30-second prototype</div>
          <div className="reel-title">The Metatake Reel</div>
          <div className="reel-sub">Five films cross in thirty seconds — a strong misreading each, read aloud over an ambient bed.</div>
          <button className="reel-btn reel-btn--go" onClick={start} disabled={!cards.length}>
            {cards.length ? "▶  Start — sound on" : "Loading…"}
          </button>
          <div className="reel-note">Best with sound. AI voice + generated music; no film footage or film audio.</div>
        </div>
      )}
    </div>
  );
}
