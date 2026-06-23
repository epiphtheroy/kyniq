import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";
import LightboxImage from "@/components/LightboxImage";

export const revalidate = 300;
export async function generateStaticParams() { return []; }
const IMG = "https://image.tmdb.org/t/p";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

interface Props { params: Promise<{ slug: string }>; }

async function load(slug: string) {
  const supabase = db();
  const { data: films } = await supabase
    .from("films").select("id, title, slug, year, director, backdrop_path, poster_path").eq("director_slug", slug).eq("visible", true).order("year");
  if (!films || films.length === 0) return null;
  const director = films[0].director ?? slug.replace(/-/g, " ");
  const filmIds = films.map((f) => f.id);

  const { data: dir } = await supabase
    .from("directors").select("name, profile_path, bio, birthday, place_of_birth").eq("slug", slug).maybeSingle();

  // Per-film Strong Misreading (reading) counts across the filmography.
  const { data: readRows } = await supabase
    .from("takes")
    .select("figure:figures!inner(film_id)")
    .in("figure.film_id", filmIds)
    .eq("status", "published");
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
    .in("figure.film_id", filmIds)
    .eq("meta_take.status", "published")
    .eq("meta_take.kind", "figure_type");
  const tropeFilms = new Map<string, { slug: string; title: string; films: Set<string> }>();
  for (const r of (tropeRows ?? []) as unknown[]) {
    const t = r as { meta_take: { id: string; slug: string; title: string }; figure: { film_id: string } };
    const e = tropeFilms.get(t.meta_take.id) ?? { slug: t.meta_take.slug, title: t.meta_take.title, films: new Set<string>() };
    e.films.add(t.figure.film_id); tropeFilms.set(t.meta_take.id, e);
  }
  const sigTropes = [...tropeFilms.values()]
    .filter((m) => m.films.size >= 2)
    .sort((a, b) => b.films.size - a.films.size)
    .map((m) => ({ ...m, filmList: [...m.films].map((id) => filmById.get(id)!).filter(Boolean) }));

  return { director, dir, films, sigTropes, perFilmReadings, total: films.length, readingCount, tropeCount: tropeFilms.size };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  return { title: `${data.director} — the recurring readings of a filmography` };
}

// Presence-dot meter: filled dots = number of the director's films a reading touches.
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

function SigRow({
  href, title, films, total, tone,
}: {
  href: string; title: string; films: { slug: string; title: string }[]; total: number; tone: "red" | "teal";
}) {
  return (
    <div className="dr-sig">
      <Link className="dr-sig-t" href={href}>{title}</Link>
      <PresenceDots n={films.length} of={total} tone={tone} />
      <div className="dr-sig-films">
        <span className="dr-vl">in</span>
        {films.map((f, i) => (
          <span key={f.slug}>{i > 0 ? " · " : ""}<Link href={`/film/${f.slug}`}>{f.title}</Link></span>
        ))}
      </div>
    </div>
  );
}

const SIG_LIMIT = 10;

export default async function DirectorPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { director, dir, films, sigTropes, perFilmReadings, total, readingCount, tropeCount } = data;
  const d = dir as { profile_path?: string | null; bio?: string | null; birthday?: string | null; place_of_birth?: string | null } | null;

  const jsonld = {
    "@context": "https://schema.org", "@type": "Person", name: director, jobTitle: "Film director",
    ...(d?.profile_path ? { image: `${IMG}/w342${d.profile_path}` } : {}),
    ...(d?.birthday ? { birthDate: d.birthday } : {}),
    ...(d?.place_of_birth ? { birthPlace: d.place_of_birth } : {}),
    ...(d?.bio ? { description: d.bio.slice(0, 500) } : {}),
  };

  // Born "March 27, 1963" from an ISO birthday, if present.
  let bornLabel: string | null = null;
  if (d?.birthday) {
    const dt = new Date(d.birthday);
    bornLabel = isNaN(dt.getTime())
      ? d.birthday
      : dt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  }

  const tropesShown = sigTropes.slice(0, SIG_LIMIT);

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
              <LightboxImage
                src={`${IMG}/w185${d.profile_path}`}
                fullUrl={`${IMG}/w342${d.profile_path}`}
                alt={director}
                caption={director}
              />
            </div>
          ) : (
            <div className="dr-photo dr-photo--empty" aria-hidden="true" />
          )}
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

        {/* STAT STRIP — clickable jump links */}
        <div className="dr-stats">
          <a className="dr-stat" href="#dr-filmography"><div className="dr-n">{total}</div><div className="dr-k">Films</div></a>
          <a className="dr-stat" href="#dr-filmography"><div className="dr-n">{readingCount}</div><div className="dr-k">Readings</div></a>
          <a className="dr-stat dr-teal" href="#dr-sigtropes"><div className="dr-n">{tropeCount}</div><div className="dr-k">Tropes</div></a>
        </div>

        {/* FINGERPRINT INTRO */}
        <p className="dr-finger">
          What makes a film unmistakably {director}&apos;s — the tropes and devices that recur across the
          filmography. <b>Computed, not asserted:</b> each one below appears in two or more of{" "}
          {total === 1 ? "the single film" : `the ${total} films`} on Metatake.
        </p>

        {/* BIOGRAPHY */}
        {d?.bio ? (
          <details className="dr-bio">
            <summary>Biography</summary>
            <div className="dr-bio-b">
              <p>{d.bio}</p>
              <div className="dr-src">Biography &amp; image via TMDB.</div>
            </div>
          </details>
        ) : null}

        {/* SIGNATURE TROPES */}
        {sigTropes.length > 0 && (
          <section className="dr-sec dr-sec--teal" id="dr-sigtropes">
            <h2 className="dr-h2">Signature tropes</h2>
            <p className="dr-gloss">
              Figure-types — devices, situations, objects — {director} returns to across films. Shared with other
              directors under <Link className="dr-teal-link" href="/tropes">Tropes</Link>.
            </p>
            <div className="dr-siglist">
              {tropesShown.map((m) => (
                <SigRow key={m.slug} href={`/trope/${m.slug}`} title={m.title} films={m.filmList} total={total} tone="teal" />
              ))}
            </div>
            {sigTropes.length > SIG_LIMIT && (
              <Link className="dr-showall dr-teal-link" href="/tropes">Show all {sigTropes.length} signature tropes →</Link>
            )}
          </section>
        )}

        {/* FILMOGRAPHY */}
        <section className="dr-sec" id="dr-filmography">
          <h2 className="dr-h2">Filmography</h2>
          <p className="dr-gloss">
            {total === 1 ? "One film" : `${total} films`} on Metatake — each read closely. The count is the number of
            Strong Misreadings written for each film.
          </p>
          <div className="dr-films-grid">
            {films.map((f) => {
              const film = f as { slug: string; title: string; year: number | null; backdrop_path?: string | null; poster_path?: string | null };
              const art = film.backdrop_path
                ? `${IMG}/w500${film.backdrop_path}`
                : film.poster_path ? `${IMG}/w342${film.poster_path}` : null;
              const count = perFilmReadings.get(f.id) ?? 0;
              return (
                <Link className="dr-fcard" href={`/film/${film.slug}`} key={film.slug}>
                  {art ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img className="dr-bd" src={art} alt={`${film.title} backdrop`} loading="lazy" />
                  ) : (
                    <div className="dr-bd dr-bd--empty" aria-hidden="true" />
                  )}
                  <div className="dr-cap">
                    <div className="dr-ti">
                      {film.title}{" "}
                      {film.year ? <span className="dr-yr">({film.year})</span> : null}
                    </div>
                    <div className="dr-fmt"><b>{count}</b> reading{count === 1 ? "" : "s"}</div>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="dr-prov">
            Director fingerprint computed from the live corpus — signatures recur across two or more films. Bio &amp;
            images via TMDB.
          </div>
        </section>
      </div>
    </div>
  );
}
