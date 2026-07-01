import type { Metadata } from "next";
import SiteNav from "@/components/home2/SiteNav";
import FilmMap from "@/components/FilmMap";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Atlas — the real-world map of cinema · Metatake",
  description: "Every place Metatake's films are set in and name, geolocated on a world map. Move the map and click a pin to read what the place means in its film.",
  alternates: { canonical: "/atlas" },
};

export default function AtlasPage() {
  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap" style={{ maxWidth: 1180 }}>
        <div className="mt-crumb">Atlas</div>
        <h1 className="th-h1">The Atlas of cinema</h1>
        <p className="th-sub">Every place our films are set in and name, geolocated. Move the map; click a pin to read what the place means in its film. (This is the world map — for the critical web of figures &amp; ideas, see <a href="/map">Connections</a>.)</p>
        <FilmMap endpoint="/api/geo" height={640} search satelliteDefault />
      </div>
    </div>
  );
}
