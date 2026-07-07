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
  if (read) parts.push(`${read} of them are read closely on Metatake.`);
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
  // Partnerships — directors they keep working with, counted across the WHOLE
  // Metatake catalog (both tiers). Self-collaborations excluded (a director-
  // writer is not "collaborating with" themselves).
  const byDir = new Map<string, { name: string; slug: string | null; n: number }>();
  for (const f of cat) {
    if (!f.director || f.director === p.name) continue;
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
  const catByTmdb = new Map(cat.map((f) => [f.tmdb_id, f]));
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
          const role = CRAFTS[mainCraft].role.toLowerCase();
          const VERB: Record<string, string> = { writer: "wrote", dp: "shot", editor: "cut", composer: "scored", pd: "designed" };
          const verb = VERB[mainCraft] ?? "made";
          const startAge = facts && p.birthday && facts.first ? facts.first - Number(p.birthday.slice(0, 4)) : null;
          // Partnerships across the whole catalog, newest data model: per
          // director, every catalog film with years — self excluded upstream.
          const byName = new Map<string, CatFilm[]>();
          for (const f of cat) {
            if (!f.director || f.director === p.name) continue;
            byName.set(f.director, [...(byName.get(f.director) ?? []), f]);
          }
          const partnerships = [...byName.entries()]
            .map(([name, films]) => ({
              name,
              slug: films.find((f) => f.director_slug)?.director_slug ?? null,
              films: [...films].sort((a, b) => (a.year ?? 0) - (b.year ?? 0)),
            }))
            .sort((a, b) => b.films.length - a.films.length || a.name.localeCompare(b.name));
          const multi = partnerships.filter((x) => x.films.length >= 2);
          const singles = partnerships.filter((x) => x.films.length === 1 && isRead(x.films[0]));

          const Bullet = ({ pr }: { pr: (typeof multi)[number] }) => {
            const years = pr.films.map((f) => f.year).filter(Boolean) as number[];
            const span = years.length > 1 && Math.min(...years) !== Math.max(...years) ? `${Math.min(...years)}–${Math.max(...years)}` : years[0] ? String(years[0]) : "";
            const shown = pr.films.slice(0, 4);
            return (
              <li style={{ margin: "0 0 10px" }}>
                <b>{p.name}</b> {verb} <b>{pr.films.length}</b> film{pr.films.length === 1 ? "" : "s"} for{" "}
                {pr.slug ? <Link href={`/director/${pr.slug}`}><b>{pr.name}</b></Link> : <b>{pr.name}</b>}
                {span ? ` (${span})` : ""}:{" "}
                {shown.map((f, i) => (
                  <span key={f.slug}>
                    {i > 0 ? ", " : ""}
                    <Link href={`/film/${f.slug}`}>{f.title}</Link>
                    {f.year ? ` (${f.year})` : ""}
                  </span>
                ))}
                {pr.films.length > shown.length ? `, and ${pr.films.length - shown.length} more` : ""}.
              </li>
            );
          };

          return (
            <>
              {facts ? (
                <p style={{ fontSize: 15.5, lineHeight: 1.65, maxWidth: "72ch", margin: "22px 0 10px" }}>
                  <b>At a glance.</b> {facts.dated} dated credit{facts.dated === 1 ? "" : "s"} across{" "}
                  {facts.decades.length} decade{facts.decades.length === 1 ? "" : "s"}, from{" "}
                  <FilmRef f={facts.firstFilm} catByTmdb={catByTmdb} /> to <FilmRef f={facts.lastFilm} catByTmdb={catByTmdb} />
                  {startAge && startAge > 10 && startAge < 80 ? <> — a career begun at {startAge}</> : null}.
                  The {facts.peak[0]}s were the densest stretch: <b>{facts.peak[1].length}</b> of the {facts.dated} credits.
                  {multi[0] ? <> The defining partnership: <b>{multi[0].name}</b>, {multi[0].films.length} films together.</> : null}
                </p>
              ) : null}

              {(multi.length > 0 || singles.length > 0) && (
                <section style={{ margin: "26px 0" }}>
                  <h2 className="df-h2">The collaborations, counted</h2>
                  <p className="df-sub">
                    Every partnership on file in the Metatake catalog, {role}-side — counted from our film records,
                    so the true totals may run larger. Analysis by Metatake; filmography via TMDB.
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.65, fontSize: 15, maxWidth: "76ch" }}>
                    {multi.slice(0, 10).map((pr) => <Bullet key={pr.name} pr={pr} />)}
                  </ul>
                  {(multi.length > 10 || singles.length > 0) && (
                    <details className="crd-more" style={{ marginTop: 10 }}>
                      <summary>Every partnership, spelled out</summary>
                      <div style={{ padding: "12px 2px 8px" }}>
                        {multi.length > 10 ? (
                          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.65, fontSize: 15, maxWidth: "76ch" }}>
                            {multi.slice(10).map((pr) => <Bullet key={pr.name} pr={pr} />)}
                          </ul>
                        ) : null}
                        {singles.length > 0 ? (
                          <p style={{ margin: multi.length > 10 ? "10px 0 0" : 0, lineHeight: 1.8, fontSize: 15, maxWidth: "76ch" }}>
                            One film apiece:{" "}
                            {singles.slice(0, 12).map((pr, i) => (
                              <span key={pr.name}>
                                {i > 0 ? " · " : ""}
                                with {pr.slug ? <Link href={`/director/${pr.slug}`}>{pr.name}</Link> : pr.name}{" "}
                                (<Link href={`/film/${pr.films[0].slug}`}>{pr.films[0].title}</Link>{pr.films[0].year ? `, ${pr.films[0].year}` : ""})
                              </span>
                            ))}
                            .
                          </p>
                        ) : null}
                      </div>
                    </details>
                  )}
                </section>
              )}
            </>
          );
        })()}

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
          Analysis by Metatake Editorial · edited by <Link href="/editor">Wonwoo Yoon</Link> · filmography data from{" "}
          <a href={`https://www.themoviedb.org/person/${id}`} target="_blank" rel="noopener noreferrer">TMDB ↗</a>
          {p.external_ids?.imdb_id ? <> · <a href={`https://www.imdb.com/name/${p.external_ids.imdb_id}/`} target="_blank" rel="noopener noreferrer">IMDb ↗</a></> : null}
          {" "}· Updated {updated}
        </p>
      </div>
    </div>
  );
}
