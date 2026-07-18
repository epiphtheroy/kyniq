import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import EntityTVHero from "@/components/EntityTVHero";
import Byline from "@/components/Byline";
import RecordToc from "@/components/read/RecordToc";
import DirectorPlates from "@/components/read/DirectorPlates";
import ShareDock from "@/components/ShareDock";
import { pageRobots } from "@/lib/seo";
import { directorNative } from "@/lib/nativeName";
import "@/app/curious/curious.css";
import "@/app/film/[slug]/read.css";

/**
 * /director/[slug]/next — "Who's Next after X" as its own indexable article
 * (2026-07-09). The hub's dr-next section promoted to a standalone page for
 * the "directors like X" query class. Render is LLM-free — this page only
 * assembles stored fields — but the recommendations themselves are not: each
 * kinship and its `reason` was drafted offline by Metatake AI
 * (worker/director-profile-gen.py, Opus batch) into director_next. Do not
 * restate "LLM-free" as a claim about the recommendations; it is true of render
 * only (2026-07-17, HANDOFF-AI집필크레딧-표기개편.md D7).
 */
export const revalidate = 3600;
export async function generateStaticParams() { return []; }

const IMG = "https://image.tmdb.org/t/p";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Next = { pos: number; rec_name: string; reason: string | null; target_slug: string | null; tmdb_person_id: number | null; profile_path: string | null };
type Film = { id: string; title: string; slug: string; year: number | null; director: string | null; backdrop_path: string | null; poster_path: string | null };

async function loadUncached(slug: string) {
  const supabase = db();
  const [{ data: films, error: filmsErr }, { data: dir }, { data: next }, { data: recByRaw }, { count: picksCount }, { data: factsRow }] = await Promise.all([
    supabase.from("films").select("id, title, slug, year, director, backdrop_path, poster_path").eq("director_slug", slug).eq("visible", true).order("year"),
    supabase.from("directors").select("name, profile_path").eq("slug", slug).maybeSingle(),
    supabase.from("director_next").select("pos, rec_name, reason, target_slug, tmdb_person_id, profile_path").eq("director_slug", slug).order("pos"),
    supabase.from("director_next").select("director_slug").eq("target_slug", slug),
    supabase.from("director_picks").select("director_slug", { count: "exact", head: true }).eq("director_slug", slug),
    supabase.from("director_facts").select("facts").eq("director_slug", slug).maybeSingle(),
  ]);

  if (filmsErr) throw new Error(`director films(${slug}): ${filmsErr.message}`); // never cache a poison 404
  if (!films || films.length === 0) return null;
  const nextArr = (next as Next[] | null) ?? [];
  if (nextArr.length === 0) return null;

  const filmArr = (films as Film[] | null) ?? [];
  const name = (dir as { name?: string | null } | null)?.name || filmArr[0]?.director || slug.replace(/-/g, " ");

  // One directors lookup covers two needs: photos for matched recs whose
  // profile_path is missing (their photo lives in `directors`, not in
  // director_next), and display names for the reverse "pointed to from" list.
  const needPhoto = [...new Set(nextArr.filter((n) => n.target_slug && !n.profile_path).map((n) => n.target_slug as string))];
  const recBySlugs = [...new Set(((recByRaw ?? []) as { director_slug: string }[]).map((r) => r.director_slug))].filter((s) => s !== slug);
  const lookup = [...new Set([...needPhoto, ...recBySlugs])];
  let recBy: { slug: string; name: string }[] = [];
  if (lookup.length) {
    const { data: dRows } = await supabase.from("directors").select("slug, name, profile_path").in("slug", lookup);
    const bySlug = new Map(((dRows ?? []) as { slug: string; name: string | null; profile_path: string | null }[]).map((r) => [r.slug, r]));
    for (const n of nextArr) {
      if (n.target_slug && !n.profile_path) n.profile_path = bySlug.get(n.target_slug)?.profile_path ?? null;
    }
    recBy = recBySlugs.map((s) => ({ slug: s, name: bySlug.get(s)?.name || s.replace(/-/g, " ") }));
  }

  // Matched recs: one batched query each for /start eligibility (only link
  // /director/x/start when x actually has picks) and visible-film counts —
  // no per-rec fan-out.
  const targetSlugs = [...new Set(nextArr.filter((n) => n.target_slug).map((n) => n.target_slug as string))];
  let startSlugs: string[] = [];
  const targetFilmCounts: Record<string, number> = {};
  if (targetSlugs.length) {
    const [{ data: pickRows }, { data: filmRows }] = await Promise.all([
      supabase.from("director_picks").select("director_slug").in("director_slug", targetSlugs),
      supabase.from("films").select("director_slug").in("director_slug", targetSlugs).eq("visible", true),
    ]);
    startSlugs = [...new Set(((pickRows ?? []) as { director_slug: string }[]).map((r) => r.director_slug))];
    for (const r of ((filmRows ?? []) as { director_slug: string }[])) {
      targetFilmCounts[r.director_slug] = (targetFilmCounts[r.director_slug] ?? 0) + 1;
    }
  }

  const facts = (factsRow as { facts?: { n: number }[] | null } | null)?.facts;
  return {
    name,
    films: filmArr,
    next: nextArr,
    recBy,
    startSlugs,
    targetFilmCounts,
    picksCount: picksCount ?? 0,
    factsCount: Array.isArray(facts) ? facts.length : 0,
  };
}

function load(slug: string) {
  return unstable_cache(() => loadUncached(slug), ["director-next-1", slug], {
    revalidate: 3600,
    tags: [`director:${slug}`],
  })();
}

interface Props { params: Promise<{ slug: string }> }

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function buildDescription(name: string, next: Next[]): string {
  const n = next.length;
  const a = next[0]?.rec_name;
  const b = next[1]?.rec_name;
  const lead = a && b ? `After ${name}, watch ${a} and ${b}` : a ? `After ${name}, watch ${a}` : `Who to watch after ${name}`;
  const rest = n > 2 ? ` — plus ${n - 2} more` : "";
  let out = `${lead}${rest}. ${n} director recommendation${n === 1 ? "" : "s"}, each with the exact reason written out, not a similarity score.`;
  if (out.length > 158) out = out.slice(0, 155).replace(/\s+\S*$/, "") + "…";
  return out;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  const native = await directorNative(data.name);
  const title = `${data.next.length} Directors to Watch After ${data.name}${native ? ` (${native})` : ""} — and Exactly Why`;
  const description = buildDescription(data.name, data.next);
  return {
    title,
    description,
    authors: [{ name: "Metatake Editorial", url: "https://metatake.net/about" }],
    alternates: { canonical: `/director/${slug}/next` },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
    robots: pageRobots(data.next.length >= 3),
  };
}

export default async function DirectorNextPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { name, films, next, recBy, startSlugs, targetFilmCounts, picksCount, factsCount } = data;
  const native = await directorNative(name);
  const n = next.length;
  const matched = next.filter((r) => r.target_slug).length;

  // Hero backdrop from the director's own films — seeded pick, stable per ISR.
  const seed = slug.split("").reduce((a, c) => a + c.charCodeAt(0), 7);
  const withBd = films.filter((f) => f.backdrop_path);
  const heroFilm = withBd.length ? withBd[seed % withBd.length] : null;

  // Mid-article stills from the subject director's own films: year order
  // (the films query is year-ordered), hero excluded, deterministic. One
  // after recommendation 2, one after recommendation 4; skipped when the
  // gallery runs out.
  const stillFilms = withBd.filter((f) => f.slug !== heroFilm?.slug);

  const headline = `${n} Directors to Watch After ${name}${native ? ` (${native})` : ""} — and Exactly Why`;
  const description = buildDescription(name, next);
  const firstThree = joinNames(next.slice(0, 3).map((r) => r.rec_name));

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://metatake.net" },
      { "@type": "ListItem", position: 2, name: "Directors", item: "https://metatake.net/director" },
      { "@type": "ListItem", position: 3, name, item: `https://metatake.net/director/${slug}` },
      { "@type": "ListItem", position: 4, name: "Who's Next", item: `https://metatake.net/director/${slug}/next` },
    ],
  };
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Directors to watch after ${name}`,
    numberOfItems: n,
    itemListElement: next.map((r) => ({
      "@type": "ListItem",
      position: r.pos,
      item: {
        "@type": "Person",
        name: r.rec_name,
        jobTitle: "Film director",
        ...(r.target_slug ? { url: `https://metatake.net/director/${r.target_slug}` } : {}),
      },
    })),
  };
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `https://metatake.net/director/${slug}/next`,
    headline,
    description,
    inLanguage: "en",
    about: { "@type": "Person", name, jobTitle: "Film director", url: `https://metatake.net/director/${slug}` },
    author: { "@type": "Organization", name: "Metatake", url: "https://metatake.net" },
    editor: { "@type": "Person", name: "Wonwoo Yoon", url: "https://metatake.net/editor" },
    publisher: { "@type": "Organization", name: "Metatake", url: "https://metatake.net" },
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />

      {/* HERO — dark, per the promoted-article grammar */}
      <div className="cur rd-hero">
        <div className="rd-hero__in">
          <div className="rd-hero__txt">
            <div className="rd-crumb">
              <Link href="/director">Directors</Link><span>›</span>
              <Link href={`/director/${slug}`}>{name}</Link><span>›</span>
              <span>Who&apos;s Next</span>
            </div>
            <div className="rd-chiprow">
              <span className="rd-chip">Who&apos;s next</span>
              <span className="rd-meta">{n} directors · a written reason, not a similarity score{recBy.length ? ` · pointed to from ${recBy.length}` : ""}</span>
            </div>
            <h1 className="rd-h1">
              {n} Directors to Watch After {name}
              {native ? <span style={{ fontSize: "0.55em", fontWeight: 500, opacity: 0.6, marginLeft: 10 }}>({native})</span> : null}
              {" "}— and Exactly Why
            </h1>
            <p className="rd-dek">
              {n} door{n === 1 ? "" : "s"} out of {name}&apos;s cinema — {firstThree}{n > 3 ? " and more" : ""} — each picked
              for one specific kinship, with the reason spelled out under every name.
            </p>
            <div className="rd-share">
              <ShareDock variant="bar" path={`/director/${slug}/next`} title={headline} hook={description} />
              <ShareDock variant="fab" path={`/director/${slug}/next`} title={headline} hook={description} />
            </div>
          </div>
          {heroFilm ? (
            <div className="rd-hero__media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="rd-hero__bd" src={`${IMG}/w780${heroFilm.backdrop_path}`} alt="" width={780} height={439} />
              <EntityTVHero inline playlist={`director-${slug}`} reelSlugs={films.map((f) => f.slug)} label={name} listHref={`/tv/list/director-${slug}`} backdrop={null} />
              <div className="rd-hero__cap">From {heroFilm.title} · via TMDB</div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-wrap" style={{ maxWidth: 760, padding: "28px 20px 40px" }}>
        <article className="essay">
          <Byline />

          <div className="essay-body">
            <p>
              {name}&apos;s films end and the question is always the same: who&apos;s next? Below are {n} director
              {n === 1 ? "" : "s"} to explore after <Link href={`/director/${slug}`}>{name}</Link>
              {matched ? <> — {matched} of them already read closely on Metatake</> : null}. Each is here for one
              specific kinship with the work, written out in full — an argued recommendation, not a similarity
              score. Written by Metatake AI, to a framework directed by <Link href="/editor">Wonwoo Yoon</Link>.
            </p>

            {next.map((r, i) => {
              const filmCount = r.target_slug ? targetFilmCounts[r.target_slug] ?? 0 : 0;
              const hasStart = !!r.target_slug && startSlugs.includes(r.target_slug);
              const still = i === 1 ? stillFilms[0] : i === 3 ? stillFilms[1] : undefined;
              return (
                <Fragment key={r.pos}>
                <section>
                  <h2>{r.pos}. {r.rec_name}</h2>
                  <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
                    {r.profile_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`${IMG}/w185${r.profile_path}`}
                        alt={r.rec_name}
                        width={110}
                        height={165}
                        loading="lazy"
                        style={{ borderRadius: 10, objectFit: "cover", flex: "0 0 auto" }}
                      />
                    ) : null}
                    <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                      {r.reason ? <p style={{ marginTop: 0 }}>{r.reason}</p> : null}
                      {r.target_slug ? (
                        <p style={{ fontSize: "0.92em" }}>
                          On Metatake: <Link href={`/director/${r.target_slug}`}>{r.rec_name} — films, readings &amp; tropes</Link>
                          {filmCount ? <> ({filmCount} film{filmCount === 1 ? "" : "s"} read closely)</> : null}
                          {hasStart ? <> · <Link href={`/director/${r.target_slug}/start`}>where to start</Link></> : null}
                        </p>
                      ) : (
                        <p style={{ fontSize: "0.92em", opacity: 0.72 }}>— not yet on Metatake.</p>
                      )}
                    </div>
                  </div>
                </section>
                {still ? (
                  <figure className="rd-fig">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`${IMG}/w780${still.backdrop_path}`} alt={`${still.title} still`} width={780} height={439} loading="lazy" />
                    <figcaption>{still.title}{still.year ? ` (${still.year})` : ""} · via TMDB</figcaption>
                  </figure>
                ) : null}
                </Fragment>
              );
            })}

            {recBy.length > 0 && (
              <section>
                <h2>Pointed to from</h2>
                <p>
                  The recommendation runs both ways: {name} is itself the &ldquo;watch next&rdquo; answer on{" "}
                  {recBy.length} other director page{recBy.length === 1 ? "" : "s"} —{" "}
                  {recBy.map((r, i) => (
                    <span key={r.slug}>
                      {i > 0 ? (i === recBy.length - 1 ? " and " : ", ") : ""}
                      <Link href={`/director/${r.slug}`}>{r.name}</Link>
                    </span>
                  ))}.
                </p>
              </section>
            )}

            <hr />
            <p>
              Every list like this is drafted by Metatake AI, one kinship at a time, to a brief set by the desk, which
              answers for it; the page then assembles it with no language model. Browse{" "}
              <Link href="/director">all directors on Metatake</Link>, or go back to{" "}
              <Link href={`/director/${slug}`}>everything on {name}</Link>: the filmography, the readings, the tropes.
            </p>
          </div>

          {(picksCount > 0 || factsCount > 0) && (
            <div className="rec-tocs">
              {picksCount > 0 && (
                <RecordToc
                  href={`/director/${slug}/start`}
                  kicker="Where to start"
                  title={`Where to Start with ${name} — a ${picksCount}-Film Route`}
                  rows={[
                    { label: "Curated picks", value: picksCount },
                    { label: "Films read closely", value: films.length },
                  ]}
                  cta="Take the route"
                />
              )}
              {factsCount > 0 && (
                <RecordToc
                  href={`/director/${slug}/life`}
                  kicker="The life"
                  title={`Who Is ${name}? — the researched life`}
                  rows={[{ label: "Researched moments", value: factsCount }]}
                  cta="Read the life"
                />
              )}
            </div>
          )}

          <p style={{ fontSize: 12.5, opacity: 0.78, marginTop: 22 }}>
            Written by Metatake AI · directed by <Link href="/editor">Wonwoo Yoon</Link> ·{" "}
            <Link href="/methodology">How we work →</Link>
          </p>

          <p style={{ marginTop: 18 }}>
            <Link href={`/director/${slug}`}>← Everything on {name}: films, readings &amp; where to start</Link>
          </p>
        </article>
      </div>

      <DirectorPlates slug={slug} exclude="next" />
    </div>
  );
}
