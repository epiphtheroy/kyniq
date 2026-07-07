"use client";

/**
 * FilmTabBar — sticky section navigation for the film / director pages.
 * Anchor links (SEO-safe: all sections stay rendered); sticks just below the global nav;
 * highlights the section currently in view; click smooth-scrolls with the right offset.
 *
 * Each tab may carry a `badge` (its section's count; TakeScore carries the score).
 * `twoRow` lays the tabs out on two slightly-offset rails, each scrollable left/right,
 * with the active tab auto-centring in its rail. Single-row default is unchanged.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export type FilmTab = { id: string; label: string; href?: string; badge?: string | number; badgeTone?: "score" };

export default function FilmTabBar({ tabs, twoRow = false }: { tabs: FilmTab[]; twoRow?: boolean }) {
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

  // Keep the active tab centred within its own rail as the reader scrolls the
  // page — the rails feel alive without moving the page itself.
  useEffect(() => {
    if (!twoRow || !active) return;
    const bar = barRef.current;
    if (!bar) return;
    const el = bar.querySelector<HTMLElement>(`[data-tab="${CSS.escape(active)}"]`);
    const rail = el?.parentElement;
    if (!el || !rail) return;
    const target = el.offsetLeft - rail.clientWidth / 2 + el.clientWidth / 2;
    rail.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [active, twoRow]);

  const onClick = (e: React.MouseEvent, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    const barH = barRef.current ? barRef.current.offsetHeight : 0;
    const top = el.getBoundingClientRect().top + window.scrollY - navH - barH - 10;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    history.replaceState(null, "", `#${id}`);
  };

  const renderTab = (t: FilmTab) => {
    const badge = t.badge != null && t.badge !== "" ? (
      <span className={`df-tab__b${t.badgeTone === "score" ? " df-tab__b--score" : ""}`}>{t.badge}</span>
    ) : null;
    return t.href ? (
      <Link key={t.id} href={t.href} data-tab={t.id} className="df-tab df-tab--link">
        <span className="df-tab__t">{t.label}</span>{badge}
      </Link>
    ) : (
      <a
        key={t.id}
        href={`#${t.id}`}
        data-tab={t.id}
        className={`df-tab${active === t.id ? " active" : ""}`}
        aria-current={active === t.id ? "true" : undefined}
        onClick={(e) => onClick(e, t.id)}
      >
        <span className="df-tab__t">{t.label}</span>{badge}
      </a>
    );
  };

  if (twoRow) {
    const mid = Math.ceil(tabs.length / 2);
    const rowA = tabs.slice(0, mid);
    const rowB = tabs.slice(mid);
    return (
      <nav ref={barRef} className="df-tabs df-tabs--two" style={{ top: navH }} aria-label="Sections on this page">
        <div className="df-tabs__row">{rowA.map(renderTab)}</div>
        {rowB.length ? <div className="df-tabs__row df-tabs__row--b">{rowB.map(renderTab)}</div> : null}
      </nav>
    );
  }

  return (
    <nav ref={barRef} className="df-tabs" style={{ top: navH }} aria-label="Sections on this page">
      <div className="df-tabs__in">{tabs.map(renderTab)}</div>
    </nav>
  );
}
