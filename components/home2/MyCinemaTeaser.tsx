"use client";

/**
 * MyCinemaTeaser — the third companion moment on home (전환마스터 §4.1-3):
 * your watching life. Two equal cards — My Room (with the import path that
 * activates it) and the mobile app (honest beta framing; detail lives on /app).
 * No screenshots, no fabricated imagery — typographic cards only.
 */
import Link from "next/link";

export default function MyCinemaTeaser() {
  return (
    <section className="band p2 mct">
      <div className="wrap">
        <div className="shead">
          <div>
            <h2>My Cinema <span className="chev">›</span></h2>
            <div className="sub">Your watching life — mapped, scored, remembered.</div>
          </div>
        </div>
        <div className="mct-grid">
          <div className="mct-card">
            <h3>My Room</h3>
            <p>
              Import your watch history and see your cinema as one map — coverage,
              blind spots, taste vectors, and a TakeScore lens on every film you know.
            </p>
            <div className="mct-ctas">
              <Link className="mct-cta mct-cta--primary" href="/room">Open My Room →</Link>
              <Link className="mct-cta" href="/me/import">Import your films</Link>
            </div>
          </div>
          <div className="mct-card">
            <h3>The app <span className="mct-tag">iOS &amp; Android</span></h3>
            <p>
              Metatake in your pocket — decide tonight&rsquo;s film from the couch,
              the train, the video store. On the App Store and Google Play.
            </p>
            <div className="mct-ctas">
              <Link className="mct-cta mct-cta--primary" href="/app">About the app →</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
