"use client";

/**
 * LensToggle — the My Films lens control in the site nav. Three states:
 * All films (off) · Highlight mine · Only mine. Lives in Nav's .navright,
 * styled by the .mtl-nav / .mtlmenu block in home2.css (dark nav palette).
 * Logged out (or no seen films yet) the menu explains the lens and routes
 * to /my-films · /login · /me/import instead of switching modes.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLens, type LensMode } from "@/components/LensProvider";

const MODES: { m: LensMode; t: string; s: string }[] = [
  { m: "off", t: "All films", s: "The public site, untouched" },
  { m: "highlight", t: "Highlight mine", s: "Films you've seen get a red border everywhere" },
  { m: "only", t: "Only mine", s: "The whole site re-centres on what you've watched" },
];

export default function LensToggle() {
  const lens = useLens();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  if (!lens) return null;
  const canLens = !!lens.uid && lens.seenCount > 0;
  const state = lens.mode;

  return (
    <div className="mtl-navwrap" ref={rootRef}>
      <button
        type="button"
        className={`mtl-nav${state !== "off" ? " on" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="My Films lens — see the site through what you've watched"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8.2" />
          <circle cx="12" cy="12" r="3.1" fill={state === "off" ? "none" : "currentColor"} stroke="none" />
        </svg>
        <span className="t">My&nbsp;films</span>
        {state !== "off" ? <span className="st">{state === "only" ? "only" : "hi"}</span> : null}
      </button>

      <div className={`mtlmenu${open ? " open" : ""}`}>
        {canLens ? (
          <>
            <div className="mtl-head">
              My Films lens
              <span className="mtl-n">{lens.seenCount.toLocaleString()} films seen</span>
            </div>
            {MODES.map((o) => (
              <button
                key={o.m}
                type="button"
                className={`mtl-opt${lens.rawMode === o.m ? " on" : ""}`}
                onClick={() => { lens.setMode(o.m); setOpen(false); }}
              >
                <span className="mtl-radio" aria-hidden="true" />
                <span>
                  <span className="mtl-t">{o.t}</span>
                  <span className="mtl-s">{o.s}</span>
                </span>
              </button>
            ))}
            <div className="mtl-foot">
              <Link href="/my-films" onClick={() => setOpen(false)}>What is this? →</Link>
              <Link href="/me/import" onClick={() => setOpen(false)}>Import more films</Link>
            </div>
          </>
        ) : lens.uid ? (
          <>
            <div className="mtl-head">My Films lens</div>
            <p className="mtl-p">
              Mark films as <b>Seen ✓</b> — or import your Letterboxd / IMDb history — and the whole
              site can re-centre on what you&rsquo;ve watched.
            </p>
            <div className="mtl-foot">
              <Link href="/me/import" onClick={() => setOpen(false)}>Import your films →</Link>
              <Link href="/my-films" onClick={() => setOpen(false)}>Learn more</Link>
            </div>
          </>
        ) : (
          <>
            <div className="mtl-head">My Films lens</div>
            <p className="mtl-p">
              See Metatake through the films you&rsquo;ve watched — highlighted across every page,
              map and galaxy, or filtered down to only yours.
            </p>
            <div className="mtl-foot">
              <Link href="/login?next=%2Fmy-films" onClick={() => setOpen(false)}>Sign in →</Link>
              <Link href="/my-films" onClick={() => setOpen(false)}>Learn more</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
