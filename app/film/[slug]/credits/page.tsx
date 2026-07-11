import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import Byline from "@/components/Byline";
import Provenance from "@/components/Provenance";
import ReadHero from "@/components/read/ReadHero";
import ReadPlates from "@/components/read/ReadPlates";
import GrowStill from "@/components/read/GrowStill";
import MakerPanels from "@/components/read/MakerPanels";
import QuickAnswers, { type QuickAnswerItem } from "@/components/read/QuickAnswers";
import { filmBackdropPaths, pickStills } from "@/lib/read-media";
import { filmCreditsData, ordinal, ROLE_NOUN, type Relation, type SharedFilm } from "@/lib/film-credits-data";
import { pageRobots } from "@/lib/seo";
import { type CraftKey, personSlug } from "@/app/credits/credits-logic";
import "@/app/curious/curious.css";
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

type Props = { params: Promise<{ slug: string }> };
const yStr = (y: number | null) => (y ? ` (${y})` : "");
const load = filmCreditsData;

// ── Quick answers (docs/PLAN-intent-coverage.md §0 charter + §5.5) ─────────
// Deterministic Q&A from the credits payload already in scope: every name is
// verbatim from a TMDB row, a question is emitted only when its answer exists,
// and the character line appears ONLY when the top-billed row carries one.
// Search-term variants are woven, max two uses each: "directed" (Q1), "stars"
// (the cast Q) with "cast" (its answer), and "plays" (the character Q + its
// answer). Crew names carry no tracked variant and are exempt.
const andJoin = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? "") : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

function creditsQuickAnswers(
  film: { title: string; director: string | null },
  director: { name: string } | null,
  crew: { craft: CraftKey; people: { name: string }[] }[],
  topCast: { name: string; character: string | null }[],
  relations: Relation[],
): QuickAnswerItem[] {
  const items: QuickAnswerItem[] = [];
  const dName = director?.name ?? film.director ?? null;
  // 1 — the head "who directed X" query.
  if (dName) items.push({ q: `Who directed ${film.title}?`, a: dName });
  // 2 — up to two signing crafts, most search-worthy first (writer, dp, composer).
  const CRAFT_Q: Partial<Record<CraftKey, string>> = {
    writer: `Who wrote ${film.title}?`,
    dp: `Who shot ${film.title}?`,
    composer: `Who composed the music for ${film.title}?`,
  };
  let usedCrafts = 0;
  for (const key of ["writer", "dp", "composer"] as CraftKey[]) {
    if (usedCrafts >= 2) break;
    const g = crew.find((c) => c.craft === key);
    if (g && g.people.length) {
      items.push({ q: CRAFT_Q[key]!, a: andJoin(g.people.map((p) => p.name)) });
      usedCrafts += 1;
    }
  }
  // 3 — the top of the bill.
  if (topCast.length > 0) {
    items.push({ q: `Who stars in ${film.title}?`, a: `The cast is led by ${andJoin(topCast.slice(0, 5).map((c) => c.name))}.` });
    // Character line ONLY when a top-billed row actually carries a character.
    const withChar = topCast.find((c) => (c.character ?? "").trim());
    if (withChar) {
      const ch = (withChar.character ?? "").trim();
      items.push({ q: `Who plays ${ch} in ${film.title}?`, a: `${withChar.name} plays ${ch}.` });
    }
  }
  // 4 — collaboration history, from the relation rows only (idx = this film's
  // place in the shared run; -1 if absent, 0 if first).
  if (dName) {
    const cand = relations
      .filter((r) => r.idx === 0 || r.shared.length > 1)
      .sort((a, b) => b.shared.length - a.shared.length)[0];
    if (cand) {
      const n = cand.shared.length;
      let a: string;
      if (cand.idx > 0) a = `Yes — ${film.title} was the ${ordinal(cand.idx + 1)} of ${n} films ${dName} and ${cand.name} have made together on TMDB's file.`;
      else if (n > 1) a = `${film.title} was the first of ${n} films ${dName} and ${cand.name} would make together — ${n - 1} more followed.`;
      else a = `No — ${film.title} is their only film together on TMDB's file.`;
      items.push({ q: `Have ${dName} and ${cand.name} worked together before?`, a });
    }
  }
  return items.slice(0, 5);
}

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
            {relations.filter((r) => r.roleKey !== "actor" && r.shared.length > 0).map((r) => (
              <li key={`${r.personId}-${r.roleKey}`} style={{ margin: "0 0 8px" }}>
                The {r.role} was <PersonT r={r} />. <RelSentence r={r} />
              </li>
            ))}
            {crew.filter((g) => !relations.some((r) => r.roleKey === g.craft && r.shared.length > 0)).map((g) => (
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
              {relations.filter((r) => r.roleKey === "actor" && r.shared.length > 0).map((r) => (
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

        <section id="the-makers" style={{ margin: "40px 0 0", borderTop: "2px solid #16233F", paddingTop: 6 }}>
          <h2 className="df-h2" style={{ marginTop: 18 }}>The makers — open their files</h2>
          <p className="df-sub">
            One panel per craft. Each opens the person&apos;s own page: everything they&apos;ve made, and who they made it with.
          </p>
          <MakerPanels payload={data} />
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
