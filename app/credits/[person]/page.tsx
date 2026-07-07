import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import SiteNav from "@/components/home2/SiteNav";
import CreditsExplorer from "../CreditsExplorer";
import { CRAFTS, type CraftKey, img, personSlug } from "../credits-logic";
import { resolveNative } from "@/lib/nativeName";
import { pageRobots } from "@/lib/seo";
import "../credits.css";

/**
 * /credits/[person] — server-rendered crew person page ("the read layer").
 * The client explorer (/credits?p=…) stays as the interactive "play layer";
 * this page is what search engines and cold visitors get: who this person is,
 * the repertory company they keep, and where their work lives in the catalog.
 * Slug format: {kebab-name}-{tmdbId} (id suffix is authoritative).
 */
export const revalidate = 86400;
export async function generateStaticParams() { return []; }

const KEY_CRAFTS: CraftKey[] = ["writer", "dp", "editor", "composer", "pd"];

type TmdbPerson = {
  id: number; name: string; also_known_as?: string[]; biography?: string | null;
  birthday?: string | null; deathday?: string | null; place_of_birth?: string | null;
  profile_path?: string | null;
  external_ids?: { imdb_id?: string | null };
  movie_credits?: { crew?: { id: number; title: string; release_date?: string; job?: string; department?: string; poster_path?: string | null }[] };
};

type CatFilm = { tmdb_id: number; slug: string; title: string; year: number | null; director: string | null; director_slug: string | null; poster_path: string | null; visible: boolean | null };

function parseId(slug: string): number | null {
  const m = slug.match(/-(\d+)$/);
  return m ? Number(m[1]) : null;
}

// Native-script alias — the name people in that language actually search.
// One alias, shown once in the title/lead; the full list goes to JSON-LD only.
// Native-name resolution (TMDB alias by expected script → Wikidata label
// fallback) lives in lib/nativeName.

async function tmdbPerson(id: number): Promise<TmdbPerson | null> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) return null;
  const v4 = token.length > 40;
  const qs = v4 ? "" : `&api_key=${token}`;
  const r = await fetch(
    `https://api.themoviedb.org/3/person/${id}?append_to_response=movie_credits,external_ids${qs}`,
    { headers: v4 ? { Authorization: `Bearer ${token}`, accept: "application/json" } : { accept: "application/json" }, next: { revalidate: 86400 } },
  );
  if (!r.ok) return null;
  return (await r.json()) as TmdbPerson;
}

function craftCredits(p: TmdbPerson) {
  const seen = new Map<CraftKey, Map<number, { id: number; title: string; year: number; poster: string | null }>>();
  for (const c of p.movie_credits?.crew ?? []) {
    for (const key of KEY_CRAFTS) {
      const cf = CRAFTS[key];
      if (c.job && cf.jobs.has(c.job) && c.department && cf.depts.includes(c.department)) {
        const year = Number((c.release_date || "").slice(0, 4)) || 0;
        const m = seen.get(key) ?? new Map();
        m.set(c.id, { id: c.id, title: c.title, year, poster: c.poster_path ?? null });
        seen.set(key, m);
      }
    }
  }
  return [...seen.entries()]
    .map(([key, m]) => ({ key, films: [...m.values()].sort((a, b) => b.year - a.year) }))
    .sort((a, b) => b.films.length - a.films.length);
}

// Both tiers: visible=true films are read closely; visible=false rows are
// Tier-2 catalog stubs — still linked (crawlable funnels), marked "catalog".
async function catalogFilms(tmdbIds: number[]): Promise<CatFilm[]> {
  if (!tmdbIds.length) return [];
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const out: CatFilm[] = [];
  for (let i = 0; i < tmdbIds.length; i += 150) {
    const { data } = await supabase
      .from("films")
      .select("tmdb_id, slug, title, year, director, director_slug, poster_path, visible")
      .in("tmdb_id", tmdbIds.slice(i, i + 150));
    out.push(...((data ?? []) as CatFilm[]));
  }
  return out;
}

const isRead = (f: CatFilm) => f.visible !== false;

// Entity stitching — is this person also a /director hub? Exact name match
// against films.director, then verified against their own TMDB directing
// credits so a namesake never links. Ambiguous names resolve to null silently.
async function directorHubFor(p: TmdbPerson): Promise<{ slug: string; n: number } | null> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data } = await supabase
    .from("films").select("tmdb_id, director_slug")
    .eq("director", p.name).eq("visible", true).not("director_slug", "is", null);
  const rows = (data ?? []) as { tmdb_id: number | null; director_slug: string }[];
  const slugs = new Set(rows.map((r) => r.director_slug));
  if (slugs.size !== 1) return null;
  const directed = new Set((p.movie_credits?.crew ?? []).filter((c) => c.job === "Director").map((c) => c.id));
  if (!rows.some((r) => r.tmdb_id != null && directed.has(r.tmdb_id))) return null;
  return { slug: [...slugs][0], n: rows.length };
}

// The name-drop antidote: turn collaboration counts into sentences.
function leadSentence(name: string, native: string | null, crafts: { key: CraftKey; films: { year: number }[] }[], cat: CatFilm[], topDirector: { name: string; slug: string | null; n: number } | null): string {
  const main = crafts[0];
  const role = CRAFTS[main.key].role;
  const years = main.films.map((f) => f.year).filter(Boolean);
  const span = years.length > 1 ? `${Math.min(...years)}–${Math.max(...years)}` : years[0] ? String(years[0]) : "";
  const parts = [
    `${name}${native ? ` (${native})` : ""} — ${role.toLowerCase()}${crafts.length > 1 ? ` and ${crafts.slice(1).map((c) => CRAFTS[c.key].role.toLowerCase()).join(", ")}` : ""}, ${main.films.length} feature credit${main.films.length === 1 ? "" : "s"}${span ? ` (${span})` : ""}.`,
  ];
  const read = cat.filter(isRead).length;
  if (read) parts.push(`${read} of them are read closely on Metatake${topDirector && topDirector.n >= 2 ? ` — including ${topDirector.n} with ${topDirector.name}` : ""}.`);
  return parts.join(" ");
}

/* ── The analysis engine (2026-07-08): every sentence below is assembled
   from the filmography numbers already on file — TMDB credits + the Metatake
   catalog. No generation. Rendered as a short "at a glance" block plus a
   <details> full analysis (server HTML, so all of it is crawlable). ── */

type CraftFilm = { id: number; title: string; year: number; poster: string | null };

function careerFacts(crafts: { key: CraftKey; films: CraftFilm[] }[]) {
  const all = [...new Map(crafts.flatMap((c) => c.films).map((f) => [f.id, f])).values()];
  const dated = all.filter((f) => f.year > 1880);
  const years = dated.map((f) => f.year);
  if (!years.length) return null;
  const first = Math.min(...years);
  const last = Math.max(...years);
  const firstFilm = dated.filter((f) => f.year === first).sort((a, b) => a.title.localeCompare(b.title))[0];
  const lastFilm = dated.filter((f) => f.year === last).sort((a, b) => a.title.localeCompare(b.title))[0];
  const byDecade = new Map<number, CraftFilm[]>();
  for (const f of dated) {
    const d = Math.floor(f.year / 10) * 10;
    byDecade.set(d, [...(byDecade.get(d) ?? []), f]);
  }
  const decades = [...byDecade.entries()].sort((a, b) => a[0] - b[0]);
  const peak = [...decades].sort((a, b) => b[1].length - a[1].length)[0];
  return { total: all.length, dated: dated.length, first, last, firstFilm, lastFilm, decades, peak };
}

const FilmRef = ({ f, catByTmdb }: { f: CraftFilm; catByTmdb: Map<number, CatFilm> }) => {
  const c = catByTmdb.get(f.id);
  return <>{c ? <Link href={`/film/${c.slug}`}>{f.title}</Link> : <i>{f.title}</i>}{f.year ? ` (${f.year})` : ""}</>;
};

interface Props { params: Promise<{ person: string }> }

async function load(personSlug: string) {
  const id = parseId(personSlug);
  if (!id) return null;
  const p = await tmdbPerson(id);
  if (!p) return null;
  const crafts = craftCredits(p);
  if (!crafts.length) return null; // not a key-craft person → no read page
  const allIds = [...new Set(crafts.flatMap((c) => c.films.map((f) => f.id)))];
  const cat = await catalogFilms(allIds);
  // Repertory company — directors they keep working with, from OUR closely-read rows.
  const byDir = new Map<string, { name: string; slug: string | null; n: number }>();
  for (const f of cat.filter(isRead)) {
    if (!f.director) continue;
    const cur = byDir.get(f.director) ?? { name: f.director, slug: f.director_slug, n: 0 };
    cur.n += 1;
    byDir.set(f.director, cur);
  }
  const company = [...byDir.values()].sort((a, b) => b.n - a.n);
  const [native, directorHub] = await Promise.all([
    resolveNative({ tmdbId: id, name: p.name, aliases: p.also_known_as, place: p.place_of_birth }),
    directorHubFor(p),
  ]);
  return { id, p, crafts, cat, company, native, directorHub };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { person } = await params;
  const data = await load(person);
  if (!data) return { title: "Not found" };
  const { p, crafts, cat, company, native } = data;
  const role = CRAFTS[crafts[0].key].label;
  const title = `${p.name}${native ? ` (${native})` : ""} — ${role}: Films & Collaborations`;
  const description = leadSentence(p.name, native, crafts, cat, company[0] ?? null);
  return {
    title,
    description,
    authors: [{ name: "Metatake Editorial", url: "https://metatake.net/about" }],
    alternates: { canonical: `/credits/${person}` },
    openGraph: { title, description, type: "profile" },
    twitter: { card: "summary", title, description },
    // Same thin-content bar as figures/Q&A: index only when the catalog can
    // actually say something (≥3 closely-read films by this person —
    // Tier-2 catalog stubs don't count toward the bar).
    robots: pageRobots(cat.filter(isRead).length >= 3),
  };
}

const W185 = (p: string | null) => img(p, "w185");

export default async function CrewPersonPage({ params }: Props) {
  const { person } = await params;
  const data = await load(person);
  if (!data) notFound();
  const { id, p, crafts, cat, company, native, directorHub } = data;
  const mainCraft = crafts[0].key;
  const readN = cat.filter(isRead).length;
  const catByTmdb = new Map(cat.map((f) => [f.tmdb_id, f]));
  const repertory = company.filter((d) => d.n >= 2).slice(0, 8);
  const updated = new Date().toISOString().slice(0, 10);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    dateModified: updated,
    mainEntity: {
      "@type": "Person",
      "@id": `https://metatake.net/credits/${personSlug(p.name, id)}`,
      name: p.name,
      ...((p.also_known_as?.length || native)
        ? { alternateName: [...new Set([...(native ? [native] : []), ...(p.also_known_as ?? [])])].slice(0, 8) }
        : {}),
      jobTitle: CRAFTS[mainCraft].role,
      ...(p.birthday ? { birthDate: p.birthday } : {}),
      ...(p.profile_path ? { image: `https://image.tmdb.org/t/p/w342${p.profile_path}` } : {}),
      sameAs: [
        ...(directorHub ? [`https://metatake.net/director/${directorHub.slug}`] : []),
        `https://www.themoviedb.org/person/${id}`,
        ...(p.external_ids?.imdb_id ? [`https://www.imdb.com/name/${p.external_ids.imdb_id}/`] : []),
      ],
    },
    author: { "@type": "Organization", "@id": "https://metatake.net/#org", name: "Metatake" },
    editor: { "@type": "Person", "@id": "https://metatake.net/editor#person", name: "Wonwoo Yoon", url: "https://metatake.net/editor" },
    publisher: { "@type": "Organization", "@id": "https://metatake.net/#org", name: "Metatake" },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Credits", item: "https://metatake.net/credits" },
      { "@type": "ListItem", position: 2, name: p.name },
    ],
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <div className="mt-wrap" style={{ maxWidth: 880, padding: "28px 20px 60px" }}>
        <div className="df-crumb" style={{ marginBottom: 14 }}>
          <Link href="/credits">Credits</Link><span className="df-sep">›</span><span>{p.name}</span>
        </div>

        <header style={{ display: "flex", gap: 22, alignItems: "flex-start", marginBottom: 18 }}>
          {p.profile_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={W185(p.profile_path)!} alt={p.name} width={110} height={165} style={{ borderRadius: 8, objectFit: "cover" }} />
          ) : null}
          <div>
            <h1 style={{ fontSize: 30, lineHeight: 1.15, margin: "2px 0 4px" }}>
              {p.name}{native ? <span style={{ fontWeight: 400, opacity: 0.75 }}> ({native})</span> : null}
            </h1>
            <p style={{ margin: "0 0 8px", opacity: 0.8 }}>
              {crafts.map((c) => CRAFTS[c.key].label).join(" · ")}
              {p.birthday ? ` · b. ${p.birthday.slice(0, 4)}${p.place_of_birth ? `, ${p.place_of_birth}` : ""}` : ""}
            </p>
            <p style={{ fontSize: 17, lineHeight: 1.6, maxWidth: "62ch", margin: 0 }}>
              {leadSentence(p.name, native, crafts, cat, company[0] ?? null)}
            </p>
            {directorHub ? (
              <p style={{ margin: "10px 0 0", fontSize: 15.5 }}>
                <Link className="rcp-h" style={{ display: "inline" }} href={`/director/${directorHub.slug}`}>
                  Directed {directorHub.n} film{directorHub.n === 1 ? "" : "s"} in the catalog → see the director hub
                </Link>
              </p>
            ) : null}
            <a
              href="#explorer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14,
                background: "#16233F", color: "#FBF8F1", padding: "9px 18px", borderRadius: 999,
                fontSize: 14, fontWeight: 600, textDecoration: "none", boxShadow: "0 1px 0 rgba(0,0,0,.15)",
              }}
            >
              <span aria-hidden style={{ color: "#E0922A" }}>◉</span>
              Play the collaboration map — live on this page ↓
            </a>
          </div>
        </header>

        {(() => {
          const facts = careerFacts(crafts);
          if (!facts) return null;
          const role = CRAFTS[mainCraft].role.toLowerCase();
          const startAge = p.birthday && facts.first ? facts.first - Number(p.birthday.slice(0, 4)) : null;
          const collabs = company.filter((d) => d.n >= 2).slice(0, 5).map((d) => {
            const their = cat.filter((f) => isRead(f) && f.director === d.name && f.year).sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
            return { ...d, first: their[0], last: their[their.length - 1] };
          });
          return (
            <section style={{ margin: "22px 0" }}>
              {/* At a glance — always visible; the full analysis unfolds below. */}
              <p style={{ fontSize: 15.5, lineHeight: 1.65, maxWidth: "72ch", margin: "0 0 10px" }}>
                <b>At a glance.</b> {facts.dated} dated credit{facts.dated === 1 ? "" : "s"} across{" "}
                {facts.decades.length} decade{facts.decades.length === 1 ? "" : "s"}, from{" "}
                <FilmRef f={facts.firstFilm} catByTmdb={catByTmdb} /> to <FilmRef f={facts.lastFilm} catByTmdb={catByTmdb} />
                {startAge && startAge > 10 && startAge < 80 ? <> — a career begun at {startAge}</> : null}.
                The {facts.peak[0]}s were the densest stretch: <b>{facts.peak[1].length}</b> of the {facts.dated} credits.
                {collabs[0] ? <> The defining partnership in our catalog: <b>{collabs[0].name}</b>, {collabs[0].n} films together.</> : null}
              </p>

              <details className="crd-more">
                <summary>The full analysis — every number, spelled out</summary>
                <div style={{ padding: "14px 2px 4px", lineHeight: 1.7, fontSize: 15 }}>
                  <h3 style={{ fontSize: 16, margin: "0 0 6px" }}>The career, decade by decade</h3>
                  <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 640, fontSize: 14.5 }}>
                    <thead>
                      <tr style={{ textAlign: "left", borderBottom: "2px solid #16233F" }}>
                        <th style={{ padding: "6px 10px 6px 0" }}>Decade</th>
                        <th style={{ padding: "6px 10px" }}>Credits</th>
                        <th style={{ padding: "6px 0" }}>Among them</th>
                      </tr>
                    </thead>
                    <tbody>
                      {facts.decades.map(([d, films]) => {
                        const notable = [...films].sort((a, b) => Number(!!catByTmdb.get(b.id)) - Number(!!catByTmdb.get(a.id)) || a.year - b.year).slice(0, 2);
                        return (
                          <tr key={d} style={{ borderBottom: "1px solid rgba(22,35,63,.12)", verticalAlign: "top" }}>
                            <td style={{ padding: "6px 10px 6px 0", whiteSpace: "nowrap" }}><b>{d}s</b></td>
                            <td style={{ padding: "6px 10px" }}>{films.length}</td>
                            <td style={{ padding: "6px 0" }}>
                              {notable.map((f, i) => <span key={f.id}>{i > 0 ? " · " : ""}<FilmRef f={f} catByTmdb={catByTmdb} /></span>)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p style={{ fontSize: 12.5, opacity: 0.65, margin: "6px 0 16px" }}>
                    How to read this: dated {role} credits from the TMDB filmography, grouped by release decade;
                    &ldquo;among them&rdquo; prefers films that are in the Metatake catalog (linked).
                  </p>

                  {collabs.length > 0 ? (
                    <>
                      <h3 style={{ fontSize: 16, margin: "14px 0 6px" }}>The collaborations, counted</h3>
                      {collabs.map((d) => (
                        <p key={d.name} style={{ margin: "0 0 8px" }}>
                          With {d.slug ? <Link href={`/director/${d.slug}`}><b>{d.name}</b></Link> : <b>{d.name}</b>}:{" "}
                          {d.n} film{d.n === 1 ? "" : "s"} in the catalog
                          {d.first && d.last && d.first !== d.last ? (
                            <> across {d.first.year}–{d.last.year}, from <Link href={`/film/${d.first.slug}`}>{d.first.title}</Link> to <Link href={`/film/${d.last.slug}`}>{d.last.title}</Link></>
                          ) : d.first ? (
                            <> — <Link href={`/film/${d.first.slug}`}>{d.first.title}</Link>{d.first.year ? ` (${d.first.year})` : ""}</>
                          ) : null}
                          .
                        </p>
                      ))}
                      <p style={{ fontSize: 12.5, opacity: 0.65, margin: "6px 0 16px" }}>
                        Counted across closely-read catalog films only — the real filmography together may be larger.
                      </p>
                    </>
                  ) : null}

                  <h3 style={{ fontSize: 16, margin: "14px 0 6px" }}>Where the work lives on Metatake</h3>
                  <p style={{ margin: 0 }}>
                    {readN} of {p.name}&apos;s films are read closely — figures, Strong Misreadings and Q&amp;A behind
                    each — and {cat.length - readN > 0 ? `${cat.length - readN} more sit in the catalog awaiting a close read` : "the rest of the filmography is tracked in the catalog"}.
                    {crafts.length > 1 ? <> Beyond {role}, the file also holds {crafts.slice(1).map((c, i) => <span key={c.key}>{i > 0 ? " and " : ""}{c.films.length} credit{c.films.length === 1 ? "" : "s"} as {CRAFTS[c.key].role.toLowerCase()}</span>)}.</> : null}
                  </p>
                </div>
              </details>
            </section>
          );
        })()}

        {repertory.length > 0 && (
          <section style={{ margin: "26px 0" }}>
            <h2 className="df-h2">The company they keep</h2>
            <p className="df-sub">Directors this {CRAFTS[mainCraft].role.toLowerCase()} keeps returning to, counted across the Metatake catalog.</p>
            <div className="rcp-list">
              {repertory.map((d) => (
                <div key={d.name} className="rcp-row">
                  {d.slug ? <Link className="rcp-h" href={`/director/${d.slug}`}>{d.name}</Link> : <span className="rcp-h">{d.name}</span>}
                  <div className="rcp-m">{d.n} films together</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {cat.length > 0 && (
          <section style={{ margin: "26px 0" }}>
            <h2 className="df-h2">In the Metatake catalog</h2>
            <p className="df-sub">
              {readN > 0 ? `${readN} of their films read closely — figures, strong misreadings and Q&A behind each link.` : ""}
              {cat.length > readN ? `${readN > 0 ? " " : ""}${cat.length - readN} more in the catalog, not yet read closely — marked “catalog”.` : ""}
            </p>
            <div className="rcp-list">
              {[...cat].sort((a, b) => (b.year ?? 0) - (a.year ?? 0)).map((f) => (
                <div key={f.slug} className="rcp-row">
                  <Link className="rcp-h" href={`/film/${f.slug}`}>
                    {f.title}{f.year ? ` (${f.year})` : ""}
                    {!isRead(f) && <span className="t2-chip">catalog</span>}
                  </Link>
                  <div className="rcp-m">{f.director ? `dir. ${f.director}` : ""}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {crafts.map((c) => (
          <section key={c.key} style={{ margin: "26px 0" }}>
            <h2 className="df-h2">{CRAFTS[c.key].label} — {c.films.length} films</h2>
            <p className="df-sub">Every {CRAFTS[c.key].role.toLowerCase()} credit on file, newest first. Linked titles are in the Metatake catalog; the rest are TMDB-only.</p>
            <p style={{ lineHeight: 1.8, maxWidth: "70ch" }}>
              {c.films.slice(0, 40).map((f, i) => {
                const catF = catByTmdb.get(f.id);
                return (
                  <span key={f.id}>
                    {i > 0 ? " · " : ""}
                    {catF ? <Link href={`/film/${catF.slug}`}>{f.title}</Link> : f.title}
                    {f.year ? ` (${f.year})` : ""}
                    {catF && !isRead(catF) ? <span className="t2-chip">catalog</span> : null}
                  </span>
                );
              })}
              {c.films.length > 40 ? ` · and ${c.films.length - 40} more` : ""}
            </p>
          </section>
        ))}

        <section id="explorer" style={{ margin: "44px 0 0", borderTop: "2px solid #16233F", paddingTop: 6 }}>
          <h2 className="df-h2" style={{ marginTop: 18 }}>The interactive layer</h2>
          <p className="df-sub">
            {p.name}&apos;s whole network, live — click any film or collaborator to keep following the credits without leaving this page.
          </p>
          <Suspense fallback={<div style={{ padding: "30px 0", opacity: 0.6 }}>Loading the map…</div>}>
            <CreditsExplorer embed initialP={id} initialC={mainCraft} />
          </Suspense>
        </section>

        <p style={{ fontSize: 12.5, opacity: 0.6, marginTop: 26 }}>
          Metatake Editorial · Filmography data from TMDB · Catalog readings by Metatake · Updated {updated}
        </p>
      </div>
    </div>
  );
}
