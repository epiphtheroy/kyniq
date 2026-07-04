import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import FilmMap from "@/components/FilmMap";
import { pageRobots } from "@/lib/seo";
import { FILM_LOCATIONS_MIN, citiesForCountry, countryPhrase, listWords, loadAtlasCountry, type AtlasCountry } from "@/lib/atlas";

/**
 * /atlas/[slug] — country hub, the READ layer for "movies filmed in X"
 * (docs/PLAN-atlas-seo.md Phase 2). Server prose + the full film list; the
 * live map (scoped to this country via /api/geo?country=) plays below.
 * Gate: ≥3 films and ≥3 pins in the country, else 404 — a hub must have a
 * shelf's worth of films, not be a doorway page.
 */
export const revalidate = 86400;
export async function generateStaticParams() { return []; }

function load(slug: string) {
  return unstable_cache(
    async () => {
      const c = await loadAtlasCountry(slug);
      if (!c || c.films.length < 3 || c.pins < 3) return null;
      return c;
    },
    ["atlas-country", slug],
    { revalidate: 86400 },
  )();
}

function leadText(c: AtlasCountry): string {
  const marks = c.landmarks.filter((m) => m.films >= 2).slice(0, 2).map((m) => m.name);
  const span = c.films.map((f) => f.year).filter((y): y is number => !!y);
  const years = span.length > 1 ? ` (${Math.min(...span)}–${Math.max(...span)})` : "";
  const sentences = [
    `${c.films.length} films on Metatake were shot on location in ${countryPhrase(c.country)}${years} — ${c.pins} mapped places in all.`,
  ];
  if (marks.length) sentences.push(`Filmmakers keep returning to ${listWords(marks)}.`);
  sentences.push("Each film below links to its own location page, with the scene every place carries.");
  return sentences.join(" ");
}

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await load(slug);
  if (!c) return { title: "Not found" };
  const title = `Movies Filmed in ${countryPhrase(c.country)} — ${c.films.length} Films, ${c.pins} Locations`;
  const description = leadText(c);
  return {
    title,
    description,
    alternates: { canonical: `/atlas/${slug}` },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
    robots: pageRobots(c.films.length >= 3 && c.pins >= 3),
  };
}

export default async function AtlasCountryPage({ params }: Props) {
  const { slug } = await params;
  const c = await load(slug);
  if (!c) notFound();
  const updated = new Date().toISOString().slice(0, 10);
  const lead = leadText(c);
  const returnedTo = c.landmarks.filter((m) => m.films >= 2);
  const cities = citiesForCountry(slug);

  // Decade shelves, newest first; undated films sit at the end.
  const decades = new Map<string, AtlasCountry["films"]>();
  for (const f of c.films) {
    const key = f.year ? `${Math.floor(f.year / 10) * 10}s` : "Undated";
    decades.set(key, [...(decades.get(key) ?? []), f]);
  }
  const shelfOrder = [...decades.keys()].sort((a, b) => {
    if (a === "Undated") return 1;
    if (b === "Undated") return -1;
    return Number(b.slice(0, 4)) - Number(a.slice(0, 4));
  });
  for (const arr of decades.values()) arr.sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || b.pins - a.pins);

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Movies filmed in ${c.country}`,
    numberOfItems: c.films.length,
    itemListElement: c.films.slice(0, 100).map((f, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Movie",
        name: f.title,
        ...(f.year ? { datePublished: String(f.year) } : {}),
        ...(f.director ? { director: { "@type": "Person", name: f.director } } : {}),
        url: `https://metatake.net/film/${f.slug}`,
      },
    })),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://metatake.net" },
      { "@type": "ListItem", position: 2, name: "Atlas", item: "https://metatake.net/atlas" },
      { "@type": "ListItem", position: 3, name: c.country, item: `https://metatake.net/atlas/${slug}` },
    ],
  };
  const pageLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    url: `https://metatake.net/atlas/${slug}`,
    name: `Movies filmed in ${c.country}`,
    author: { "@type": "Organization", "@id": "https://metatake.net/#org", name: "Metatake" },
    editor: { "@type": "Person", "@id": "https://metatake.net/editor#person", name: "Wonwoo Yoon", url: "https://metatake.net/editor" },
    publisher: { "@type": "Organization", "@id": "https://metatake.net/#org", name: "Metatake" },
    dateModified: updated,
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageLd) }} />
      <div className="mt-wrap" style={{ maxWidth: 880, padding: "28px 20px 60px" }}>
        <div className="df-crumb" style={{ marginBottom: 14 }}>
          <Link href="/atlas">Atlas</Link>
          <span className="df-sep">›</span><span>{c.country}</span>
        </div>

        <h1 style={{ fontSize: 30, lineHeight: 1.18, margin: "2px 0 10px" }}>Movies filmed in {countryPhrase(c.country)}</h1>
        <p style={{ fontSize: 17, lineHeight: 1.6, maxWidth: "64ch", margin: 0 }}>{lead}</p>
        <a
          href="#map"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14,
            background: "#16233F", color: "#FBF8F1", padding: "9px 18px", borderRadius: 999,
            fontSize: 14, fontWeight: 600, textDecoration: "none", boxShadow: "0 1px 0 rgba(0,0,0,.15)",
          }}
        >
          <span aria-hidden style={{ color: "#E0922A" }}>◉</span>
          See {c.country} on the map ↓
        </a>

        {returnedTo.length > 0 && (
          <section style={{ margin: "30px 0" }}>
          <h2 className="df-h2">The places filmmakers return to</h2>
            <p className="df-sub">Locations in {countryPhrase(c.country)} that appear in more than one film on Metatake.</p>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.8 }}>
              {returnedTo.slice(0, 12).map((m) => (
                <li key={m.name}>
                  {m.name} <span style={{ opacity: 0.65 }}>— in {m.films} films</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {cities.length > 0 && (
          <section style={{ margin: "30px 0" }}>
            <h2 className="df-h2">Cities &amp; regions</h2>
            <p className="df-sub">Where in {countryPhrase(c.country)} the cameras stood — each with its own films, landmarks and map.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "6px 18px", marginTop: 10 }}>
              {cities.map((ct) => (
                <Link key={ct.slug} href={`/atlas/${slug}/${ct.slug}`} style={{ padding: "7px 0", borderBottom: "1px solid rgba(22,35,63,.08)" }}>
                  {ct.name} <span style={{ opacity: 0.6, fontSize: 13 }}>— {ct.films} films</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section style={{ margin: "30px 0" }}>
          <h2 className="df-h2">The films — decade by decade</h2>
          <p className="df-sub">Every film on Metatake with at least one mapped location in {countryPhrase(c.country)}, newest first.</p>
          {shelfOrder.map((decade) => (
            <div key={decade} style={{ margin: "18px 0 6px" }}>
              <h3 style={{ fontSize: 14, letterSpacing: ".04em", textTransform: "uppercase", opacity: 0.7, margin: "0 0 2px" }}>{decade}</h3>
              {decades.get(decade)!.map((f) => (
                <div key={f.slug} style={{ padding: "9px 0", borderBottom: "1px solid rgba(22,35,63,.08)" }}>
                  <Link href={`/film/${f.slug}`} style={{ fontWeight: 600 }}>{f.title}{f.year ? ` (${f.year})` : ""}</Link>
                  <span style={{ fontSize: 13.5, opacity: 0.7 }}>
                    {f.director ? <> — dir. {f.director_slug ? <Link href={`/director/${f.director_slug}`}>{f.director}</Link> : f.director}</> : null}
                    {f.top_location ? <> · {f.top_location}</> : null}
                  </span>
                  {f.pins >= FILM_LOCATIONS_MIN ? (
                    <span style={{ fontSize: 13.5 }}>
                      {" · "}
                      <Link href={`/film/${f.slug}/locations`}>{f.pins} locations →</Link>
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ))}
        </section>

        <section id="map" style={{ margin: "44px 0 0", borderTop: "2px solid #16233F", paddingTop: 6 }}>
          <h2 className="df-h2" style={{ marginTop: 18 }}>See {countryPhrase(c.country)} on the map</h2>
          <p className="df-sub">All mapped places in {countryPhrase(c.country)}, live. Click a pin to read what it means in its film.</p>
          <FilmMap endpoint={`/api/geo?country=${slug}`} height={560} />
        </section>

        <section style={{ margin: "30px 0 0" }}>
          <h2 className="df-h2">Keep exploring</h2>
          <p style={{ lineHeight: 1.9, margin: "6px 0 0" }}>
            <Link href="/atlas">The Atlas of cinema — every country, one map →</Link>
          </p>
        </section>

        <p style={{ fontSize: 12.5, opacity: 0.6, marginTop: 26 }}>
          Metatake Editorial · Location data compiled and geolocated by Metatake · Updated {updated}
        </p>
      </div>
    </div>
  );
}
