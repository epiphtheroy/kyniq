"use client";

/**
 * ListFilter — instant client-side narrowing of an ALREADY server-rendered list
 * (keeps SSR/SEO: all links stay in the HTML). Operates on a container by id:
 *   • every row has   data-filter-item data-filter-text="<lowercased searchable>"
 *   • every group has data-filter-group, with a [data-filter-count] badge inside
 * Hides non-matching rows, hides emptied groups, live-updates per-group counts.
 */

import { useEffect, useState } from "react";

export default function ListFilter({
  targetId, placeholder, total, listenEvent,
}: {
  targetId: string; placeholder?: string; total?: number;
  // The sticky tab bar's in-page search drives this filter too (CustomEvent).
  listenEvent?: string;
}) {
  const [q, setQ] = useState("");
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    if (!listenEvent) return;
    const onQ = (e: Event) => setQ(String((e as CustomEvent).detail ?? ""));
    window.addEventListener(listenEvent, onQ);
    return () => window.removeEventListener(listenEvent, onQ);
  }, [listenEvent]);

  useEffect(() => {
    const root = document.getElementById(targetId);
    if (!root) return;
    const term = q.trim().toLowerCase();
    let visible = 0;
    root.querySelectorAll<HTMLElement>("[data-filter-item]").forEach((el) => {
      const hit = !term || (el.dataset.filterText || "").includes(term);
      el.style.display = hit ? "" : "none";
      if (hit) visible++;
    });
    root.querySelectorAll<HTMLElement>("[data-filter-group]").forEach((g) => {
      const items = Array.from(g.querySelectorAll<HTMLElement>("[data-filter-item]"));
      const gShown = items.filter((e) => e.style.display !== "none").length;
      g.style.display = gShown ? "" : "none";
      const badge = g.querySelector<HTMLElement>("[data-filter-count]");
      if (badge) badge.textContent = String(gShown);
    });
    setShown(term ? visible : null);
  }, [q, targetId]);

  return (
    <div className="lf">
      <input
        className="lf-input"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder || "Filter this list…"}
        aria-label="Filter this list"
        autoComplete="off"
      />
      {shown !== null && (
        <span className="lf-count">{shown} shown{total ? ` of ${total}` : ""}</span>
      )}
    </div>
  );
}
