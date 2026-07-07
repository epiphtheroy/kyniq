import { createClient } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import SaveChip from "@/components/SaveChip";
import FigureContribute from "@/components/FigureContribute";
import EntityMap from "@/components/EntityMap";
import EntityActions from "@/components/EntityActions";
import SeqNav from "@/components/SeqNav";
import Provenance from "@/components/Provenance";
import Byline from "@/components/Byline";
import { FigureStats } from "@/components/detail/FigureDetailBits";
import RelatedBoxes from "@/components/RelatedBoxes";
import { relatedForFigure } from "@/lib/related";
import { renderTokens } from "@/lib/mtTokens";
import { fw } from "@/lib/frameworks";
import { pageRobots } from "@/lib/seo";
import { axisLabel, nodeHref } from "@/lib/catalog";
import { ruleFigureQuestion, messyFigureTitle } from "@/lib/figureSeo";

export const revalidate = 300;
export async function generateStaticParams() { return []; }

const IMG = "https://image.tmdb.org/t/p";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const KIND: Record<string, string> = {
  character: "Character", object: "Object / symbol", location: "Location", form: "Form / technique",
};

interface Props { params: Promise<{ slug: string; figureSlug: string }>; }

type Take = {
  id: string; framework: string | null; take_title: string | null; rationale: string | null;
  leap: string | null; strength: number | null; theorist_name: string | null;
  concept: string | null; real_person: string | null; is_invitation: boolean | null;
  source: string | null; theorist: { slug: string } | null;
};

async function load(slug: string, figureSlug: string) {
  const supabase = db();
  const { data: film } = await supabase
    .from("films").select("id, title, slug, year, director, director_slug, poster_path, visible")
    .eq("slug", slug).maybeSingle();
  if (!film) return null;
  const { data: figure } = await supabase
    .from("figures").select("id, label, kind, description, created_at, updated_at")
    .eq("film_id", film.id).eq("slug", figureSlug).maybeSingle();
  if (!figure) return null;
  const { data: takeRows } = await supabase
    .from("takes")
    .select("id, framework, take_title, rationale, leap, strength, theorist_name, concept, real_person, is_invitation, source, theorist:theorists(slug)")
    .eq("figure_id", figure.id).eq("status", "published");
  const takes = ((takeRows ?? []) as unknown as Take[])
    .sort((a, b) => Number(b.is_invitation ?? false) - Number(a.is_invitation ?? false) || (b.strength ?? 0) - (a.strength ?? 0));
  // Map this figure's concept tags → /idea slugs (only concepts that recur become links).
  const conceptKeys = Array.from(new Set(takes.map((t) => (t.concept ?? "").trim().toLowerCase()).filter(Boolean)));
  const conceptSlugs: Record<string, string> = {};
  if (conceptKeys.length) {
    const { data: cs } = await supabase.from("sm_concepts").select("slug, name_l").in("name_l", conceptKeys);
    for (const r of (cs ?? []) as { slug: string; name_l: string }[]) conceptSlugs[r.name_l] = r.slug;
  }
  // The canonical tradition each reading leans on (Phase 3) — one canon per take, if matched.
  const tradition: Record<string, { slug: string; title: string }> = {};
  const takeIds = takes.map((t) => t.id);
  if (takeIds.length) {
    const { data: tr } = await supabase.rpc("take_traditions", { p_ids: takeIds });
    for (const r of (tr ?? []) as { take_id: string; slug: string; title: string }[]) {
      tradition[r.take_id] = { slug: r.slug, title: r.title.replace(/\s*\([^)]*\)\s*$/, "").trim() || r.title };
    }
  }
  const { data: mtRows } = await supabase
    .from("meta_takes")
    .select("id, title, laconic, theory_family:theory_families(name)")
    .eq("status", "published").eq("kind", "reading").order("title");
  const metaTakes = ((mtRows ?? []) as unknown[]).map((r) => {
    const m = r as { id: string; title: string; laconic: string | null; theory_family: { name: string } | null };
    return { id: m.id, title: m.title, laconic: m.laconic ?? null, family: m.theory_family?.name ?? null };
  });
  const { data: tropeRows } = await supabase
    .from("figure_type_members")
    .select("meta_take:meta_takes!inner(id, slug, title, kind, status, film_count)")
    .eq("figure_id", figure.id);
  const tropes = ((tropeRows ?? []) as unknown[])
    .map((r) => (r as { meta_take: { id: string; slug: string; title: string; kind: string; status: string; film_count: number | null } }).meta_take)
    .filter((m) => m && m.kind === "figure_type" && m.status === "published")
    .map((m) => ({ id: m.id, slug: m.slug, title: m.title, filmCount: m.film_count ?? null }));

  // Nearest figures by embedding (surface kinship) — live cosine, cross-film only.
  // figure_neighbors returns no slugs, so a second lookup resolves link targets.
  type Neighbor = { id: string; label: string; slug: string | null; sim: number; filmTitle: string; filmSlug: string; year: number | null };
  let neighbors: Neighbor[] = [];
  const { data: nbRaw } = await supabase.rpc("figure_neighbors", { p_figure: figure.id, p_k: 12, p_min: 0.5 });
  const nbRows = ((nbRaw ?? []) as { id: string; label: string; film: string; sim: number }[]);
  if (nbRows.length) {
    const { data: nbFigs } = await supabase
      .from("figures").select("id, label, slug, film:films!inner(title, slug, year, visible)")
      .in("id", nbRows.map((r) => r.id));
    const bySim = new Map(nbRows.map((r) => [r.id, r.sim]));
    neighbors = ((nbFigs ?? []) as unknown[])
      .map((r) => r as { id: string; label: string; slug: string | null; film: { title: string; slug: string; year: number | null; visible: boolean | null } })
      .filter((x) => x.film.slug !== film.slug && x.film.visible !== false)
      .map((x) => ({ id: x.id, label: x.label, slug: x.slug, sim: bySim.get(x.id) ?? 0, filmTitle: x.film.title, filmSlug: x.film.slug, year: x.film.year }))
      .sort((a, b) => b.sim - a.sim || a.filmTitle.localeCompare(b.filmTitle))
      .slice(0, 8);
  }

  // Catalog classification — what this figure IS (taxonomy layer), spelled out per axis.
  const { data: catRows } = await supabase
    .from("figure_taxonomy")
    .select("axis, node:taxonomy_nodes!inner(slug, label, kind)")
    .eq("figure_id", figure.id);
  const catalog = ((catRows ?? []) as unknown[]).map((r) => {
    const x = r as { axis: string; node: { slug: string; label: string; kind: string } };
    return { axis: x.axis, slug: x.node.slug, label: x.node.label, kind: x.node.kind };
  });

  // Connected figures — siblings that share one of this figure's tropes (cross-film kinship).
  type Sib = { id: string; label: string; slug: string | null; filmTitle: string; filmSlug: string; year: number | null };
  const connections: { slug: string; title: string; siblings: Sib[]; total: number; more: number }[] = [];
  const tropeIds = tropes.map((t) => t.id);
  if (tropeIds.length) {
    const { data: sibRows } = await supabase
      .from("figure_type_members")
      .select("meta_take_id, figure:figures!inner(id, label, slug, status, film:films!inner(title, slug, year))")
      .in("meta_take_id", tropeIds)
      .neq("figure_id", figure.id);
    const byTrope = new Map<string, Sib[]>();
    const seen = new Set<string>();
    for (const r of (sibRows ?? []) as unknown[]) {
      const row = r as { meta_take_id: string; figure: { id: string; label: string; slug: string | null; status: string; film: { title: string; slug: string; year: number | null } } };
      const f = row.figure;
      if (!f || f.status !== "approved") continue;
      const key = `${row.meta_take_id}:${f.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const arr = byTrope.get(row.meta_take_id) ?? [];
      arr.push({ id: f.id, label: f.label, slug: f.slug, filmTitle: f.film.title, filmSlug: f.film.slug, year: f.film.year });
      byTrope.set(row.meta_take_id, arr);
    }
    for (const t of tropes) {
      const all = (byTrope.get(t.id) ?? []).sort((a, b) => a.filmTitle.localeCompare(b.filmTitle));
      if (all.length === 0) continue;
      connections.push({ slug: t.slug, title: t.title, siblings: all.slice(0, 10), total: all.length, more: Math.max(0, all.length - 10) });
    }
  }

  return { film, figure, takes, metaTakes, tropes, connections, catalog, conceptSlugs, tradition, neighbors };
}

// Display order for the figure-page "Classified as" line (named archetype first, then tiers, then themes).
const CATALOG_ORDER = [
  "object", "location", "char_archetype", "char_identity", "char_complex",
  "object_type", "function", "location_category", "location_group", "theme",
] as const;
const CATALOG_CAP: Record<string, number> = { theme: 5, char_identity: 4, char_complex: 3 };

// Strip stored {{film:slug}} / {{meta_take:slug}} tokens down to plain, human-readable text
// (metadata contexts have no renderer, so tokens must not leak as literal braces).
function plainText(text: string): string {
  return text.replace(/\{\{(?:film|meta_take|take):([^}]+)\}\}/g, (_m, id: string) => id.replace(/-/g, " "));
}

// Prefix a figure label with "The " for search-query framing — but only for
// lowercase common-noun labels ("mirror" → "The mirror"). Characters ("Anna")
// and capitalized proper nouns ("Rosebud") keep their label verbatim.
function withThe(label: string, kind?: string | null): string {
  if (/^the\s/i.test(label)) return label;
  if (kind && /char/i.test(kind)) return label;
  return /^[a-z]/.test(label) ? `The ${label}` : label;
}

// First 1–2 sentences of prose, plain text, ≤155 chars, truncated at a word boundary with "…".
function metaDescription(text: string, maxLen = 155): string {
  const plain = plainText(text).replace(/\s+/g, " ").trim();
  const sentences = plain.match(/[^.!?]+[.!?]+(\s+|$)/g);
  let out = sentences ? sentences.slice(0, 2).join("").trim() : plain;
  if (out.length > maxLen) {
    const cut = out.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(" ");
    out = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
  }
  return out;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, figureSlug } = await params;
  const data = await load(slug, figureSlug);
  if (!data) return { title: "Not found" };
  // Search-query framing targets long-tail "{figure} meaning" / "{figure} symbolism in {film}" queries.
  const yearPart = data.film.year ? ` (${data.film.year})` : "";
  // No brand suffix here — the root layout template appends "· Metatake".
  // Clean labels get a full question-form title (matches real query phrasing);
  // messy labels get the dash-suffix question — grammatical with any noun phrase,
  // strips trailing periods, and skips "in {film}" when the label names the film.
  const rq = ruleFigureQuestion(data.figure.label as string, data.figure.kind as string | null, data.film.title as string);
  const title = rq
    ? rq.replace(/\?$/, `${yearPart}?`)
    : messyFigureTitle(data.figure.label as string, data.film.title as string, yearPart);
  const description = data.figure.description ? metaDescription(data.figure.description) : undefined;
  return {
    title,
    description,
    openGraph: { title, ...(description ? { description } : {}) },
    twitter: { card: "summary_large_image", title, ...(description ? { description } : {}) },
    alternates: { canonical: `/film/${slug}/figure/${figureSlug}` },
    robots: pageRobots(data.takes.length >= 3 && (data.film as { visible?: boolean }).visible !== false),
  };
}

export default async function FigurePage({ params }: Props) {
  const { slug, figureSlug } = await params;
  const data = await load(slug, figureSlug);
  if (!data) notFound();
  const { film, figure, takes, metaTakes, tropes, connections, catalog, conceptSlugs, tradition, neighbors } = data;
  if (takes.length === 0) redirect(`/film/${film.slug}`);   // unanchored old figure (no readings) → film page, not an empty shell
  // Related-boxes sections (SEO module) — deterministic, per-figure mix.
  const relatedSections = await relatedForFigure({
    filmId: film.id as string,
    figureId: figure.id as string,
    figureSlug,
    figureLabel: figure.label as string,
    filmSlug: film.slug as string,
    filmTitle: film.title as string,
    year: (film.year as number | null) ?? null,
  });
  const resolver = { film: { [film.slug]: { title: film.title } } };

  // distinct published meta takes reached by this figure's takes
  const connectedCount = connections.reduce((n, c) => n + c.total, 0);
  const kindLabel = figure.kind ? (KIND[figure.kind] ?? null) : null;

  const jsonld = {
    "@context": "https://schema.org", "@type": "Article",
    headline: `${figure.label} — ${film.title}`,
    about: { "@type": "Movie", name: film.title, ...(film.year ? { datePublished: String(film.year) } : {}) },
    ...(figure.description ? { description: figure.description as string } : {}),
    author: { "@type": "Organization", name: "Metatake" },
    editor: { "@type": "Person", name: "Wonwoo Yoon", url: "https://metatake.net/editor" },
    publisher: { "@type": "Organization", name: "Metatake" },
    ...(figure.created_at ? { datePublished: figure.created_at as string } : {}),
    ...(figure.updated_at ? { dateModified: figure.updated_at as string } : {}),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://metatake.net" },
      { "@type": "ListItem", position: 2, name: "Films", item: "https://metatake.net/film" },
      { "@type": "ListItem", position: 3, name: film.title, item: `https://metatake.net/film/${film.slug}` },
      { "@type": "ListItem", position: 4, name: figure.label, item: `https://metatake.net/film/${film.slug}/figure/${figureSlug}` },
    ],
  };

  // The lead question — the query-shaped SUBTITLE. Entity identity (H1, cross-page
  // references, JSON-LD headline) always stays the label; the question appears only
  // in <title> and as the visible H2, mirrored by the FAQ markup.
  const ruleQ = ruleFigureQuestion(figure.label as string, figure.kind as string | null, film.title as string);
  const leadQuestion = ruleQ ?? `What does ${withThe(figure.label, figure.kind).replace(/^The\b/, "the")} mean in ${film.title}?`;
  const topConn = connections.length > 0 ? connections[0] : null;
  const faqLd = figure.description ? {
    "@context": "https://schema.org", "@type": "FAQPage",
    ...(figure.created_at ? { datePublished: figure.created_at as string } : {}),
    ...(figure.updated_at ? { dateModified: figure.updated_at as string } : {}),
    mainEntity: [
      {
        "@type": "Question", name: leadQuestion,
        acceptedAnswer: { "@type": "Answer", text: plainText(String(figure.description)) },
      },
      // Mirrors the visible "Connected figures" section (films sharing the top trope).
      // Trope titles often begin with "The …" — don't double the article.
      ...(topConn ? [{
        "@type": "Question", name: `Which other films share ${/^the\b/i.test(topConn.title) ? "" : "the "}${topConn.title} trope with ${film.title}?`,
        acceptedAnswer: { "@type": "Answer", text: `${topConn.total} other ${topConn.total === 1 ? "figure carries" : "figures carry"} ${topConn.title} on Metatake, in films such as ${topConn.siblings.slice(0, 6).map((s) => `${s.filmTitle}${s.year ? ` (${s.year})` : ""}`).join(", ")}.` },
      }] : []),
    ],
  } : null;

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {faqLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} /> : null}

      <div className="fg-wrap">
        <div className="fg-crumb">
          <Link href="/film">Films</Link>
          {film.director_slug ? <><span className="fg-sep">›</span><Link href={`/director/${film.director_slug}`}>{film.director}</Link></> : null}
          <span className="fg-sep">›</span><Link href={`/film/${film.slug}`}>{film.title}</Link>
        </div>

        <section className="fg-head">
          <div className="fg-kindtag">Figure</div>
          {/* H1 stays the entity name — figures are cross-referenced site-wide as
              noun phrases. The question lives in <title> and the lead H2 only. */}
          <h1 className="fg-h1">{figure.label}</h1>
          <Byline created={figure.created_at} updated={figure.updated_at} />

          <div className="fg-fromfilm">
            {film.poster_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <Link href={`/film/${film.slug}`} className="fg-pp">
                <img src={`${IMG}/w185${film.poster_path}`} alt={`${film.title} poster`} width={185} height={278} loading="lazy" />
              </Link>
            ) : null}
            <div className="fg-ff">
              a figure in
              <b><Link href={`/film/${film.slug}`}>{film.title}</Link>{film.year ? <span className="fg-ff__yr"> ({film.year})</span> : null}</b>
              {film.director ? (
                film.director_slug
                  ? <>dir. <Link href={`/director/${film.director_slug}`}>{film.director}</Link></>
                  : <>dir. {film.director}</>
              ) : null}
            </div>
          </div>

          <div className="fg-metarow">
            {kindLabel ? <span>Kind <b>{kindLabel}</b></span> : null}
            {kindLabel && tropes.length > 0 ? <span className="fg-dot" /> : null}
            {tropes.length > 0 ? (
              <span className="fg-type">
                Type{" "}
                {tropes.map((t, i) => (
                  <span key={t.slug}>
                    {i > 0 ? ", " : ""}
                    <Link href={`/trope/${t.slug}`}>{t.title}</Link>
                    {t.filmCount != null && t.filmCount > 1 ? <span className="fg-type__n"> (in {t.filmCount} films)</span> : null}
                  </span>
                ))}
              </span>
            ) : null}
            <span className="fg-dot" />
            <span>Readings <b>{takes.length}</b></span>
          </div>

          {catalog.length > 0 ? (
            <div className="fg-catrow">
              <span className="fg-cat__l">Classified as</span>
              {CATALOG_ORDER.map((k) => {
                const items = catalog.filter((c) => c.kind === k);
                if (!items.length) return null;
                const shown = items.slice(0, CATALOG_CAP[k] ?? 8);
                return (
                  <span key={k} className="fg-cat__grp">
                    <span className="fg-cat__k">{axisLabel(k)}</span>{" "}
                    {shown.map((c, i) => (
                      <span key={c.slug}>{i > 0 ? ", " : ""}<Link href={nodeHref(c.kind, c.slug)}>{c.label}</Link></span>
                    ))}
                  </span>
                );
              })}
            </div>
          ) : null}

          {figure.description ? (
            <>
              {/* Visible twin of the FAQ question — the query-shaped subtitle
                  under the entity H1 (rule-improved when the label is clean). */}
              <h2 className="fg-qh">{leadQuestion}</h2>
              <p className="fg-desc">{renderTokens(figure.description, resolver)}</p>
            </>
          ) : null}

          <div className="fg-search">
            <a href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${film.title} ${figure.label}`)}`} target="_blank" rel="noopener noreferrer">Search images ↗</a>
            <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${film.title} ${figure.label} scene clip`)}`} target="_blank" rel="noopener noreferrer">Search clips ↗</a>
          </div>

          <div className="fg-actions">
            <EntityActions entityType="figure" entityId={figure.id} />
          </div>

          <FigureStats takes={takes.length} connected={connections.length ? connectedCount : null} />
        </section>

        {/* STRONG MISREADINGS */}
        <section className="fg-sec" id="takes">
          <h2 className="fg-h2">Strong Misreadings</h2>
          <p className="fg-gloss">Bold readings of this figure — each a deliberate over-reading, offered as a provocation, not a verdict. Filed by <Link href="/about#strong-misreadings">framework</Link>.</p>

          <div className="fg-takes">
            {takes.map((t) => {
              const F = fw(t.framework);
              const inv = !!t.is_invitation;
              const s = Math.min(5, Math.max(0, t.strength ?? 0));
              return (
                <div key={t.id} id={`t-${t.id}`} className={`sm-card${inv ? " sm-card--inv" : ""}`} style={{ borderLeftColor: F.color, scrollMarginTop: 70 }}>
                  <div className="sm-card__top">
                    <span className="sm-fw" style={{ color: F.color }}>{F.label}</span>
                    {!inv && s > 0 ? (
                      <span className="sm-str" title={`Strength ${s}/5`} aria-label={`Strength ${s} of 5`}>
                        <span className="sm-str__on">{"●".repeat(s)}</span><span className="sm-str__off">{"●".repeat(5 - s)}</span>
                      </span>
                    ) : null}
                    {t.source === "human" ? <span className="fg-badge fg-badge--community">Community</span> : null}
                    {!inv ? <SaveChip entityType="take" entityRef={t.id} /> : null}
                  </div>
                  {!inv && t.take_title ? <h3 className="sm-title">{t.take_title}</h3> : null}
                  {t.rationale ? <p className={`sm-thesis${inv ? " sm-thesis--inv" : ""}`}>{renderTokens(t.rationale, resolver)}</p> : null}
                  {!inv && t.leap ? <p className="sm-leap"><span className="sm-leap__l">The leap</span> {t.leap}</p> : null}
                  {!inv && (t.theorist_name || t.concept || t.real_person) ? (
                    <div className="sm-meta">
                      {t.theorist_name ? (t.theorist?.slug
                        ? <Link className="sm-tag sm-tag--link" href={`/theorist/${t.theorist.slug}`}>{t.theorist_name}</Link>
                        : <span className="sm-tag">{t.theorist_name}</span>) : null}
                      {t.concept ? (conceptSlugs[(t.concept ?? "").trim().toLowerCase()]
                        ? <Link className="sm-tag sm-tag--c sm-tag--link" href={`/idea/${conceptSlugs[(t.concept ?? "").trim().toLowerCase()]}`}>{t.concept}</Link>
                        : <span className="sm-tag sm-tag--c">{t.concept}</span>) : null}
                      {t.real_person ? <span className="sm-tag sm-tag--p">{t.real_person}</span> : null}
                    </div>
                  ) : null}
                  {!inv && tradition[t.id] ? (
                    <p className="sm-trad">
                      <span className="sm-trad__l">Tradition</span>
                      <Link className="sm-trad__v" href={`/tradition/${tradition[t.id].slug}`}>{tradition[t.id].title}</Link>
                    </p>
                  ) : null}
                </div>
              );
            })}
            {takes.length === 0 ? <p className="fg-empty">No readings yet.</p> : null}
          </div>
        </section>

        {/* MAP */}
        <section className="fg-sec" id="fg-map">
          <h2 className="fg-h2">{figure.label} — connection map</h2>
          <p className="cmap-stat"><b>{takes.length}</b> readings · <b>{tropes.length}</b> tropes</p>
          <p className="cmap-intro">{figure.label} in {film.title} — its tropes, the ideas and theorists it draws, and the figures nearest it across films. Click a node to open it.</p>
          <EntityMap api={`/api/map?type=figure&key=${film.slug}&key2=${figureSlug}`} full={`/map?m=critical&t=figure&k=${film.slug}&k2=${figureSlug}`} />
        </section>

        {/* CONNECTED FIGURES */}
        {connections.length > 0 && (
          <section className="fg-sec" id="connected">
            <h2 className="fg-h2">Connected figures</h2>
            <p className="fg-gloss">
              Figures from other films Metatake places alongside this one — grouped by the <strong>trope</strong>
              {" "}(figure-type) they share. The shared trope is <em>why</em> they connect.
            </p>
            {connections.map((c) => (
              <div key={c.slug} className="fg-conn">
                <div className="fg-conn__h">
                  via <Link href={`/trope/${c.slug}`}>{c.title}</Link>
                  <span className="fg-conn__n">{c.total} other {c.total === 1 ? "figure" : "figures"}</span>
                </div>
                <ul className="fg-conn__list">
                  {c.siblings.map((s) => (
                    <li key={s.id}>
                      <Link href={`/film/${s.filmSlug}`} className="fg-conn__fl">{s.filmTitle}</Link>{" "}
                      <span className="fg-conn__yr">({s.year ?? "?"})</span> —{" "}
                      {s.slug
                        ? <Link href={`/film/${s.filmSlug}/figure/${s.slug}`} className="fg-conn__fg">{s.label}</Link>
                        : <span className="fg-conn__fg">{s.label}</span>}
                    </li>
                  ))}
                </ul>
                {c.more > 0 && <Link href={`/trope/${c.slug}`} className="fg-conn__more">+{c.more} more →</Link>}
              </div>
            ))}
          </section>
        )}

        {/* NEAREST FIGURES — embedding kinship (surface axis), live cosine */}
        {neighbors.length > 0 && (
          <section className="fg-sec" id="nearest">
            <h2 className="fg-h2">Which figures across cinema are nearest {figure.label} in {film.title}?</h2>
            <p className="fg-gloss">
              The figures whose descriptions sit closest to this one in meaning-space — computed from embeddings,
              not hand-picked, and recomputed as the archive grows (<Link href="/methodology#rankings">how the % works</Link>).
            </p>
            <ul className="fg-nblist">
              {neighbors.map((s) => (
                <li key={s.id}>
                  <span className="tp-rel-kin" title="cosine similarity between the two figures' embeddings — see /methodology#rankings">
                    {Math.round(s.sim * 100)}<span className="u">%</span>
                  </span>{" "}
                  {s.slug
                    ? <Link href={`/film/${s.filmSlug}/figure/${s.slug}`} className="fg-conn__fg">{s.label}</Link>
                    : <span className="fg-conn__fg">{s.label}</span>}{" "}
                  <span className="fg-nb__in">in</span>{" "}
                  <Link href={`/film/${s.filmSlug}`} className="fg-conn__fl">{s.filmTitle}</Link>{" "}
                  <span className="fg-conn__yr">({s.year ?? "?"})</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Related boxes — before the contribute CTA so readers actually reach them */}
        {relatedSections.map((s) => (
          <RelatedBoxes key={s.heading} heading={s.heading} variant={s.variant} boxes={s.boxes} />
        ))}

        <FigureContribute figureId={figure.id} metaTakes={metaTakes} />

        <SeqNav kind="figure" id={figure.id} />

        <Provenance created={figure.created_at} updated={figure.updated_at} />
      </div>
    </div>
  );
}
