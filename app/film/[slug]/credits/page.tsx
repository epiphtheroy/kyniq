import { Suspense, type ReactNode } from "react";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import CreditsExplorer from "@/app/credits/CreditsExplorer";
import Byline from "@/components/Byline";
import Provenance from "@/components/Provenance";
import ReadHero from "@/components/read/ReadHero";
import ReadPlates from "@/components/read/ReadPlates";
import GrowStill from "@/components/read/GrowStill";
import { filmBackdropPaths, pickStills } from "@/lib/read-media";
import { pageRobots } from "@/lib/seo";
import { CRAFTS, type CraftKey, personSlug } from "@/app/credits/credits-logic";
import "@/app/curious/curious.css";
import "@/app/credits/credits.css"; // the embedded explorer's cr-* chrome
import "../read.css";

/**
 * /film/[slug]/credits — "Who made this film?" as an independent read page
 * (2026-07-08, promoted from the /credits?f= explorer view). Every sentence
 * is deterministic: for each key crew member (and the top of the bill), the
 * page counts their films with the director on TMDB's file and says which
 * meeting THIS film was — and how many more followed. The interactive
 * explorer stays as the play layer; production companies link out to TMDB
 * (an internal company layer would need its own tables — future work).
 */
export const revalidate = 86400;
export async function generateStaticParams() { return []; }

const KEY_CRAFTS: CraftKey[] = ["writer", "dp", "editor", "composer", "pd"];
const ROLE_NOUN: Record<string, string> = {
  writer: "writer", dp: "cinematographer", editor: "editor", composer: "composer", pd: "production designer",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

async function tm<T>(path: string): Promise<T | null> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) return null;
  const v4 = token.length > 40;
  const url = `https://api.themoviedb.org/3${path}${v4 ? "" : `${path.includes("?") ? "&" : "?"}api_key=${token}`}`;
  const r = await fetch(url, {
    headers: v4 ? { Authorization: `Bearer ${token}`, accept: "application/json" } : { accept: "application/json" },
    next: { revalidate: 86400 },
  }).catch(() => null);
  if (!r || !r.ok) return null;
  return (await r.json()) as T;
}

type TmMovie = {
  id: number; title: string;
  production_companies?: { id: number; name: string; origin_country?: string }[];
  credits?: {
    crew?: { id: number; name: string; job?: string; department?: string }[];
    cast?: { id: number; name: string; character?: string; order?: number }[];
  };
};
type TmPersonCredits = {
  crew?: { id: number; title?: string; release_date?: string; job?: string }[];
  cast?: { id: number; title?: string; release_date?: string }[];
};

type SharedFilm = { id: number; title: string; year: number };
type Relation = {
  personId: number; name: string; roleKey: CraftKey | "actor"; role: string;
  shared: SharedFilm[]; idx: number; // index of THIS film in shared (-1 if absent)
};

const yearOf = (d?: string) => Number((d || "").slice(0, 4)) || 0;

async function relationWithDirector(
  person: { id: number; name: string }, roleKey: CraftKey | "actor",
  directedIds: Map<number, { title: string; year: number }>, thisId: number,
): Promise<Relation | null> {
  const pc = await tm<TmPersonCredits>(`/person/${person.id}/movie_credits`);
  if (!pc) return null;
  const mine = new Map<number, { title: string; year: number }>();
  if (roleKey === "actor") {
    for (const c of pc.cast ?? []) mine.set(c.id, { title: c.title ?? `#${c.id}`, year: yearOf(c.release_date) });
  } else {
    const cf = CRAFTS[roleKey];
    for (const c of pc.crew ?? []) {
      if (c.job && cf.jobs.has(c.job)) mine.set(c.id, { title: c.title ?? `#${c.id}`, year: yearOf(c.release_date) });
    }
  }
  const shared: SharedFilm[] = [];
  for (const [fid, meta] of mine) {
    if (directedIds.has(fid)) shared.push({ id: fid, title: meta.title, year: meta.year });
  }
  shared.sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));
  const idx = shared.findIndex((f) => f.id === thisId);
  return { personId: person.id, name: person.name, roleKey, role: roleKey === "actor" ? "actor" : ROLE_NOUN[roleKey], shared, idx };
}

async function loadUncached(slug: string) {
  const supabase = db();
  const { data: film } = await supabase
    .from("films")
    .select("id, title, slug, year, director, director_slug, tmdb_id, poster_path, backdrop_path, visible")
    .eq("slug", slug)
    .maybeSingle<{ id: string; title: string; slug: string; year: number | null; director: string | null; director_slug: string | null; tmdb_id: number | null; poster_path: string | null; backdrop_path: string | null; visible: boolean | null }>();
  if (!film || !film.tmdb_id) return null;

  const [movie, { data: vidRows }] = await Promise.all([
    tm<TmMovie>(`/movie/${film.tmdb_id}?append_to_response=credits`),
    supabase.from("media").select("external_id, title").eq("entity_type", "film").eq("entity_id", film.id)
      .eq("status", "published").eq("kind", "video").order("position"),
  ]);
  if (!movie) return null;

  const crewAll = movie.credits?.crew ?? [];
  const directorEntry = crewAll.find((c) => c.job === "Director") ?? null;

  // Key crew, one group per craft (up to 2 names each — the signing crafts).
  const crew: { craft: CraftKey; people: { id: number; name: string }[] }[] = [];
  for (const key of KEY_CRAFTS) {
    const cf = CRAFTS[key];
    const seen = new Map<number, { id: number; name: string }>();
    for (const c of crewAll) {
      if (c.job && cf.jobs.has(c.job) && c.department && cf.depts.includes(c.department)) seen.set(c.id, { id: c.id, name: c.name });
    }
    if (seen.size) crew.push({ craft: key, people: [...seen.values()].slice(0, 2) });
  }
  const topCast = [...(movie.credits?.cast ?? [])].sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).slice(0, 5)
    .map((c) => ({ id: c.id, name: c.name, character: c.character ?? null }));

  // Relationship engine — director's directed set, then each person's overlap.
  let directorFilmog: SharedFilm[] = [];
  const relations: Relation[] = [];
  if (directorEntry) {
    const dc = await tm<TmPersonCredits>(`/person/${directorEntry.id}/movie_credits`);
    const directed = new Map<number, { title: string; year: number }>();
    for (const c of dc?.crew ?? []) {
      if (c.job === "Director") directed.set(c.id, { title: c.title ?? `#${c.id}`, year: yearOf(c.release_date) });
    }
    directorFilmog = [...directed.entries()].map(([id, m]) => ({ id, ...m })).filter((f) => f.year > 1880)
      .sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));
    const subjects: { p: { id: number; name: string }; roleKey: CraftKey | "actor" }[] = [];
    for (const g of crew) for (const p of g.people.slice(0, 1)) if (p.id !== directorEntry.id) subjects.push({ p, roleKey: g.craft });
    for (const c of topCast.slice(0, 3)) if (c.id !== directorEntry.id) subjects.push({ p: c, roleKey: "actor" });
    const settled = await Promise.all(subjects.map((s) => relationWithDirector(s.p, s.roleKey, directed, film.tmdb_id!).catch(() => null)));
    for (const r of settled) if (r && r.shared.length) relations.push(r);
  }

  // Catalog links for every film mentioned in a sentence.
  const mentioned = new Set<number>([film.tmdb_id]);
  for (const r of relations) for (const f of r.shared) mentioned.add(f.id);
  for (const f of directorFilmog.slice(0, 1)) mentioned.add(f.id);
  for (const f of directorFilmog.slice(-1)) mentioned.add(f.id);
  const slugByTmdb = new Map<number, string>();
  const ids = [...mentioned];
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase.from("films").select("tmdb_id, slug").in("tmdb_id", ids.slice(i, i + 150));
    for (const row of (data ?? []) as { tmdb_id: number; slug: string }[]) slugByTmdb.set(row.tmdb_id, row.slug);
  }

  const vids = ((vidRows ?? []) as { external_id: string | null; title: string | null }[]).filter((v) => v.external_id);
  const isTrailerTitle = (t: string | null) => !!t && /trailer|teaser/i.test(t);
  const videos = [...vids.filter((v) => !isTrailerTitle(v.title)), ...vids.filter((v) => isTrailerTitle(v.title))]
    .map((v) => ({ id: v.external_id as string, title: v.title ?? "" }));

  return {
    film: { title: film.title, slug: film.slug, year: film.year, director: film.director, director_slug: film.director_slug, tmdb_id: film.tmdb_id, backdrop_path: film.backdrop_path, visible: film.visible },
    director: directorEntry ? { id: directorEntry.id, name: directorEntry.name } : null,
    directorFilmog,
    crew,
    topCast,
    companies: (movie.production_companies ?? []).slice(0, 8),
    relations,
    videos,
    slugByTmdb: [...slugByTmdb.entries()],
  };
}

function load(slug: string) {
  return unstable_cache(() => loadUncached(slug), ["film-credits-page-1", slug], {
    revalidate: 86400,
    tags: [`film:${slug}`],
  })();
}

type Props = { params: Promise<{ slug: string }> };
const yStr = (y: number | null) => (y ? ` (${y})` : "");
const ordinal = (n: number) => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  const u = n % 10;
  return `${n}${u === 1 ? "st" : u === 2 ? "nd" : u === 3 ? "rd" : "th"}`;
};

function dekText(d: { film: { title: string }; director: { name: string } | null; crew: { craft: CraftKey; people: { name: string }[] }[] }): string {
  const bits: string[] = [];
  if (d.director) bits.push(`directed by ${d.director.name}`);
  const VERB: Record<string, string> = { writer: "written by", dp: "shot by", editor: "cut by", composer: "scored by", pd: "designed by" };
  for (const g of d.crew) bits.push(`${VERB[g.craft]} ${g.people.map((p) => p.name).join(" & ")}`);
  return `${d.film.title} was ${bits.join("; ")} — and below, the page counts how many times each of them had met the director before, and how many times they would meet again.`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  const { film, crew } = data;
  const title = `Who Made ${film.title}${yStr(film.year)}? — the Crew, Credit by Credit`;
  let description = dekText(data);
  if (description.length > 158) description = description.slice(0, 155).replace(/\s+\S*$/, "") + "…";
  return {
    title,
    description,
    alternates: { canonical: `/film/${slug}/credits` },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
    robots: pageRobots(film.visible !== false && crew.length >= 2),
  };
}

export default async function FilmCreditsPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { film, director, directorFilmog, crew, topCast, companies, relations, videos } = data;
  const slugByTmdb = new Map(data.slugByTmdb);
  const titleYear = `${film.title}${yStr(film.year)}`;
  const updated = new Date().toISOString().slice(0, 10);

  const FilmT = ({ f }: { f: SharedFilm }) => {
    const s = f.id === film.tmdb_id ? film.slug : slugByTmdb.get(f.id);
    return <>{s ? <Link href={`/film/${s}`}>{f.title}</Link> : <i>{f.title}</i>}{f.year ? ` (${f.year})` : ""}</>;
  };
  const PersonT = ({ r }: { r: Relation }) =>
    r.roleKey === "actor"
      ? <b>{r.name}</b>
      : <Link href={`/credits/${personSlug(r.name, r.personId)}`}><b>{r.name}</b></Link>;
  const DirT = () =>
    director
      ? (film.director_slug && film.director === director.name
          ? <Link href={`/director/${film.director_slug}`}><b>{director.name}</b></Link>
          : <b>{director?.name}</b>)
      : null;
  const list = (xs: ReactNode[]) =>
    xs.map((x, i) => <span key={i}>{i > 0 ? (i === xs.length - 1 ? " and " : ", ") : ""}{x}</span>);

  // One deterministic sentence per relation — the ordinal meeting + what followed.
  const RelSentence = ({ r }: { r: Relation }) => {
    const n = r.shared.length;
    if (r.idx === -1) {
      return <>TMDB files {n} film{n === 1 ? "" : "s"} between director <DirT /> and {r.role} <PersonT r={r} />: {list(r.shared.slice(0, 3).map((f) => <FilmT key={f.id} f={f} />))}{n > 3 ? `, and ${n - 3} more` : ""}.</>;
    }
    if (n === 1) {
      return <>{titleYear} was the only film between director <DirT /> and {r.role} <PersonT r={r} /> on TMDB&apos;s file.</>;
    }
    const after = r.shared.slice(r.idx + 1);
    const before = r.shared.slice(0, r.idx);
    if (r.idx === 0) {
      return <>{titleYear} was the <b>first</b> of {n} films between director <DirT /> and {r.role} <PersonT r={r} />; {list(after.slice(0, 3).map((f) => <FilmT key={f.id} f={f} />))}{after.length > 3 ? `, and ${after.length - 3} more` : ""} followed.</>;
    }
    if (after.length === 0) {
      return <>{titleYear} was the <b>{ordinal(r.idx + 1)} and most recent</b> of {n} films between director <DirT /> and {r.role} <PersonT r={r} />, after {list(before.slice(-2).map((f) => <FilmT key={f.id} f={f} />))}.</>;
    }
    return <>{titleYear} was the <b>{ordinal(r.idx + 1)}</b> of {n} films between director <DirT /> and {r.role} <PersonT r={r} /> — after {list(before.slice(-2).map((f) => <FilmT key={f.id} f={f} />))}; {after.length === 1 ? <>one more followed: <FilmT f={after[0]} /></> : <>{after.length} more followed, from <FilmT f={after[0]} /> to <FilmT f={after[after.length - 1]} /></>}.</>;
  };

  const gallery = await filmBackdropPaths(film.tmdb_id);
  const artPicks = pickStills(gallery, `${film.slug}:credits`, 5);
  const still = artPicks[0] ?? null;
  const plateArt = [...artPicks.slice(1), ...(film.backdrop_path ? [film.backdrop_path] : [])];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    url: `https://metatake.net/film/${film.slug}/credits`,
    name: `Who made ${titleYear}?`,
    about: { "@type": "Movie", "@id": `https://metatake.net/film/${film.slug}`, name: film.title },
    author: { "@type": "Organization", "@id": "https://metatake.net/#org", name: "Metatake" },
    editor: { "@type": "Person", "@id": "https://metatake.net/editor#person", name: "Wonwoo Yoon", url: "https://metatake.net/editor" },
    publisher: { "@type": "Organization", "@id": "https://metatake.net/#org", name: "Metatake" },
    dateModified: updated,
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Films", item: "https://metatake.net/film" },
      { "@type": "ListItem", position: 2, name: titleYear, item: `https://metatake.net/film/${film.slug}` },
      { "@type": "ListItem", position: 3, name: "Credits", item: `https://metatake.net/film/${film.slug}/credits` },
    ],
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <ReadHero
        film={{ title: film.title, slug: film.slug, year: film.year }}
        crumbTail="Credits"
        chip={<><Link href="/credits" style={{ color: "inherit", textDecoration: "none" }}>Credits</Link>{" · "}who made it, counted</>}
        meta={<>{crew.length} key crafts · {companies.length} companies · data from TMDB</>}
        title={<>Who made {titleYear}?</>}
        dek={dekText(data)}
        videos={videos}
        backdropPath={film.backdrop_path}
      />

      <div className="mt-wrap" style={{ maxWidth: 880, padding: "24px 20px 40px" }}>
        <Byline created={updated} />

        <section style={{ margin: "14px 0 0" }}>
          <h2 className="df-h2">The crew — and which meeting this was</h2>
          <p className="df-sub">
            For each signing craft, how many films the person and the director have on file together, which
            meeting {film.title} was, and what followed. Counted from TMDB&apos;s records; analysis by Metatake.
          </p>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7, fontSize: 15, maxWidth: "78ch" }}>
            {director && directorFilmog.length > 0 ? (
              <li style={{ margin: "0 0 8px" }}>
                {titleYear} was directed by <DirT />; TMDB files {directorFilmog.length} directing credit{directorFilmog.length === 1 ? "" : "s"} for {director.name}, from <FilmT f={directorFilmog[0]} /> to <FilmT f={directorFilmog[directorFilmog.length - 1]} />.
              </li>
            ) : null}
            {relations.filter((r) => r.roleKey !== "actor").map((r) => (
              <li key={`${r.personId}-${r.roleKey}`} style={{ margin: "0 0 8px" }}>
                The {r.role} was <PersonT r={r} />. <RelSentence r={r} />
              </li>
            ))}
            {crew.filter((g) => !relations.some((r) => r.roleKey === g.craft)).map((g) => (
              <li key={g.craft} style={{ margin: "0 0 8px" }}>
                The {ROLE_NOUN[g.craft]} credit on {film.title} belongs to {list(g.people.map((p) => <Link key={p.id} href={`/credits/${personSlug(p.name, p.id)}`}><b>{p.name}</b></Link>))} — no shared history with the director on file.
              </li>
            ))}
          </ul>
        </section>

        {still ? (
          <GrowStill
            src={`https://image.tmdb.org/t/p/w1280${still}`}
            alt={`${film.title} still`}
            caption={`${titleYear}${director ? ` — directed by ${director.name}` : ""} · via TMDB`}
          />
        ) : null}

        {topCast.length > 0 ? (
          <section style={{ margin: "26px 0 0" }}>
            <h2 className="df-h2">The top of the bill</h2>
            <p className="df-sub">The first names on the cast list — and their own history with the director.</p>
            <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7, fontSize: 15, maxWidth: "78ch" }}>
              <li style={{ margin: "0 0 8px" }}>
                The cast of {titleYear} was led by {list(topCast.map((c) => <b key={c.id}>{c.name}</b>))}.
              </li>
              {relations.filter((r) => r.roleKey === "actor").map((r) => (
                <li key={r.personId} style={{ margin: "0 0 8px" }}><RelSentence r={r} /></li>
              ))}
            </ul>
          </section>
        ) : null}

        {companies.length > 0 ? (
          <section style={{ margin: "26px 0 0" }}>
            <h2 className="df-h2">The companies behind it</h2>
            <p className="df-sub">Production companies on TMDB&apos;s record — the links open their TMDB pages.</p>
            <p style={{ lineHeight: 1.8, maxWidth: "78ch", margin: 0, fontSize: 15 }}>
              {titleYear} was produced by{" "}
              {list(companies.map((c) => (
                <a key={c.id} href={`https://www.themoviedb.org/company/${c.id}`} target="_blank" rel="noopener noreferrer">
                  <b>{c.name}</b>{c.origin_country ? ` (${c.origin_country})` : ""} ↗
                </a>
              )))}
              .
            </p>
          </section>
        ) : null}

        <section id="explorer" style={{ margin: "40px 0 0", borderTop: "2px solid #16233F", paddingTop: 6 }}>
          <h2 className="df-h2" style={{ marginTop: 18 }}>The collaboration map — live</h2>
          <p className="df-sub">
            The whole crew network of {film.title}, right here — every name opens their own credits page.
          </p>
          <Suspense fallback={<div style={{ padding: "30px 0", opacity: 0.6 }}>Loading the map…</div>}>
            <CreditsExplorer embed initialF={film.tmdb_id!} />
          </Suspense>
        </section>

        <p style={{ fontSize: 12.5, opacity: 0.6, marginTop: 22 }}>
          Analysis by Metatake Editorial · edited by <Link href="/editor">Wonwoo Yoon</Link> · credits &amp; company data from{" "}
          <a href={`https://www.themoviedb.org/movie/${film.tmdb_id}`} target="_blank" rel="noopener noreferrer">TMDB ↗</a> · Updated {updated}
        </p>
        <Provenance created={updated} />

        <p style={{ marginTop: 18 }}>
          <Link href={`/film/${film.slug}`}>← Everything on {titleYear}</Link>
        </p>
      </div>

      <ReadPlates slug={film.slug} exclude="credits" artPaths={plateArt} />
    </div>
  );
}
