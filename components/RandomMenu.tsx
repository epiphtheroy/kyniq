"use client";

/** "🎲 Random ▾" dropdown in the nav — jump to a random film, meta-take, or take.
 *  prefetch is off so the redirect target is chosen at click time, not prefetch time. */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function RandomMenu() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <span className="rnd" ref={wrap}>
      <button type="button" className="rnd-btn" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        Random ▾
      </button>
      {open && (
        <div className="rnd-menu" role="menu">
          <Link href="/random/take" role="menuitem" prefetch={false} onClick={() => setOpen(false)}>A take</Link>
          <Link href="/random/meta-take" role="menuitem" prefetch={false} onClick={() => setOpen(false)}>A meta take</Link>
          <Link href="/random/film" role="menuitem" prefetch={false} onClick={() => setOpen(false)}>A film</Link>
        </div>
      )}
    </span>
  );
}
