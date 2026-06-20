"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * HeroExamples — rotating example questions beneath the "ask Metatake AI" bar.
 * Shows two chips at a time and gently rolls to the next pair on a timer
 * (fade + slight lift), the way prompt suggestions peek out and slip away.
 * Order is shuffled per visit. Pauses on hover so a chip can be clicked, and
 * falls back to a static set when the visitor prefers reduced motion.
 * Figure-/reading-centred prompts — the heart of what Metatake does.
 */
const POOL = [
  "Films about surveillance that isn't a camera",
  "The body that performs past its hour",
  "What does a staircase mean in horror?",
  "Films where the house is a character",
  "What makes an ending feel earned?",
  "Doorways and thresholds as a figure",
  "Mirrors and the divided self on screen",
  "How do films show time passing?",
  "The figure of the double in cinema",
  "Rain as emotion, not weather",
  "Why do westerns keep returning to the wound?",
  "The empty chair as absence",
  "Windows as a figure of longing",
  "How is silence used as a figure?",
  "The lingering close-up on a face",
  "What does fog conceal and reveal?",
  "The road as a figure of escape",
  "Hands as a figure of contact",
  "Animals as omens on screen",
  "The meal as a scene of power",
  "Light through a window as grace",
  "What recurs across films about grief?",
  "Films that distrust their own narrator",
  "What connects Bacurau and There Will Be Blood?",
];

const SHOW = 2; // chips visible at once
const PERIOD = 3400; // ms between rotations
const FADE = 360; // ms fade-out before swapping

function shuffle(a: string[]): string[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export default function HeroExamples() {
  const [pool, setPool] = useState<string[]>(POOL); // deterministic for SSR/hydration
  const [i, setI] = useState(0);
  const [show, setShow] = useState(true);
  const [reduced, setReduced] = useState(false);
  const hover = useRef(false);

  useEffect(() => {
    const r = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    setReduced(r);
    setPool(shuffle(POOL)); // randomise order after mount (avoids SSR mismatch)
    if (r) return; // honour reduced motion: no rotation
    const t = window.setInterval(() => {
      if (hover.current) return; // paused while hovering
      setShow(false);
      window.setTimeout(() => {
        setI((v) => v + SHOW);
        setShow(true);
      }, FADE);
    }, PERIOD);
    return () => window.clearInterval(t);
  }, []);

  const items = reduced
    ? pool.slice(0, 6)
    : Array.from({ length: SHOW }, (_, k) => pool[(i + k) % pool.length]);

  return (
    <div
      className={`ah-eg${reduced ? "" : show ? " on" : " off"}`}
      onMouseEnter={() => (hover.current = true)}
      onMouseLeave={() => (hover.current = false)}
    >
      {items.map((x, k) => (
        <Link key={`${i}-${k}-${x}`} className="ah-chip" href={`/chat?q=${encodeURIComponent(x)}`}>
          {x}
        </Link>
      ))}
    </div>
  );
}
