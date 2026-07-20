import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import OdysseyGalaxy from "@/components/odyssey/OdysseyGalaxy";
import mapData from "@/public/odyssey/map.v1.json";
import type { OdyMap } from "@/lib/odyssey/types";
import "./odyssey.css";

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
          <div className="seclbl">The map</div>
          <h1 className="disp">Odyssey</h1>
          <p className="standfirst">
            Cinephile cinema as a similarity galaxy: {map.stations.length.toLocaleString()} films
            drift into constellations by taste, the terrain rises where canon peaks cluster, and{" "}
            {lines.length} movements and genres thread across it as lines you can follow. Zoom in
            and the stars become posters; hover a line to trace its road; let a destination mode
            propose your next ride — the point is to travel far without a failed night.
          </p>
        </header>

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
