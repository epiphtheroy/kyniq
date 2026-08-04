/**
 * Skeleton — the loading vocabulary, ported from the app per
 * HANDOFF-앱에서-웹으로-이식.md §1.4 rank 1.
 *
 * The point (§1.2): a spinner says "something is turning". A skeleton says
 * "here is what is coming" — so it must hold the SHAPE of the real content,
 * which is why these mirror each host surface's geometry rather than being one
 * generic grey box.
 *
 * The shimmer is not here. Every block gets `.mo-sk` and reads one driver
 * animated on :root (app/motion.css), so a single light crosses the whole page
 * instead of every tile twinkling on its own — one animation per screen rather
 * than one per tile, exactly as in the app.
 *
 * These are server-safe: no hooks, no client boundary.
 */

/** Screen-reader announcement + a wrapper the blocks hang off. */
function Frame({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className} role="status" aria-live="polite">
      <span className="mo-sr">{label}</span>
      <span aria-hidden="true" style={{ display: "contents" }}>{children}</span>
    </div>
  );
}

const keys = (n: number) => Array.from({ length: n }, (_, i) => i);

/**
 * Film cards — poster beside a block of metadata. Stands in for the
 * What to Watch marquee grid.
 */
export function SkFilmCards({ count = 8, label = "Loading films" }: { count?: number; label?: string }) {
  return (
    <Frame label={label} className="mo-sk-cards">
      {keys(count).map((i) => (
        <div className="mo-sk-card" key={i}>
          <div className="mo-sk" style={{ width: 80, minWidth: 80, height: 120 }} />
          <div className="mo-sk-card-mid">
            <div className="mo-sk mo-sk-line w40" />
            <div className="mo-sk mo-sk-line w80" />
            <div className="mo-sk mo-sk-line w60" />
          </div>
        </div>
      ))}
    </Frame>
  );
}

/**
 * Ranked rows — rank number, poster, title block. Stands in for the TakeScore
 * screener results.
 */
export function SkFilmRows({ count = 10, label = "Loading films" }: { count?: number; label?: string }) {
  return (
    <Frame label={label} className="mo-sk-rows">
      {keys(count).map((i) => (
        <div className="mo-sk-rowitem" key={i}>
          <div className="mo-sk mo-sk-line w80" style={{ margin: 0 }} />
          <div className="mo-sk" style={{ width: 66, height: 99 }} />
          <div>
            <div className="mo-sk mo-sk-line w60" />
            <div className="mo-sk mo-sk-line w40" />
          </div>
        </div>
      ))}
    </Frame>
  );
}

/**
 * Poster (or portrait) tiles with a caption line. Stands in for the /film and
 * /director index search results.
 */
export function SkTiles({ count = 12, shape = "poster", label = "Searching" }: {
  count?: number; shape?: "poster" | "round"; label?: string;
}) {
  return (
    <Frame label={label} className="mo-sk-grid">
      {keys(count).map((i) => (
        <div className={shape === "round" ? "mo-sk-tile round" : "mo-sk-tile"} key={i}>
          <div className="mo-sk mo-sk-poster" />
          <div className="mo-sk mo-sk-line w80" />
        </div>
      ))}
    </Frame>
  );
}

/** Plain text rows — concept / theorist / tradition lists. */
export function SkLines({ count = 8, label = "Searching" }: { count?: number; label?: string }) {
  return (
    <Frame label={label} className="mo-sk-rows">
      {keys(count).map((i) => (
        <div className="mo-sk-row" key={i}>
          <div className="mo-sk mo-sk-line" style={{ width: `${[62, 44, 71, 38, 55, 66, 49, 58][i % 8]}%` }} />
        </div>
      ))}
    </Frame>
  );
}
