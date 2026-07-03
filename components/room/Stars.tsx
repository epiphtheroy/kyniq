"use client";
/** v2 공용 반별점 (0.5–5) — rate.css 비의존(.v2stars). 호버 미리보기 + 반/전체 클릭존. */
import { useState } from "react";

export default function Stars({ value, onPick, size = 19 }: {
  value: number; onPick?: (v: number) => void; size?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const v = hover ?? value;
  return (
    <span className="v2stars" style={{ fontSize: size }} onMouseLeave={() => setHover(null)}>
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
