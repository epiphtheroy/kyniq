"use client";

import { useRef } from "react";

/**
 * Rail wrapper with ‹ › scroll buttons (scrollBy ±520 smooth), per the mockup.
 * `variant` controls the inner flex container class ("rail" or "born").
 */
export default function Rail({
  children,
  variant = "rail",
}: {
  children: React.ReactNode;
  variant?: "rail" | "born";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (d: number) => ref.current?.scrollBy({ left: d * 520, behavior: "smooth" });

  return (
    <div className="railwrap">
      <button className="scrollbtn l" onClick={() => scroll(-1)} aria-label="Scroll left">
        ‹
      </button>
      <div className={variant} ref={ref}>
        {children}
      </div>
      <button className="scrollbtn r" onClick={() => scroll(1)} aria-label="Scroll right">
        ›
      </button>
    </div>
  );
}
