"use client";
/** v2 셸 (2026-07-03 리뉴얼 — 데일리 루프 셸).
 *  4단(레일·본문·상시 인스펙터·라이브피드) → 레일 + 본문 + 온디맨드 인스펙터(슬라이드오버).
 *  - 라이브피드/LIVE 티커/시스템카드 삭제 (실데이터 감사: 정보가치 0)
 *  - 인스펙터: select() 호출 시에만 우측 슬라이드-인(<900px 바텀시트) · ESC/백드롭/X 닫기.
 *    setDefault 요약은 앱바 「요약」 버튼으로 열람(자동 오픈 없음 — 본문과 중복이므로).
 *  - 레일 12→9항목·3그룹(오늘/자산/기록실). desk는 /room에 흡수(redirect), 동행은 ⌘K로만,
 *    공개 프로필은 아바타로 이동. NAV chip · 카운트 뱃지 · ⌘K는 유지(자산 0클릭 확인). */
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { InspectorProvider, useInspector } from "./InspectorContext";
import CmdK from "./CmdK";

export type NavChip = { nav: number | null; tier: string; up?: string | null };
export type RailCounts = { collection?: number; watchlist?: number; pair?: number };

const NAV: { sec: string; items: { label: string; icon: string; href: string; key?: keyof RailCounts }[] }[] = [
  { sec: "오늘", items: [
    { label: "오늘 · 홈", icon: "ti-sun", href: "/room" },
    { label: "볼 영화 · 추천", icon: "ti-target-arrow", href: "/room/watchlist", key: "watchlist" },
    { label: "기록 · 평가", icon: "ti-star", href: "/room/rate" },
  ]},
  { sec: "자산", items: [
    { label: "보유 영화", icon: "ti-list-details", href: "/room/collection", key: "collection" },
    { label: "감독 정복", icon: "ti-crown", href: "/room/auteurs" },
    { label: "지리 Atlas", icon: "ti-map-2", href: "/room/atlas" },
    { label: "자산 분석", icon: "ti-chart-arcs", href: "/room/analysis" },
  ]},
  { sec: "기록실", items: [
    { label: "서재", icon: "ti-books", href: "/room/library" },
    { label: "노트 · 글쓰기", icon: "ti-feather", href: "/room/write" },
  ]},
];

// Collapsed state persists in localStorage; if unset, auto-collapse when the
// viewport is narrower than `collapseBelow` so the workspace fits on first load.
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

/** 온디맨드 인스펙터 — 슬라이드오버(백드롭·ESC·X 닫기). */
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
          <span className="ti-tit">{insp.title}</span>
          <span className="chv" onClick={insp.close} title="닫기 (ESC)"><i className="ti ti-x" /></span>
        </div>
        <div className="col-scroll">
          <div className="inspbody">
            {insp.content ?? <div className="emptyins">항목을 클릭하면 상세와 「왜」가 여기 열립니다.</div>}
          </div>
        </div>
      </aside>
    </>
  );
}

/** 앱바 「요약」 버튼 — setDefault로 등록된 페이지 요약을 온디맨드로 연다. */
function SummaryButton() {
  const insp = useInspector();
  if (!insp.hasDefault) return null;
  return (
    <span className="iconbtn" onClick={insp.openDefault} title="이 페이지 요약">
      <i className="ti ti-layout-sidebar-right-expand" />
    </span>
  );
}

const CRUMB: Record<string, string> = {
  "/room": "오늘 · 홈", "/room/collection": "보유 영화", "/room/watchlist": "볼 영화 · 추천",
  "/room/analysis": "자산 분석", "/room/atlas": "지리 Atlas", "/room/auteurs": "감독 정복", "/room/rate": "기록 · 평가",
  "/room/library": "서재", "/room/write": "노트", "/room/pair": "동행",
};

export default function RoomShell({
  children, chip, counts,
}: {
  children: ReactNode; chip: NavChip; counts: RailCounts;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const crumb = CRUMB[pathname] ?? (pathname.startsWith("/room/film") ? "평가 카드" : "오늘 · 홈");
  const [railC, toggleRail] = useSticky("mt_rail", 900);
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
            <SummaryButton />
            <span className="iconbtn" onClick={() => router.refresh()} title="새로고침"><i className="ti ti-refresh" /></span>
            <a className="ava ser" href="/u/me" title="공개 프로필">나</a>
          </div>
        </div>

        {/* SHELL — 레일 + 본문 (인스펙터는 온디맨드 오버레이) */}
        <div className="shell">
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

          <main className="col main"><div className="col-scroll">{children}</div></main>
        </div>

        <InspectorPanel />
        <CmdK open={cmdk} onClose={() => setCmdk(false)} />
      </div>
    </InspectorProvider>
  );
}
