"use client";

/**
 * JustWatched — slim paper band for the second companion moment (전환마스터
 * §4.1-2): you just watched something, now understand it. One native GET form
 * to /search (works without JS; the nav's ⌘K palette remains the fast path).
 * Deliberately one input + one caption — no module furniture.
 */
export default function JustWatched() {
  return (
    <section className="band jw">
      <div className="wrap">
        <h2 className="jw-h">Just watched something?</h2>
        <form className="jw-form" action="/search" method="get">
          <input name="q" placeholder="The film you just watched…" aria-label="Search Metatake" />
          <button type="submit">Search</button>
        </form>
        <p className="jw-sub">Its meaning, its shooting locations, what it echoes, what to watch next.</p>
      </div>
    </section>
  );
}
