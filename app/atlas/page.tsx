import type { Metadata } from "next";
import SiteNav from "@/components/home2/SiteNav";
import FilmMap from "@/components/FilmMap";

// Static shell: all data loads client-side from /api/geo, so the page itself
// is prerendered and served from the edge (no per-request SSR needed).

export const metadata: Metadata = {
  title: "Atlas — the real-world map of cinema · Metatake",
  description: "Every place Metatake's films are set in and name, geolocated on a world map. Move the map and click a pin to read what the place means in its film.",
  alternates: { canonical: "/atlas" },
};

export default function AtlasPage() {
  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap" style={{ maxWidth: 1320 }}>
        <div className="mt-crumb">Atlas</div>
        <h1 className="th-h1">The Atlas of cinema</h1>
        <p className="th-sub">Every place our films are set in and name, geolocated. Browse films in the panel, click one to frame it on the map, click a pin to read what the place means in its film. (This is the world map — for the critical web of figures &amp; ideas, see <a href="/map">Connections</a>.)</p>
        <FilmMap endpoint="/api/geo" height={700} search panelSide="left" />
      </div>
    </div>
  );
}
