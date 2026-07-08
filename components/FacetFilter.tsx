"use client";

import { useState } from "react";

/**
 * FacetFilter — chip row that shows/hides [data-facet] items inside #targetId
 * (UCN facet axis, surfaced 2026-07-08). Family sections ([data-family]) with
 * no visible pills collapse too. Pure DOM visibility; no URL state.
 */
export default function FacetFilter({
  targetId,
  facets,
}: {
  targetId: string;
  facets: { key: string; label: string; n: number }[];
}) {
  const [active, setActive] = useState<string>("");

  const apply = (key: string) => {
    setActive(key);
    const root = document.getElementById(targetId);
    if (!root) return;
    root.querySelectorAll<HTMLElement>("[data-facet]").forEach((el) => {
      el.style.display = !key || el.dataset.facet === key ? "" : "none";
    });
    root.querySelectorAll<HTMLElement>("[data-family]").forEach((sec) => {
      const any = [...sec.querySelectorAll<HTMLElement>("[data-facet]")].some(
        (el) => el.style.display !== "none"
      );
      sec.style.display = any ? "" : "none";
    });
  };

  return (
    <div className="cat-pills" style={{ margin: "10px 0 4px" }} role="group" aria-label="Filter by facet">
      <button
        type="button"
        className="cat-pill"
        onClick={() => apply("")}
        style={active === "" ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}
      >
        All facets
      </button>
      {facets.map((f) => (
        <button
          type="button"
          key={f.key}
          className="cat-pill"
          onClick={() => apply(f.key)}
          style={active === f.key ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}
        >
          {f.label}
          <span className="cat-pill__n">{f.n}</span>
        </button>
      ))}
    </div>
  );
}
