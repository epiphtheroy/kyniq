import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Nav = { nav: number | null; essentials?: number; lines?: number; avg_standing?: number | null; n_watched?: number };
type Wwi = { slug: string; title: string; year: number | null; wwi: number; ts: number | null; tier: string | null };

export default async function RoomHome() {
  const supabase = await createClient();
  const [{ data: navRaw }, { data: wwiRaw }] = await Promise.all([
    supabase.rpc("me_portfolio_nav"),
    supabase.rpc("me_recommend_wwi", { p_lambda: 1.0, p_limit: 1 }),
  ]);
  const nav = (navRaw as Nav | null) ?? null;
  const today = ((wwiRaw as Wwi[] | null) ?? [])[0] ?? null;

  return (
    <div className="mainpad">
      <h1 className="secttl">현황 · 커맨드센터</h1>
      <p className="secsub">내 영화적 자산의 하루를 여는 대시보드 — 자산 총량 · 오늘 볼 한 편 · 무엇을 하면 되나.</p>

      {/* NAV hero */}
      <div className="mod"><div className="modbody" style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div className="eb">Portfolio index · NAV</div>
          <div className="bigscore" style={{ fontSize: 48 }}>{nav?.nav ?? "—"}</div>
        </div>
        <div className="kpis" style={{ flex: 1, margin: 0 }}>
          <div className="kpi"><div className="kl">필수작 관람</div><div className="kn">{nav?.essentials ?? "—"}</div><div className="ks">정전가 ≥ 70</div></div>
          <div className="kpi"><div className="kl">계보 라인</div><div className="kn">{nav?.lines ?? "—"}</div><div className="ks">정전·수상·국가</div></div>
          <div className="kpi"><div className="kl">평균 정전가</div><div className="kn">{nav?.avg_standing != null ? Math.round(nav.avg_standing) : "—"}</div><div className="ks">내 보유작</div></div>
          <div className="kpi"><div className="kl">보유(관람)</div><div className="kn">{nav?.n_watched ?? "—"}</div><div className="ks">자산 편수</div></div>
        </div>
      </div></div>

      {/* Today's one */}
      {today ? (
        <div className="mod"><div className="modh"><span className="mt ser">오늘의 한 편</span><span className="eb" style={{ marginLeft: "auto" }}>최대 WWI · 취향+정전+신뢰도</span></div>
          <div className="modbody" style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div><div className="wwi"><div className="pv" style={{ color: "#86b9ec", fontSize: 30 }}>{today.wwi}</div><div className="pl">WWI</div></div></div>
            <div style={{ flex: 1 }}>
              <div className="ser" style={{ fontSize: 20 }}>{today.title} <span style={{ color: "var(--mut)", fontSize: 13 }}>{today.year ?? ""}</span></div>
              <div style={{ color: "var(--mut)", fontSize: 12, marginTop: 3 }}>TakeScore {today.ts ?? "—"} · 신뢰도 {today.tier ?? "—"}</div>
            </div>
            <Link className="actbtn pri" style={{ maxWidth: 150 }} href={`/room/film/${today.slug}`}>Cinecodex 평가 →</Link>
          </div>
        </div>
      ) : null}

      {/* Shortcuts */}
      <div className="kpis">
        <Link href="/room/watchlist" className="kpi" style={{ textDecoration: "none" }}><div className="kl"><i className="ti ti-target-arrow" /> 볼 영화 · 추천</div><div className="ks" style={{ marginTop: 8 }}>WWI 후보 데스크 · 위험 거르기 · λ 다이얼 →</div></Link>
        <Link href="/room/collection" className="kpi" style={{ textDecoration: "none" }}><div className="kl"><i className="ti ti-list-details" /> 보유 영화</div><div className="ks" style={{ marginTop: 8 }}>자산 거래소 · 정전가 + Cinecodex 나란히 · 2축 뱃지 →</div></Link>
      </div>

      <p className="secsub" style={{ marginTop: 8 }}>커버리지 매트릭스 · 블라인드 · 별자리 · 5전략 데스크는 다음 단계에서 이 화면에 채워집니다.</p>
    </div>
  );
}
