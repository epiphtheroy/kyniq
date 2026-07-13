import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import EntityTVHero from "@/components/EntityTVHero";
import FilmMap from "@/components/FilmMap";
import ShareDock from "@/components/ShareDock";
import DirectorPlates from "@/components/read/DirectorPlates";
import "@/app/curious/curious.css";
import { pageRobots } from "@/lib/seo";
import {
  DIRECTOR_LOCATIONS_MIN_FILMS,
  DIRECTOR_LOCATIONS_MIN_PINS,
  FILM_LOCATIONS_MIN,
  cachedLocationsEligibility,
  cachedLocationsMeta,
  countryListPhrase,
  countryPhrase,
  countrySlug,
  loadDirectorGeo,
  mergeCells,
  mergePins,
  pinCountries,
  precisionRank,
  type GeoPin,
} from "@/lib/locations";

/**
 * /director/[slug]/locations — the Atlas READ layer for one director's whole
 * filmography (docs/PLAN-atlas-seo.md Phase 2.5). The director page's Atlas
 * tab stays the play layer; this page answers "where does X film?" in server
 * HTML, film by film. Gate: ≥2 located films and ≥6 merged pins, else 404.
 */
export const revalidate = 86400;
export async function generateStaticParams() { return []; }

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type FilmGroup = { slug: string; title: string; year: number | null; pins: GeoPin[] };

async function loadUncached(slug: string) {
  const { data: filmRows } = await db()
    .from("films").select("director, slug, poster_path").eq("director_slug", slug).eq("visible", true).limit(200);
  const rows = (filmRows ?? []) as { director: string | null; slug: string; poster_path: string | null }[];
  const director = rows[0]?.director;
  if (!director) return null;
  const posterBySlug = Object.fromEntries(rows.filter((r) => r.poster_path).map((r) => [r.slug, r.poster_path as string]));
  const raw = await loadDirectorGeo(slug); // visible films only (RPC filters)
  // Gate on the coordinate-cell counts (mirrors the sitemap's SQL rule
  // exactly, so an advertised URL can never 404); render the fused list.
  const cells = mergeCells(raw);
  const cellFilms = new Set(cells.map((p) => p.film_slug).filter(Boolean));
  if (cellFilms.size < DIRECTOR_LOCATIONS_MIN_FILMS || cells.length < DIRECTOR_LOCATIONS_MIN_PINS) return null;
  const cellsByFilm = new Map<string, number>();
  for (const p of cells) {
    if (p.film_slug) cellsByFilm.set(p.film_slug, (cellsByFilm.get(p.film_slug) ?? 0) + 1);
  }
  const pins = mergePins(raw);
  const byFilm = new Map<string, FilmGroup>();
  for (const p of pins) {
    if (!p.film_slug) continue;
    const g = byFilm.get(p.film_slug) ?? { slug: p.film_slug, title: p.film_title ?? p.film_slug, year: p.film_year ?? null, pins: [] };
    g.pins.push(p);
    byFilm.set(p.film_slug, g);
  }
  const films = [...byFilm.values()].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  const elig = await cachedLocationsEligibility();
  return { director, slug, pins, films, posterBySlug, cellsByFilm: Object.fromEntries(cellsByFilm), hubCountrySlugs: elig.countries.map((c) => c.slug) };
}

function load(slug: string) {
  // Key bumped (locations3) when posters joined the payload — the Data
  // Cache outlives deploys.
  return unstable_cache(() => loadUncached(slug), ["director-locations3", slug], {
    revalidate: 86400,
    tags: [`director:${slug}`],
  })();
}

// The geographic signature, as one deterministic sentence from the data.
function leadText(director: string, films: FilmGroup[], pins: GeoPin[]): string {
  const countries = pinCountries(pins);
  const top = countries[0];
  const share = top ? Math.round((top.pins / pins.length) * 100) : 0;
  const where = countryListPhrase(countries.slice(0, 3).map((c) => c.name), Math.max(0, countries.length - 3));
  const first = `${director}'s ${films.length} films on Metatake were shot across ${pins.length} mapped locations${where ? ` in ${where}` : ""}.`;
  const second = top && share >= 55 && countries.length > 1
    ? ` ${share}% of them stand in ${countryPhrase(top.name)} — the geography is part of the signature.`
    : top && countries.length === 1
      ? ` All of them stand in ${countryPhrase(top.name)}.`
      : "";
  return `${first}${second} Every location below links back to the film it belongs to.`;
}

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  const { director, films, pins } = data;
  const title = `Where Does ${director} Film? — ${films.length} Films, ${pins.length} Locations, Mapped`;
  const description = leadText(director, films, pins);
  return {
    title,
    description,
    alternates: { canonical: `/director/${slug}/locations` },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
    robots: pageRobots(true), // load() already 404s below the gate
  };
}

const PER_FILM_SHOWN = 6;

export default async function DirectorLocationsPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { director, pins, films, posterBySlug, cellsByFilm, hubCountrySlugs } = data;
  const hubCountries = new Set(hubCountrySlugs);
  const countries = pinCountries(pins);
  const updated = (await cachedLocationsMeta()).updated || new Date().toISOString().slice(0, 10);
  const lead = leadText(director, films, pins);

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Filming locations across ${director}'s films`,
    numberOfItems: pins.length,
    itemListElement: pins.slice(0, 100).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Place",
        name: p.name,
        geo: { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lng },
        ...(p.country ? { address: { "@type": "PostalAddress", addressCountry: p.country } } : {}),
      },
    })),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://metatake.net" },
      { "@type": "ListItem", position: 2, name: "Directors", item: "https://metatake.net/director" },
      { "@type": "ListItem", position: 3, name: director, item: `https://metatake.net/director/${slug}` },
      { "@type": "ListItem", position: 4, name: "Filming locations", item: `https://metatake.net/director/${slug}/locations` },
    ],
  };
  const pageLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    url: `https://metatake.net/director/${slug}/locations`,
    name: `Where does ${director} film?`,
    about: { "@type": "Person", name: director, url: `https://metatake.net/director/${slug}` },
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
          <Link href="/director">Directors</Link>
          <span className="df-sep">›</span><Link href={`/director/${slug}`}>{director}</Link>
          <span className="df-sep">›</span><span>Locations</span>
        </div>
        <EntityTVHero playlist={`director-${slug}`} reelSlugs={films.map((f) => f.slug)} label={director} listHref={`/tv/list/director-${slug}`} backdrop={null} />

        <h1 style={{ fontSize: 30, lineHeight: 1.18, margin: "2px 0 10px" }}>Where does {director} film?</h1>
        <p style={{ fontSize: 17, lineHeight: 1.6, maxWidth: "64ch", margin: 0 }}>{lead}</p>
        <div className="rd-share">
          <ShareDock variant="bar" path={`/director/${slug}/locations`} title={`Where does ${director} film?`} hook={lead} />
          <ShareDock variant="fab" path={`/director/${slug}/locations`} title={`Where does ${director} film?`} hook={lead} />
        </div>
        <a
          href="#map"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14,
            background: "#16233F", color: "#FBF8F1", padding: "9px 18px", borderRadius: 999,
            fontSize: 14, fontWeight: 600, textDecoration: "none", boxShadow: "0 1px 0 rgba(0,0,0,.15)",
          }}
        >
          <span aria-hidden style={{ color: "#E0922A" }}>◉</span>
          See all {pins.length} on the map ↓
        </a>

        <section style={{ margin: "30px 0" }}>
          <h2 className="df-h2">Film by film</h2>
          <p className="df-sub">Most recent first. Films with three or more mapped places link to their full location page.</p>
          {films.map((f) => {
            const shown = [...f.pins].sort((a, b) => precisionRank(a.precision) - precisionRank(b.precision)).slice(0, PER_FILM_SHOWN);
            // Same cell-count gate as /film/x/locations itself — never link a 404.
            const hasOwnPage = (cellsByFilm[f.slug] ?? 0) >= FILM_LOCATIONS_MIN;
            const poster = posterBySlug[f.slug];
            return (
              <div key={f.slug} style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: "1px solid rgba(22,35,63,.1)" }}>
                {poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <Link href={`/film/${f.slug}`} style={{ flexShrink: 0 }}>
                    <img src={`https://image.tmdb.org/t/p/w92${poster}`} alt={`${f.title} poster`} width={48} height={72} style={{ borderRadius: 6, objectFit: "cover", display: "block" }} loading="lazy" />
                  </Link>
                ) : null}
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: 17.5 }}>
                    <Link href={`/film/${f.slug}`}>{f.title}{f.year ? ` (${f.year})` : ""}</Link>
                    <span style={{ fontWeight: 400, fontSize: 13.5, opacity: 0.65 }}> — {f.pins.length} location{f.pins.length === 1 ? "" : "s"}</span>
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.65 }}>
                    {shown.map((p) => (
                      <li key={p.id}>
                        {p.name}
                        {p.narrative_setting ? <span style={{ opacity: 0.75 }}> — {p.narrative_setting}</span> : null}
                      </li>
                    ))}
                  </ul>
                  {hasOwnPage ? (
                    <p style={{ margin: "5px 0 0", fontSize: 14 }}>
                      <Link href={`/film/locations/${f.slug}`}>
                        {f.pins.length > PER_FILM_SHOWN ? `All ${f.pins.length} locations, with the scene each carries →` : "Where was it filmed? The full location page →"}
                      </Link>
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </section>

        <section id="map" style={{ margin: "44px 0 0", borderTop: "2px solid #16233F", paddingTop: 6 }}>
          <h2 className="df-h2" style={{ marginTop: 18 }}>{director} — the filmography on one map</h2>
          <p className="df-sub">All {pins.length} places, live. Click a pin to read what it means in its film.</p>
          <FilmMap endpoint={`/api/geo?director=${slug}`} height={520} />
        </section>

        <section style={{ margin: "30px 0 0" }}>
          <h2 className="df-h2">Keep reading</h2>
          <p style={{ lineHeight: 1.9, margin: "6px 0 0" }}>
            <Link href={`/director/${slug}`}>{director} — the director hub →</Link>
            {countries.filter((c) => hubCountries.has(countrySlug(c.name))).slice(0, 3).map((c) => (
              <span key={c.name}><br /><Link href={`/locations/${countrySlug(c.name)}`}>Movies filmed in {c.name} →</Link></span>
            ))}
          </p>
        </section>

        <p style={{ fontSize: 12.5, opacity: 0.6, marginTop: 26 }}>
          Metatake Editorial · Location data researched, compiled and geolocated by Metatake · Data updated {updated} · Corrections: <Link href="/methodology">methodology</Link>
        </p>
      </div>
      <DirectorPlates slug={slug} exclude="locations" />
    </div>
  );
}
