"use client";
/** Shared half-star widget (0.5–5) — .v2stars, no rate.css dependency.
 *  Hover preview + half/full click zones. Read-only variant: omit onPick
 *  (used for averages, e.g. the Auteurs oeuvre mean). */
import { useState } from "react";

export default function Stars({ value, onPick, size = 19, title }: {
  value: number;
  /** Omit for read-only display. */
  onPick?: (v: number) => void;
  size?: number;
  title?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const v = hover ?? value;
  return (
    <span className="v2stars" style={{ fontSize: size }} onMouseLeave={() => setHover(null)} title={title}>
      {[1, 2, 3, 4, 5].map((i) => {
        const lit = v >= i;
        const hf = !lit && v >= i - 0.5;
        return (
          <span key={i} className={`s${lit ? " lit" : hf ? " hf" : ""}`}>★
            {onPick ? (
              <span className="hz">
                <i onMouseEnter={() => setHover(i - 0.5)} onClick={(e) => { e.stopPropagation(); onPick(i - 0.5); }} />
                <i onMouseEnter={() => setHover(i)} onClick={(e) => { e.stopPropagation(); onPick(i); }} />
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}
