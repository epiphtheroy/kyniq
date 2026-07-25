import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import BoardGrid from "@/components/odyssey/BoardGrid";
import "../odyssey/odyssey.css";
import "./board.css";

export const metadata: Metadata = {
  title: "Board — 시네필 영화 전체 조감",
  description:
    "메타테이크가 다루는 시네필 영화 약 2,000편을 바둑판으로 — 가로는 시대, 세로는 취향 분류. 본 영화·볼 영화·내 서비스로 색이 바뀌고, 필터로 좁혀 한눈에 조감합니다.",
  alternates: { canonical: "/board" },
  robots: { index: true, follow: true },
};

export default function BoardPage() {
  return (
    <>
      <SiteNav />
      <main>
        <header className="ody-hero" style={{ paddingBottom: 6 }}>
          <div className="seclbl">The board</div>
          <h1 className="disp">시네필 영화 전체를 한눈에</h1>
          <p className="standfirst">
            메타테이크가 다루는 시네필 영화 약 2,000편의 바둑판. 가로는 시대, 세로는 취향 분류.{" "}
            <b>본 영화·볼 영화·내 서비스</b>를 켜면 그 영화들에 색이 들어오고, 연도·장르로 좁히면 판이
            줄어듭니다. 영화에 마우스를 올리면 요약이 뜨고, 누르면 옆에 자세히 열립니다.{" "}
            <Link href="/journey" className="accent" style={{ textDecoration: "none", fontWeight: 600 }}>여정 제안 →</Link>{" "}
            <Link href="/odyssey" className="accent" style={{ textDecoration: "none", fontWeight: 600 }}>지도 →</Link>
          </p>
        </header>

        <BoardGrid />
        {/* Coverage (canon bars + auteur conquest) lives in My Room — linking
            instead of duplicating keeps this page's server HTML non-personalized
            (the embedded BoardCoverage was force-dynamic + auth, a breach of
            the invariant) and keeps one instrument in one place. */}
        <section className="ody-hero" style={{ paddingTop: 10, paddingBottom: 28 }}>
          <p className="standfirst">
            내 정전 커버리지와 감독 정복은{" "}
            <Link href="/room" className="accent" style={{ textDecoration: "none", fontWeight: 600 }}>
              마이룸에서 →
            </Link>
          </p>
        </section>
      </main>
    </>
  );
}
