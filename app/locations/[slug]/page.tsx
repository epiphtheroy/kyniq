import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import EntityTVHero from "@/components/EntityTVHero";
import FilmMap from "@/components/FilmMap";
import LensQuickBar from "@/components/LensQuickBar";
import QuickAnswers, { type QuickAnswerItem } from "@/components/read/QuickAnswers";
import { pageRobots } from "@/lib/seo";
import { FILM_LOCATIONS_MIN, cachedLocationsEligibility, cachedLocationsMeta, citiesForCountry, countryPhrase, listWords, loadLocationsCountry, type LocationCountry } from "@/lib/locations";

/**
 * /locations/[slug] — country hub, the READ layer for "movies filmed in X"
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
      const c = await loadLocationsCountry(slug);
      if (!c || c.films.length < 3 || c.pins < 3) return null;
      return c;
    },
    // Key bumped (2) when film posters joined the RPC payload — the Data
    // Cache outlives deploys.
    ["locations-country2", slug],
    { revalidate: 86400 },
  )();
}

function leadText(c: LocationCountry): string {
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

// ── Quick answers (docs/PLAN-intent-coverage.md §0 charter + §5.7) ─────────
// Deterministic Q&A assembled ONLY from fields already in scope: a question is
// emitted only when its answer row is present, and every film, landmark, city
// and director name is verbatim from the country payload. The Atlas carries NO
// quality signal, so there is never a "best films in X" question — only counts,
// what/which and where. Search-term variants (filmed / shot / filming
// locations) are woven across Q and A, max two uses each: "filmed" carries
// Q1+Q3, "shot" carries Q2+Q5, "filming locations" carries A1+Q4.
function quickAnswerItems(
  c: LocationCountry,
  returnedTo: LocationCountry["landmarks"],
  cities: { name: string; films: number }[],
  returningDirectors: { name: string; films: number }[],
): QuickAnswerItem[] {
  const place = countryPhrase(c.country);
  const filmLabel = (f: LocationCountry["films"][number]) => `${f.title}${f.year ? ` (${f.year})` : ""}`;
  const items: QuickAnswerItem[] = [];

  items.push({
    q: `How many movies were filmed in ${place}?`,
    a: `${c.films.length} films, across ${c.pins} real filming locations in all.`,
  });

  if (c.films.length > 0) {
    const sample = [...c.films].sort((a, b) => b.pins - a.pins).slice(0, 4);
    items.push({
      q: `What movies were shot in ${place}?`,
      a: `Among them, ${listWords(sample.map(filmLabel))}.`,
    });
  }

  if (returnedTo.length > 0) {
    items.push({
      q: `What are the most-filmed locations in ${place}?`,
      a: `${listWords(returnedTo.slice(0, 3).map((m) => `${m.name} (in ${m.films} films)`))}.`,
    });
  }

  if (cities.length > 0) {
    const top = [...cities].sort((a, b) => b.films - a.films).slice(0, 4);
    items.push({
      q: `Which cities in ${place} are filming locations?`,
      a: `${listWords(top.map((ct) => ct.name))}.`,
    });
  }

  if (returningDirectors.length > 0) {
    items.push({
      q: `Which directors keep shooting in ${place}?`,
      a: `${listWords(returningDirectors.slice(0, 3).map((d) => d.name))} each return with more than one film here.`,
    });
  }

  return items.slice(0, 5);
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
    alternates: { canonical: `/locations/${slug}` },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
    robots: pageRobots(c.films.length >= 3 && c.pins >= 3),
  };
}

export default async function LocationsCountryPage({ params }: Props) {
  const { slug } = await params;
  const c = await load(slug);
  if (!c) notFound();
  const [meta, elig] = await Promise.all([cachedLocationsMeta(), cachedLocationsEligibility()]);
  const updated = meta.updated || new Date().toISOString().slice(0, 10);
  const lead = leadText(c);
  const returnedTo = c.landmarks.filter((m) => m.films >= 2);
  const cities = citiesForCountry(slug);
  // Directors with ≥2 films shot here — link into their own location pages.
  const locDirectors = new Set(elig.directors.map((d) => d.slug));
  const byDirector = new Map<string, { name: string; slug: string | null; films: number }>();
  for (const f of c.films) {
    if (!f.director) continue;
    const e = byDirector.get(f.director) ?? { name: f.director, slug: f.director_slug, films: 0 };
    e.films += 1;
    byDirector.set(f.director, e);
  }
  const returningDirectors = [...byDirector.values()].filter((d) => d.films >= 2).sort((a, b) => b.films - a.films).slice(0, 8);

  // Decade shelves, newest first; undated films sit at the end.
  const decades = new Map<string, LocationCountry["films"]>();
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
      { "@type": "ListItem", position: 2, name: "Locations", item: "https://metatake.net/locations" },
      { "@type": "ListItem", position: 3, name: c.country, item: `https://metatake.net/locations/${slug}` },
    ],
  };
  const pageLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    url: `https://metatake.net/locations/${slug}`,
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
          <Link href="/locations">Locations</Link>
          <span className="df-sep">›</span><span>{c.country}</span>
        </div>
        <EntityTVHero playlist={`country-${slug}`} reelSlugs={c.films.map((f) => f.slug)} label={countryPhrase(c.country)} listHref={`/tv/list/country-${slug}`} backdrop={null} />

        <h1 style={{ fontSize: 30, lineHeight: 1.18, margin: "2px 0 10px" }}>Movies filmed in {countryPhrase(c.country)}</h1>
        <p style={{ fontSize: 17, lineHeight: 1.6, maxWidth: "64ch", margin: 0 }}>{lead}</p>
        <QuickAnswers items={quickAnswerItems(c, returnedTo, cities, returningDirectors)} />
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
        <LensQuickBar />

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

        {returningDirectors.length > 0 && (
          <section style={{ margin: "30px 0" }}>
            <h2 className="df-h2">The directors who keep coming back</h2>
            <p className="df-sub">Filmmakers with more than one film shot in {countryPhrase(c.country)} on Metatake.</p>
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

        {cities.length > 0 && (
          <section style={{ margin: "30px 0" }}>
            <h2 className="df-h2">Cities &amp; regions</h2>
            <p className="df-sub">Where in {countryPhrase(c.country)} the cameras stood — each with its own films, landmarks and map.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "6px 18px", marginTop: 10 }}>
              {cities.map((ct) => (
                <Link key={ct.slug} href={`/locations/${slug}/${ct.slug}`} style={{ padding: "7px 0", borderBottom: "1px solid rgba(22,35,63,.08)" }}>
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
              <div className="mtl-rows">
              {decades.get(decade)!.map((f) => (
                <div key={f.slug} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "9px 0", borderBottom: "1px solid rgba(22,35,63,.08)" }}>
                  {f.poster_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <Link href={`/film/${f.slug}`} style={{ flexShrink: 0 }}>
                      <img src={`https://image.tmdb.org/t/p/w92${f.poster_path}`} alt={`${f.title} poster`} width={40} height={60} style={{ borderRadius: 5, objectFit: "cover", display: "block" }} loading="lazy" />
                    </Link>
                  ) : null}
                  <div>
                    <Link href={`/film/${f.slug}`} style={{ fontWeight: 600 }}>{f.title}{f.year ? ` (${f.year})` : ""}</Link>
                    <span style={{ fontSize: 13.5, opacity: 0.7 }}>
                      {f.director ? <> — dir. {f.director_slug ? <Link href={`/director/${f.director_slug}`}>{f.director}</Link> : f.director}</> : null}
                      {f.top_location ? <> · {f.top_location}</> : null}
                    </span>
                    {f.pins >= FILM_LOCATIONS_MIN ? (
                      <span style={{ fontSize: 13.5 }}>
                        {" · "}
                        <Link href={`/film/locations/${f.slug}`}>{f.pins} locations →</Link>
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
              </div>
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
            <Link href="/locations">The world map of cinema — every country, one map →</Link>
          </p>
        </section>

        <p style={{ fontSize: 12.5, opacity: 0.6, marginTop: 26 }}>
          Metatake Editorial · Location data researched, compiled and geolocated by Metatake · Data updated {updated} · Corrections: <Link href="/methodology">methodology</Link>
        </p>
      </div>
    </div>
  );
}
