"use client";

/**
 * LensCta — the live control block on /my-films. State-aware:
 * signed out → sign-in / create-account; signed in without seen films →
 * import CTA; otherwise the three lens modes, switchable right here.
 */
import Link from "next/link";
import { useLens, type LensMode } from "@/components/LensProvider";

const MODES: { m: LensMode; t: string; s: string }[] = [
  { m: "off", t: "All films", s: "The public site, exactly as everyone sees it." },
  { m: "highlight", t: "Highlight mine", s: "Every film you've seen wears a red border — posters, thumbnails, the galaxy, the maps." },
  { m: "only", t: "Only mine", s: "The site re-centres on your history: unseen films ghost out, the galaxy and atlas filter down to yours." },
];

export default function LensCta() {
  const lens = useLens();
  if (!lens || !lens.ready) {
    return <div className="mfl-cta"><p className="mfl-note">Loading your lens…</p></div>;
  }

  if (!lens.uid) {
    return (
      <div className="mfl-cta">
        <p className="mfl-note">The lens needs to know what you&rsquo;ve watched — create a free account, then mark films or import your history.</p>
        <div className="mfl-btns">
          <Link className="mfl-btn mfl-btn--red" href="/signup?next=%2Fmy-films">Create account</Link>
          <Link className="mfl-btn" href="/login?next=%2Fmy-films">Sign in</Link>
        </div>
      </div>
    );
  }

  if (lens.seenCount === 0) {
    return (
      <div className="mfl-cta">
        <p className="mfl-note">
          You&rsquo;re signed in — now give the lens something to work with. Mark films as
          <b> Seen ✓</b> anywhere on the site, or import your whole history in one go.
        </p>
        <div className="mfl-btns">
          <Link className="mfl-btn mfl-btn--red" href="/me/import">Import from Letterboxd / IMDb</Link>
          <Link className="mfl-btn" href="/film">Browse films to mark</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mfl-cta">
      <p className="mfl-note">
        Your lens covers <b>{lens.seenCount.toLocaleString()}</b> films. Switch it here — or any
        time from the <b>◎ My films</b> toggle in the top bar.
      </p>
      <div className="mfl-modes">
        {MODES.map((o) => (
          <button
            key={o.m}
            type="button"
            className={`mfl-mode${lens.rawMode === o.m ? " on" : ""}`}
            onClick={() => lens.setMode(o.m)}
            aria-pressed={lens.rawMode === o.m}
          >
            <span className="mfl-mt">{o.t}</span>
            <span className="mfl-ms">{o.s}</span>
          </button>
        ))}
      </div>
      <p className="mfl-small">
        Missing films? <Link href="/me/import">Import more</Link> — the lens updates instantly.
      </p>
    </div>
  );
}
