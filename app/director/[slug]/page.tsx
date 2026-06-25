import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";
import LightboxImage from "@/components/LightboxImage";
import FilmTabBar from "@/components/FilmTabBar";
import { fw } from "@/lib/frameworks";
import { axisLabel, nodeHref } from "@/lib/catalog";

export const revalidate = 300;
export async function generateStaticParams() { return []; }
const IMG = "https://image.tmdb.org/t/p";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

interface Props { params: Promise<{ slug: string }>; }

type Pick = { pos: number; film_slug: string | null; film_title: string | null; film_year: number | null; label: string | null; reason: string | null };
type Fact = { n: number; text: string; source?: string | null };
type Next = { pos: number; rec_name: string; reason: string; target_slug: string | null; tmdb_person_id: number | null; profile_path: string | null };

async function load(slug: string) {
  const supabase = db();
  const { data: films } = await supabase
    .from("films").select("id, title, slug, year, director, backdrop_path, poster_path").eq("director_slug", slug).eq("visible", true).order("year");
  if (!films || films.length === 0) return null;
  const director = films[0].director ?? slug.replace(/-/g, " ");
  const filmIds = films.map((f) => f.id);

  const [{ data: dir }, { data: portrait }, { data: facts }, { data: picks }, { data: next }, { data: recByRaw }, { data: misRows }, { data: archRows }] = await Promise.all([
    supabase.from("directors").select("name, profile_path, bio, birthday, place_of_birth").eq("slug", slug).maybeSingle(),
    supabase.from("director_portrait").select("body, source").eq("director_slug", slug).maybeSingle(),
    supabase.from("director_facts").select("name_meaning, intro, facts").eq("director_slug", slug).maybeSingle(),
    supabase.from("director_picks").select("pos, film_slug, film_title, film_year, label, reason").eq("director_slug", slug).order("pos"),
    supabase.from("director_next").select("pos, rec_name, reason, target_slug, tmdb_person_id, profile_path").eq("director_slug", slug).order("pos"),
    supabase.from("director_next").select("director_slug").eq("target_slug", slug),
    supabase.rpc("director_misreadings", { p_slug: slug, p_limit: 30 }),
    supabase.rpc("director_catalog", { p_slug: slug }),
  ]);

  // Strong Misreadings — pick a representative set: strongest first, max 2 per film, cap 8.
  type Mis = { framework: string | null; take_title: string | null; rationale: string | null; strength: number | null; figure_label: string | null; figure_slug: string | null; film_title: string; film_slug: string; film_year: number | null };
  const perFilm = new Map<string, number>(); const misreadings: Mis[] = [];
  for (const m of ((misRows as Mis[] | null) ?? [])) {
    const c = perFilm.get(m.film_slug) ?? 0;
    if (c >= 2) continue;
    perFilm.set(m.film_slug, c + 1); misreadings.push(m);
    if (misreadings.length >= 8) break;
  }
  // Archetype — aggregate across the filmography, cap per axis.
  type Arch = { axis: string; slug: string; label: string; n: number };
  const archByAxis = new Map<string, Arch[]>();
  for (const a of ((archRows as Arch[] | null) ?? [])) {
    const arr = archByAxis.get(a.axis) ?? []; if (arr.length < 12) arr.push(a); archByAxis.set(a.axis, arr);
  }
  const ARCH_AXES = ["char_archetype", "char_identity", "char_complex", "object", "location", "theme"];
  const archGroups = ARCH_AXES.map((axis) => ({ axis, items: archByAxis.get(axis) ?? [] })).filter((g) => g.items.length > 0);

  // reverse "recommended by" — resolve recommender slugs → display names
  const recBySlugs = [...new Set(((recByRaw ?? []) as { director_slug: string }[]).map((r) => r.director_slug))];
  let recBy: { slug: string; name: string }[] = [];
  if (recBySlugs.length) {
    const { data: names } = await supabase.from("directors").select("slug, name").in("slug", recBySlugs);
    const nameOf = new Map((names ?? []).map((n: { slug: string; name: string }) => [n.slug, n.name]));
    recBy = recBySlugs.map((s) => ({ slug: s, name: nameOf.get(s) || s.replace(/-/g, " ") }));
  }

  // Per-film Strong Misreading (reading) counts across the filmography.
  const { data: readRows } = await supabase
    .from("takes").select("figure:figures!inner(film_id)").in("figure.film_id", filmIds).eq("status", "published");
  const perFilmReadings = new Map<string, number>();
  for (const r of (readRows ?? []) as unknown[]) {
    const fid = (r as { figure: { film_id: string } }).figure.film_id;
    perFilmReadings.set(fid, (perFilmReadings.get(fid) ?? 0) + 1);
  }
  let readingCount = 0;
  for (const v of perFilmReadings.values()) readingCount += v;

  const filmById = new Map<string, { id: string; title: string; slug: string; year: number | null }>(
    films.map((f) => [f.id as string, f as { id: string; title: string; slug: string; year: number | null }])
  );

  // Tropes (figure-types) recurring across the filmography.
  const { data: tropeRows } = await supabase
    .from("figure_type_members")
    .select("meta_take:meta_takes!inner(id, slug, title, status, kind), figure:figures!inner(film_id)")
    .in("figure.film_id", filmIds).eq("meta_take.status", "published").eq("meta_take.kind", "figure_type");
  const tropeFilms = new Map<string, { slug: string; title: string; films: Set<string> }>();
  for (const r of (tropeRows ?? []) as unknown[]) {
    const t = r as { meta_take: { id: string; slug: string; title: string }; figure: { film_id: string } };
    const e = tropeFilms.get(t.meta_take.id) ?? { slug: t.meta_take.slug, title: t.meta_take.title, films: new Set<string>() };
    e.films.add(t.figure.film_id); tropeFilms.set(t.meta_take.id, e);
  }
  const sigTropes = [...tropeFilms.values()]
    .filter((m) => m.films.size >= 2).sort((a, b) => b.films.size - a.films.size)
    .map((m) => ({ ...m, filmList: [...m.films].map((id) => filmById.get(id)!).filter(Boolean) }));

  // Who's Next photos: matched directors (target_slug set) have their photo in `directors`,
  // not in director_next — pull it so the circles aren't grey.
  const nextArr = (next as Next[] | null) ?? [];
  const needPhoto = [...new Set(nextArr.filter((n) => n.target_slug && !n.profile_path).map((n) => n.target_slug as string))];
  if (needPhoto.length) {
    const { data: dp } = await supabase.from("directors").select("slug, profile_path").in("slug", needPhoto);
    const pmap = new Map((dp ?? []).map((r: { slug: string; profile_path: string | null }) => [r.slug, r.profile_path]));
    for (const n of nextArr) { if (n.target_slug && !n.profile_path) n.profile_path = pmap.get(n.target_slug) ?? null; }
  }

  return {
    director, dir, films, sigTropes, perFilmReadings, total: films.length, readingCount, tropeCount: tropeFilms.size,
    portrait: portrait as { body: string; source: string } | null,
    facts: facts as { name_meaning: string | null; intro: string | null; facts: Fact[] } | null,
    picks: (picks as Pick[] | null) ?? [],
    next: nextArr,
    recBy, misreadings, archGroups,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  return { title: `${data.director} — portrait, filmography & where to start — Metatake` };
}

const SIG_LIMIT = 12;

export default async function DirectorPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { director, dir, films, sigTropes, perFilmReadings, total, readingCount, tropeCount, portrait, facts, picks, next, recBy, misreadings, archGroups } = data;
  const d = dir as { profile_path?: string | null; bio?: string | null; birthday?: string | null; place_of_birth?: string | null } | null;

  const jsonld = {
    "@context": "https://schema.org", "@type": "Person", name: director, jobTitle: "Film director",
    ...(d?.profile_path ? { image: `${IMG}/w342${d.profile_path}` } : {}),
    ...(d?.birthday ? { birthDate: d.birthday } : {}),
    ...(d?.place_of_birth ? { birthPlace: d.place_of_birth } : {}),
    ...(portrait?.body ? { description: portrait.body.slice(0, 500) } : d?.bio ? { description: d.bio.slice(0, 500) } : {}),
  };

  let bornLabel: string | null = null;
  if (d?.birthday) {
    const dt = new Date(d.birthday);
    bornLabel = isNaN(dt.getTime()) ? d.birthday : dt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  }

  const tropesShown = sigTropes.slice(0, SIG_LIMIT);
  const portraitText = portrait?.body || d?.bio || null;

  // Portrait art: up to 6 of the director's own film images (seeded shuffle → stable per ISR window).
  type FilmArt = { id: string; slug: string; title: string; year: number | null; poster_path?: string | null; backdrop_path?: string | null };
  const artPool = (films as FilmArt[]).filter((f) => f.poster_path || f.backdrop_path);
  const seed = slug.split("").reduce((a, c) => a + c.charCodeAt(0), 7);
  const portraitArt = artPool
    .map((f, i) => ({ f, k: (i * 2654435761 + seed * 40503) % 1000000 }))
    .sort((a, b) => a.k - b.k).slice(0, 6).map((x) => x.f);

  // poster for each pick (picks reference the director's own films)
  const posterBySlug = new Map<string, string | null>((films as FilmArt[]).map((f) => [f.slug, f.poster_path || f.backdrop_path || null]));

  // Dynamic tabs: Portrait + Filmography always; others when their data exists.
  const tabs: { id: string; label: string }[] = [
    { id: "dr-portrait", label: "Portrait" },
    { id: "dr-filmography", label: "Filmography" },
  ];
  if (misreadings.length) tabs.push({ id: "dr-misreadings", label: "Strong Misreadings" });
  if (sigTropes.length) tabs.push({ id: "dr-tropes", label: "Tropes" });
  if (archGroups.length) tabs.push({ id: "dr-archetype", label: "Archetype" });
  if (facts && Array.isArray(facts.facts) && facts.facts.length) tabs.push({ id: "dr-life", label: "The Life" });
  if (next.length) tabs.push({ id: "dr-next", label: "Who's Next" });
  if (picks.length) tabs.push({ id: "dr-start", label: "Where to Start" });

  return (
    <div className="mt">
      <MetatakeNav active="directors" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />

      <div className="dr-wrap">
        <div className="dr-crumb"><Link href="/director">Directors</Link></div>

        {/* HEADER */}
        <div className="dr-head">
          {d?.profile_path ? (
            <div className="dr-photo">
              <LightboxImage src={`${IMG}/w185${d.profile_path}`} fullUrl={`${IMG}/w342${d.profile_path}`} alt={director} caption={director} />
            </div>
          ) : (<div className="dr-photo dr-photo--empty" aria-hidden="true" />)}
          <div className="dr-txt">
            <div className="dr-role">Director</div>
            <h1 className="dr-h1">{director}</h1>
            {(bornLabel || d?.place_of_birth) && (
              <div className="dr-born">
                {bornLabel && <span>Born {bornLabel}</span>}
                {bornLabel && d?.place_of_birth && <span className="dr-dot" />}
                {d?.place_of_birth && <span>{d.place_of_birth}</span>}
              </div>
            )}
          </div>
        </div>

        {/* STAT STRIP */}
        <div className="dr-stats">
          <a className="dr-stat" href="#dr-filmography"><div className="dr-n">{total}</div><div className="dr-k">Films</div></a>
          <a className="dr-stat" href="#dr-misreadings"><div className="dr-n">{readingCount}</div><div className="dr-k">Readings</div></a>
          <a className="dr-stat dr-teal" href="#dr-tropes"><div className="dr-n">{tropeCount}</div><div className="dr-k">Tropes</div></a>
        </div>
      </div>

      <div className="dr-wrap">
        <FilmTabBar tabs={tabs} />

        {/* PORTRAIT */}
        <section className="dr-sec" id="dr-portrait">
          <h2 className="dr-h2">Portrait</h2>
          <div className={`dr-portrait-row${portraitArt.length ? "" : " dr-portrait-row--solo"}`}>
            <div className="dr-portrait-main">
              {portraitText ? (
                <div className="dr-portrait-body">
                  {portraitText.split(/\n\s*\n/).map((para, i) => <p key={i}>{para}</p>)}
                  <div className="dr-src">{portrait?.body ? "Metatake editorial method (AI-drafted)." : "Biography via TMDB — Metatake portrait coming soon."}</div>
                </div>
              ) : (
                <p className="dr-gloss">A portrait of {director} is coming soon.</p>
              )}
            </div>
            {portraitArt.length > 0 && (
              <div className="dr-portrait-art" aria-hidden="true">
                {portraitArt.map((f) => {
                  const src = f.poster_path ? `${IMG}/w185${f.poster_path}` : f.backdrop_path ? `${IMG}/w300${f.backdrop_path}` : null;
                  if (!src) return null;
                  return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={f.slug} className="dr-pa-img" src={src} alt="" loading="lazy" title={`${f.title}${f.year ? ` (${f.year})` : ""}`} />
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* STRONG MISREADINGS — a representative set of real readings across the films */}
        {misreadings.length > 0 && (
          <section className="dr-sec" id="dr-misreadings">
            <h2 className="dr-h2">Strong Misreadings</h2>
            <p className="dr-gloss">{readingCount} bold readings across {director}&apos;s films — here are the strongest, at most two per film. Open a film for its full set.</p>
            <div className="dr-mr-cards">
              {misreadings.map((m, i) => {
                const f = fw(m.framework);
                const thesis = m.rationale ? (m.rationale.length > 220 ? m.rationale.slice(0, 220).trimEnd() + "…" : m.rationale) : null;
                return (
                  <div className="dr-mr-card" key={i}>
                    <div className="dr-mr-top">
                      <span className="dr-mr-fw" style={{ color: f.color }}>{f.label}</span>
                      <Link className="dr-mr-film" href={`/film/${m.film_slug}#df-readings`}>{m.film_title}{m.film_year ? ` (${m.film_year})` : ""}</Link>
                    </div>
                    {m.take_title ? <div className="dr-mr-title">{m.take_title}</div> : null}
                    {thesis ? <p className="dr-mr-thesis">{thesis}</p> : null}
                    {m.figure_label ? (
                      <div className="dr-mr-via"><span className="dr-mr-vk">via</span>{" "}
                        {m.figure_slug ? <Link href={`/film/${m.film_slug}/figure/${m.figure_slug}`}>{m.figure_label}</Link> : <span>{m.figure_label}</span>}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* TROPES — signature figure-types, just the items */}
        {sigTropes.length > 0 && (
          <section className="dr-sec dr-sec--teal" id="dr-tropes">
            <h2 className="dr-h2">Tropes</h2>
            <p className="dr-gloss">Figure-types {director} returns to — computed across the filmography. <Link className="dr-teal-link" href="/tropes">All tropes →</Link></p>
            <div className="dr-chips">
              {tropesShown.map((m) => (
                <Link key={m.slug} className="dr-chip dr-chip--teal" href={`/trope/${m.slug}`}>{m.title}<span className="dr-chip-n">{m.filmList.length}</span></Link>
              ))}
            </div>
          </section>
        )}

        {/* ARCHETYPE — catalog classification aggregated across the filmography */}
        {archGroups.length > 0 && (
          <section className="dr-sec" id="dr-archetype">
            <h2 className="dr-h2">Archetype</h2>
            <p className="dr-gloss">What recurs across {director}&apos;s films by the figure catalog — characters, objects, places, themes. Each links into the <Link href="/catalog">Archetype</Link> catalog.</p>
            {archGroups.map((g) => (
              <div className="dr-arch-grp" key={g.axis}>
                <div className="dr-arch-axis">{axisLabel(g.axis)}</div>
                <div className="dr-chips">
                  {g.items.map((a) => (
                    <Link key={a.slug} className="dr-chip" href={nodeHref(g.axis, a.slug)}>{a.label}{a.n > 1 ? <span className="dr-chip-n">{a.n}</span> : null}</Link>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* THE LIFE */}
        {facts && Array.isArray(facts.facts) && facts.facts.length > 0 && (
          <section className="dr-sec" id="dr-life">
            <h2 className="dr-h2">The Life</h2>
            <p className="dr-gloss">The person behind the films — {facts.facts.length} things worth knowing about {director}.</p>
            {facts.name_meaning ? (
              <div className="dr-namemean"><span className="dr-nm-k">The name</span><p>{facts.name_meaning}</p></div>
            ) : null}
            {facts.intro ? <p className="dr-life-intro">{facts.intro}</p> : null}
            <ol className="dr-life-list">
              {facts.facts.slice().sort((a, b) => a.n - b.n).map((f) => {
                let host = "";
                try { if (f.source) host = new URL(f.source).hostname.replace(/^www\./, ""); } catch {}
                return (
                  <li key={f.n} className="dr-fact">
                    {f.text}
                    {f.source ? <> <a className="dr-fact-src" href={f.source} target="_blank" rel="noopener nofollow" title={f.source}>↗ {host}</a></> : null}
                  </li>
                );
              })}
            </ol>
            <div className="dr-src">Each fact is written freely, then verified against a live web source (English &amp; native-language). Source link per fact.</div>
          </section>
        )}

        {/* WHO'S NEXT */}
        {next.length > 0 && (
          <section className="dr-sec" id="dr-next">
            <h2 className="dr-h2">Who&apos;s Next</h2>
            <p className="dr-gloss">Five directors to explore after {director} — each chosen for a specific kinship. Curated, not algorithmic.</p>
            <div className="dr-next-grid">
              {next.map((n) => (
                <div className="dr-next-card" key={n.pos}>
                  {n.profile_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="dr-next-photo" src={`${IMG}/w185${n.profile_path}`} alt="" loading="lazy" />
                  ) : <span className="dr-next-photo dr-next-photo--e" aria-hidden="true" />}
                  <div className="dr-next-b">
                    <div className="dr-next-name">
                      {n.target_slug ? <Link href={`/director/${n.target_slug}`}>{n.rec_name}</Link> : <>{n.rec_name} <span className="dr-next-off">not yet on Metatake</span></>}
                    </div>
                    <p className="dr-next-why">{n.reason}</p>
                  </div>
                </div>
              ))}
            </div>
            {recBy.length > 0 && (
              <div className="dr-recby">
                <span className="dr-recby-k">Pointed to from:</span>{" "}
                {recBy.map((r, i) => (<span key={r.slug}>{i > 0 ? " · " : ""}<Link href={`/director/${r.slug}`}>{r.name}</Link></span>))}
              </div>
            )}
          </section>
        )}

        {/* FILMOGRAPHY */}
        <section className="dr-sec" id="dr-filmography">
          <h2 className="dr-h2">Filmography</h2>
          <p className="dr-gloss">
            {total === 1 ? "One film" : `${total} films`} on Metatake — each read closely. The count is the number of Strong Misreadings written for each film.
          </p>
          <div className="dr-films-grid">
            {films.map((f) => {
              const film = f as { slug: string; title: string; year: number | null; backdrop_path?: string | null; poster_path?: string | null };
              const art = film.backdrop_path ? `${IMG}/w500${film.backdrop_path}` : film.poster_path ? `${IMG}/w342${film.poster_path}` : null;
              const count = perFilmReadings.get(f.id) ?? 0;
              return (
                <Link className="dr-fcard" href={`/film/${film.slug}`} key={film.slug}>
                  {art ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img className="dr-bd" src={art} alt={`${film.title} backdrop`} loading="lazy" />
                  ) : (<div className="dr-bd dr-bd--empty" aria-hidden="true" />)}
                  <div className="dr-cap">
                    <div className="dr-ti">{film.title}{" "}{film.year ? <span className="dr-yr">({film.year})</span> : null}</div>
                    <div className="dr-fmt"><b>{count}</b> reading{count === 1 ? "" : "s"}</div>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="dr-prov">Director fingerprint computed from the live corpus — signatures recur across two or more films. Bio &amp; images via TMDB.</div>
        </section>

        {/* WHERE TO START — a route through the filmography (sits below it) */}
        {picks.length > 0 && (
          <section className="dr-sec" id="dr-start">
            <h2 className="dr-h2">Where to Start</h2>
            <p className="dr-gloss">A way into {director}&apos;s filmography — where to begin, the peak, the deep cut. Curated, not ranked by box office.</p>
            <div className="dr-picks">
              {picks.map((p) => {
                const poster = p.film_slug ? posterBySlug.get(p.film_slug) : null;
                return (
                  <div className="dr-pick" key={p.pos}>
                    {p.film_slug && poster ? (
                      <Link href={`/film/${p.film_slug}`} className="dr-pick-thumb">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`${IMG}/w92${poster}`} alt="" loading="lazy" />
                      </Link>
                    ) : <span className="dr-pick-thumb dr-pick-thumb--e" aria-hidden="true" />}
                    <div className="dr-pick-b">
                      {p.label ? <span className="dr-pick-label">{p.label}</span> : null}
                      <div className="dr-pick-film">
                        {p.film_slug ? <Link href={`/film/${p.film_slug}`}>{p.film_title}</Link> : <span>{p.film_title}</span>}
                        {p.film_year ? <span className="dr-yr"> ({p.film_year})</span> : null}
                      </div>
                      {p.reason ? <p className="dr-pick-why">{p.reason}</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
