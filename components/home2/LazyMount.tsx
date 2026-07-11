"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * LazyMount — render heavy below-the-fold children only when the reader
 * scrolls near (IntersectionObserver, generous pre-roll). Until then a
 * fixed-height placeholder holds the layout (zero CLS). Pair with
 * next/dynamic({ssr:false}) children so their JS chunk isn't even
 * downloaded until needed — the home's initial load stays light no matter
 * how heavy the section (MapLibre, the connection graph, the TV player).
 */
export default function LazyMount({
  children,
  height,
  rootMargin = "700px",
  label = "Loading…",
}: {
  children: ReactNode;
  height: number;
  rootMargin?: string;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (show) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShow(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [show, rootMargin]);

  return (
    <div ref={ref} style={show ? undefined : { minHeight: height }}>
      {show ? children : <div className="emap-skel" style={{ height }}>{label}</div>}
    </div>
  );
}
