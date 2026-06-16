"use client";

/**
 * TakeExplorer — the "All takes" browser on a meta-take page.
 * A meta-take can gather 100+ cases that get buried in folders, so this adds:
 *  - an in-page search that filters rows across the active folder view and
 *    auto-opens folders that contain matches,
 *  - a 🎲 Random button that surfaces a random (visible) case: opens its folder,
 *    scrolls to it, and flashes it.
 * Both the genre and register groupings are rendered on the server and passed in;
 * filtering/random operate on whichever is shown (progressive enhancement on the DOM).
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export default function TakeExplorer({ total, genre, register }: { total: number; genre: ReactNode; register: ReactNode }) {
  const [by, setBy] = useState<"genre" | "register">("genre");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(total);
  const wrap = useRef<HTMLDivElement | null>(null);

  // (re)apply the current query whenever it changes or the view toggles
  useEffect(() => {
    const root = wrap.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-take-item]"));
    const folders = Array.from(root.querySelectorAll<HTMLDetailsElement>("details.mt-folder"));
    const query = q.trim().toLowerCase();

    if (!query) {
      items.forEach((it) => { it.style.display = ""; });
      folders.forEach((f) => { f.style.display = ""; f.open = false; });
      setShown(total);
      return;
    }
    let visible = 0;
    items.forEach((it) => {
      const match = (it.getAttribute("data-take-text") || "").includes(query);
      it.style.display = match ? "" : "none";
      if (match) visible++;
    });
    folders.forEach((f) => {
      const hasVisible = Array.from(f.querySelectorAll<HTMLElement>("[data-take-item]")).some((x) => x.style.display !== "none");
      f.style.display = hasVisible ? "" : "none";
      f.open = hasVisible;
    });
    setShown(visible);
  }, [q, by, total]);

  const randomPick = useCallback(() => {
    const root = wrap.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-take-item]")).filter((it) => it.style.display !== "none");
    if (!items.length) return;
    const pick = items[Math.floor(Math.random() * items.length)];
    const det = pick.closest("details.mt-folder") as HTMLDetailsElement | null;
    if (det) det.open = true;
    pick.scrollIntoView({ behavior: "smooth", block: "center" });
    root.querySelectorAll(".take-flash").forEach((el) => el.classList.remove("take-flash"));
    pick.classList.add("take-flash");
    window.setTimeout(() => pick.classList.remove("take-flash"), 1800);
  }, []);

  return (
    <>
      <div className="tx-bar">
        <input
          className="tx-input"
          type="search"
          placeholder={`Search ${total} takes…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search takes within this meta take"
        />
        <button type="button" className="tx-rnd" onClick={randomPick}>🎲 Random</button>
        <span className="tx-count">{q.trim() ? `${shown} of ${total}` : `${total} takes`}</span>
      </div>
      <div className="mt-fold-tabs" role="tablist" aria-label="Group takes by">
        <button type="button" role="tab" aria-selected={by === "genre"} className={by === "genre" ? "on" : ""} onClick={() => setBy("genre")}>By genre</button>
        <button type="button" role="tab" aria-selected={by === "register"} className={by === "register" ? "on" : ""} onClick={() => setBy("register")}>By register</button>
      </div>
      <div ref={wrap}>{by === "genre" ? genre : register}</div>
    </>
  );
}
