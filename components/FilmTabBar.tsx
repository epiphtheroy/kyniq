"use client";

/**
 * FilmTabBar — sticky section navigation for the film / director pages.
 * Anchor links (SEO-safe: all sections stay rendered); sticks just below the global nav;
 * highlights the section currently in view; click smooth-scrolls with the right offset.
 *
 * `twoRow` renders the film-page "section menu": a light, colour-coded bar (deliberately
 * unlike the dark global nav) on two slightly-offset rails. Each rail scrolls left/right
 * with a visible, draggable track; the active tab auto-centres. Every tab carries its
 * section count as a colour-tinted badge (TakeScore carries the score). The single-row
 * default (director page) is unchanged.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";

export type FilmTab = { id: string; label: string; href?: string; badge?: string | number; badgeTone?: "score"; color?: string };

// Per-section accent for the badge + chip. Keyed by the section anchor id; muted,
// print-ink versions (legible on the light bar), one family per section.
const TAB_COLOR: Record<string, string> = {
  "df-readings": "#D64534", "df-figures": "#B8863B", "df-tropes": "#12897A", "df-connected": "#2F6DB0",
  "df-lineage": "#C1802A", "df-atlas": "#2E7D9E", "df-reception": "#4E7088", "df-recby": "#B85C9E",
  "df-curious": "#C87A2C", "df-counterpoints": "#C56A44", "df-archetype": "#6B4E9E", "df-watchnext": "#2E8B6E",
  "df-whywatch": "#6E7BA6", "df-daily": "#8A6D3B", "df-codex": "#0F6E56", "df-watch": "#3F7E8C",
  "df-crew": "#6B7280", "df-credits": "#6B7280", "df-map": "#5A6B86", "df-invitation": "#5A6B86",
  "df-information": "#5A6B86", "df-gallery": "#6B7280", "df-digest": "#5A6B86",
};
const DEFAULT_TAB_COLOR = "#5A6B86";

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

  // Keep the active tab centred within its own rail as the reader scrolls the page.
  useEffect(() => {
    if (!twoRow || !active) return;
    const bar = barRef.current;
    if (!bar) return;
    const el = bar.querySelector<HTMLElement>(`[data-tab="${CSS.escape(active)}"]`);
    const rail = el?.closest<HTMLElement>(".df-tabs__row");
    if (!el || !rail) return;
    const target = el.offsetLeft - rail.clientWidth / 2 + el.clientWidth / 2;
    rail.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [active, twoRow]);

  // Visible + draggable scroll rail: size/position each row's thumb from its scroll
  // metrics, hide the track when the row fits, and let the thumb be dragged.
  useEffect(() => {
    if (!twoRow) return;
    const bar = barRef.current;
    if (!bar) return;
    const cleanups: Array<() => void> = [];
    bar.querySelectorAll<HTMLElement>(".df-tabs__rail").forEach((rail) => {
      const row = rail.querySelector<HTMLElement>(".df-tabs__row");
      const track = rail.querySelector<HTMLElement>(".df-tabs__track");
      const thumb = rail.querySelector<HTMLElement>(".df-tabs__thumb");
      if (!row || !track || !thumb) return;
      const update = () => {
        const sw = row.scrollWidth, cw = row.clientWidth;
        if (sw <= cw + 2) { track.style.display = "none"; return; }
        track.style.display = "block";
        const widthPct = Math.max(14, (cw / sw) * 100);
        const maxScroll = sw - cw;
        const p = maxScroll > 0 ? row.scrollLeft / maxScroll : 0;
        thumb.style.width = `${widthPct}%`;
        thumb.style.left = `${p * (100 - widthPct)}%`;
      };
      update();
      row.addEventListener("scroll", update, { passive: true });
      const ro = new ResizeObserver(update);
      ro.observe(row);
      let startX = 0, startScroll = 0, dragging = false;
      const onDown = (e: PointerEvent) => {
        dragging = true; startX = e.clientX; startScroll = row.scrollLeft;
        thumb.setPointerCapture(e.pointerId); e.preventDefault();
      };
      const onMove = (e: PointerEvent) => {
        if (!dragging) return;
        const ratio = row.scrollWidth / Math.max(1, track.clientWidth);
        row.scrollLeft = startScroll + (e.clientX - startX) * ratio;
      };
      const onUp = () => { dragging = false; };
      thumb.addEventListener("pointerdown", onDown);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      cleanups.push(() => {
        row.removeEventListener("scroll", update); ro.disconnect();
        thumb.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      });
    });
    return () => cleanups.forEach((fn) => fn());
  }, [twoRow, tabs]);

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
    const bc = t.color ?? TAB_COLOR[t.id] ?? DEFAULT_TAB_COLOR;
    const style = { "--bc": bc } as CSSProperties;
    const badge = t.badge != null && t.badge !== "" ? (
      <span className={`df-tab__b${t.badgeTone === "score" ? " df-tab__b--score" : ""}`}>{t.badge}</span>
    ) : null;
    return t.href ? (
      <Link key={t.id} href={t.href} data-tab={t.id} className="df-tab df-tab--link" style={style}>
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
        style={style}
      >
        <span className="df-tab__t">{t.label}</span>{badge}
      </a>
    );
  };

  if (twoRow) {
    const mid = Math.ceil(tabs.length / 2);
    const rows = [tabs.slice(0, mid), tabs.slice(mid)].filter((r) => r.length);
    return (
      <nav ref={barRef} className="df-tabs df-tabs--menu" style={{ top: navH }} aria-label="Sections on this page">
        {rows.map((row, i) => (
          <div key={i} className={`df-tabs__rail${i === 1 ? " df-tabs__rail--b" : ""}`}>
            <div className="df-tabs__row">{row.map(renderTab)}</div>
            <div className="df-tabs__track" aria-hidden="true"><i className="df-tabs__thumb" /></div>
          </div>
        ))}
      </nav>
    );
  }

  return (
    <nav ref={barRef} className="df-tabs" style={{ top: navH }} aria-label="Sections on this page">
      <div className="df-tabs__in">{tabs.map(renderTab)}</div>
    </nav>
  );
}
