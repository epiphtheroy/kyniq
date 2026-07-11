import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import SiteNav from "@/components/home2/SiteNav";
import EntityTVHero from "@/components/EntityTVHero";
import PosterActions from "@/components/PosterActions";
import LensQuickBar from "@/components/LensQuickBar";
import ShareDock from "@/components/ShareDock";
import { pageRobots } from "@/lib/seo";

export const revalidate = 300;
export async function generateStaticParams() { return []; }
const IMG = "https://image.tmdb.org/t/p";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
interface Props { params: Promise<{ slug: string }> }

type Film = { id: string; title: string; slug: string; year: number | null; director: string | null; director_slug: string | null; poster_path: string | null; backdrop_path: string | null; visible: boolean };
type Rec = {
  film: { title: string; slug: string; year: number | null; director: string | null; backdrop_path: string | null };
  reasons: { slug: string; title: string }[];
  score: number;
  cos: number | null;
  sharedN: number;
  ts?: number | null;   // public TakeScore (U); null if unscored
};

async function load(slug: string) {
  const supabase = db();
  const { data: film } = await supabase
    .from("films")
    .select("id, title, slug, year, director, director_slug, poster_path, backdrop_path, visible")
    .eq("slug", slug).maybeSingle();
  if (!film) return null;

  const { data: aff } = await supabase
    .from("film_affinities")
    .select("related_film_id, score, shared_meta_take_ids, cos, updated_at")
    .eq("film_id", (film as Film).id)
    .order("score", { ascending: false })
    .limit(24);

  const relIds = (aff ?? []).map((a) => a.related_film_id);
  const sharedIds = [...new Set((aff ?? []).flatMap((a) => (a.shared_meta_take_ids ?? []) as string[]))];
  const [{ data: relFilms }, { data: sharedMts }] = await Promise.all([
    relIds.length ? supabase.from("films").select("id, title, slug, year, director, backdrop_path").in("id", relIds).eq("visible", true)
      : Promise.resolve({ data: [] as { id: string; title: string; slug: string; year: number | null; director: string | null; backdrop_path: string | null }[] }),
    sharedIds.length ? supabase.from("meta_takes").select("id, slug, title").in("id", sharedIds).eq("status", "published").eq("kind", "figure_type")
      : Promise.resolve({ data: [] as { id: string; slug: string; title: string }[] }),
  ]);
  const relMap = new Map((relFilms ?? []).map((f) => [f.id, f]));
  const mtMap = new Map((sharedMts ?? []).map((m) => [m.id, m]));
  const recs: Rec[] = (aff ?? []).map((a) => {
    const f = relMap.get(a.related_film_id);
    if (!f) return null;  // skip hidden/thin related films
    const reasons = ((a.shared_meta_take_ids ?? []) as string[]).map((id) => mtMap.get(id)).filter(Boolean) as { slug: string; title: string }[];
    return { film: f, reasons, score: Number(a.score), cos: a.cos == null ? null : Number(a.cos), sharedN: (a.shared_meta_take_ids ?? []).length };
  }).filter(Boolean) as Rec[];

  // TakeScore per rec (shared bulk RPC by slug; null for unscored Tier-2 films)
  const scoreRows = recs.length
    ? (((await supabase.rpc("takescore_for_slugs", { p_slugs: recs.map((r) => r.film.slug) })).data as { slug: string; ts: number }[] | null) ?? [])
    : [];
  const scoreMap = new Map(scoreRows.map((s) => [s.slug, s.ts]));
  recs.forEach((r) => { r.ts = scoreMap.get(r.film.slug) ?? null; });

  // derived, never baked: the edition date is the last time the affinity ledger was rebuilt
  const updatedAt = (aff ?? []).reduce<string | null>((m, a) => {
    const u = (a as { updated_at?: string }).updated_at ?? null;
    return u && (!m || u > m) ? u : m;
  }, null);

  return { film: film as Film, recs, updatedAt };
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : null;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  const { film, recs } = data;
  const yr = film.year ? ` (${film.year})` : "";
  const title = `Movies like ${film.title}${yr} — ${recs.length} Closest Films, Ranked`;
  const description = recs.length
    ? `The ${recs.length} films closest in pattern to ${film.title}, ranked by shared tropes and taste-vector proximity: ${recs.slice(0, 5).map((r) => r.film.title).join(", ")} and more — each with the evidence for why it's kin.`
    : `Films similar to ${film.title}.`;
  const meetsBar = film.visible && recs.length >= 3;
  return {
    title,
    description,
    openGraph: { title, description },
    alternates: { canonical: `/movies-like/${film.slug}` },
    robots: pageRobots(meetsBar),
  };
}

export default async function MoviesLikePage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { film, recs, updatedAt } = data;
  const updated = fmtDate(updatedAt);

  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemList",
        "@id": `https://metatake.net/movies-like/${film.slug}#list`,
        name: `Movies like ${film.title} — ranked`,
        numberOfItems: recs.length,
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        itemListElement: recs.map((r, i) => ({
          "@type": "ListItem", position: i + 1,
          item: { "@type": "Movie", name: r.film.title, ...(r.film.year ? { datePublished: String(r.film.year) } : {}), url: `https://metatake.net/film/${r.film.slug}` },
        })),
      },
      {
        "@type": "WebPage",
        "@id": `https://metatake.net/movies-like/${film.slug}`,
        name: `Movies like ${film.title}`,
        ...(updatedAt ? { dateModified: updatedAt } : {}),
        author: { "@type": "Organization", "@id": "https://metatake.net/#org", name: "Metatake" },
        editor: { "@type": "Person", "@id": "https://metatake.net/editor#person", name: "Wonwoo Yoon" },
        mainEntity: { "@id": `https://metatake.net/movies-like/${film.slug}#list` },
      },
    ],
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
      <div className="mt-wrap">
        <div className="mt-crumb">
          <Link href="/film">Films</Link> &nbsp;›&nbsp; <Link href={`/film/${film.slug}`}>{film.title}</Link>
        </div>
        <EntityTVHero program={film.slug} reelSlugs={[film.slug]} label={film.title} backdrop={film.backdrop_path ?? null} />

        <div style={{ display: "flex", gap: 18, alignItems: "flex-start", marginTop: 6 }}>
          {film.poster_path ? (
            <Link href={`/film/${film.slug}`} style={{ flex: "0 0 92px" }} aria-label={film.title}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${IMG}/w154${film.poster_path}`} alt={`${film.title} poster`} width={92} style={{ borderRadius: 8, display: "block", width: 92, height: "auto" }} loading="eager" />
            </Link>
          ) : null}
          <div style={{ minWidth: 0 }}>
            <h1 className="mt-h1" style={{ marginTop: 0 }}>Movies like {film.title}{film.year ? ` (${film.year})` : ""}</h1>
            <p className="mt-laconic" style={{ marginTop: 6 }}>
              The <b>{recs.length} films closest in pattern</b> to {film.title} — ranked by shared{" "}
              <Link href="/tropes">tropes</Link> and taste-vector proximity. Each entry carries its evidence.
              The inverse list — films that share the shape but fight over the meaning — lives under{" "}
              <Link href={`/film/${film.slug}#df-counterpoints`}>Counterpoints</Link>.
            </p>
            <p style={{ fontSize: 12.5, opacity: .72, margin: "10px 0 0" }}>
              By Metatake Editorial · Edited by <Link href="/editor">Wonwoo Yoon</Link>
              {updated ? <> · Updated {updated}</> : null} · <Link href="/methodology#connections">How it&apos;s computed →</Link>
            </p>
            <div className="ml-share" style={{ marginTop: 12 }}>
              <ShareDock variant="bar" path={`/movies-like/${slug}`} title={`Movies like ${film.title}`}
                hook={`Movies like ${film.title}${film.year ? ` (${film.year})` : ""} — the ${recs.length} closest films, ranked by shared tropes and taste on Metatake`}
                saveType="movies-like" saveRef={slug} />
              <ShareDock variant="fab" path={`/movies-like/${slug}`} title={`Movies like ${film.title}`} noSave />
            </div>
          </div>
        </div>

        <LensQuickBar />

        {recs.length === 0 ? (
          <p className="mt-see" style={{ fontStyle: "italic", marginTop: 24 }}>No similar films yet — this film&apos;s readings are still being connected.</p>
        ) : (
          <ol className="ml-list" style={{ listStyle: "none", padding: 0, marginTop: 26 }}>
            {recs.map((r, i) => (
              <li key={r.film.slug} className="ml-item">
                <div className="ml-row" style={{ position: "relative" }}>
                  <div style={{
                    flex: "0 0 34px", fontSize: i < 3 ? 22 : 17, fontWeight: 800, lineHeight: "1",
                    paddingTop: 6, textAlign: "right", opacity: i < 3 ? .95 : .45, fontVariantNumeric: "tabular-nums",
                  }}><span style={{ fontSize: "0.6em", verticalAlign: "0.25em", opacity: .7 }}>#</span>{i + 1}</div>
                  {r.film.backdrop_path ? (
                    <Link href={`/film/${r.film.slug}`} className="ml-thumb" aria-label={r.film.title}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${IMG}/w300${r.film.backdrop_path}`} alt="" loading="lazy" />
                      <PosterActions slug={r.film.slug} compact />
                    </Link>
                  ) : null}
                  <div className="ml-txt">
                    <Link href={`/film/${r.film.slug}`} className="ml-title">{r.film.title}</Link>{" "}
                    <span className="yr">({r.film.year ?? "?"})</span>
                    {r.film.director ? <span className="ml-dir"> · {r.film.director}</span> : null}
                    <p style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "7px 0 0" }}>
                      {r.ts != null ? (
                        <Link href={`/takescore/film/${r.film.slug}`} style={{ fontSize: 11.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(176,138,44,.12)", color: "#6b5416", textDecoration: "none" }}>
                          TakeScore {r.ts}
                        </Link>
                      ) : null}
                      {r.cos != null ? (
                        <span style={{ fontSize: 11.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(31,111,178,.10)", color: "#1a4e7a" }}>
                          taste match {Math.round(r.cos * 100)}%
                        </span>
                      ) : null}
                      <span style={{ fontSize: 11.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(15,110,86,.10)", color: "#0b5343" }}>
                        {r.sharedN > 0 ? `${r.sharedN} shared trope${r.sharedN > 1 ? "s" : ""}` : "taste-vector neighbour"}
                      </span>
                    </p>
                    {r.reasons.length ? (
                      <p className="ml-why">
                        <b>{r.film.title}</b> and <b>{film.title}</b> share:{" "}
                        {r.reasons.slice(0, 4).map((m, j) => (
                          <span key={m.slug}>{j > 0 ? ", " : ""}<Link href={`/trope/${m.slug}`}>{m.title}</Link></span>
                        ))}{r.reasons.length > 4 ? ` +${r.reasons.length - 4}` : ""}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}

        <p style={{ fontSize: 12, opacity: .62, marginTop: 28, maxWidth: "68ch", lineHeight: 1.55 }}>
          <b>taste match</b> = cosine similarity between the two films&apos; reading vectors (each film&apos;s published
          readings averaged into one embedding). <b>shared tropes</b> = published tropes both films&apos; figures belong to,
          rarer tropes weighing more. Rankings are computed by Metatake&apos;s connection engine from its own readings
          corpus and update as the corpus grows. © Metatake — all rights reserved.
        </p>

        <p className="mt-see" style={{ marginTop: "1.2rem" }}>
          ← Back to <Link href={`/film/${film.slug}`}>{film.title}</Link>
        </p>
      </div>
    </div>
  );
}
