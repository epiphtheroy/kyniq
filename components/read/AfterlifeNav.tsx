"use client";

/**
 * AfterlifeNav — sticky chronology navigation for /film/[slug]/reception
 * (2026-07-08). Two rails of year pills (film-page menu-bar grammar: colored
 * badges, scroll-spy, smooth anchor scroll) + a mode row that collects one
 * entry type across all years (All / Releases / Honors / Reviews /
 * Scholarship). Filtering is DOM-level (ListFilter grammar): entries carry
 * data-af, year cards carry data-af-year; empty year cards hide and their
 * pills dim, so every mode stays a coherent timeline.
 */
import { useEffect, useRef, useState } from "react";

export type AfnYear = { id: string; label: string; n: number; color: string };
export type AfnMode = { key: string; label: string; n: number; color: string };

export default function AfterlifeNav({ years, modes }: { years: AfnYear[]; modes: AfnMode[] }) {
  const barRef = useRef<HTMLElement>(null);
  const [navH, setNavH] = useState(0);
  const [active, setActive] = useState(years[0]?.id ?? "");
  const [mode, setMode] = useState("all");
  const [emptyIds, setEmptyIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const measure = () => {
      const nav = document.querySelector("header.nav, .mt-nav") as HTMLElement | null;
      setNavH(nav ? Math.round(nav.getBoundingClientRect().height) : 0);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const bar = barRef.current;
        const offset = (bar ? bar.getBoundingClientRect().bottom : navH) + 14;
        let cur = years[0]?.id ?? "";
        for (const y of years) {
          const el = document.getElementById(y.id);
          if (el && el.style.display !== "none" && el.getBoundingClientRect().top <= offset) cur = y.id;
        }
        setActive(cur);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [years, navH]);

  const jump = (e: React.MouseEvent, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    const barH = barRef.current ? barRef.current.offsetHeight : 0;
    const top = el.getBoundingClientRect().top + window.scrollY - navH - barH - 10;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    history.replaceState(null, "", `#${id}`);
  };

  const applyMode = (m: string) => {
    setMode(m);
    document.querySelectorAll<HTMLElement>("[data-af]").forEach((el) => {
      el.style.display = m === "all" || el.dataset.af === m ? "" : "none";
    });
    const empty = new Set<string>();
    document.querySelectorAll<HTMLElement>("[data-af-year]").forEach((sec) => {
      const any = [...sec.querySelectorAll<HTMLElement>("[data-af]")].some((e) => e.style.display !== "none");
      sec.style.display = any ? "" : "none";
      if (!any) empty.add(sec.id);
    });
    setEmptyIds(empty);
  };

  const mid = Math.ceil(years.length / 2);
  const rows = years.length > 6 ? [years.slice(0, mid), years.slice(mid)] : [years];

  return (
    <nav ref={barRef} className="afn" style={{ top: navH }} aria-label="Timeline navigation">
      {rows.map((row, i) => (
        <div key={i} className="afn__row">
          {row.map((y) => (
            <a
              key={y.id}
              href={`#${y.id}`}
              onClick={(e) => jump(e, y.id)}
              className={`afn__y${active === y.id ? " active" : ""}${emptyIds.has(y.id) ? " off" : ""}`}
              style={{ "--bc": y.color } as React.CSSProperties}
              aria-current={active === y.id ? "true" : undefined}
            >
              {y.label}<span className="afn__n">{y.n}</span>
            </a>
          ))}
        </div>
      ))}
      <div className="afn__modes" role="tablist" aria-label="Collect one record type">
        {modes.filter((m) => m.n > 0 || m.key === "all").map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={mode === m.key}
            className={`afn__m${mode === m.key ? " active" : ""}`}
            style={{ "--bc": m.color } as React.CSSProperties}
            onClick={() => applyMode(m.key)}
          >
            {m.label}{m.key !== "all" ? <span className="afn__n">{m.n}</span> : null}
          </button>
        ))}
      </div>
    </nav>
  );
}
