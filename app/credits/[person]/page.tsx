import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import SiteNav from "@/components/home2/SiteNav";
import GrowStill from "@/components/read/GrowStill";
import CreditsExplorer from "../CreditsExplorer";
import {
  CRAFTS, FAM, type Api, type ArtistData, type Collab, type CraftKey, type GrpKey, type TFilm,
  computeArtist, img, personSlug,
} from "../credits-logic";
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

const yrs = (c: { y0: number; y1: number }) => (c.y0 === c.y1 ? String(c.y0) : `${c.y0}–${c.y1}`);

const FilmRef = ({ f, catByTmdb }: { f: CraftFilm; catByTmdb: Map<number, CatFilm> }) => {
  const c = catByTmdb.get(f.id);
  return <>{c ? <Link href={`/film/${c.slug}`}>{f.title}</Link> : <i>{f.title}</i>}{f.year ? ` (${f.year})` : ""}</>;
};

/* Server-side TMDB adapter for computeArtist — the SAME aggregation the
   interactive explorer runs client-side, so the sentences below and the play
   layer can never disagree. Fetches are Next-cached for a day. */
const tmdbApi: Api = async (path, params) => {
  const token = process.env.TMDB_READ_TOKEN!;
  const v4 = token.length > 40;
  const u = new URL(`https://api.themoviedb.org/3${path}`);
  for (const [k, v] of Object.entries(params ?? {})) u.searchParams.set(k, v);
  if (!v4) u.searchParams.set("api_key", token);
  const r = await fetch(u, {
    headers: v4 ? { Authorization: `Bearer ${token}`, accept: "application/json" } : { accept: "application/json" },
    next: { revalidate: 86400 },
  });
  if (!r.ok) throw new Error(`tmdb ${r.status}`);
  return r.json();
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
  const [native, directorHub, artistRaw] = await Promise.all([
    resolveNative({ tmdbId: id, name: p.name, aliases: p.also_known_as, place: p.place_of_birth }),
    directorHubFor(p),
    computeArtist(tmdbApi, id, crafts[0].key).catch(() => null),
  ]);
  const artist = artistRaw && !("empty" in artistRaw) ? (artistRaw as ArtistData) : null;
  return { id, p, crafts, cat, company, native, directorHub, artist };
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
  const { id, p, crafts, cat, company, native, directorHub, artist } = data;
  const mainCraft = crafts[0].key;
  const catByTmdb = new Map(cat.map((f) => [f.tmdb_id, f]));
  // Representative stills — the subject's films with backdrops, catalog-read
  // films first, spread across the years (deterministic; no ratings involved).
  const STILL_VERB: Record<string, string> = { dp: "shot by", editor: "cut by", composer: "scored by", pd: "production design by", writer: "written by" };
  const stills = (() => {
    if (!artist) return [] as { src: string; alt: string; caption: string }[];
    const cands = artist.films.filter((f) => f.backdrop && f.year > 1880);
    const isReadFilm = (fid: number) => { const c = catByTmdb.get(fid); return !!c && isRead(c); };
    const readC = cands.filter((f) => isReadFilm(f.id)).sort((a, b) => a.year - b.year);
    const rest = cands.filter((f) => !isReadFilm(f.id)).sort((a, b) => a.year - b.year);
    const spread = <T,>(arr: T[], n: number): T[] =>
      arr.length <= n ? arr : n === 1 ? [arr[0]] : n === 2 ? [arr[0], arr[arr.length - 1]] : [arr[0], arr[Math.floor(arr.length / 2)], arr[arr.length - 1]];
    const picked = [...spread(readC, 3)];
    if (picked.length < 3) picked.push(...spread(rest, 3 - picked.length));
    const verb = STILL_VERB[mainCraft] ?? "by";
    return picked.map((f) => ({
      src: `https://image.tmdb.org/t/p/w1280${f.backdrop}`,
      alt: `${f.title} still`,
      caption: `${f.title}${f.year ? ` (${f.year})` : ""} — ${verb} ${p.name} · via TMDB`,
    }));
  })();
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

        {stills[0] ? <GrowStill {...stills[0]} /> : null}

        {(() => {
          /* ── Verbalization engine (credits-verbalization-spec.md, 2026-07-08).
             Every sentence: (1) contains the subject's full name, (2) carries at
             least one concrete value (year, count, title, name), (3) uses only
             deterministic operations — count, min/max, first/last, decade
             buckets, ranges, role groups. Forbidden: derived arithmetic (ages,
             career lengths), evaluation, ratings/curation, filled-in gaps. ── */
          const facts = careerFacts(crafts);
          if (!facts) return null;
          const NAME = p.name;
          const dept = CRAFTS[mainCraft].label.toLowerCase(); // credit noun: "score credit" etc.
          const ord = (n: number) => {
            const t = n % 100;
            if (t >= 11 && t <= 13) return `${n}th`;
            return `${n}${["th", "st", "nd", "rd"][Math.min(n % 10, 4) % 4] ?? "th"}`;
          };
          const andList = (xs: ReactNode[]) =>
            xs.map((x, i) => <span key={i}>{i > 0 ? (i === xs.length - 1 ? " and " : ", ") : ""}{x}</span>);
          const FilmT = ({ f }: { f: TFilm }) => {
            const c = catByTmdb.get(f.id);
            return <>{c ? <Link href={`/film/${c.slug}`}>{f.title}</Link> : <i>{f.title}</i>}{f.year ? ` (${f.year})` : ""}</>;
          };
          const GRP_NOUN: Record<GrpKey, string> = {
            director: "director", dp: "cinematographer", editor: "editor", composer: "composer",
            pd: "production designer", writer: "writer", producer: "producer", actor: "actor",
          };
          const KEY_GRPS: GrpKey[] = ["dp", "editor", "composer", "pd", "writer"];
          const dirSlugByName = new Map(cat.filter((f) => f.director && f.director_slug).map((f) => [f.director as string, f.director_slug as string]));
          const PersonT = ({ c, withRole = false }: { c: Collab; withRole?: boolean }) => {
            const role = withRole ? `${GRP_NOUN[c.grp]} ` : "";
            if (c.grp === "director" && dirSlugByName.has(c.name)) {
              return <>{role}<Link href={`/director/${dirSlugByName.get(c.name)}`}><b>{c.name}</b></Link></>;
            }
            if (KEY_GRPS.includes(c.grp)) return <>{role}<Link href={`/credits/${personSlug(c.name, c.id)}`}><b>{c.name}</b></Link></>;
            return <>{role}<b>{c.name}</b></>;
          };
          const spanTxt = (y0: number, y1: number) => (y0 && y1 && y0 !== y1 ? `between ${y0} and ${y1}` : y0 ? `in ${y0}` : "");
          const latestYear = facts.last;

          // troupe (the regulars): same thresholds as the explorer — crew ≥2
          // films, producers/cast ≥3. Self never appears (excluded upstream).
          const troupe = (artist?.troupe ?? []).slice().sort((a, b) => b.count - a.count || a.y0 - b.y0 || a.name.localeCompare(b.name));
          const corpusN = artist?.corpus.length ?? 0;
          const filmsN = artist?.films.length ?? facts.dated;
          const maxCount = troupe[0]?.count ?? 0;
          const tops = troupe.filter((t) => t.count === maxCount);
          const listFilms = (fs: TFilm[], cap = 8) => (
            <>
              {andList(fs.slice(0, cap).map((f) => <FilmT key={f.id} f={f} />))}
              {fs.length > cap ? `, and ${fs.length - cap} more` : ""}
            </>
          );

          // Per-film index of regulars (corpus films, chronological) — spec §D.
          const corpusFilms = (artist?.corpus ?? []).filter((f) => f.year).slice().sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));
          const regularsOf = (fid: number) => troupe.filter((t) => t.filmIds.has(fid));
          const withRegulars = corpusFilms.filter((f) => regularsOf(f.id).length > 0);
          const withoutRegulars = corpusFilms.filter((f) => regularsOf(f.id).length === 0);
          const fullestN = Math.max(0, ...withRegulars.map((f) => regularsOf(f.id).length));
          const fullest = withRegulars.filter((f) => regularsOf(f.id).length === fullestN);

          // Role-group sentences + succession (non-overlapping runs only).
          const byGrp = new Map<GrpKey, Collab[]>();
          for (const t of troupe) byGrp.set(t.grp, [...(byGrp.get(t.grp) ?? []), t]);

          const peakList = facts.peak[1].slice().sort((a, b) => a.year - b.year);

          return (
            <>
              <section style={{ margin: "24px 0" }}>
                <h2 className="df-h2">The facts, spelled out</h2>
                <p className="df-sub">Assembled sentence by sentence from the TMDB filmography and the Metatake catalog — counts, years and names only, no interpretation.</p>
                <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7, fontSize: 15, maxWidth: "78ch" }}>
                  {p.birthday && p.place_of_birth ? (
                    <li>{NAME} was born in {p.place_of_birth} in {p.birthday.slice(0, 4)}.</li>
                  ) : null}
                  <li>
                    {NAME} has {facts.dated} {dept} credit{facts.dated === 1 ? "" : "s"} on file, from {facts.first} to {facts.last}.
                  </li>
                  <li>
                    {NAME}&apos;s first {dept} credit was <FilmRef f={facts.firstFilm} catByTmdb={catByTmdb} />; the most recent was <FilmRef f={facts.lastFilm} catByTmdb={catByTmdb} />.
                  </li>
                  <li>
                    {NAME}&apos;s {facts.dated} credits spread across {facts.decades.length} decade{facts.decades.length === 1 ? "" : "s"}, from the {facts.decades[0][0]}s to the {facts.decades[facts.decades.length - 1][0]}s.
                  </li>
                  <li>
                    The decade with the most {NAME} credits was the {facts.peak[0]}s — {facts.peak[1].length} of the {facts.dated}
                    {peakList.length <= 8 ? <>: {andList(peakList.map((f) => <FilmRef key={f.id} f={f} catByTmdb={catByTmdb} />))}</> : <>, from <FilmRef f={peakList[0]} catByTmdb={catByTmdb} /> to <FilmRef f={peakList[peakList.length - 1]} catByTmdb={catByTmdb} /></>}.
                  </li>
                  {crafts.length > 1 ? (
                    <li>
                      Beyond {dept}, {NAME} also holds {andList(crafts.slice(1).map((c) => <span key={c.key}>{c.films.length} {CRAFTS[c.key].label.toLowerCase()} credit{c.films.length === 1 ? "" : "s"}</span>))}.
                    </li>
                  ) : null}
                </ul>
              </section>

              {troupe.length > 0 ? (
                <section style={{ margin: "26px 0" }}>
                  <h2 className="df-h2">The collaborations, counted</h2>
                  <p className="df-sub">
                    The regulars across {corpusN === filmsN ? `all ${filmsN} films` : `${corpusN} of the ${filmsN} films analysed`} — crew who appear on
                    2 or more, producers and cast on 3 or more. Counted from the same records as the live map below{artist && artist.failed > 0 ? `; ${artist.failed} film${artist.failed === 1 ? "" : "s"} failed to load, so counts may run low` : ""}.
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7, fontSize: 15, maxWidth: "78ch" }}>
                    {tops.length === 1 ? (
                      <li>
                        {NAME}&apos;s most frequent regular collaborator was <PersonT c={tops[0]} withRole /> — {tops[0].count} films together {spanTxt(tops[0].y0, tops[0].y1)}.
                      </li>
                    ) : tops.length > 1 ? (
                      <li>
                        {NAME}&apos;s most frequent regular collaborators were {andList(tops.map((t) => <PersonT key={t.id} c={t} withRole />))} — {maxCount} films each.
                      </li>
                    ) : null}
                    {troupe.slice(0, 10).map((t) => (
                      <li key={t.id} style={{ margin: "0 0 8px" }}>
                        {NAME} and <PersonT c={t} withRole /> made {t.count} films together {spanTxt(t.y0, t.y1)}: {listFilms(t.filmsArr)}.{" "}
                        The first was <FilmT f={t.filmsArr[0]} />; the {t.y1 < latestYear ? "last" : "most recent"} was <FilmT f={t.filmsArr[t.filmsArr.length - 1]} />.
                      </li>
                    ))}
                  </ul>
                  {(troupe.length > 10 || byGrp.size > 0) && (
                    <details className="crd-more" style={{ marginTop: 10 }}>
                      <summary>Every regular, spelled out</summary>
                      <div style={{ padding: "12px 2px 8px", lineHeight: 1.7, fontSize: 15, maxWidth: "78ch" }}>
                        {troupe.length > 10 ? (
                          <ul style={{ margin: "0 0 12px", paddingLeft: 20 }}>
                            {troupe.slice(10).map((t) => (
                              <li key={t.id} style={{ margin: "0 0 8px" }}>
                                {NAME} and <PersonT c={t} withRole /> made {t.count} films together {spanTxt(t.y0, t.y1)}: {listFilms(t.filmsArr, 6)}.
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {[...byGrp.entries()].map(([g, members]) => {
                          const sorted = members.slice().sort((a, b) => a.y0 - b.y0);
                          const succ: ReactNode[] = [];
                          for (let i = 1; i < sorted.length; i++) {
                            if (sorted[i - 1].y1 < sorted[i].y0) {
                              succ.push(
                                <span key={i}> <PersonT c={sorted[i]} /> came after <b>{sorted[i - 1].name}</b>&apos;s last film with {NAME} ({sorted[i - 1].y1}).</span>
                              );
                            }
                          }
                          return (
                            <p key={g} style={{ margin: "0 0 8px" }}>
                              {members.length === 1
                                ? <>The only regular {GRP_NOUN[g]} in {NAME}&apos;s company was <PersonT c={members[0]} /> ({members[0].count} films, {yrs(members[0])}).</>
                                : <>Among {NAME}&apos;s regulars, the {GRP_NOUN[g]}s were {andList(members.map((m) => <span key={m.id}><PersonT c={m} /> ({m.count} films, {yrs(m)})</span>))}.</>}
                              {succ}
                            </p>
                          );
                        })}
                        <p style={{ margin: 0 }}>
                          In all, {NAME}&apos;s regular collaborators were {andList(troupe.map((t) => <span key={t.id}><PersonT c={t} /> ({GRP_NOUN[t.grp]}, {t.count})</span>))} — {troupe.length} people.
                        </p>
                      </div>
                    </details>
                  )}

                  {withRegulars.length > 0 ? (
                    <details className="crd-more" style={{ marginTop: 10 }}>
                      <summary>Film by film — who was in the room</summary>
                      <div style={{ padding: "12px 2px 8px", lineHeight: 1.7, fontSize: 15, maxWidth: "78ch" }}>
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                          {withRegulars.map((f) => {
                            const regs = regularsOf(f.id);
                            const firsts = regs.filter((t) => t.filmsArr[0]?.id === f.id);
                            const lasts = regs.filter((t) => t.filmsArr[t.filmsArr.length - 1]?.id === f.id && t.y1 < latestYear);
                            return (
                              <li key={f.id} style={{ margin: "0 0 8px" }}>
                                On <FilmT f={f} />, {NAME} worked with {andList(regs.map((t) => <PersonT key={t.id} c={t} withRole />))}.
                                {fullestN > 1 && fullest.length === 1 && fullest[0].id === f.id ? <> No other film gathered more of the regulars.</> : null}
                                {firsts.length ? <> It was the first film with {NAME} for {andList(firsts.map((t) => <b key={t.id}>{t.name}</b>))}.</> : null}
                                {lasts.length ? <> For {andList(lasts.map((t) => <b key={t.id}>{t.name}</b>))}, it was the last.</> : null}
                              </li>
                            );
                          })}
                        </ul>
                        {withoutRegulars.length > 0 ? (
                          <p style={{ margin: "10px 0 0" }}>
                            No regular collaborator appeared on {andList(withoutRegulars.slice(0, 10).map((f) => <FilmT key={f.id} f={f} />))}
                            {withoutRegulars.length > 10 ? `, or ${withoutRegulars.length - 10} more` : ""}.
                          </p>
                        ) : null}
                        {filmsN > corpusN ? (
                          <p style={{ margin: "10px 0 0", opacity: 0.75 }}>
                            The crew records of the remaining {filmsN - corpusN} films were not analysed on this page.
                          </p>
                        ) : null}
                      </div>
                    </details>
                  ) : null}
                </section>
              ) : null}
            </>
          );
        })()}

        {stills[1] ? <GrowStill {...stills[1]} /> : null}

        {crafts.map((c) => {
          const dated = c.films.filter((f) => f.year > 1880).sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));
          const undated = c.films.filter((f) => !(f.year > 1880)).sort((a, b) => a.title.localeCompare(b.title));
          const ordered = [...dated, ...undated];
          const ord = (n: number) => {
            const t = n % 100;
            if (t >= 11 && t <= 13) return `${n}th`;
            const u = n % 10;
            return `${n}${u === 1 ? "st" : u === 2 ? "nd" : u === 3 ? "rd" : "th"}`;
          };
          const noun = CRAFTS[c.key].label.toLowerCase();
          const Sentence = ({ f, i }: { f: (typeof ordered)[number]; i: number }) => {
            const catF = catByTmdb.get(f.id);
            const isLastDated = f.year > 1880 && i === dated.length - 1;
            return (
              <li>
                {p.name}&apos;s {ord(i + 1)}{isLastDated ? " and most recent" : ""} {noun} credit was{" "}
                {catF ? <Link href={`/film/${catF.slug}`}>{f.title}</Link> : <i>{f.title}</i>}
                {f.year > 1880 ? ` (${f.year})` : " — release year not on file"}.
              </li>
            );
          };
          return (
            <section key={c.key} style={{ margin: "26px 0" }}>
              <h2 className="df-h2">{CRAFTS[c.key].label} — {c.films.length} films</h2>
              <p className="df-sub">The full run, first credit to latest, one sentence per film. Linked titles are in the Metatake catalog; the rest are TMDB-only.</p>
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7, fontSize: 15, maxWidth: "78ch" }}>
                {ordered.slice(0, 8).map((f, i) => <Sentence key={f.id} f={f} i={i} />)}
              </ul>
              {ordered.length > 8 ? (
                <details className="crd-more" style={{ marginTop: 10 }}>
                  <summary>All {ordered.length} credits, spelled out</summary>
                  <ul style={{ margin: 0, padding: "12px 2px 8px 20px", lineHeight: 1.7, fontSize: 15, maxWidth: "78ch" }}>
                    {ordered.slice(8).map((f, i) => <Sentence key={f.id} f={f} i={i + 8} />)}
                  </ul>
                </details>
              ) : null}
            </section>
          );
        })}

        {stills[2] ? <GrowStill {...stills[2]} /> : null}

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
