"use client";

/**
 * FloatingTrailerDock — the small follow-along player on film pages whose hero
 * is the METATAKE TV broadcast. When the hero scrolls out of view, this docks a
 * PLAIN trailer reel (the old hero video — no broadcast overlay) bottom-left,
 * exactly like FilmHeroReel's float: draggable, mute toggle, dismissable.
 * The iframe mounts only while floating (no double YouTube load with the
 * broadcast); a simple loop playlist chains all the film's clips — no YT API.
 * Reuses the .iv-frame--float / .iv-drag / .iv-mute / .iv-close furniture.
 */
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

type Vid = { id: string; title: string };

export default function FloatingTrailerDock({ videos, watch, poster }: {
  videos: Vid[];
  watch: RefObject<HTMLElement | null>;  // the hero box to observe
  poster?: string;
}) {
  const [floating, setFloating] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [muted, setMuted] = useState(true);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dismRef = useRef(false); dismRef.current = dismissed;
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  // Float when the watched hero scrolls out of view (same threshold as FilmHeroReel).
  useEffect(() => {
    const el = watch.current;
    if (!el || !videos.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e.isIntersecting) setFloating(false);
        else if (!dismRef.current) setFloating(true);
      },
      { threshold: 0, rootMargin: "-72px 0px 0px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [watch, videos.length]);

  const postYT = (func: string) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*");
  };
  const toggleMute = () => {
    postYT(muted ? "unMute" : "mute");
    setMuted((m) => !m);
  };

  // Drag the float by its handle (copied from FilmHeroReel).
  const onDragDown = (e: ReactPointerEvent) => {
    const el = frameRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    const move = (ev: PointerEvent) => {
      if (!drag.current || !frameRef.current) return;
      const w = frameRef.current.offsetWidth, h = frameRef.current.offsetHeight;
      const x = Math.max(6, Math.min(window.innerWidth - w - 6, ev.clientX - drag.current.dx));
      const y = Math.max(6, Math.min(window.innerHeight - h - 6, ev.clientY - drag.current.dy));
      setPos({ x, y });
    };
    const up = () => { drag.current = null; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  if (!videos.length || dismissed || !floating) return null;

  const ids = videos.map((v) => v.id);
  // Plain reel: first clip, looped playlist chains the rest; enablejsapi for mute toggle.
  const src = `https://www.youtube-nocookie.com/embed/${ids[0]}?autoplay=1&mute=1&controls=1&start=7&playsinline=1&rel=0&modestbranding=1&loop=1&playlist=${ids.join(",")}&enablejsapi=1`;
  const style: CSSProperties = {
    ...(poster ? { backgroundImage: `url(${poster})` } : {}),
    ...(pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : {}),
  };

  return (
    <div ref={frameRef} className="iv-frame iv-frame--float" style={style}>
      <iframe
        ref={iframeRef}
        className="ivd-yt"
        src={src}
        title={videos[0].title || "Trailer"}
        allow="autoplay; encrypted-media; picture-in-picture"
      />
      <div className="iv-drag" onPointerDown={onDragDown} title="Drag to move">⋮⋮ drag</div>
      <button type="button" className={`iv-mute${muted ? "" : " on"}`} onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
        {muted ? "🔇" : "🔊"}
      </button>
      <button type="button" className="iv-close" onClick={() => { setDismissed(true); setFloating(false); }} aria-label="Close floating video">×</button>
    </div>
  );
}
