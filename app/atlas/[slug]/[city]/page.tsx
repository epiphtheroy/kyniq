import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import FilmMap from "@/components/FilmMap";
import { pageRobots } from "@/lib/seo";
import {
  FILM_LOCATIONS_MIN,
  cachedAtlasEligibility,
  cachedAtlasMeta,
  cachedCountryGeo,
  cityMemberPins,
  countryPhrase,
  findAtlasCity,
  listWords,
  mergePins,
  precisionRank,
  type AtlasCity,
  type GeoPin,
} from "@/lib/atlas";

/**
 * /atlas/[country]/[city] — city & region hubs, the READ layer for
 * "movies filmed in Paris / Manhattan / Hertfordshire"
 * (docs/PLAN-atlas-seo.md Phase 3). The roster is frozen in
 * lib/atlas_cities.json (≥3 films, geographically coherent, variants merged);
 * membership = locality-term match + proximity, computed live from the
 * country's pin dump. robots gate re-checks the ≥3-film bar as a belt against
 * roster/data drift.
 */
export const revalidate = 86400;
export async function generateStaticParams() { return []; }

type FilmGroup = { slug: string; title: string; year: number | null; pins: GeoPin[] };

async function loadUncached(countrySlug: string, citySlug: string) {
  const city = findAtlasCity(countrySlug, citySlug);
  if (!city) return null;
  const members = cityMemberPins(await cachedCountryGeo(countrySlug), city);
  const pins = mergePins(members);
  const byFilm = new Map<string, FilmGroup>();
  for (const p of pins) {
    if (!p.film_slug) continue;
    const g = byFilm.get(p.film_slug) ?? { slug: p.film_slug, title: p.film_title ?? p.film_slug, year: p.film_year ?? null, pins: [] };
    g.pins.push(p);
    byFilm.set(p.film_slug, g);
  }
  const films = [...byFilm.values()].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  if (!films.length) return null;
  // Places in this city used by more than one film — the "returned to" list.
  const byPlace = new Map<string, { name: string; films: Set<string> }>();
  for (const p of pins) {
    if (!p.film_slug || (p.kind !== "landmark" && p.kind !== "venue")) continue;
    const key = p.name.split(",")[0].trim();
    const e = byPlace.get(key.toLowerCase()) ?? { name: key, films: new Set<string>() };
    e.films.add(p.film_slug);
    byPlace.set(key.toLowerCase(), e);
  }
  const returnedTo = [...byPlace.values()]
    .filter((m) => m.films.size >= 2)
    .sort((a, b) => b.films.size - a.films.size)
    .slice(0, 12)
    .map((m) => ({ name: m.name, films: m.films.size }));
  const elig = await cachedAtlasEligibility();
  return {
    city, pins, films, returnedTo,
    eligibleFilmSlugs: elig.films.map((f) => f.slug),
    eligibleDirectorSlugs: elig.directors.map((d) => d.slug),
  };
}

function load(countrySlug: string, citySlug: string) {
  // Key bumped (2) when director fields/posters joined the pin payload.
  return unstable_cache(() => loadUncached(countrySlug, citySlug), ["atlas-city2", countrySlug, citySlug], {
    revalidate: 86400,
  })();
}

function leadText(city: AtlasCity, films: FilmGroup[], pinCount: number, returnedTo: { name: string }[]): string {
  const span = films.map((f) => f.year).filter((y): y is number => !!y);
  const years = span.length > 1 ? ` (${Math.min(...span)}–${Math.max(...span)})` : "";
  const inWord = city.scale === "city" ? "in and around" : "across";
  const sentences = [
    `${films.length} films on Metatake were shot ${inWord} ${city.name}, ${countryPhrase(city.country)}${years} — ${pinCount} mapped places in all.`,
  ];
  if (returnedTo.length) sentences.push(`Filmmakers keep returning to ${listWords(returnedTo.slice(0, 2).map((m) => m.name))}.`);
  sentences.push("Each film below links to its own location page, with the scene every place carries.");
  return sentences.join(" ");
}

interface Props { params: Promise<{ slug: string; city: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, city: citySlug } = await params;
  const data = await load(slug, citySlug);
  if (!data) return { title: "Not found" };
  const { city, films, pins, returnedTo } = data;
  const title = `Movies Filmed in ${city.name} — ${films.length} Films, ${pins.length} Locations`;
  const description = leadText(city, films, pins.length, returnedTo);
  return {
    title,
    description,
    alternates: { canonical: `/atlas/${slug}/${citySlug}` },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
    robots: pageRobots(films.length >= 3),
  };
}

const PER_FILM_SHOWN = 3;

export default async function AtlasCityPage({ params }: Props) {
  const { slug, city: citySlug } = await params;
  const data = await load(slug, citySlug);
  if (!data) notFound();
  const { city, pins, films, returnedTo, eligibleFilmSlugs, eligibleDirectorSlugs } = data;
  const eligible = new Set(eligibleFilmSlugs);
  const locDirectors = new Set(eligibleDirectorSlugs);
  const updated = (await cachedAtlasMeta()).updated || new Date().toISOString().slice(0, 10);
  const lead = leadText(city, films, pins.length, returnedTo);
  // Directors with ≥2 films shot here — the anti-catalog editorial layer.
  const byDirector = new Map<string, { name: string; slug: string | null; films: number }>();
  for (const f of films) {
    const d = f.pins[0]?.director;
    if (!d) continue;
    const e = byDirector.get(d) ?? { name: d, slug: f.pins[0]?.director_slug ?? null, films: 0 };
    e.films += 1;
    byDirector.set(d, e);
  }
  const returningDirectors = [...byDirector.values()].filter((d) => d.films >= 2).sort((a, b) => b.films - a.films).slice(0, 8);
  // Map scope: the members' own bounding box, padded.
  const lats = pins.map((p) => p.lat), lngs = pins.map((p) => p.lng);
  const bbox = [
    Math.max(-180, Math.min(...lngs) - 0.08), Math.max(-90, Math.min(...lats) - 0.08),
    Math.min(180, Math.max(...lngs) + 0.08), Math.min(90, Math.max(...lats) + 0.08),
  ].map((n) => n.toFixed(4)).join(",");

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Movies filmed in ${city.name}`,
    numberOfItems: films.length,
    itemListElement: films.slice(0, 100).map((f, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Movie",
        name: f.title,
        ...(f.year ? { datePublished: String(f.year) } : {}),
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
      { "@type": "ListItem", position: 3, name: city.country, item: `https://metatake.net/atlas/${slug}` },
      { "@type": "ListItem", position: 4, name: city.name, item: `https://metatake.net/atlas/${slug}/${citySlug}` },
    ],
  };
  const pageLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    url: `https://metatake.net/atlas/${slug}/${citySlug}`,
    name: `Movies filmed in ${city.name}`,
    about: {
      "@type": "Place",
      name: city.name,
      geo: { "@type": "GeoCoordinates", latitude: city.lat, longitude: city.lng },
      address: { "@type": "PostalAddress", addressCountry: city.country },
    },
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
          <span className="df-sep">›</span><Link href={`/atlas/${slug}`}>{city.country}</Link>
          <span className="df-sep">›</span><span>{city.name}</span>
        </div>

        <h1 style={{ fontSize: 30, lineHeight: 1.18, margin: "2px 0 10px" }}>Movies filmed in {city.name}</h1>
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
          See {city.name} on the map ↓
        </a>

        {returningDirectors.length > 0 && (
          <section style={{ margin: "30px 0" }}>
            <h2 className="df-h2">The directors who keep coming back</h2>
            <p className="df-sub">Filmmakers with more than one film shot in {city.name} on Metatake.</p>
            <p style={{ lineHeight: 2, margin: "6px 0 0" }}>
              {returningDirectors.map((d, i) => (
                <span key={d.name}>
                  {i > 0 ? " · " : ""}
                  {d.slug
                    ? <Link href={locDirectors.has(d.slug) ? `/director/${d.slug}/locations` : `/director/${d.slug}`}>{d.name}</Link>
                    : d.name}
                  <span style={{ opacity: 0.6, fontSize: 13.5 }}> ({d.films} films)</span>
                </span>
              ))}
            </p>
          </section>
        )}

        {returnedTo.length > 0 && (
          <section style={{ margin: "30px 0" }}>
            <h2 className="df-h2">The places filmmakers return to</h2>
            <p className="df-sub">Locations in {city.name} that appear in more than one film on Metatake.</p>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.8 }}>
              {returnedTo.map((m) => (
                <li key={m.name}>{m.name} <span style={{ opacity: 0.65 }}>— in {m.films} films</span></li>
              ))}
            </ul>
          </section>
        )}

        <section style={{ margin: "30px 0" }}>
          <h2 className="df-h2">The films — newest first</h2>
          <p className="df-sub">Every film on Metatake with a mapped location in {city.name}, and where in the city it stood.</p>
          {films.map((f) => {
            const shown = [...f.pins].sort((a, b) => precisionRank(a.precision) - precisionRank(b.precision)).slice(0, PER_FILM_SHOWN);
            const poster = f.pins[0]?.poster_path;
            return (
              <div key={f.slug} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 0", borderBottom: "1px solid rgba(22,35,63,.08)" }}>
                {poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <Link href={`/film/${f.slug}`} style={{ flexShrink: 0 }}>
                    <img src={`https://image.tmdb.org/t/p/w92${poster}`} alt={`${f.title} poster`} width={44} height={66} style={{ borderRadius: 5, objectFit: "cover", display: "block" }} loading="lazy" />
                  </Link>
                ) : null}
                <div>
                  <h3 style={{ margin: "0 0 3px", fontSize: 16.5 }}>
                    <Link href={`/film/${f.slug}`}>{f.title}{f.year ? ` (${f.year})` : ""}</Link>
                    {f.pins[0]?.director ? <span style={{ fontWeight: 400, fontSize: 13.5, opacity: 0.65 }}> — dir. {f.pins[0].director}</span> : null}
                  </h3>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, opacity: 0.85 }}>
                    {shown.map((p, i) => (
                      <span key={p.id}>{i > 0 ? " · " : ""}{p.name.split(",")[0].trim()}{p.narrative_setting ? ` (${p.narrative_setting.split(".")[0]})` : ""}</span>
                    ))}
                  </p>
                  {eligible.has(f.slug) ? (
                    <p style={{ margin: "3px 0 0", fontSize: 13.5 }}>
                      <Link href={`/film/${f.slug}/locations`}>Where was {f.title} filmed? All locations →</Link>
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </section>

        <section id="map" style={{ margin: "44px 0 0", borderTop: "2px solid #16233F", paddingTop: 6 }}>
          <h2 className="df-h2" style={{ marginTop: 18 }}>See {city.name} on the map</h2>
          <p className="df-sub">Every mapped place in this frame, live. Click a pin to read what it means in its film.</p>
          <FilmMap endpoint={`/api/geo?bbox=${bbox}`} height={520} />
        </section>

        <section style={{ margin: "30px 0 0" }}>
          <h2 className="df-h2">Keep exploring</h2>
          <p style={{ lineHeight: 1.9, margin: "6px 0 0" }}>
            <Link href={`/atlas/${slug}`}>Movies filmed in {countryPhrase(city.country)} — the country hub →</Link>
            <br /><Link href="/atlas">The Atlas of cinema — every country, one map →</Link>
          </p>
        </section>

        <p style={{ fontSize: 12.5, opacity: 0.6, marginTop: 26 }}>
          Metatake Editorial · Location data researched, compiled and geolocated by Metatake · Data updated {updated} · Corrections: <Link href="/methodology">methodology</Link>
        </p>
      </div>
    </div>
  );
}
