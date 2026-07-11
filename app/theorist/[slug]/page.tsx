import { createClient } from "@supabase/supabase-js";
import ShareDock from "@/components/ShareDock";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import EntityTVHero from "@/components/EntityTVHero";
import FilmTabBar from "@/components/FilmTabBar";
import ReadingsExplorer from "@/components/ReadingsExplorer";
import DeskExplorer, { type DeskLink as XDeskLink } from "@/components/DeskExplorer";
import { attachKwic } from "@/lib/kwic";
import ReadingLedger from "@/components/read/ReadingLedger";
import EntityNetwork from "@/components/EntityNetwork";
import EntityFantasiaServer from "@/components/EntityFantasiaServer";
import Byline from "@/components/Byline";
import QuickAnswers, { type QuickAnswerItem } from "@/components/read/QuickAnswers";
import Provenance from "@/components/Provenance";
import GrowStill from "@/components/read/GrowStill";
import { Card, SectionHead } from "@/components/curious/ui";
import { FAMILIES, fw } from "@/lib/frameworks";
import { pageRobots } from "@/lib/seo";
import { wdPerson } from "@/lib/wikidata-person";
import theoristQid from "@/lib/theorist_qid.json";
import "@/app/curious/curious.css";
import "@/app/film/[slug]/read.css";

/**
 * /theorist/[slug] — the theorist as a LENS ON CINEMA, not a theory explainer
 * (2026-07-08 rebuild, whole-session grammar: dark hero + Wikidata portrait,
 * LLM-free verbalized facts, framework-family structure, film panels, plates).
 * Every sentence is assembled from the readings corpus — counts, years,
 * titles, names only.
 */
export const revalidate = 1800;
export async function generateStaticParams() { return []; }

const IMG = "https://image.tmdb.org/t/p";
const SITE = "https://metatake.net";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

interface Props { params: Promise<{ slug: string }> }

type Reading = {
  take_id: string; take_title: string | null; framework: string | null; thesis: string | null; leap: string | null;
  concept: string | null; fig_label: string; fig_slug: string;
  film_title: string; film_slug: string; film_year: number | null; backdrop_path: string | null;
};

type DeskLink = { film_slug: string; film_title: string; film_year: number | null; desk_key: string; essay_title: string };
type FilmMeta = { slug: string; genres: string[] | null; year: number | null; poster_path: string | null; backdrop_path: string | null };

function load(slug: string) {
  return unstable_cache(
    async () => {
      const supabase = db();
      const { data: th } = await supabase.from("theorists").select("id, name, blurb").eq("slug", slug).maybeSingle();
      if (!th) return null;
      const { data: rd } = await supabase.rpc("theorist_readings", { p_slug: slug });
      const readings = (rd as Reading[] | null) ?? [];

      // Film metadata for the verbalizer (genres/years) — one IN query.
      const filmMeta = new Map<string, FilmMeta>();

      // Concepts this theorist authored (theory DB) — the idea shelf.
      let concepts: { name: string; slug: string }[] = [];
      try {
        const { data: cc } = await supabase
          .from("theorist_concepts")
          .select("theory_concepts(concept, concept_slug)")
          .eq("theorist_id", (th as { id: number | string }).id)
          .limit(16);
        const seen = new Set<string>();
        for (const row of (cc ?? []) as unknown as { theory_concepts: { concept: string; concept_slug: string } | null }[]) {
          const c = row.theory_concepts;
          if (!c?.concept || seen.has(c.concept_slug)) continue;
          seen.add(c.concept_slug);
          concepts.push({ name: c.concept, slug: c.concept_slug });
        }
      } catch { concepts = []; }

      // Desk essays that cite this theorist (precomputed reverse links).
      let desks: DeskLink[] = [];
      try {
        const { data: dl } = await supabase
          .from("essay_entity_links")
          .select("film_slug, film_title, film_year, desk_key, essay_title")
          .eq("entity_type", "theorist")
          .eq("entity_slug", slug)
          .limit(36);
        const seen = new Set<string>();
        for (const d of (dl ?? []) as DeskLink[]) {
          const key = `${d.film_slug}/${d.desk_key}`;
          if (seen.has(key)) continue;
          seen.add(key);
          desks.push(d);
          if (desks.length >= 12) break;
        }
      } catch { desks = []; }

      // Film metadata for BOTH readings (genres/year) and desk essays (backdrop
      // for the thumbnail) — desk-only films have no reading, so without this the
      // desks section renders thumbnail-less.
      const slugs = [...new Set([...readings.map((r) => r.film_slug), ...desks.map((d) => d.film_slug)])];
      for (let i = 0; i < slugs.length; i += 150) {
        const { data: fm } = await supabase
          .from("films").select("slug, genres, year, poster_path, backdrop_path").in("slug", slugs.slice(i, i + 150));
        for (const f of (fm ?? []) as FilmMeta[]) filmMeta.set(f.slug, f);
      }

      return {
        name: (th as { name: string }).name,
        blurb: (th as { blurb: string | null }).blurb,
        readings, desks, concepts,
        filmMeta: [...filmMeta.entries()] as [string, FilmMeta][],
      };
    },
    // v3: genres/concepts/filmMeta joined the payload (2026-07-08 rebuild)
    ["theorist-4", slug],
    { revalidate: 1800, tags: [`theorist:${slug}`] },
  )();
}

/* ── The verbalizer: deterministic aggregates over the readings corpus ── */

function facts(name: string, readings: Reading[], filmMeta: Map<string, FilmMeta>) {
  const films = new Map<string, { title: string; year: number | null; n: number; backdrop: string | null }>();
  for (const r of readings) {
    const cur = films.get(r.film_slug) ?? { title: r.film_title, year: r.film_year, n: 0, backdrop: r.backdrop_path };
    cur.n += 1;
    if (!cur.backdrop && r.backdrop_path) cur.backdrop = r.backdrop_path;
    films.set(r.film_slug, cur);
  }
  const filmArr = [...films.entries()].map(([slug, f]) => ({ slug, ...f }));
  const dated = filmArr.filter((f) => (f.year ?? 0) > 1880).sort((a, b) => (a.year! - b.year!) || a.title.localeCompare(b.title));
  const fwCount = new Map<string, number>();
  for (const r of readings) { const l = fw(r.framework).label; fwCount.set(l, (fwCount.get(l) ?? 0) + 1); }
  const fwTop = [...fwCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const topFilms = [...filmArr].sort((a, b) => b.n - a.n || a.title.localeCompare(b.title));
  const genreCount = new Map<string, number>();
  for (const f of filmArr) for (const g of filmMeta.get(f.slug)?.genres ?? []) genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
  const genresTop = [...genreCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4);
  const decades = new Map<number, number>();
  for (const f of dated) { const d = Math.floor((f.year as number) / 10) * 10; decades.set(d, (decades.get(d) ?? 0) + 1); }
  const decadeTop = [...decades.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0] ?? null;
  return { filmArr, dated, fwTop, topFilms, genresTop, decadeTop };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Theorist — Metatake" };
  const F = facts(data.name, data.readings, new Map(data.filmMeta));
  const n = F.filmArr.length;
  const title = n >= 3
    ? `${data.name} in Film — ${n} Movies Read Through ${data.name}'s Lens`
    : `${data.name} in film — readings through ${data.name}`;
  const first = F.dated[0]; const last = F.dated[F.dated.length - 1];
  let description = first && last && first.slug !== last.slug
    ? `From ${first.title} (${first.year}) to ${last.title} (${last.year}): ${data.readings.length} Strong Misreadings borrow ${data.name}'s lens${F.fwTop[0] ? `, most often through ${F.fwTop[0][0].toLowerCase()}` : ""}.`
    : `Films read through ${data.name}: ${data.readings.length} Strong Misreadings that borrow ${data.name}'s lens, across cinema.`;
  if (description.length > 158) description = description.slice(0, 155).replace(/\s+\S*$/, "") + "…";
  return {
    title, description,
    alternates: { canonical: `/theorist/${slug}` },
    openGraph: { title, description },
    robots: pageRobots(data.readings.length >= 3),
  };
}

export default async function TheoristPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { name, blurb, readings, desks, concepts } = data;
  const filmMeta = new Map(data.filmMeta);
  const F = facts(name, readings, filmMeta);
  const qid = (theoristQid as Record<string, string>)[slug];
  const wd = qid ? await wdPerson(qid) : null;
  const life = wd?.birth ? `${wd.birth}–${wd.death ?? ""}` : null;

  // Readings grouped by framework family — the site's own taxonomy is the tab structure.
  const byFamily = FAMILIES
    .map((fam) => ({ fam, items: readings.filter((r) => fw(r.framework).family === fam.key) }))
    .filter((g) => g.items.length > 0);

  const surnamePre = name.split(" ").length > 1 ? name.split(" ").pop() as string : "";
  const hlTermsPre = [name, surnamePre].filter(Boolean);
  // Recurring figures this lens anchors to (aggregated by label).
  const figCount = new Map<string, { n: number; href: string; bd: string | null; film: string }>();
  for (const r of readings) {
    const k = r.fig_label.toLowerCase();
    const cur = figCount.get(k) ?? { n: 0, href: `/film/${r.film_slug}/figure/${r.fig_slug}`, bd: r.backdrop_path, film: r.film_title };
    cur.n += 1;
    if (!cur.bd && r.backdrop_path) { cur.bd = r.backdrop_path; cur.film = r.film_title; }
    figCount.set(k, cur);
  }
  const figTop = [...figCount.entries()].map(([label, v]) => ({ label, ...v }))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)).slice(0, 24);

  const heroBackdrop = F.topFilms.find((f) => f.backdrop)?.backdrop ?? null;
  const bdBySlug = new Map<string, string | null>();
  for (const r of readings) if (!bdBySlug.has(r.film_slug)) bdBySlug.set(r.film_slug, r.backdrop_path);
  const desksKwic = await attachKwic(db(), desks, hlTermsPre);
  const deskLinks: XDeskLink[] = desksKwic.map((d) => ({
    film_slug: d.film_slug, film_title: d.film_title, film_year: d.film_year,
    desk_key: d.desk_key, essay_title: d.essay_title,
    excerpt: d.excerpt, mode: null,
    backdrop_path: bdBySlug.get(d.film_slug) ?? filmMeta.get(d.film_slug)?.backdrop_path ?? null,
  }));

  const growFilm = F.topFilms.find((f) => f.backdrop && f.n >= 1) ?? null;

  // ── Quick answers (docs/PLAN-intent-coverage.md §0 + §5.6) ─────────────────
  // Search-phrased Q&A from fields already in scope, mounted above the "lens,
  // spelled out" bullets (distinct framing). Names, years and frameworks are
  // verbatim. Variants (§0.6): "thinker" ×1, "theory" ×1 (each ≤2).
  const theoristQA: QuickAnswerItem[] = [];
  const bio = wd?.description ?? blurb ?? null;
  if (bio) {
    const bioCap = (bio.charAt(0).toUpperCase() + bio.slice(1)).trim();
    const bioSentence = /[.!?]$/.test(bioCap) ? bioCap : `${bioCap}.`;
    theoristQA.push({
      q: `Who is ${name}?`,
      a: (
        <>
          {bioSentence}
          {wd?.birth ? ` ${name} was born in ${wd.birth}${wd.death ? ` and died in ${wd.death}` : ""}.` : ""}
        </>
      ),
    });
  }
  if (readings.length > 0 && F.topFilms.length > 0) {
    const show = F.topFilms.slice(0, 4);
    const more = F.filmArr.length - show.length;
    theoristQA.push({
      q: `Which films are read through ${name}?`,
      a: (
        <>
          {show.map((f, i) => (
            <span key={f.slug}>
              {i > 0 ? (i === show.length - 1 ? " and " : ", ") : ""}
              <Link href={`/film/${f.slug}`}>{f.title}</Link>{f.year ? ` (${f.year})` : ""}
            </span>
          ))}
          {more > 0 ? `, and ${more} more` : ""} — {F.filmArr.length} film{F.filmArr.length === 1 ? "" : "s"} in all.
        </>
      ),
    });
  }
  if (concepts.length > 0) {
    const shown = Math.min(6, concepts.length);
    theoristQA.push({
      q: `What concepts is ${name} known for?`,
      a: (
        <>
          {name} is the thinker behind{" "}
          {concepts.slice(0, 6).map((c, i) => (
            <span key={c.slug}>
              {i > 0 ? (i === shown - 1 ? " and " : ", ") : ""}
              <Link href={`/concept/${c.slug}`}>{c.name}</Link>
            </span>
          ))}
          {concepts.length > 6 ? `, and ${concepts.length - 6} more` : ""}.
        </>
      ),
    });
  }
  if (F.fwTop.length > 0) {
    theoristQA.push({
      q: `What kind of theory is ${name} associated with?`,
      a: (
        <>
          The readings that borrow {name}&apos;s lens lean most on <b>{F.fwTop[0][0]}</b>
          {F.fwTop[1] ? <>, ahead of {F.fwTop[1][0]}</> : null}.
        </>
      ),
    });
  }

  const canonical = `${SITE}/theorist/${slug}`;
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: "Theorists", item: `${SITE}/theorist` },
      { "@type": "ListItem", position: 3, name, item: canonical },
    ] },
    { "@context": "https://schema.org", "@type": "Person", "@id": canonical, name, url: canonical,
      ...(wd?.description || blurb ? { description: wd?.description ?? blurb } : {}),
      ...(wd?.birth ? { birthDate: String(wd.birth) } : {}),
      ...(wd?.image ? { image: wd.image } : {}),
      ...(qid ? { sameAs: [`https://www.wikidata.org/wiki/${qid}`] } : {}) },
  ];

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── Dark hero: the person, the lens, the count ── */}
      <div className="cur rd-hero">
        <div className="rd-hero__in">
          <div className="rd-hero__txt">
            <div className="rd-crumb">
              <Link href="/concept">Theory</Link><span>›</span>
              <Link href="/theorist">Theorists</Link><span>›</span>
              <span>{name}</span>
            </div>
            <div className="rd-chiprow">
              <span className="rd-chip"><Link href="/theorist" style={{ color: "inherit", textDecoration: "none" }}>The Lens</Link>{" · "}theorist</span>
              <span className="rd-meta">{readings.length} readings · {F.filmArr.length} films{qid ? <> · <a href={`https://www.wikidata.org/wiki/${qid}`} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>Wikidata ↗</a></> : null}</span>
            </div>
            <h1 className="rd-h1">{name}{life ? <span style={{ fontWeight: 500, opacity: 0.6, fontSize: "0.62em" }}> ({life})</span> : null}</h1>
            <p className="rd-dek">
              {wd?.description ? `${wd.description.charAt(0).toUpperCase()}${wd.description.slice(1)}. ` : blurb ? `${blurb} ` : ""}
              {readings.length} Strong Misreading{readings.length === 1 ? "" : "s"} across {F.filmArr.length} film{F.filmArr.length === 1 ? "" : "s"} borrow {name}&apos;s lens
              {F.dated.length > 1 ? <> — from <i>{F.dated[0].title}</i> ({F.dated[0].year}) to <i>{F.dated[F.dated.length - 1].title}</i> ({F.dated[F.dated.length - 1].year})</> : null}.
              {" "}Every entry below is a close reading of a scene, not a précis.
            </p>
            <div className="rd-share">
              <ShareDock variant="bar" path={`/theorist/${slug}`} title={name}
                hook={`${name} through ${F.filmArr.length} films — the cinema read through their lens, on Metatake`}
                saveType="theorist" saveRef={slug} />
              <ShareDock variant="fab" path={`/theorist/${slug}`} title={name} />
            </div>
          </div>
          {(wd?.image || heroBackdrop) && (
            <div className="rd-hero__media" style={wd?.image ? { maxWidth: 300, justifySelf: "end" } : undefined}>
              {wd?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={wd.image} alt={name} width={300} height={380} style={{ width: "100%", borderRadius: 8, display: "block", background: "#000" }} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="rd-hero__bd" src={`${IMG}/w780${heroBackdrop}`} alt="" width={780} height={439} />
              )}
              {!wd?.image ? <EntityTVHero inline playlist={`theorist-${slug}`} reelSlugs={F.filmArr.map((f) => f.slug)} label={name} listHref={`/tv/list/theorist-${slug}`} backdrop={null} /> : null}
              <div className="rd-hero__cap">{wd?.image ? "Portrait via Wikimedia Commons" : `From ${F.topFilms[0]?.title} · via TMDB`}</div>
            </div>
          )}
        </div>
      </div>

      <FilmTabBar
        center
        search={{ event: "theory:q", targetId: "readings", placeholder: `Search ${readings.length} readings…` }}
        tabs={[
          { id: "lens-facts", label: "The lens", color: "#D64534" },
          ...(figTop.length ? [{ id: "lens-figures", label: "Figures", badge: figTop.length, color: "#B8863B" }] : []),
          ...(desks.length ? [{ id: "theorist-desks", label: "Desk essays", badge: desks.length, color: "#C87A2C" }] : []),
          { id: "theorist-network", label: "Connections", color: "#2F6DB0" },
          { id: "readings", label: "Every reading", badge: readings.length, color: "#12897A" },
        ]}
      />

      <div className="mt-wrap" style={{ maxWidth: 880, padding: "24px 20px 40px" }}>
        <Byline />

        <QuickAnswers items={theoristQA.slice(0, 5)} />

        {/* ── The lens, spelled out — deterministic sentences only ── */}
        <section style={{ margin: "12px 0 0" }} id="lens-facts">
          <h2 className="df-h2">The lens, spelled out</h2>
          <p className="df-sub">Counted from the readings corpus — every claim below is a number, a year, a title or a name.</p>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7, fontSize: 15, maxWidth: "78ch" }}>
            <li>
              {name}&apos;s lens appears in {readings.length} Strong Misreading{readings.length === 1 ? "" : "s"} across{" "}
              {F.filmArr.length} film{F.filmArr.length === 1 ? "" : "s"}
              {F.dated.length > 1 ? <>, from <Link href={`/film/${F.dated[0].slug}`}>{F.dated[0].title}</Link> ({F.dated[0].year}) to <Link href={`/film/${F.dated[F.dated.length - 1].slug}`}>{F.dated[F.dated.length - 1].title}</Link> ({F.dated[F.dated.length - 1].year})</> : null}.
            </li>
            {F.fwTop.length > 0 ? (
              <li>
                The framework that borrows {name} most is <b>{F.fwTop[0][0]}</b> ({F.fwTop[0][1]} of the {readings.length} readings)
                {F.fwTop[1] ? <>, ahead of {F.fwTop[1][0]} ({F.fwTop[1][1]})</> : null}.
              </li>
            ) : null}
            {F.topFilms[0] && F.topFilms[0].n > 1 ? (
              <li>
                The film that returns to {name} most is <Link href={`/film/${F.topFilms[0].slug}`}>{F.topFilms[0].title}</Link>
                {F.topFilms[0].year ? ` (${F.topFilms[0].year})` : ""} — {F.topFilms[0].n} readings turn on this lens there.
              </li>
            ) : null}
            {F.genresTop.length > 1 ? (
              <li>
                By genre, {name} gravitates to {F.genresTop.map(([g, n], i) => <span key={g}>{i > 0 ? (i === F.genresTop.length - 1 ? " and " : ", ") : ""}{g} ({n})</span>)}.
              </li>
            ) : null}
            {F.decadeTop && F.dated.length >= 4 ? (
              <li>
                The decade of cinema {name} reads best, by count, is the {F.decadeTop[0]}s — {F.decadeTop[1]} of the {F.dated.length} dated films.
              </li>
            ) : null}
            {concepts.length > 0 ? (
              <li>
                Concepts on {name}&apos;s shelf here: {concepts.slice(0, 6).map((c, i) => <span key={c.slug}>{i > 0 ? " · " : ""}<Link href={`/concept/${c.slug}`}>{c.name}</Link></span>)}{concepts.length > 6 ? ` — and ${concepts.length - 6} more` : ""}.
              </li>
            ) : null}
          </ul>
          <ReadingLedger subject={name} readings={readings} essays={deskLinks} />
        </section>

        {/* ── The readings, by framework family — the tab structure IS the taxonomy ── */}
        {figTop.length > 0 ? (
          <section style={{ margin: "30px 0 0" }} id="lens-figures">
            <h2 className="df-h2">The figures {name} anchors to</h2>
            <p className="df-sub">The recurring anchors — characters, objects, places, forms — that this lens keeps choosing. Each chip opens a figure page where the reading lives.</p>
            <div className="fig-cloud">
              {figTop.map((f) => (
                <Link key={f.label} href={f.href} className={`fig-chip${f.bd ? "" : " fig-chip--bare"}`}>
                  {f.bd ? <img src={`${IMG}/w300${f.bd}`} alt={`${f.film} still`} width={56} height={32} loading="lazy" /> : null}
                  <span>{f.label}{f.n > 1 ? <span className="fig-chip__n"> ×{f.n}</span> : null}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {growFilm?.backdrop ? (
          <GrowStill
            src={`${IMG}/w1280${growFilm.backdrop}`}
            alt={`${growFilm.title} still`}
            caption={`${growFilm.title}${growFilm.year ? ` (${growFilm.year})` : ""} — read through ${name} · via TMDB`}
          />
        ) : null}

        {desks.length > 0 && (
          <section style={{ margin: "34px 0 0" }} id="theorist-desks">
            <h2 className="df-h2">From the desks — essays that cite {name}</h2>
            <p className="df-sub">Excerpted where {name} actually appears in the essay, not just the opening line.</p>
            <DeskExplorer desks={deskLinks} about={name} listenEvent="theory:q" />
          </section>
        )}

        <section className="cmap-sec" id="theorist-network" style={{ marginTop: 34 }}>
          <h2 className="cmap-h2">Connections — {name} across the web</h2>
          <p className="cmap-intro">The figures, films and ideas read through {name} across Metatake&rsquo;s critical web. Click a node to open it.</p>
          <EntityNetwork api={`/api/map?type=theorist&key=${slug}`} full={`/network?m=critical&t=theorist&k=${slug}`} />
        </section>

        {/* EMBEDDING FANTASIA — sentences read through this thinker's lenses */}
        <EntityFantasiaServer type="theorist" entityKey={slug} title={name} sectionId="theorist-fantasia" sectionClass="cmap-sec" selfHref={`/theorist/${slug}`} tag={`theorist:${slug}`} />

        <section style={{ margin: "8px 0 0" }} id="readings">
          <h2 className="df-h2">Every reading, searchable</h2>
          <p className="df-sub">
            {readings.length} Strong Misreadings borrow {name} — search them from the bar above, or filter by
            framework and decade. Each card links into the film&apos;s figure page, where the full reading lives.
          </p>
          <ReadingsExplorer
            readings={readings.map((r) => ({ ...r, theorist_name: null, theorist_slug: null }))}
            about={name}
            listenEvent="theory:q"
          />
        </section>

        {/* ── The films this lens returns to — panel cards ── */}
        {F.topFilms.length > 0 ? (
          <section style={{ margin: "30px 0 0" }} id="lens-films">
            <h2 className="df-h2">The films {name} returns to</h2>
            <p className="df-sub">Every panel opens the film — the readings there carry {name}&apos;s ideas into the scenes.</p>
            <div className="crd-grid">
              {F.topFilms.slice(0, 6).map((f) => (
                <a className="crd-panel" href={`/film/${f.slug}`} key={f.slug}>
                  {f.backdrop
                    ? /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={`${IMG}/w300${f.backdrop}`} alt="" width={124} height={70} loading="lazy" style={{ width: 124, height: 70, borderRadius: 6 }} />
                    : <span className="crd-ph" style={{ width: 124, height: 70, fontSize: 22 }} aria-hidden>{f.title[0]}</span>}
                  <span>
                    <span className="crd-k">{f.n} reading{f.n === 1 ? "" : "s"} · through {name}</span>
                    <h3>{f.title}{f.year ? ` (${f.year})` : ""}</h3>
                    <span className="crd-go">Open the film →</span>
                  </span>
                </a>
              ))}
            </div>
          </section>
        ) : null}

        <p style={{ fontSize: 12.5, opacity: 0.6, marginTop: 26 }}>
          Analysis by Metatake Editorial · edited by <Link href="/editor">Wonwoo Yoon</Link>
          {qid ? <> · person data from <a href={`https://www.wikidata.org/wiki/${qid}`} target="_blank" rel="noopener noreferrer">Wikidata ↗</a></> : null}
          {" "}· <Link href="/methodology">How we read films →</Link>
        </p>
        <Provenance />
        <p className="th-foot"><Link href="/theorist">← All theorists</Link></p>
      </div>

      {/* ── Keep-reading plates: the lens's films, as misreadings articles ── */}
      {F.topFilms.filter((f) => f.backdrop).length >= 2 ? (
        <div className="cur rd-plates">
          <div className="cur-wrap">
            <SectionHead title={`Keep reading through ${name}`} count={`${Math.min(5, F.topFilms.length)} doors`} />
            <div className="cur-grid">
              {F.topFilms.filter((f) => f.backdrop).slice(0, 5).map((f) => (
                <Card
                  key={f.slug}
                  href={`/film/${f.slug}/misreadings`}
                  film={{ slug: f.slug, title: f.title, year: f.year, backdrop_path: f.backdrop, poster_path: filmMeta.get(f.slug)?.poster_path ?? null }}
                  title={`${f.title}, read against the grain — the misreadings article`}
                  tag="Strong Misreadings"
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
