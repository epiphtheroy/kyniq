"use client";

/**
 * FilmTabBar — sticky section navigation for the film detail page.
 * Anchor links (SEO-safe: all sections stay rendered); sticks just below the global nav;
 * highlights the section currently in view; click smooth-scrolls with the right offset.
 * Mobile: horizontally scrollable.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Tab = { id: string; label: string; href?: string };

export default function FilmTabBar({ tabs }: { tabs: Tab[] }) {
  const barRef = useRef<HTMLElement>(null);
  const [navH, setNavH] = useState(0);
  const [active, setActive] = useState(tabs[0]?.id ?? "");

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
        let cur = tabs[0]?.id ?? "";
        for (const t of tabs) {
          const el = document.getElementById(t.id);
          if (el && el.getBoundingClientRect().top <= offset) cur = t.id;
        }
        setActive(cur);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [tabs, navH]);

  const onClick = (e: React.MouseEvent, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    const barH = barRef.current ? barRef.current.offsetHeight : 0;
    const top = el.getBoundingClientRect().top + window.scrollY - navH - barH - 10;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <nav ref={barRef} className="df-tabs" style={{ top: navH }} aria-label="Sections on this page">
      <div className="df-tabs__in">
        {tabs.map((t) => (
          t.href ? (
            <Link key={t.id} href={t.href} className="df-tab df-tab--link">
              {t.label}
            </Link>
          ) : (
            <a
              key={t.id}
              href={`#${t.id}`}
              className={`df-tab${active === t.id ? " active" : ""}`}
              aria-current={active === t.id ? "true" : undefined}
              onClick={(e) => onClick(e, t.id)}
            >
              {t.label}
            </a>
          )
        ))}
      </div>
    </nav>
  );
}
