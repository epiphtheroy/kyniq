import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteNav from "@/components/home2/SiteNav";
import LineageActions from "@/components/LineageActions";
import { pageRobots } from "@/lib/seo";
import {
  FACET_LABEL,
  LINEAGE_LIST_MIN,
  cachedLineageEligibility,
  cachedLineageMeta,
  lineageSource,
  wikidataUrl,
  type LineageFilmRow,
  type LineageListMeta,
} from "@/lib/lineage";

/**
 * /lineage/[slug] — one list's READ page: what the list is, who compiles it
 * (source + Wikidata entity), and every member film on Metatake — the read
 * layer for "palme d'or winners list" / "sight and sound top 100" queries.
 * robots gate: ≥3 member films (same non-thin bar as the sitemap).
 */
export const revalidate = 1800;
// Empty list enables the on-demand Full Route Cache (ISR HIT) without
// prebuilding anything at build time.
export async function generateStaticParams() { return []; }
const IMG = "https://image.tmdb.org/t/p";

type Props = { params: Promise<{ slug: string }> };

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

// Hidden members (catalog entries) in deterministic order: year desc, then slug.
function hiddenOf(films: LineageFilmRow[]): LineageFilmRow[] {
  return films
    .filter((f) => !f.visible)
    .sort((a, b) => (b.film_year ?? 0) - (a.film_year ?? 0) || a.film_slug.localeCompare(b.film_slug));
}

// Cached per slug so the page is ISR-cached instead of re-querying on every
// request. Key bumped (lineage3) when source/related joined the payload —
// the Data Cache outlives deploys.
function load(slug: string) {
  return unstable_cache(
    async () => {
      const supabase = db();
      const { data: list } = await supabase
        .from("lineage_lists")
        .select("slug, label, facet, description, country, tier, film_count, source, external_ref")
        .eq("slug", slug).maybeSingle();
      if (!list) return null;
      const { data: films } = await supabase.rpc("lineage_list_films", { p_slug: slug });
      const rows = (films as LineageFilmRow[] | null) ?? [];
      // Native titles for the hidden-member cards (top 24 only).
      let hiddenNative: Record<string, string | null> = {};
      const hiddenTop = hiddenOf(rows).slice(0, 24).map((f) => f.film_slug);
      if (hiddenTop.length) {
        const { data: nat } = await supabase.from("films").select("slug, title, original_title").in("slug", hiddenTop);
        hiddenNative = Object.fromEntries(
          ((nat ?? []) as { slug: string; title: string; original_title: string | null }[])
            .map((r) => [r.slug, r.original_title && r.original_title !== r.title ? r.original_title : null])
        );
      }
      return { list: list as unknown as LineageListMeta, films: rows, hiddenNative };
    },
    ["lineage3", slug],
    { revalidate: 1800, tags: [`lineage:${slug}`] },
  )();
}

// Sibling lists in the same facet — internal links, gated to lists that
// themselves clear the ≥3-member bar (no links into noindex shells).
// Computed at component level, NOT inside load(): calling one unstable_cache
// (the eligibility roster) from inside another returns empty on cold fills.
function cachedSiblings(facet: string, slug: string) {
  return unstable_cache(
    async () => {
      const { data } = await db()
        .from("lineage_lists")
        .select("slug, label")
        .eq("facet", facet)
        .eq("status", "active")
        .neq("slug", slug)
        .order("authority_weight", { ascending: false, nullsFirst: false })
        .limit(24);
      return (data ?? []) as { slug: string; label: string }[];
    },
    ["lineage-sibs", facet, slug],
    { revalidate: 86400 },
  )();
}

// Search-phrase titles, by facet. The root layout appends "· Metatake" — no
// brand suffix here (the old hardcoded one double-branded every list page).
function listTitle(list: LineageListMeta, films: LineageFilmRow[]): string {
  const n = films.length;
  const years = films.map((f) => f.edition_year).filter((y): y is number => !!y);
  const span = years.length > 1 ? ` (${Math.min(...years)}–${Math.max(...years)})` : "";
  const ranked = films.some((f) => f.rank != null);
  const allWon = n > 0 && films.every((f) => f.result === "won");
  if (list.facet === "award") return allWon ? `${list.label} Winners — the Complete List${span}` : `${list.label} — the Complete Record${span}`;
  if (list.facet === "canon") return `${list.label} — All ${n} Films${ranked ? ", Ranked" : ""}`;
  if (list.facet === "national") return `${list.label} — the Complete List`;
  if (list.facet === "auteur") return `${list.label} — the Essential Films`;
  return `${list.label} — ${n} Films`;
}

function listDescription(list: LineageListMeta, films: LineageFilmRow[]): string {
  const n = films.length;
  const read = films.filter((f) => f.visible).length;
  const src = lineageSource(list.source);
  const base = list.description
    ? (/[.!?]$/.test(list.description.trim()) ? list.description.trim() : `${list.description.trim()}.`)
    : `${list.label} — ${FACET_LABEL[list.facet]?.toLowerCase() ?? list.facet}.`;
  return `${base} ${n} film${n === 1 ? "" : "s"} on record${src ? `, compiled from ${src.name}` : ""}${read ? ` — ${read} read closely on Metatake` : ""}.`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  const title = listTitle(data.list, data.films);
  const description = listDescription(data.list, data.films);
  return {
    title,
    description,
    alternates: { canonical: `/lineage/${slug}` },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
    robots: pageRobots(data.films.length >= LINEAGE_LIST_MIN),
  };
}

export default async function LineagePage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { list, films } = data;
  const hiddenNative = data.hiddenNative ?? {};
  const visibleFilms = films.filter((f) => f.visible);
  const hiddenFilms = hiddenOf(films);
  const isCanon = list.facet === "canon" || films.some((f) => f.rank != null);
  const src = lineageSource(list.source);
  const wd = wikidataUrl(list.external_ref);
  const [meta, elig, sibs] = await Promise.all([
    cachedLineageMeta(),
    cachedLineageEligibility(),
    cachedSiblings(list.facet, slug),
  ]);
  const updated = meta.updated || new Date().toISOString().slice(0, 10);
  const eligible = new Map(elig.lists.map((l) => [l.slug, l.n]));
  const related = sibs.filter((s) => eligible.has(s.slug)).slice(0, 8).map((s) => ({ ...s, n: eligible.get(s.slug)! }));

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listTitle(list, films),
    numberOfItems: films.length,
    itemListElement: films.slice(0, 100).map((f, i) => ({
      "@type": "ListItem",
      position: f.rank ?? i + 1,
      item: {
        "@type": "Movie",
        name: f.film_title,
        ...(f.film_year ? { datePublished: String(f.film_year) } : {}),
        url: `https://metatake.net/film/${f.film_slug}`,
      },
    })),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://metatake.net" },
      { "@type": "ListItem", position: 2, name: "Lineage", item: "https://metatake.net/lineage" },
      { "@type": "ListItem", position: 3, name: list.label, item: `https://metatake.net/lineage/${slug}` },
    ],
  };
  const pageLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    url: `https://metatake.net/lineage/${slug}`,
    name: listTitle(list, films),
    ...(list.description ? { description: list.description } : {}),
    about: {
      "@type": "Thing",
      name: list.label,
      ...(wd ? { sameAs: [wd] } : {}),
    },
    author: { "@type": "Organization", "@id": "https://metatake.net/#org", name: "Metatake" },
    editor: { "@type": "Person", "@id": "https://metatake.net/editor#person", name: "Wonwoo Yoon", url: "https://metatake.net/editor" },
    publisher: { "@type": "Organization", "@id": "https://metatake.net/#org", name: "Metatake" },
    dateModified: updated,
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageLd) }} />
      <div className="mt-wrap lh">
        <div className="lh-crumb"><Link href="/lineage">Lineage</Link></div>
        <h1 className="lh-h1">{list.label}</h1>
        <div className="lh-kick">
          {FACET_LABEL[list.facet] ?? list.facet}
          {list.country ? ` · ${list.country.toUpperCase()}` : ""}
          <span className="lh-cnt">{films.length} films</span>
        </div>
        {list.description ? <p className="lh-def">{list.description}</p> : null}
        <p className="lh-def" style={{ fontSize: 14, opacity: 0.7 }}>
          {src ? <>Compiled from {src.url ? <a href={src.url} target="_blank" rel="noopener noreferrer">{src.name} ↗</a> : src.name}</> : "Compiled from public records"}
          {wd ? <> · <a href={wd} target="_blank" rel="noopener noreferrer">Wikidata ↗</a></> : null}
          {" · "}{visibleFilms.length} of {films.length} read closely on Metatake
        </p>
        <LineageActions slug={slug} />

        <div className="lh-films">
          {visibleFilms.map((f, i) => (
            <div className="lh-film" key={i}>
              {f.poster_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="lh-poster" src={`${IMG}/w92${f.poster_path}`} alt="" loading="lazy" />
              ) : <div className="lh-poster lh-poster--empty" aria-hidden="true" />}
              <div className="lh-fmeta">
                <div className="lh-ftitle">
                  {isCanon && f.rank ? <span className="lh-rank">#{f.rank}</span> : null}
                  <Link href={`/film/${f.film_slug}`}>{f.film_title}</Link>
                  {f.film_year ? <span className="lh-yr"> ({f.film_year})</span> : null}
                </div>
                <div className="lh-fsub">
                  {f.result === "won" ? "Won" : f.result === "listed" ? "Listed" : f.result ? f.result : ""}
                  {f.edition_year ? `${f.result ? " · " : ""}${f.edition_year}` : ""}
                  {f.rep_type ? `${(f.result || f.edition_year) ? " · " : ""}${f.rep_type === "both" ? "defining & recent" : f.rep_type} work` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Layer 2 — the hidden catalog as members of this lineage. Server-rendered
            plain <a> list; these films' own pages stay out of the index. */}
        {hiddenFilms.length > 0 && (
          <section className="mvh-sec">
            <h2 className="lh-h2" style={{ fontSize: 22 }}>
              Also in this lineage — not yet read closely <span className="lh-cnt">{hiddenFilms.length}</span>
            </h2>
            <p className="mvh-note">
              The rest of {list.label} on Metatake — catalog entries, each with its own film page. The close readings are still to come.
            </p>
            <div className="mvh-films">
              {hiddenFilms.slice(0, 24).map((f) => (
                <a className="mvh-film" key={f.film_slug} href={`/film/${f.film_slug}`}>
                  {f.poster_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="mvh-poster" src={`${IMG}/w185${f.poster_path}`} alt="" width={185} height={278} loading="lazy" />
                  ) : <div className="mvh-poster mvh-poster--empty" aria-hidden="true" />}
                  <div className="mvh-fmeta">
                    <div className="mvh-ftitle">
                      {isCanon && f.rank ? <span className="lh-rank">#{f.rank} </span> : null}
                      {f.film_title}
                      {f.film_year ? <span className="mvh-yr"> ({f.film_year})</span> : null}
                    </div>
                    {hiddenNative[f.film_slug] ? <div className="mvh-fdir">{hiddenNative[f.film_slug]}</div> : null}
                  </div>
                </a>
              ))}
            </div>
            {hiddenFilms.length > 24 ? (
              <>
                <p className="mvh-note" style={{ marginTop: 16 }}>+ {hiddenFilms.length - 24} more in this lineage:</p>
                <ul className="mt-list">
                  {hiddenFilms.slice(24).map((f) => (
                    <li key={f.film_slug}>
                      <a href={`/film/${f.film_slug}`}>{isCanon && f.rank ? `#${f.rank} ` : ""}{f.film_title}</a>{" "}
                      <span className="meta">({f.film_year ?? "?"})</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>
        )}

        {related.length > 0 && (
          <section className="mvh-sec">
            <h2 className="lh-h2" style={{ fontSize: 22 }}>More {FACET_LABEL[list.facet]?.toLowerCase() ?? list.facet}s</h2>
            <ul className="mt-list">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={`/lineage/${r.slug}`}>{r.label}</Link>{" "}
                  <span className="meta">— {r.n} films</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p style={{ fontSize: 12.5, opacity: 0.6, marginTop: 26 }}>
          Metatake Editorial · Lineage data compiled from public records — source above · Data updated {updated} · Corrections: <Link href="/methodology">methodology</Link>
        </p>
      </div>
    </div>
  );
}
