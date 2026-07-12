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
import CopyForAI from "@/components/CopyForAI";
import DownloadPackModal from "@/components/DownloadPackModal";
import { PACK_SECTION_BY_TAB, PACK_SECTION_LABEL } from "@/lib/pack";

export type FilmTab = { id: string; label: string; href?: string; badge?: string | number; badgeTone?: "score"; color?: string; zone?: "free" | "spoiler" };
export type ZoneLabels = { free: { title: string; sub: string }; spoiler: { title: string; sub: string } };
const DEFAULT_ZONE_LABELS: ZoneLabels = {
  free: { title: "Spoiler-free", sub: "before you watch" },
  spoiler: { title: "Spoilers", sub: "after you watch" },
};

// Per-section accent for the badge + chip. Keyed by the section anchor id; muted,
// print-ink versions (legible on the light bar), one family per section.
const TAB_COLOR: Record<string, string> = {
  "df-readings": "#D64534", "df-figures": "#B8863B", "df-tropes": "#12897A", "df-connected": "#2F6DB0",
  "df-lineage": "#C1802A", "df-atlas": "#2E7D9E", "df-reception": "#4E7088", "df-recby": "#B85C9E",
  "df-curious": "#C87A2C", "df-counterpoints": "#C56A44", "df-archetype": "#6B4E9E", "df-watchnext": "#2E8B6E",
  "df-whywatch": "#6E7BA6", "df-daily": "#8A6D3B", "df-codex": "#0F6E56", "df-watch": "#3F7E8C",
  "df-crew": "#6B7280", "df-credits": "#6B7280", "df-network": "#5A6B86", "df-invitation": "#5A6B86",
  "df-information": "#5A6B86", "df-gallery": "#6B7280", "df-digest": "#5A6B86",
};
const DEFAULT_TAB_COLOR = "#5A6B86";

export default function FilmTabBar({ tabs, twoRow = false, center = false, search, zoneLabels = DEFAULT_ZONE_LABELS, packSlug, packDownload = false }: {
  tabs: FilmTab[]; twoRow?: boolean;
  // Theory pages (2026-07-08): center the single-row bar, and carry an
  // in-page search box that drives the page's explorers via a CustomEvent.
  center?: boolean;
  search?: { event: string; targetId: string; placeholder?: string };
  // Two-row spoiler zoning (2026-07-09): top rail = spoiler-free (before you
  // watch), bottom rail = spoilers (after). Tabs split by their `zone`.
  zoneLabels?: ZoneLabels;
  // Context packs (2026-07-12): when packSlug is set, tabs that map to a pack
  // section get a compact "✦ AI" copy button next to the label, and (if
  // packDownload) a whole-film download control sits at the bottom rail's far right.
  packSlug?: string;
  packDownload?: boolean;
}) {
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

  // Available pack sections on this film (deduped), for the download selector.
  const packSecs = packSlug
    ? Array.from(new Map(
        tabs
          .filter((t) => !t.href && PACK_SECTION_BY_TAB[t.id])
          .map((t) => {
            const k = PACK_SECTION_BY_TAB[t.id];
            return [k, { key: k, label: PACK_SECTION_LABEL[k] }] as const;
          })
      ).values())
    : [];

  const renderTab = (t: FilmTab) => {
    const bc = t.color ?? TAB_COLOR[t.id] ?? DEFAULT_TAB_COLOR;
    const style = { "--bc": bc } as CSSProperties;
    const badge = t.badge != null && t.badge !== "" ? (
      <span className={`df-tab__b${t.badgeTone === "score" ? " df-tab__b--score" : ""}`}>{t.badge}</span>
    ) : null;
    if (t.href) {
      return (
        <Link key={t.id} href={t.href} data-tab={t.id} data-mt={`tab:${t.id}`} className="df-tab df-tab--link" style={style}>
          <span className="df-tab__t">{t.label}</span>{badge}
        </Link>
      );
    }
    const anchor = (withKey: boolean) => (
      <a
        key={withKey ? t.id : undefined}
        href={`#${t.id}`}
        data-tab={t.id}
        data-mt={`tab:${t.id}`}
        className={`df-tab${active === t.id ? " active" : ""}`}
        aria-current={active === t.id ? "true" : undefined}
        onClick={(e) => onClick(e, t.id)}
        style={style}
      >
        <span className="df-tab__t">{t.label}</span>{badge}
      </a>
    );
    // Invitation deliberately carries no copy mark (owner request); it stays a
    // downloadable section in the selector.
    const sk = packSlug && t.id !== "df-invitation" ? PACK_SECTION_BY_TAB[t.id] : undefined;
    if (!sk) return anchor(true); // unchanged DOM for non-pack tabs (director pages included)
    return (
      <span key={t.id} style={{ display: "inline-flex", alignItems: "center", gap: 2, flex: "0 0 auto" }}>
        {anchor(false)}
        <CopyForAI slug={packSlug!} section={sk} variant="tab" />
      </span>
    );
  };

  if (twoRow) {
    // Zoned split (spoiler-free / spoilers) when tabs carry a `zone`; otherwise
    // fall back to the old halve-by-count layout (no labels).
    const zoned = tabs.some((t) => t.zone);
    const rails: { key: string; kind: "free" | "spoiler" | "none"; items: FilmTab[] }[] = zoned
      ? [
          { key: "free", kind: "free" as const, items: tabs.filter((t) => t.zone !== "spoiler") },
          { key: "spoiler", kind: "spoiler" as const, items: tabs.filter((t) => t.zone === "spoiler") },
        ].filter((r) => r.items.length)
      : (() => {
          const mid = Math.ceil(tabs.length / 2);
          return [tabs.slice(0, mid), tabs.slice(mid)]
            .filter((r) => r.length)
            .map((items, i) => ({ key: `r${i}`, kind: "none" as const, items }));
        })();
    return (
      <nav ref={barRef} className={`df-tabs df-tabs--menu${zoned ? " df-tabs--zoned" : ""}`} style={{ top: navH }} aria-label="Sections on this page">
        {rails.map((rail, i) => (
          <div key={rail.key} className={`df-tabs__rail${i === 1 ? " df-tabs__rail--b" : ""}${rail.kind !== "none" ? ` df-tabs__rail--${rail.kind}` : ""}`}>
            {rail.kind !== "none" ? (
              <span className={`df-tabs__zlab df-tabs__zlab--${rail.kind}`}>
                <b>{zoneLabels[rail.kind].title}</b>
                <em>{zoneLabels[rail.kind].sub}</em>
              </span>
            ) : null}
            <div className="df-tabs__scroll">
              <div className="df-tabs__row">
                {rail.items.map(renderTab)}
                {/* Download control lives INSIDE the row so it scrolls with the tabs. */}
                {packDownload && packSlug && packSecs.length > 0 && i === rails.length - 1 ? (
                  <DownloadPackModal slug={packSlug} sections={packSecs} variant="rail" />
                ) : null}
              </div>
              <div className="df-tabs__track" aria-hidden="true"><i className="df-tabs__thumb" /></div>
            </div>
          </div>
        ))}
      </nav>
    );
  }

  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const barH = barRef.current ? barRef.current.offsetHeight : 0;
    const top = el.getBoundingClientRect().top + window.scrollY - navH - barH - 10;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  };

  return (
    <nav ref={barRef} className="df-tabs" style={{ top: navH }} aria-label="Sections on this page">
      <div className={`df-tabs__in${center ? " df-tabs__in--center" : ""}`}>
        {tabs.map(renderTab)}
        {search ? (
          <input
            className="df-tabs__q"
            type="search"
            placeholder={search.placeholder ?? "Search this page…"}
            aria-label={search.placeholder ?? "Search this page"}
            onChange={(e) => window.dispatchEvent(new CustomEvent(search.event, { detail: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); jumpTo(search.targetId); } }}
            onFocus={() => { /* keep context — jump happens on Enter */ }}
          />
        ) : null}
      </div>
    </nav>
  );
}
