import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";
import LightboxImage from "@/components/LightboxImage";
import FilmTabBar from "@/components/FilmTabBar";

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

  const [{ data: dir }, { data: portrait }, { data: facts }, { data: picks }, { data: next }, { data: recByRaw }] = await Promise.all([
    supabase.from("directors").select("name, profile_path, bio, birthday, place_of_birth").eq("slug", slug).maybeSingle(),
    supabase.from("director_portrait").select("body, source").eq("director_slug", slug).maybeSingle(),
    supabase.from("director_facts").select("name_meaning, intro, facts").eq("director_slug", slug).maybeSingle(),
    supabase.from("director_picks").select("pos, film_slug, film_title, film_year, label, reason").eq("director_slug", slug).order("pos"),
    supabase.from("director_next").select("pos, rec_name, reason, target_slug, tmdb_person_id, profile_path").eq("director_slug", slug).order("pos"),
    supabase.from("director_next").select("director_slug").eq("target_slug", slug),
  ]);

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

  return {
    director, dir, films, sigTropes, perFilmReadings, total: films.length, readingCount, tropeCount: tropeFilms.size,
    portrait: portrait as { body: string; source: string } | null,
    facts: facts as { name_meaning: string | null; intro: string | null; facts: Fact[] } | null,
    picks: (picks as Pick[] | null) ?? [],
    next: (next as Next[] | null) ?? [],
    recBy,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  return { title: `${data.director} — portrait, filmography & where to start — Metatake` };
}

function PresenceDots({ n, of, tone }: { n: number; of: number; tone: "red" | "teal" }) {
  return (
    <span className="dr-pres">
      <span className="dr-dots">
        {Array.from({ length: of }).map((_, i) => (
          <i key={i} className={i < n ? (tone === "teal" ? "dr-on-teal" : "dr-on") : undefined} />
        ))}
      </span>
      <span className="dr-inof">{n} / {of}</span>
    </span>
  );
}

function SigRow({ href, title, films, total, tone }: { href: string; title: string; films: { slug: string; title: string }[]; total: number; tone: "red" | "teal" }) {
  return (
    <div className="dr-sig">
      <Link className="dr-sig-t" href={href}>{title}</Link>
      <PresenceDots n={films.length} of={total} tone={tone} />
      <div className="dr-sig-films">
        <span className="dr-vl">in</span>
        {films.map((f, i) => (<span key={f.slug}>{i > 0 ? " · " : ""}<Link href={`/film/${f.slug}`}>{f.title}</Link></span>))}
      </div>
    </div>
  );
}

const SIG_LIMIT = 10;

export default async function DirectorPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { director, dir, films, sigTropes, perFilmReadings, total, readingCount, tropeCount, portrait, facts, picks, next, recBy } = data;
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

  // Dynamic tabs: Portrait + Filmography always; others when their data exists.
  const tabs: { id: string; label: string }[] = [
    { id: "dr-portrait", label: "Portrait" },
    { id: "dr-filmography", label: "Filmography" },
  ];
  if (picks.length) tabs.push({ id: "dr-start", label: "Where to Start" });
  if (facts && Array.isArray(facts.facts) && facts.facts.length) tabs.push({ id: "dr-life", label: "The Life" });
  if (next.length) tabs.push({ id: "dr-next", label: "Who's Next" });

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
          <a className="dr-stat" href="#dr-filmography"><div className="dr-n">{readingCount}</div><div className="dr-k">Readings</div></a>
          <a className="dr-stat dr-teal" href="#dr-portrait"><div className="dr-n">{tropeCount}</div><div className="dr-k">Tropes</div></a>
        </div>
      </div>

      <FilmTabBar tabs={tabs} />

      <div className="dr-wrap">
        {/* PORTRAIT */}
        <section className="dr-sec" id="dr-portrait">
          <h2 className="dr-h2">Portrait</h2>
          {portraitText ? (
            <div className="dr-portrait-body">
              {portraitText.split(/\n\s*\n/).map((para, i) => <p key={i}>{para}</p>)}
              <div className="dr-src">{portrait?.body ? "Metatake editorial method (AI-drafted)." : "Biography via TMDB — Metatake portrait coming soon."}</div>
            </div>
          ) : (
            <p className="dr-gloss">A portrait of {director} is coming soon.</p>
          )}

          {/* computed fingerprint — signature tropes */}
          {sigTropes.length > 0 && (
            <div className="dr-sub dr-sec--teal" id="dr-sigtropes">
              <h3 className="dr-h3">Signature tropes</h3>
              <p className="dr-gloss">
                Figure-types — devices, situations, objects — {director} returns to across films. <b>Computed, not asserted:</b> each
                appears in two or more of {total === 1 ? "the single film" : `the ${total} films`} on Metatake. Shared with other
                directors under <Link className="dr-teal-link" href="/tropes">Tropes</Link>.
              </p>
              <div className="dr-siglist">
                {tropesShown.map((m) => (<SigRow key={m.slug} href={`/trope/${m.slug}`} title={m.title} films={m.filmList} total={total} tone="teal" />))}
              </div>
            </div>
          )}
        </section>

        {/* WHERE TO START */}
        {picks.length > 0 && (
          <section className="dr-sec" id="dr-start">
            <h2 className="dr-h2">Where to Start</h2>
            <p className="dr-gloss">A way into {director}&apos;s filmography — where to begin, the peak, the deep cut. Curated, not ranked by box office.</p>
            <div className="dr-picks">
              {picks.map((p) => (
                <div className="dr-pick" key={p.pos}>
                  {p.label ? <span className="dr-pick-label">{p.label}</span> : null}
                  <div className="dr-pick-film">
                    {p.film_slug ? <Link href={`/film/${p.film_slug}`}>{p.film_title}</Link> : <span>{p.film_title}</span>}
                    {p.film_year ? <span className="dr-yr"> ({p.film_year})</span> : null}
                  </div>
                  {p.reason ? <p className="dr-pick-why">{p.reason}</p> : null}
                </div>
              ))}
            </div>
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
      </div>
    </div>
  );
}
