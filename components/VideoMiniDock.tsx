"use client";

// VideoMiniDock — wrap any top-of-page video stage; when it scrolls out of view
// the SAME element docks bottom-right shrunk via transform:scale, YouTube-
// miniplayer-style. Because it's a transform (not a re-layout), everything
// inside — the broadcast overlay text, chips, badges — scales in exact
// proportion. The player keeps playing through the transition (same DOM node,
// no remount). Draggable, dismissable; re-arms when the hero scrolls back up.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export default function VideoMiniDock({ children, mini = 420 }: {
  children: React.ReactNode;
  mini?: number; // docked width in px (clamped to 62vw on small screens)
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [docked, setDocked] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dismRef = useRef(false); dismRef.current = dismissed;
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const dockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      const e = entries[0];
      if (e.isIntersecting) {
        // hero back on screen → undock and re-arm the dismiss
        setDocked(false); setDismissed(false); setPos(null);
      } else if (!dismRef.current && e.boundingClientRect.top < 0) {
        // only dock when the hero left through the TOP (scrolling down)
        const r = el.getBoundingClientRect();
        if (r.width > 40 && r.height > 40) setBox({ w: r.width, h: r.height });
        setDocked(true);
      }
    }, { threshold: 0, rootMargin: "-72px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const miniW = typeof window !== "undefined" ? Math.min(mini, window.innerWidth * 0.62) : mini;
  const scale = box ? miniW / box.w : 1;
  const on = docked && !dismissed && !!box;

  // drag by the handle; getBoundingClientRect on the scaled element returns the
  // VISUAL (mini) box, which is what we clamp against
  const onDragDown = (e: ReactPointerEvent) => {
    const el = dockRef.current; if (!el) return;
    e.preventDefault();
    const r = el.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    setPos({ x: r.left, y: r.top }); // switch to top-left anchoring in place
    const move = (ev: PointerEvent) => {
      if (!drag.current || !dockRef.current) return;
      const vr = dockRef.current.getBoundingClientRect();
      const x = Math.max(6, Math.min(window.innerWidth - vr.width - 6, ev.clientX - drag.current.dx));
      const y = Math.max(6, Math.min(window.innerHeight - vr.height - 6, ev.clientY - drag.current.dy));
      setPos({ x, y });
    };
    const up = () => { drag.current = null; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div ref={hostRef} className="vdock-host" style={on ? { height: box!.h } : undefined}>
      <div
        ref={dockRef}
        className={`vdock${on ? " vdock--on" : ""}`}
        style={on ? {
          width: box!.w, height: box!.h,
          transform: `scale(${scale})`,
          ...(pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto", transformOrigin: "top left" } : {}),
        } : undefined}
      >
        {children}
        {on ? (
          <span className="vdock-ui" style={{ transform: `scale(${1 / scale})` }}>
            <span className="vdock-drag" onPointerDown={onDragDown} title="Drag to move">⋮⋮</span>
            <button type="button" className="vdock-x" onClick={() => { setDismissed(true); setDocked(false); setPos(null); }} aria-label="Close mini player">✕</button>
          </span>
        ) : null}
      </div>
    </div>
  );
}
