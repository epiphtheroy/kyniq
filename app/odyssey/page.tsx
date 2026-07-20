import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import OdysseyGalaxy from "@/components/odyssey/OdysseyGalaxy";
import MetatakeDeck from "@/components/odyssey/MetatakeDeck";
import mapData from "@/public/odyssey/map.v1.json";
import type { OdyMap } from "@/lib/odyssey/types";
import "./odyssey.css";
import "./deck.css";

// Fully static: the map is a compile-time artifact (public/odyssey/map.v1.json,
// built by worker/odyssey-build.py). Personalization — seen films, streaming
// availability — is a client-side overlay in OdysseyMap; the served HTML is
// identical for everyone.

const map = mapData as unknown as OdyMap;
const siteUrl = "https://metatake.net";

export const metadata: Metadata = {
  title: "Odyssey — the cinephile film map",
  description:
    "A metro map of cinephile cinema: 1,959 films as stations, movements and genres as lines, decades as geography. See where you stand, pick a destination mode, and ride line by line without a failed night.",
  alternates: { canonical: "/odyssey" },
  robots: { index: true, follow: true },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "Metatake Odyssey — cinephile film map",
  url: `${siteUrl}/odyssey`,
  description:
    "A curated transit-map model of cinephile cinema: films as stations, movements and genres as lines.",
  creator: { "@type": "Organization", name: "Metatake", url: siteUrl, "@id": `${siteUrl}/#org` },
};

export default function OdysseyPage() {
  const lines = map.lines;
  const nOnLine = map.stations.filter((s) => s.ln?.length).length;
  return (
    <>
      <SiteNav />
      <main>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <header className="ody-hero">
          <div className="seclbl">Odyssey</div>
          <h1 className="disp">시네필이 되는 여정</h1>
          <p className="standfirst">
            좋은 영화 목록이 아니라, 지금 당신에게 맞는 <b>다음 한 편</b>. 버튼을 누르면 세 방향의 길이
            펼쳐지고, 아래 지도는 그 여정이 놓인 영화의 전경입니다.
          </p>
        </header>

        <MetatakeDeck />

        <div className="ody-hero" style={{ paddingTop: 8 }}>
          <div className="seclbl">The atlas</div>
          <h2 className="disp" style={{ fontSize: "1.5rem" }}>영화 전경 지도</h2>
          <p className="standfirst">
            시대(가로)와 취향(세로)으로 펼친 {map.stations.length.toLocaleString()}편의 지도. {lines.length}개
            운동·장르가 길로 지나갑니다 — 영화를 누르면 그 노선이 켜지고, ⌘/Ctrl+드래그로 기울여 길을
            따라갈 수 있습니다.
          </p>
        </div>

        <OdysseyGalaxy />

        <section className="ody-index" aria-label="All lines">
          <h2>Every line on the network</h2>
          <p className="sub">
            {nOnLine.toLocaleString()} of {map.stations.length.toLocaleString()} stations sit on a
            named line; the rest are local stops you reach by wandering the map. Each line is a
            chronological journey you can ride film by film.
          </p>
          <div className="cols">
            {lines.map((l) => (
              <div className="li" key={l.id}>
                <span className="dot" style={{ background: l.color }} />
                <Link href={`/odyssey/line/${l.id}`}>{l.name_en}</Link>
                <span className="n">{l.stations.length} stops</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
