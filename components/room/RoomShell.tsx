"use client";
/** My Room v3 shell (The Terminal) — app bar + 3-group rail + on-demand inspector.
 *  - Rail: SESSION / PORTFOLIO / RESEARCH from lib/room/nav.ts (single source
 *    with CmdK PAGES). Items are real <Link>s (middle-click / prefetch / a11y).
 *  - App bar: logo → /room · ⌘K trigger · NAV chip (score + tier + 30-day micro
 *    sparkline; click opens the Performance-summary inspector — it NEVER links
 *    to the Ledger) · Brief (text ≥1180px) · Refresh · avatar → /u/me.
 *    Breadcrumb deleted (zero information).
 *  - Providers mounted here: Inspector + SessionStore + Toast (single host). */
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PRIMARY_DOORS, MORE_DOORS } from "@/lib/room/nav";
import { STR } from "./strings";
import { InspectorProvider, useInspector } from "./InspectorContext";
import { SessionStoreProvider } from "./SessionStore";
import { ToastProvider } from "./Toast";
import ICard from "./insp/ICard";
import KV from "./insp/KV";
import CmdK from "./CmdK";

export type NavChip = {
  nav: number | null;
  tier: string;
  /** me_nav_history(30) NAV values, oldest → today (fetched once in layout). */
  spark: number[];
  /** me_portfolio_nav composition for the summary inspector (null = not formed). */
  watched?: number | null;
  scored?: number | null;
  essentials?: number | null;
  avgStanding?: number | null;
  lines?: number | null;
};
export type RailCounts = { collection?: number; watchlist?: number };

/** Inline micro sparkline (no axes — a pulse, not a chart). Hidden under 2 points. */
function Spark({ values, w = 64, h = 18 }: { values: number[]; w?: number; h?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (w - 2) + 1).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4) + 1).toFixed(1)}`).join(" ");
  return (
    <svg className="spk" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline points={pts} fill="none" stroke="var(--safe)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** NAV-chip click target: the Performance summary (composition + covenant).
 *  Links ONLY to Performance — never to the Ledger (spec §1 risk fix). */
function NavSummary({ chip }: { chip: NavChip }) {
  return (
    <div>
      <ICard icon="ti-chart-line" title="NAV" right={chip.tier}>
        <div className="bigscore">{chip.nav ?? "—"}</div>
        <div style={{ margin: "8px 0 10px" }}><Spark values={chip.spark} w={200} h={36} /></div>
        <KV k="Films seen" v={chip.watched ?? "—"} />
        <KV k="Scored" v={chip.scored ?? "—"} />
        <KV k="Essentials" v={chip.essentials ?? "—"} />
        <KV k="Avg standing" v={chip.avgStanding ?? "—"} />
        <KV k="Lines touched" v={chip.lines ?? "—"} />
        <div className="relcard" style={{ marginTop: 8 }}>{STR.common.navCovenant}</div>
      </ICard>
      <Link className="actbtn" href="/room/performance" style={{ display: "block", textAlign: "center", fontSize: 11.5 }}>
        {STR.shell.openPerformance}
      </Link>
    </div>
  );
}

/** On-demand inspector — slide-over (backdrop · ESC · X · 1-depth back). */
function InspectorPanel() {
  const insp = useInspector();
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") insp.close(); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [insp]);
  return (
    <>
      <div className={`insp-overlay${insp.open ? " on" : ""}`} onClick={insp.close} />
      <aside className={`insp-panel${insp.open ? " on" : ""}`} role="dialog" aria-modal="true" aria-label={insp.title}>
        <div className="insphd">
          {insp.canBack ? <span className="chv" onClick={insp.back} title={STR.shell.back}><i className="ti ti-arrow-left" /></span> : null}
          <span className="ti-tit">{insp.title}</span>
          <span className="chv" onClick={insp.close} title={STR.shell.close}><i className="ti ti-x" /></span>
        </div>
        <div className="col-scroll">
          <div className="inspbody">
            {insp.content ?? <div className="emptyins">{STR.shell.inspectorEmpty}</div>}
          </div>
        </div>
      </aside>
    </>
  );
}

/** App-bar "Brief" button — opens the page summary registered via setDefault. */
function BriefButton() {
  const insp = useInspector();
  if (!insp.hasDefault) return null;
  return (
    <span className="iconbtn briefbtn" onClick={insp.openDefault} title={STR.shell.briefTitle}>
      <i className="ti ti-layout-sidebar-right-expand" />
      <span className="tx">{STR.shell.brief}</span>
    </span>
  );
}

function NavChipButton({ chip }: { chip: NavChip }) {
  const insp = useInspector();
  return (
    <div
      className="navchip clk"
      role="button"
      tabIndex={0}
      title={STR.shell.navChipTitle}
      onClick={() => insp.select(<NavSummary chip={chip} />, STR.shell.navSummaryTitle)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); insp.select(<NavSummary chip={chip} />, STR.shell.navSummaryTitle); } }}
    >
      <span className="eb">NAV</span>
      <span className="n">{chip.nav ?? "—"}</span>
      <span className="l">{chip.tier}</span>
      <Spark values={chip.spark} />
    </div>
  );
}

export default function RoomShell({
  children, chip, counts,
}: {
  children: ReactNode; chip: NavChip; counts: RailCounts;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [cmdk, setCmdk] = useState(false);
  const [more, setMore] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdk((v) => !v); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);
  useEffect(() => { setMore(false); }, [pathname]); // close More on navigation

  const door = (it: (typeof PRIMARY_DOORS)[number]) => {
    const on = pathname.startsWith(it.href);
    const ct = it.countKey ? counts[it.countKey] : undefined;
    return (
      <Link key={it.href} className={`rb-door${on ? " on" : ""}`} href={it.href} title={it.label}>
        {it.label}
        {ct != null ? <span className="ct">{ct}</span> : null}
      </Link>
    );
  };

  return (
    /* v4 (HANDOFF-마이룸-v4 §1): the room lives UNDER the global SiteNav in
       normal document flow — no fixed-inset takeover, footer visible again.
       The 15-item rail is replaced by a slim sticky room bar: [My Room] + six
       primary doors + More (everything else) + NAV chip / Brief / profile.
       .room-root stays outermost so the room CSS token scope still applies. */
    <div className="room-root room-v4">
      <InspectorProvider>
        <SessionStoreProvider>
          <ToastProvider>
            {/* ROOM BAR — slim, sticky under the site nav */}
            <div className="roombar">
              <Link className={`rb-home${pathname === "/room" ? " on" : ""}`} href="/room">My Room</Link>
              <nav className="rb-doors" aria-label={STR.shell.railAria}>
                {PRIMARY_DOORS.map(door)}
                <span className="rb-more">
                  <button type="button" className={`rb-door rb-morebtn${more ? " on" : ""}`} aria-expanded={more} onClick={() => setMore((v) => !v)}>
                    More <i className="ti ti-chevron-down" />
                  </button>
                  {more ? (
                    <span className="rb-moremenu" role="menu">
                      {MORE_DOORS.map((it) => (
                        <Link key={it.href} role="menuitem" className={`rb-mitem${pathname.startsWith(it.href) ? " on" : ""}`} href={it.href}>
                          <i className={`ti ${it.icon}`} /> {it.label}
                        </Link>
                      ))}
                      <Link role="menuitem" className="rb-mitem" href="/me/import"><i className="ti ti-download" /> {STR.shell.railImport}</Link>
                    </span>
                  ) : null}
                </span>
              </nav>
              <div className="abright">
                <NavChipButton chip={chip} />
                <BriefButton />
                <span className="iconbtn" onClick={() => setCmdk(true)} title={STR.cmdk.placeholder}><i className="ti ti-search" /></span>
                <span className="iconbtn" onClick={() => router.refresh()} title={STR.shell.refresh}><i className="ti ti-refresh" /></span>
                <a className="ava ser" href="/u/me" title={STR.shell.publicProfile}>me</a>
              </div>
            </div>

            {/* MAIN — normal flow (v4 CSS neutralizes the old fixed shell) */}
            <div className="shell">
              <main className="col main"><div className="col-scroll">{children}</div></main>
            </div>

            <InspectorPanel />
            <CmdK open={cmdk} onClose={() => setCmdk(false)} />
          </ToastProvider>
        </SessionStoreProvider>
      </InspectorProvider>
    </div>
  );
}
