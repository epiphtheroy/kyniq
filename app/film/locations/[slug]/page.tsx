import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import FilmMap from "@/components/FilmMap";
import Byline from "@/components/Byline";
import Provenance from "@/components/Provenance";
import ReadHero from "@/components/read/ReadHero";
import ReadPlates from "@/components/read/ReadPlates";
import QuickAnswers, { type QuickAnswerItem } from "@/components/read/QuickAnswers";
import { pageRobots } from "@/lib/seo";
import "@/app/curious/curious.css";
import "@/app/film/[slug]/read.css";
import {
  FILM_LOCATIONS_MIN,
  cachedLocationsEligibility,
  cachedLocationsMeta,
  citiesForCountry,
  cityMemberPins,
  countryListPhrase,
  countryPhrase,
  countrySlug,
  listWords,
  loadFilmGeo,
  mergeCells,
  mergePins,
  pinCountries,
  precisionRank,
  type LocationCity,
  type GeoPin,
} from "@/lib/locations";

/**
 * /film/locations/[slug] — the Atlas READ layer for one film
 * (docs/PLAN-atlas-seo.md Phase 1). The film page's Atlas tab stays the play
 * layer; this page is what search engines, AI assistants and cold visitors
 * get: where the film was actually shot, place by place, with the scene each
 * location carries. Gate: ≥3 merged locations on a visible film, else 404.
 * (Moved 2026-07-06 from /film/[slug]/locations — the old route 308-redirects.)
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
  backdrop_path: string | null; id?: string;
};

async function loadUncached(slug: string) {
  const { data: film } = await db()
    .from("films")
    .select("id, title, slug, year, director, director_slug, poster_path, backdrop_path, visible")
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
  const elig = await cachedLocationsEligibility();
  const f = film as FilmRow;
  const directorHasLocations = !!f.director_slug && elig.directors.some((d) => d.slug === f.director_slug);
  const hubCountrySlugs = new Set(elig.countries.map((c) => c.slug));
  // Hero videos (same reel as the film page — clips first, trailer last).
  const { data: vidRows } = await db()
    .from("media")
    .select("external_id, title")
    .eq("entity_type", "film").eq("entity_id", f.id as string)
    .eq("status", "published").eq("kind", "video")
    .order("position");
  const vids = ((vidRows ?? []) as { external_id: string | null; title: string | null }[]).filter((v) => v.external_id);
  const isTrailerTitle = (t: string | null) => !!t && /trailer|teaser/i.test(t);
  const videos = [...vids.filter((v) => !isTrailerTitle(v.title)), ...vids.filter((v) => isTrailerTitle(v.title))]
    .map((v) => ({ id: v.external_id as string, title: v.title ?? "" }));
  return { film: f, pins, videos, directorHasLocations, hubCountrySlugs: [...hubCountrySlugs] };
}

function load(slug: string) {
  // Key history: locations2 = name-fusion; locations3 = film art + hero
  // videos (2026-07-08 On Location redesign). The Data Cache outlives deploys.
  return unstable_cache(() => loadUncached(slug), ["film-locations3", slug], {
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

// ── City-first "where" phrase (docs/PLAN-intent-coverage.md §5.1) ──────────
// GeoPin has no city field, so the dominant shooting city is derived from the
// frozen roster (lib/atlas_cities.json) with the SAME membership matcher the
// /locations/[country]/[city] hubs use — locality-term + proximity via
// cityMemberPins(). A city is therefore only ever named when the roster
// already owns it (never invented from pin-name text).
function cityMatches(filmed: GeoPin[]): { city: LocationCity; ids: Set<string> }[] {
  const out: { city: LocationCity; ids: Set<string> }[] = [];
  for (const c of pinCountries(filmed)) {
    for (const city of citiesForCountry(countrySlug(c.name))) {
      const ids = new Set(cityMemberPins(filmed, city).map((p) => p.id));
      if (ids.size) out.push({ city, ids });
    }
  }
  return out.sort((a, b) => b.ids.size - a.ids.size);
}

// Full prepositional phrase for "…across N locations {HERE}". Rules: one
// roster city matching ≥50% of filmed pins → "in and around {City}" (country
// appended when the film also shot elsewhere); top two cities together ≥70%
// (union, overlaps counted once) → "in {CityA} and {CityB}"; otherwise the
// original country phrasing, unchanged.
function wherePhrase(filmed: GeoPin[]): string {
  const countries = pinCountries(filmed);
  const countryWhere = countryListPhrase(countries.slice(0, 3).map((c) => c.name), Math.max(0, countries.length - 3));
  const fallback = countryWhere ? `in ${countryWhere}` : "";
  if (!filmed.length) return fallback;
  const matches = cityMatches(filmed);
  const top = matches[0];
  if (!top) return fallback;
  if (top.ids.size / filmed.length >= 0.5) {
    const alsoElsewhere = filmed.some((p) => !top.ids.has(p.id));
    return alsoElsewhere
      ? `in and around ${top.city.name}, ${countryPhrase(top.city.country)}`
      : `in and around ${top.city.name}`;
  }
  let second: { city: LocationCity; add: number } | null = null;
  for (const m of matches.slice(1)) {
    if (m.city.name === top.city.name) continue;
    let add = 0;
    for (const id of m.ids) if (!top.ids.has(id)) add += 1;
    if (!second || add > second.add) second = { city: m.city, add };
  }
  if (second && second.add > 0 && (top.ids.size + second.add) / filmed.length >= 0.7) {
    return `in ${top.city.name} and ${second.city.name}`;
  }
  return fallback;
}

function leadText(film: FilmRow, filmed: GeoPin[], setting: GeoPin[]): string {
  const year = film.year ? ` (${film.year})` : "";
  const builtSets = filmed.filter((p) => p.built_set).length;
  const sentences: string[] = [];
  if (filmed.length) {
    const where = wherePhrase(filmed);
    sentences.push(`${film.title}${year} was filmed across ${filmed.length} real location${filmed.length === 1 ? "" : "s"}${where ? ` ${where}` : ""}.`);
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

// ── Quick answers (docs/PLAN-intent-coverage.md §0 charter + §5.1) ─────────
// Deterministic Q&A assembled ONLY from fields already in scope: a question
// is emitted only when its answer row is present, and every name, count and
// country is verbatim from the pin rows. Search-term variants (filmed / shot /
// filming locations) are woven across Q and A — never listed, max two uses
// each: "filmed" carries Q1+Q4, "shot" carries A1+Q3 (the plan's own §5.1
// scene template), "filming locations" appears once in A1.
function quickAnswerItems(film: FilmRow, filmed: GeoPin[], setting: GeoPin[]): QuickAnswerItem[] {
  const yearLabel = film.year ? ` (${film.year})` : "";
  const items: QuickAnswerItem[] = [];
  if (filmed.length > 0) {
    const where = wherePhrase(filmed);
    items.push({
      q: `Where was ${film.title} filmed?`,
      a: `${film.title}${yearLabel} was shot across ${filmed.length} filming location${filmed.length === 1 ? "" : "s"}${where ? ` ${where}` : ""}.`,
    });
    const builtPins = filmed.filter((p) => p.built_set);
    if (builtPins.length > 0) {
      const realCount = filmed.length - builtPins.length;
      const host = builtPins.find((p) => (p.set_host ?? "").trim());
      let a =
        realCount > 0
          ? `Of its ${filmed.length} locations, ${realCount} ${realCount === 1 ? "was a real place" : "were real places"} and ${builtPins.length} ${builtPins.length === 1 ? "was a built set" : "were built sets"}`
          : `All ${filmed.length} of its locations were built as sets rather than found`;
      if (host) a += ` — ${host.name} was built at ${(host.set_host ?? "").trim()}`;
      items.push({ q: `Were ${film.title}'s locations real places or built sets?`, a: `${a}.` });
    }
    // filmed arrives precision-sorted, so the first pin with a scene is "top".
    const scenePin = filmed.find((p) => (p.scene_role ?? "").trim());
    if (scenePin) {
      const scene = (scenePin.scene_role ?? "").trim();
      items.push({
        q: `What scene was shot at ${scenePin.name}?`,
        a: /[.!?]$/.test(scene) ? scene : `${scene}.`,
      });
    }
    const countries = pinCountries(filmed);
    if (countries.length > 1) {
      items.push({
        q: `Which countries was ${film.title} filmed in?`,
        a: `Cameras stood in ${countryListPhrase(countries.map((c) => c.name))} — ${countries.length} countries in all.`,
      });
    }
  } else if (setting.length > 0) {
    // Setting-only page: one question, no filming claims (charter §0-1).
    const names = listWords(setting.slice(0, 3).map((p) => p.name));
    items.push({
      q: `Where is ${film.title} set?`,
      a: `${film.title}${yearLabel} is set in ${names} — ${setting.length} narrative place${setting.length === 1 ? "" : "s"}, mapped below.`,
    });
  }
  return items.slice(0, 4);
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
    alternates: { canonical: `/film/locations/${slug}` },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
    robots: pageRobots(true), // load() already 404s below the gate
  };
}

// The pin's on-file citations (URLs collected during research) — shown as
// per-location source links, the receipts behind "compiled by Metatake".
function sourceUrls(sources: unknown): string[] {
  if (!Array.isArray(sources)) return [];
  return (sources as unknown[]).filter((s): s is string => typeof s === "string" && s.startsWith("http")).slice(0, 2);
}
function sourceHost(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "source"; }
}

function gmaps(p: GeoPin): string {
  // A point, not a search: the query pins the exact geocode we hold.
  return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
}

function LocationItem({ p, n }: { p: GeoPin; n: number }) {
  const prose = pinProse(p);
  const badge = p.precision ? PRECISION_LABEL[p.precision] ?? p.precision : null;
  const srcs = sourceUrls(p.sources);
  return (
    <div style={{ padding: "14px 0", borderBottom: "1px solid rgba(22,35,63,.1)", display: "grid", gridTemplateColumns: "34px 1fr", gap: 12 }}>
      <div aria-hidden style={{ fontSize: 19, fontWeight: 700, color: "#c0392b", lineHeight: 1.3 }}>{n}.</div>
      <div>
        <h3 style={{ margin: "0 0 3px", fontSize: 16.5, lineHeight: 1.35 }}>{p.name}</h3>
        <div style={{ fontSize: 12.5, opacity: 0.6, marginBottom: prose ? 5 : 0 }}>
          {[p.country, badge, p.built_set ? (p.set_host ? `built set — ${p.set_host}` : "built set") : null]
            .filter(Boolean).join(" · ")}
        </div>
        {prose ? <p style={{ margin: 0, lineHeight: 1.6, maxWidth: "70ch" }}>{prose}</p> : null}
        <p style={{ margin: "6px 0 0", fontSize: 13.5 }}>
          <a href={gmaps(p)} target="_blank" rel="noopener noreferrer">◉ Google Maps ↗</a>
          {p.fig_slug && p.film_slug ? (
            <> · <Link href={`/film/${p.film_slug}/figure/${p.fig_slug}`}>this place as a figure →</Link></>
          ) : null}
          {srcs.map((u, i) => (
            <span key={u} style={{ opacity: 0.75 }}>
              {" · "}
              {i === 0 ? "Source: " : ""}
              <a href={u} target="_blank" rel="noopener noreferrer">{sourceHost(u)} ↗</a>
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}

export default async function FilmLocationsPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { film, pins, videos, directorHasLocations, hubCountrySlugs } = data;
  const hubCountries = new Set(hubCountrySlugs);
  const filmed = sortPins(pins.filter((p) => p.layer === "filmed"));
  const setting = sortPins(pins.filter((p) => p.layer === "setting"));
  const countries = pinCountries(filmed);
  const groupByCountry = countries.length > 1;
  // The dataset's real last-change date — not the render date.
  const updated = (await cachedLocationsMeta()).updated || new Date().toISOString().slice(0, 10);
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
      { "@type": "ListItem", position: 4, name: "Filming locations", item: `https://metatake.net/film/locations/${film.slug}` },
    ],
  };
  const pageLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    url: `https://metatake.net/film/locations/${film.slug}`,
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
      <ReadHero
        film={{ title: film.title, slug: film.slug, year: film.year }}
        crumbTail="On Location"
        chip={<><Link href="/curious/locations" style={{ color: "inherit", textDecoration: "none" }}>On Location</Link>{" · "}fact-checked &amp; mapped</>}
        meta={<>{pins.length} places · <a href="#map" style={{ color: "inherit", textDecoration: "underline" }}>see the map ↓</a> · data updated {updated}</>}
        title={<>Where was {film.title}{yearLabel} filmed?</>}
        dek={lead}
        videos={videos}
        backdropPath={film.backdrop_path}
      />
      <div className="mt-wrap" style={{ maxWidth: 880, padding: "28px 20px 40px" }}>
        <Byline created={updated} />

        <QuickAnswers items={quickAnswerItems(film, filmed, setting)} />

        {filmed.length > 0 && (
          <section style={{ margin: "28px 0" }}>
            <h2 className="df-h2">Filmed locations — {filmed.length} places</h2>
            <p className="df-sub">Where the cameras actually stood, from exact addresses down to city level.</p>
            {groupByCountry ? (
              (() => {
                let n = 0;
                return countries.map((c) => {
                  const rows = filmed.filter((p) => (p.country ?? "").trim() === c.name);
                  if (!rows.length) return null;
                  return (
                    <div key={c.name} style={{ margin: "18px 0 6px" }}>
                      <h3 style={{ fontSize: 14, letterSpacing: ".04em", textTransform: "uppercase", opacity: 0.7, margin: "0 0 2px" }}>
                        {c.name} — {rows.length} location{rows.length === 1 ? "" : "s"}
                      </h3>
                      {rows.map((p) => { n += 1; return <LocationItem key={p.id} p={p} n={n} />; })}
                    </div>
                  );
                });
              })()
            ) : (
              filmed.map((p, i) => <LocationItem key={p.id} p={p} n={i + 1} />)
            )}
          </section>
        )}

        {setting.length > 0 && (
          <section style={{ margin: "28px 0" }}>
            <h2 className="df-h2">The world it pretends to be</h2>
            <p className="df-sub">Places the story claims as its world — distinct from where the cameras stood.</p>
            {setting.map((p, i) => <LocationItem key={p.id} p={p} n={filmed.length + i + 1} />)}
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
              <span key={c.name}><br /><Link href={`/locations/${countrySlug(c.name)}`}>Movies filmed in {countryPhrase(c.name)} →</Link></span>
            ))}
            <br /><Link href="/locations">The world map of cinema — every country, one map →</Link>
          </p>
        </section>

        <aside style={{ margin: "34px 0 0", padding: "16px 18px", borderLeft: "3px solid #c0392b", background: "rgba(22,35,63,.04)", borderRadius: "0 6px 6px 0" }}>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65 }}>
            <b>How this was researched.</b> Every location above was compiled from cited sources — production
            notes, interviews, local press — then geocoded and graded for precision (exact spot → venue → area →
            city). Built sets are flagged as sets, and the world the story <em>claims</em> is kept separate from
            where the cameras stood. Sources are cited per location where on file; the dataset is corrected on
            an ongoing basis. <Link href="/methodology#locations">Read the full methodology →</Link>
          </p>
        </aside>
        <Provenance created={updated} />
      </div>

      <ReadPlates slug={film.slug} exclude="locations" />
    </div>
  );
}
