import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";
import FigureContribute from "@/components/FigureContribute";
import EntityGraphLoader from "@/components/EntityGraphLoader";
import EntityActions from "@/components/EntityActions";
import SeqNav from "@/components/SeqNav";
import TakeMapToggle from "@/components/TakeMapToggle";
import Provenance from "@/components/Provenance";
import { FigureStats } from "@/components/detail/FigureDetailBits";
import { renderTokens } from "@/lib/mtTokens";
import { pageRobots } from "@/lib/seo";

export const revalidate = 300;
export async function generateStaticParams() { return []; }

const IMG = "https://image.tmdb.org/t/p";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

// register → [label, color]  (figure-page-design.md §6.1)
const REG: Record<string, [string, string]> = {
  formal: ["Formal", "#5B8FB9"],
  semiotic: ["Semiotic", "#B8860B"],
  psychoanalytic: ["Psychoanalytic", "#A8434F"],
  ideological: ["Ideological", "#C0392B"],
  politico_economic: ["Politico-economic", "#2E7D5B"],
  philosophical: ["Philosophical", "#7E57C2"],
  existential: ["Existential", "#546E7A"],
  mythic: ["Mythic", "#A9743B"],
  genealogical: ["Film-historical", "#2E86C1"],
  reception: ["Reception", "#159A8A"],
};
const KIND: Record<string, string> = {
  character: "Character", object: "Object / symbol", location: "Location",
  form: "Form / technique", trope: "Trope",
};

interface Props { params: Promise<{ slug: string; figureSlug: string }>; }

type MetaTake = { slug: string; title: string; status: string } | null;
type Take = {
  id: string; rationale: string | null; register: string | null;
  angle: string | null; confidence: number | null; source: string | null; meta_take: MetaTake;
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
    .select("id, rationale, register, angle, confidence, source, meta_take:meta_takes(slug, title, status)")
    .eq("figure_id", figure.id).eq("status", "published");
  const takes = ((takeRows ?? []) as unknown as Take[])
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
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
    .select("meta_take:meta_takes!inner(id, slug, title, kind, status)")
    .eq("figure_id", figure.id);
  const tropes = ((tropeRows ?? []) as unknown[])
    .map((r) => (r as { meta_take: { id: string; slug: string; title: string; kind: string; status: string } }).meta_take)
    .filter((m) => m && m.kind === "figure_type" && m.status === "published")
    .map((m) => ({ id: m.id, slug: m.slug, title: m.title }));

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

  return { film, figure, takes, metaTakes, tropes, connections };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, figureSlug } = await params;
  const data = await load(slug, figureSlug);
  if (!data) return { title: "Not found" };
  // Question/"explained" framing targets long-tail "{element} in {film} meaning" queries.
  const title = `${data.figure.label} in ${data.film.title}${data.film.year ? ` (${data.film.year})` : ""}, explained`;
  const description = data.figure.description ?? undefined;
  return {
    title,
    description,
    openGraph: { title, ...(description ? { description } : {}) },
    robots: pageRobots(data.takes.length >= 3 && (data.film as { visible?: boolean }).visible !== false),
  };
}

export default async function FigurePage({ params }: Props) {
  const { slug, figureSlug } = await params;
  const data = await load(slug, figureSlug);
  if (!data) notFound();
  const { film, figure, takes, metaTakes, tropes, connections } = data;
  const resolver = { film: { [film.slug]: { title: film.title } } };

  // distinct published meta takes reached by this figure's takes
  const metaTakeCount = new Set(
    takes.map((t) => t.meta_take).filter((m): m is NonNullable<MetaTake> => !!m && m.status === "published").map((m) => m.slug)
  ).size;
  const connectedCount = connections.reduce((n, c) => n + c.total, 0);
  const primaryTrope = tropes[0] ?? null;
  const kindLabel = figure.kind ? (KIND[figure.kind] ?? figure.kind) : null;

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

  const faqLd = figure.description ? {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: [{
      "@type": "Question", name: `What does ${figure.label} mean in ${film.title}?`,
      acceptedAnswer: { "@type": "Answer", text: String(figure.description) },
    }],
  } : null;

  return (
    <div className="mt">
      <MetatakeNav active="films" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
      {faqLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} /> : null}

      <div className="fg-wrap">
        <div className="fg-crumb">
          <Link href="/film">Films</Link>
          {film.director_slug ? <><span className="fg-sep">›</span><Link href={`/director/${film.director_slug}`}>{film.director}</Link></> : null}
          <span className="fg-sep">›</span><Link href={`/film/${film.slug}`}>{film.title}</Link>
        </div>

        <section className="fg-head">
          <div className="fg-kindtag">
            Figure{primaryTrope ? <> · Trope</> : kindLabel ? <> · {kindLabel}</> : null}
          </div>
          <h1 className="fg-h1">{figure.label}</h1>

          <div className="fg-fromfilm">
            {film.poster_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <Link href={`/film/${film.slug}`} className="fg-pp">
                <img src={`${IMG}/w185${film.poster_path}`} alt={`${film.title} poster`} loading="lazy" />
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
                  <span key={t.slug}>{i > 0 ? ", " : ""}<Link href={`/trope/${t.slug}`}>{t.title}</Link></span>
                ))}
              </span>
            ) : null}
            <span className="fg-dot" />
            <span>Takes <b>{takes.length}</b></span>
          </div>

          {figure.description ? (
            <p className="fg-desc">{renderTokens(figure.description, resolver)}</p>
          ) : null}

          <div className="fg-search">
            <a href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${film.title} ${figure.label}`)}`} target="_blank" rel="noopener noreferrer">Search images ↗</a>
            <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${film.title} ${figure.label} scene clip`)}`} target="_blank" rel="noopener noreferrer">Search clips ↗</a>
          </div>

          <div className="fg-actions">
            <EntityActions entityType="figure" entityId={figure.id} />
          </div>

          <FigureStats takes={takes.length} metaTakes={metaTakeCount} connected={connections.length ? connectedCount : null} />
        </section>

        {/* TAKES */}
        <section className="fg-sec" id="takes">
          <h2 className="fg-h2">Takes</h2>
          <p className="fg-gloss">A take is one critical reading of this figure. Takes that recur across films converge into a <strong>meta take</strong> — the hub each one links to. Filed by critical register.</p>

          <div className="fg-takes">
            {takes.map((t) => {
              const reg = t.register ? REG[t.register] : undefined;
              const color = reg ? reg[1] : "#8F8F8F";
              const mt = t.meta_take;
              return (
                <div key={t.id} id={`t-${t.id}`} className="fg-take" style={{ borderLeftColor: color, scrollMarginTop: 70 }}>
                  <div className="fg-take__top">
                    {reg ? <span className="fg-badge" style={{ background: color }}>{reg[0]}</span> : null}
                    {t.source === "human" ? <span className="fg-badge fg-badge--community">Community</span> : null}
                    {mt ? (
                      <span className="fg-hub">
                        <span className="fg-hub__ar">→</span>{" "}
                        {mt.status === "published"
                          ? <Link href={`/take/${mt.slug}`}>{mt.title}</Link>
                          : <span className="fg-hub__emerging">{mt.title} <em>(emerging)</em></span>}
                      </span>
                    ) : null}
                  </div>
                  {t.rationale ? <p className="fg-take__rat">{renderTokens(t.rationale, resolver)}</p> : null}
                  {mt && mt.status === "published" ? (
                    <div className="fg-take__foot">
                      <TakeMapToggle mtSlug={mt.slug} mtTitle={mt.title} label={figure.label} takeId={t.id} />
                    </div>
                  ) : null}
                </div>
              );
            })}
            {takes.length === 0 ? <p className="fg-empty">No takes yet.</p> : null}
          </div>
        </section>

        {/* MAP */}
        <section className="fg-sec">
          <h2 className="fg-h2">The neighbourhood of this figure</h2>
          <p className="fg-gloss">The figure at the centre, the readings it gathers above, and the trope-siblings it connects to across films. Drag, zoom, hover.</p>
          <EntityGraphLoader kind="figure" filmSlug={film.slug} figureSlug={figureSlug} label={figure.label} height={460} />
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

        <FigureContribute figureId={figure.id} metaTakes={metaTakes} />

        <SeqNav kind="figure" id={figure.id} />

        <Provenance created={figure.created_at} updated={figure.updated_at} />
      </div>
    </div>
  );
}
