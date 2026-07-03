"use client";
/** The operating-system shell (HANDOFF §2). 4 columns — rail / main / inspector / activity —
 *  invariant across every /room page; only the center + inspector content change.
 *  Collapse persists per-column in localStorage. Provides InspectorProvider. */
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { InspectorProvider, useInspector } from "./InspectorContext";
import CmdK from "./CmdK";

export type NavChip = { nav: number | null; tier: string; up?: string | null };
export type RailCounts = { collection?: number; watchlist?: number; pair?: number };
export type SystemStatus = { scored: number | null; model: string | null; taste: number | null };

const NAV: { sec: string; items: { label: string; icon: string; href: string; key?: keyof RailCounts }[] }[] = [
  { sec: "자산 운영", items: [
    { label: "현황 · 커맨드센터", icon: "ti-dashboard", href: "/room" },
    { label: "보유 영화", icon: "ti-list-details", href: "/room/collection", key: "collection" },
    { label: "볼 영화 · 추천", icon: "ti-target-arrow", href: "/room/watchlist", key: "watchlist" },
    { label: "운용 데스크", icon: "ti-briefcase", href: "/room/desk" },
    { label: "자산 분석", icon: "ti-chart-arcs", href: "/room/analysis" },
    { label: "지리 Atlas", icon: "ti-map-2", href: "/room/atlas" },
    { label: "감독 정복", icon: "ti-crown", href: "/room/auteurs" },
  ]},
  { sec: "기록 · 교류", items: [
    { label: "기록 · 평가", icon: "ti-star", href: "/room/rate" },
    { label: "서재", icon: "ti-books", href: "/room/library" },
    { label: "노트 · 글쓰기", icon: "ti-feather", href: "/room/write" },
    { label: "동행", icon: "ti-users", href: "/room/pair", key: "pair" },
    { label: "공개 프로필", icon: "ti-id-badge", href: "/u/me" },
  ]},
];

// Collapsed state persists in localStorage; if unset, auto-collapse when the
// viewport is narrower than `collapseBelow` so all columns fit on first load.
function useSticky(key: string, collapseBelow = 0) {
  const [v, setV] = useState(false);
  useEffect(() => {
    const s = localStorage.getItem(key);
    if (s != null) setV(s === "1");
    else if (collapseBelow > 0 && typeof window !== "undefined") setV(window.innerWidth < collapseBelow);
  }, [key, collapseBelow]);
  const toggle = () => setV((p) => { const n = !p; localStorage.setItem(key, n ? "1" : "0"); return n; });
  return [v, toggle] as const;
}

function InspectorCol({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const insp = useInspector();
  return (
    <aside className={`col inspector${collapsed ? " collapsed" : ""}`}>
      <div className="insphd">
        <span className="chv" onClick={onToggle}><i className="ti ti-layout-sidebar-right-collapse" /></span>
        <span className="ti-tit">{insp.title}</span>
      </div>
      <div className="col-scroll">
        <div className="inspbody">
          {insp.content ?? <div className="emptyins">항목을 선택하면 상세와 근거가 여기 표시됩니다.</div>}
        </div>
      </div>
    </aside>
  );
}

const CRUMB: Record<string, string> = {
  "/room": "현황 · 커맨드센터", "/room/collection": "보유 영화", "/room/watchlist": "볼 영화 · 추천",
  "/room/desk": "운용 데스크", "/room/analysis": "자산 분석", "/room/atlas": "지리 Atlas", "/room/auteurs": "감독 정복", "/room/rate": "기록 · 평가",
  "/room/library": "서재", "/room/write": "노트", "/room/pair": "동행",
};

export default function RoomShell({
  children, chip, counts, ticker, system,
}: {
  children: ReactNode; chip: NavChip; counts: RailCounts;
  ticker: { icon?: string; text: string }[];
  system?: SystemStatus;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const crumb = CRUMB[pathname] ?? (pathname.startsWith("/room/film") ? "평가 카드" : "커맨드센터");
  const [railC, toggleRail] = useSticky("mt_rail", 820);
  const [inspC, toggleInsp] = useSticky("mt_inspector", 1180);
  const [actC, toggleAct] = useSticky("mt_activity", 1440);
  const [cmdk, setCmdk] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdk((v) => !v); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <InspectorProvider>
      <div className="room-root">
        {/* APP BAR */}
        <div className="appbar">
          <span className="logo" onClick={() => router.push("/room")} style={{ cursor: "pointer" }}>META TAKE</span>
          <div className="crumb"><b>{crumb}</b></div>
          <div className="cmdk" onClick={() => setCmdk(true)}><i className="ti ti-search" /><span>영화 · 페이지 검색</span><span className="kbd">⌘K</span></div>
          <div className="abright">
            <div className="navchip">
              <span className="eb">NAV</span>
              <span className="n">{chip.nav ?? "—"}</span>
              <span className="l">{chip.tier}</span>
              {chip.up ? <span className="up">{chip.up}</span> : null}
            </div>
            <span className="iconbtn" onClick={() => router.refresh()}><i className="ti ti-refresh" /></span>
            <span className="ava ser">나</span>
          </div>
        </div>

        {/* TICKER */}
        <div className="ticker">
          <span className="tag">LIVE</span>
          <div className="vp"><div className="run">
            {[...ticker, ...ticker].map((t, i) => (
              <span key={i}><i className="ti dot ti-point-filled" />{t.text}</span>
            ))}
          </div></div>
        </div>

        {/* SHELL */}
        <div className="shell">
          {/* RAIL */}
          <nav className={`col rail${railC ? " collapsed" : ""}`}>
            <div className="col-scroll" style={{ display: "flex", flexDirection: "column" }}>
              <div className="railhd"><span className="eb">운영 메뉴</span><span className="chv" onClick={toggleRail}><i className="ti ti-layout-sidebar-left-collapse" /></span></div>
              {NAV.map((s) => (
                <div className="navsec" key={s.sec}>
                  <div className="navlbl">{s.sec}</div>
                  {s.items.map((it) => {
                    const on = it.href === "/room" ? pathname === "/room" : pathname.startsWith(it.href);
                    const ct = it.key ? counts[it.key] : undefined;
                    return (
                      <div key={it.href} className={`nv${on ? " on" : ""}`} onClick={() => router.push(it.href)} title={it.label}>
                        <i className={`ti lead ${it.icon}`} />
                        <span className="tx">{it.label}</span>
                        {ct != null ? <span className="ct">{ct}</span> : null}
                      </div>
                    );
                  })}
                </div>
              ))}
              <div className="railft">영화적 자산 운영 시스템 · Metatake</div>
            </div>
          </nav>

          {/* MAIN */}
          <main className="col main"><div className="col-scroll">{children}</div></main>

          {/* INSPECTOR */}
          <InspectorCol collapsed={inspC} onToggle={toggleInsp} />

          {/* ACTIVITY */}
          <aside className={`col activity${actC ? " collapsed" : ""}`}>
            <div className="acthd"><span className="pulse" /><span className="t">라이브 피드</span><span className="chv" onClick={toggleAct}><i className="ti ti-layout-sidebar-right-collapse" /></span></div>
            <div className="col-scroll"><div className="actbody">
              {ticker.map((t, i) => (
                <div className="feeditem" key={i}><span className="fi"><i className={`ti ${t.icon ?? "ti-point-filled"}`} /></span><div className="fb"><div className="ft">{t.text}</div></div></div>
              ))}
              <div className="acard"><h4>시스템 상태</h4>
                <div className="stat"><span>Cinecodex 채점</span><b>{system?.scored != null ? `${system.scored.toLocaleString("ko-KR")}편` : "—"}</b></div>
                <div className="stat"><span>정전가 모델</span><b>{system?.model ?? "—"}</b></div>
                <div className="stat"><span>취향 벡터</span><b>{system?.taste != null ? `${system.taste.toLocaleString("ko-KR")}편` : "—"}</b></div>
              </div>
            </div></div>
          </aside>
        </div>

        <CmdK open={cmdk} onClose={() => setCmdk(false)} />
      </div>
    </InspectorProvider>
  );
}
