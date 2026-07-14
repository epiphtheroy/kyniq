import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import FilmMap from "@/components/FilmMap";
import { cachedLocationsEligibility, cachedLocationsMeta } from "@/lib/locations";

// The map loads client-side from /api/geo (the play layer); the country grid
// below it is server-rendered at revalidation time (the read layer), so the
// page gives crawlers a real index of the country hubs.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Locations — the real-world map of cinema",
  description: "Every place Metatake's films are set in and name, geolocated on a world map — and browsable by country, from the United States to South Korea. Click a pin to read what the place means in its film.",
  alternates: { canonical: "/locations" },
};

export default async function LocationsPage() {
  const [{ countries }, meta] = await Promise.all([cachedLocationsEligibility(), cachedLocationsMeta()]);
  // First-party dataset declaration — this atlas is compiled by Metatake, not
  // syndicated; Dataset markup states that formally (name, size, freshness).
  const datasetLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Metatake Film Locations",
    url: "https://metatake.net/locations",
    description: `${meta.pins.toLocaleString()} geolocated film locations across ${meta.films.toLocaleString()} films, researched and compiled by Metatake Editorial from public sources (production records, press kits, encyclopedic references). Each location carries the scene it hosts, a precision label, and its source where on file; filmed places are kept distinct from the places a story claims as its setting.`,
    creator: { "@type": "Organization", "@id": "https://metatake.net/#org", name: "Metatake" },
    publisher: { "@type": "Organization", "@id": "https://metatake.net/#org", name: "Metatake" },
    ...(meta.updated ? { dateModified: meta.updated } : {}),
    isAccessibleForFree: true,
  };
  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetLd) }} />
      <div className="mt-wrap" style={{ maxWidth: 1320 }}>
        <div className="mt-crumb">Locations</div>
        <h1 className="th-h1">The world map of cinema</h1>
        <p className="th-sub">Every place our films are set in and name, geolocated. Browse films in the panel, click one to frame it on the map, click a pin to read what the place means in its film. (This is the world map — for the critical web of figures &amp; ideas, see <a href="/network">Connections</a>.)</p>
        <FilmMap endpoint="/api/geo" height={700} search panelSide="left" />

        <section style={{ margin: "40px 0 30px" }}>
          <h2 className="df-h2">Movies filmed in — country by country</h2>
          <p className="df-sub">The same map as readable pages: every country with at least three located films, each with its films, its returned-to landmarks and its own map.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: "6px 18px", marginTop: 12 }}>
            {countries.map((c) => (
              <Link key={c.slug} href={`/locations/${c.slug}`} style={{ padding: "7px 0", borderBottom: "1px solid rgba(22,35,63,.08)" }}>
                {c.name} <span style={{ opacity: 0.6, fontSize: 13 }}>— {c.films} films</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
