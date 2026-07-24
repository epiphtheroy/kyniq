import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import MetatakeDeck from "@/components/odyssey/MetatakeDeck";
import "../odyssey/odyssey.css";
import "../odyssey/deck.css";

// The journey proposal — the actual navigation. Static shell; the deck is a
// client component that reads the map artifact and the viewer's seen films.

export const metadata: Metadata = {
  title: "여정 — 시네필이 되는 다음 한 편",
  description:
    "좋은 영화 목록이 아니라, 지금 당신에게 맞는 다음 한 편. Metatake가 안정·모험·전혀 새로운 세 방향으로 안 본 영화를 펼쳐 줍니다 — 당신의 취향, 서비스, 연도와 장르에 맞춰.",
  alternates: { canonical: "/journey" },
  robots: { index: true, follow: true },
};

export default function JourneyPage() {
  return (
    <>
      <SiteNav />
      <main>
        <header className="ody-hero" style={{ paddingBottom: 4 }}>
          <div className="seclbl">The journey</div>
          <h1 className="disp">시네필이 되는 여정</h1>
          <p className="standfirst">
            좋은 영화 목록이 아니라, 지금 당신에게 맞는 <b>다음 한 편</b>. 버튼을 누르면 안정·모험·전혀
            새로운 세 방향으로 안 본 영화가 펼쳐집니다. 전체 지도가 보고 싶다면{" "}
            <Link href="/odyssey" className="accent" style={{ textDecoration: "none", fontWeight: 600 }}>
              Odyssey 지도 →
            </Link>
          </p>
        </header>

        <MetatakeDeck />
      </main>
    </>
  );
}
