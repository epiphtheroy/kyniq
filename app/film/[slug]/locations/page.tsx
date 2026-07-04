import { createClient } from "@supabase/supabase-js";
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
  countrySlug,
  listWords,
  loadFilmGeo,
  mergeCells,
  mergePins,
  pinCountries,
  precisionRank,
  type GeoPin,
} from "@/lib/atlas";

/**
 * /film/[slug]/locations — the Atlas READ layer for one film
 * (docs/PLAN-atlas-seo.md Phase 1). The film page's Atlas tab stays the play
 * layer; this page is what search engines, AI assistants and cold visitors
 * get: where the film was actually shot, place by place, with the scene each
 * location carries. Gate: ≥3 merged locations on a visible film, else 404.
 */
export const revalidate = 86400;
export async function generateStaticParams() { return []; }

const IMG = "https://image.tmdb.org/t/p";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type FilmRow = {
  title: string; slug: string; year: number | null;
  director: string | null; director_slug: string | null;
  poster_path: string | null; visible: boolean | null;
};

async function loadUncached(slug: string) {
  const { data: film } = await db()
    .from("films")
    .select("title, slug, year, director, director_slug, poster_path, visible")
    .eq("slug", slug)
    .maybeSingle();
  // film_geo does not filter on visibility, so the read page must.
  if (!film || (film as FilmRow).visible === false) return null;
  const raw = await loadFilmGeo(slug);
  // Gate on the coordinate-cell count (mirrors the sitemap's SQL rule exactly,
  // so an advertised URL can never 404); render the fully fused list.
  if (mergeCells(raw).length < FILM_LOCATIONS_MIN) return null;
  const pins = mergePins(raw);
  // Only link to sibling pages that clear their own gates (no 404 links).
  const elig = await cachedAtlasEligibility();
  const f = film as FilmRow;
  const directorHasLocations = !!f.director_slug && elig.directors.some((d) => d.slug === f.director_slug);
  const hubCountrySlugs = new Set(elig.countries.map((c) => c.slug));
  return { film: f, pins, directorHasLocations, hubCountrySlugs: [...hubCountrySlugs] };
}

function load(slug: string) {
  // Key bumped (locations2) when name-fusion joined the merge — the Data
  // Cache outlives deploys.
  return unstable_cache(() => loadUncached(slug), ["film-locations2", slug], {
    revalidate: 86400,
    tags: [`film:${slug}`],
  })();
}

const PRECISION_LABEL: Record<string, string> = {
  exact: "exact spot", venue: "venue", area: "area", city: "city-level",
};

// One readable sentence block per pin: what the place is in the film, then the
// scene it carries. Both come from the compiled location data (no generation).
function pinProse(p: GeoPin): string {
  const parts: string[] = [];
  const nar = (p.narrative_setting ?? "").trim();
  const scene = (p.scene_role ?? "").trim();
  if (nar) parts.push(/[.!?]$/.test(nar) ? nar : `${nar}.`);
  if (scene && scene !== nar) parts.push(/[.!?]$/.test(scene) ? scene : `${scene}.`);
  return parts.join(" ");
}

function sortPins(pins: GeoPin[]): GeoPin[] {
  return [...pins].sort((a, b) => precisionRank(a.precision) - precisionRank(b.precision) || a.name.localeCompare(b.name));
}

function leadText(film: FilmRow, filmed: GeoPin[], setting: GeoPin[]): string {
  const year = film.year ? ` (${film.year})` : "";
  const builtSets = filmed.filter((p) => p.built_set).length;
  const sentences: string[] = [];
  if (filmed.length) {
    const countries = pinCountries(filmed);
    const where = listWords(countries.slice(0, 3).map((c) => c.name));
    sentences.push(`${film.title}${year} was filmed across ${filmed.length} real location${filmed.length === 1 ? "" : "s"}${where ? ` in ${where}` : ""}${countries.length > 3 ? ` and ${countries.length - 3} more countr${countries.length - 3 === 1 ? "y" : "ies"}` : ""}.`);
    if (builtSets) sentences.push(`${builtSets} of its worlds ${builtSets === 1 ? "was" : "were"} built as sets rather than found.`);
  }
  if (setting.length) {
    const names = listWords(setting.slice(0, 3).map((p) => p.name));
    sentences.push(filmed.length
      ? `The story itself claims ${names} as its world — mapped separately below.`
      : `${film.title}${year} is set in ${names} — ${setting.length} narrative place${setting.length === 1 ? "" : "s"}, mapped below.`);
  }
  sentences.push("Every place below is geolocated, with the scene each one carries in the film.");
  return sentences.join(" ");
}

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  const { film, pins } = data;
  const filmed = pins.filter((p) => p.layer === "filmed");
  const setting = pins.filter((p) => p.layer === "setting");
  const year = film.year ? ` (${film.year})` : "";
  // No brand suffix — the root layout template appends "· Metatake".
  const title = `Where Was ${film.title}${year} Filmed? — ${pins.length} Locations, Mapped`;
  const description = leadText(film, filmed, setting);
  return {
    title,
    description,
    alternates: { canonical: `/film/${slug}/locations` },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
    robots: pageRobots(true), // load() already 404s below the gate
  };
}

function LocationItem({ p }: { p: GeoPin }) {
  const prose = pinProse(p);
  const badge = p.precision ? PRECISION_LABEL[p.precision] ?? p.precision : null;
  return (
    <div style={{ padding: "13px 0", borderBottom: "1px solid rgba(22,35,63,.1)" }}>
      <h3 style={{ margin: "0 0 3px", fontSize: 16.5, lineHeight: 1.35 }}>{p.name}</h3>
      <div style={{ fontSize: 12.5, opacity: 0.6, marginBottom: prose ? 5 : 0 }}>
        {[p.country, badge, p.built_set ? (p.set_host ? `built set — ${p.set_host}` : "built set") : null]
          .filter(Boolean).join(" · ")}
      </div>
      {prose ? <p style={{ margin: 0, lineHeight: 1.6, maxWidth: "70ch" }}>{prose}</p> : null}
      {p.fig_slug && p.film_slug ? (
        <p style={{ margin: "5px 0 0", fontSize: 14 }}>
          <Link href={`/film/${p.film_slug}/figure/${p.fig_slug}`}>Read this place as a figure in the film →</Link>
        </p>
      ) : null}
    </div>
  );
}

export default async function FilmLocationsPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { film, pins, directorHasLocations, hubCountrySlugs } = data;
  const hubCountries = new Set(hubCountrySlugs);
  const filmed = sortPins(pins.filter((p) => p.layer === "filmed"));
  const setting = sortPins(pins.filter((p) => p.layer === "setting"));
  const countries = pinCountries(filmed);
  const groupByCountry = countries.length > 1;
  const updated = new Date().toISOString().slice(0, 10);
  const lead = leadText(film, filmed, setting);
  const yearLabel = film.year ? ` (${film.year})` : "";

  const placeLd = (p: GeoPin) => ({
    "@type": "Place",
    name: p.name,
    ...(pinProse(p) ? { description: pinProse(p) } : {}),
    geo: { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lng },
    ...(p.country ? { address: { "@type": "PostalAddress", addressCountry: p.country } } : {}),
  });
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Filming locations of ${film.title}${yearLabel}`,
    numberOfItems: pins.length,
    itemListElement: [...filmed, ...setting].map((p, i) => ({ "@type": "ListItem", position: i + 1, item: placeLd(p) })),
  };
  const movieLd = {
    "@context": "https://schema.org",
    "@type": "Movie",
    "@id": `https://metatake.net/film/${film.slug}`,
    name: film.title,
    ...(film.year ? { datePublished: String(film.year) } : {}),
    ...(film.director ? { director: { "@type": "Person", name: film.director } } : {}),
    ...(film.poster_path ? { image: `${IMG}/w500${film.poster_path}` } : {}),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://metatake.net" },
      { "@type": "ListItem", position: 2, name: "Films", item: "https://metatake.net/film" },
      { "@type": "ListItem", position: 3, name: `${film.title}${yearLabel}`, item: `https://metatake.net/film/${film.slug}` },
      { "@type": "ListItem", position: 4, name: "Filming locations", item: `https://metatake.net/film/${film.slug}/locations` },
    ],
  };
  const pageLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    url: `https://metatake.net/film/${film.slug}/locations`,
    name: `Where was ${film.title}${yearLabel} filmed?`,
    about: { "@type": "Movie", "@id": `https://metatake.net/film/${film.slug}`, name: film.title },
    author: { "@type": "Organization", "@id": "https://metatake.net/#org", name: "Metatake" },
    editor: { "@type": "Person", "@id": "https://metatake.net/editor#person", name: "Wonwoo Yoon", url: "https://metatake.net/editor" },
    publisher: { "@type": "Organization", "@id": "https://metatake.net/#org", name: "Metatake" },
    dateModified: updated,
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(movieLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageLd) }} />
      <div className="mt-wrap" style={{ maxWidth: 880, padding: "28px 20px 60px" }}>
        <div className="df-crumb" style={{ marginBottom: 14 }}>
          <Link href="/film">Films</Link>
          {film.director_slug ? <><span className="df-sep">›</span><Link href={`/director/${film.director_slug}`}>{film.director}</Link></> : null}
          <span className="df-sep">›</span><Link href={`/film/${film.slug}`}>{film.title}</Link>
          <span className="df-sep">›</span><span>Locations</span>
        </div>

        <header style={{ display: "flex", gap: 22, alignItems: "flex-start", marginBottom: 8 }}>
          {film.poster_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <Link href={`/film/${film.slug}`} style={{ flexShrink: 0 }}>
              <img src={`${IMG}/w185${film.poster_path}`} alt={`${film.title} poster`} width={110} height={165} style={{ borderRadius: 8, objectFit: "cover" }} loading="lazy" />
            </Link>
          ) : null}
          <div>
            <h1 style={{ fontSize: 30, lineHeight: 1.18, margin: "2px 0 10px" }}>
              Where was {film.title}{yearLabel} filmed?
            </h1>
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
              See all {pins.length} on the map ↓
            </a>
          </div>
        </header>

        {filmed.length > 0 && (
          <section style={{ margin: "28px 0" }}>
            <h2 className="df-h2">Filmed locations — {filmed.length} places</h2>
            <p className="df-sub">Where the cameras actually stood, from exact addresses down to city level.</p>
            {groupByCountry ? (
              countries.map((c) => {
                const rows = filmed.filter((p) => (p.country ?? "").trim() === c.name);
                if (!rows.length) return null;
                return (
                  <div key={c.name} style={{ margin: "18px 0 6px" }}>
                    <h3 style={{ fontSize: 14, letterSpacing: ".04em", textTransform: "uppercase", opacity: 0.7, margin: "0 0 2px" }}>
                      {c.name} — {rows.length} location{rows.length === 1 ? "" : "s"}
                    </h3>
                    {rows.map((p) => <LocationItem key={p.id} p={p} />)}
                  </div>
                );
              })
            ) : (
              filmed.map((p) => <LocationItem key={p.id} p={p} />)
            )}
          </section>
        )}

        {setting.length > 0 && (
          <section style={{ margin: "28px 0" }}>
            <h2 className="df-h2">The world it pretends to be</h2>
            <p className="df-sub">Places the story claims as its world — distinct from where the cameras stood.</p>
            {setting.map((p) => <LocationItem key={p.id} p={p} />)}
          </section>
        )}

        <section id="map" style={{ margin: "44px 0 0", borderTop: "2px solid #16233F", paddingTop: 6 }}>
          <h2 className="df-h2" style={{ marginTop: 18 }}>{film.title} — every location on the map</h2>
          <p className="df-sub">The same {pins.length} places, live. Click a pin to read what it means in the film.</p>
          <FilmMap endpoint={`/api/geo?film=${film.slug}`} filmSlug={film.slug} height={520} />
        </section>

        <section style={{ margin: "30px 0 0" }}>
          <h2 className="df-h2">Keep reading</h2>
          <p style={{ lineHeight: 1.9, margin: "6px 0 0" }}>
            <Link href={`/film/${film.slug}`}>{film.title} — analysis, themes &amp; symbols →</Link>
            {directorHasLocations && film.director_slug ? (
              <><br /><Link href={`/director/${film.director_slug}/locations`}>Where does {film.director} film? Every location across the filmography →</Link></>
            ) : null}
            {countries.filter((c) => hubCountries.has(countrySlug(c.name))).slice(0, 3).map((c) => (
              <span key={c.name}><br /><Link href={`/atlas/${countrySlug(c.name)}`}>Movies filmed in {c.name} →</Link></span>
            ))}
          </p>
        </section>

        <p style={{ fontSize: 12.5, opacity: 0.6, marginTop: 26 }}>
          Metatake Editorial · Location data compiled and geolocated by Metatake · Updated {updated}
        </p>
      </div>
    </div>
  );
}
