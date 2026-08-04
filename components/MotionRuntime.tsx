"use client";

/**
 * MotionRuntime — the small amount of JavaScript the image fade-in needs.
 *
 * Ported from the app per HANDOFF-앱에서-웹으로-이식.md §1.4 rank 2. CSS alone
 * cannot know when an <img> has decoded, so this marks each one as it lands and
 * app/motion.css does the rest. Mounted once in the root layout; it covers all
 * 228 <img> tags across 122 files without any of them changing.
 *
 * Everything happens in an effect, after hydration, and that ordering is the
 * whole design:
 *
 *   · A blocking script that marked images before React hydrated produced a
 *     hydration mismatch on every cached poster — React compares the DOM it
 *     finds against the props it rendered, and any attribute or class added in
 *     between is a diff. Worse with a class: the next render that touches
 *     className drops the mark, the image never fires `load` again because it
 *     is already decoded, and the poster stays invisible for good.
 *   · Sweeping the already-decoded images BEFORE raising the gate means nothing
 *     that is already on screen ever blinks off. An image still in flight is a
 *     blank box, so hiding that one costs nothing to look at.
 *   · The images this fade is actually for are the lazy ones further down the
 *     page, which load long after hydration either way.
 *
 * §1.3 rule 3 — it must not break when it fails. Nothing is hidden unless this
 * component mounted, so a crawler, a blocked bundle or a render error all see
 * plain visible images; the web already had seven hand-rolled copies of this
 * fade with an unconditional `opacity: 0` and no fallback, which is exactly the
 * accident the app hit. Past that, four paths can still reveal an image: load,
 * error, the sweep of anything already `complete`, and a 2.5s forced sweep (the
 * same fallback timer the app uses).
 *
 * Opt out with `data-mo-skip` on the <img>. `.sh-img` (StillHero, which runs
 * its own cross-fade) is excluded in CSS.
 */

import { useEffect } from "react";

export default function MotionRuntime() {
  useEffect(() => {
    const doc = document;
    const mark = (img: HTMLImageElement) => img.setAttribute("data-mo-in", "");

    /** `force` is the last resort: reveal even what has not loaded, so a
     *  request that neither resolves nor errors cannot leave a hole. Lazy
     *  images are exempt — they are off screen and have not been asked for
     *  yet, so they keep their fade for when they scroll into view. */
    const sweep = (force: boolean) => {
      const imgs = doc.getElementsByTagName("img");
      for (let i = 0; i < imgs.length; i++) {
        const img = imgs[i];
        if (img.hasAttribute("data-mo-in")) continue;
        if (img.complete || (force && img.loading !== "lazy")) mark(img);
      }
    };

    sweep(false);                                        // then raise the gate,
    doc.documentElement.setAttribute("data-mo", "on");   // never the other way

    const hit = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t && t.tagName === "IMG") mark(t as HTMLImageElement);
    };
    // `load` does not bubble, so listen in the capture phase.
    doc.addEventListener("load", hit, true);
    doc.addEventListener("error", hit, true);

    const onShow = () => sweep(false);   // bfcache restore
    addEventListener("pageshow", onShow);
    const timer = window.setTimeout(() => sweep(true), 2500);

    return () => {
      doc.removeEventListener("load", hit, true);
      doc.removeEventListener("error", hit, true);
      removeEventListener("pageshow", onShow);
      clearTimeout(timer);
    };
  }, []);

  return null;
}
