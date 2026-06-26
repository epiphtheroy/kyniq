"use client";

import { hashTone, tone } from "./helpers";

/**
 * A poster/backdrop fill: renders <img> when a TMDB url is present, otherwise the
 * exact tone-gradient placeholder the mockup uses. `seed` makes the tone stable.
 * Children (overlays like + buttons, titles) are stacked on top.
 */
export default function Fill({
  url,
  seed,
  alt = "",
  className,
  children,
}: {
  url: string | null;
  seed: string;
  alt?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={className} style={{ background: tone(hashTone(seed)) }}>
      {url ? (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : null}
      {children}
    </div>
  );
}
