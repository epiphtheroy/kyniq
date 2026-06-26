import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";
import EntityActions from "@/components/EntityActions";
import SaveButton from "@/components/SaveButton";
import ListFilter from "@/components/ListFilter";
import Provenance from "@/components/Provenance";
import { pageRobots } from "@/lib/seo";
import { fw } from "@/lib/frameworks";
import EntityGraphLoader from "@/components/EntityGraphLoader";

export const revalidate = 300;
export async function generateStaticParams() { return []; }

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
interface Props { params: Promise<{ slug: string }> }

type Reading = {
  id: string; take_title: string | null; framework: string | null;
  figure: { id: string; label: string; slug: string | null; film: { title: string; slug: string; year: number | null } };
};

type Related = {
  slug: string; title: string; laconic: string | null; maturity: string | null;
  film_count: number | null; member_count: number | null; sim: number;
  sample: { film: string; year: number | null; fw: string | null; tt: string | null } | null;
};

const MATURITY: Record<string, [string, string]> = {
  // label, blurb
  fresh: ["Fresh", "a pattern just beginning to be shared — only these films, so far"],
  emerging: ["Emerging", "a real recurring pattern, still rare"],
  established: ["Established", "a recurring pattern across many films"],
  cliche: ["Cliché", "fully conventional — cinema returns to it again and again"],
};

async function load(slug: string) {
  const supabase = db();
  const { data: t } = await supabase
    .from("meta_takes")
    .select("id, slug, title, laconic, thesis, seo_phrase, maturity, trope_kind, film_count, member_count, created_at, updated_at")
    .eq("slug", slug).eq("kind", "figure_type").eq("status", "published").maybeSingle();
  if (!t) return null;
  // The readings that define this trope (each take whose trope_id = this trope).
  const { data: rd } = await supabase.from("takes")
    .select("id, take_title, framework, figure:figures!inner(id, label, slug, film:films!inner(title, slug, year))")
    .eq("trope_id", t.id).eq("status", "published");
  const readings = (rd as unknown as Reading[]) ?? [];
  const films = new Set(readings.map((r) => r.figure.film.slug));
  return { t, readings, filmCount: films.size };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Trope — Metatake" };
  const phrase = (data.t as { seo_phrase?: string | null }).seo_phrase;
  const title = phrase ? `${phrase} — ${data.filmCount} films` : `${data.t.title} — a trope across ${data.filmCount} films`;
  const description = data.t.thesis ?? data.t.laconic ?? undefined;
  return {
    title,
    description,
    openGraph: { title, ...(description ? { description } : {}) },
    robots: pageRobots(true),
  };
}

export default async function TropePage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) redirect("/tropes");   // retired/old trope slug (e.g. a stale cached link) → index, not a 404
  const { t, readings, filmCount } = data;
  const { data: relRaw } = await db().rpc("trope_related", { p_slug: slug, p_n: 9 });
  const related = (relRaw as Related[] | null) ?? [];
  const tt = t as typeof t & { maturity: string | null };
  const sorted = [...readings].sort((a, b) => a.figure.film.title.localeCompare(b.figure.film.title));
  const filmLabel = filmCount === 1 ? "film" : "films";
  const n = readings.length;
  const readLabel = n === 1 ? "reading" : "readings";
  const mat = tt.maturity ? MATURITY[tt.maturity] : null;

  return (
    <div className="mt">
      <MetatakeNav active="tropes" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([
        { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Tropes", item: "https://metatake.net/tropes" },
          { "@type": "ListItem", position: 2, name: t.title, item: `https://metatake.net/trope/${t.slug}` },
        ] },
        { "@context": "https://schema.org", "@type": "Article", headline: t.title,
          ...(t.thesis || t.laconic ? { description: t.thesis ?? t.laconic } : {}),
          author: { "@type": "Organization", name: "Metatake" },
          publisher: { "@type": "Organization", name: "Metatake" } },
      ]) }} />

      <div className="tp-wrap">
        <div className="tp-crumb"><Link href="/tropes">Tropes</Link></div>

        <header className="tp-head">
          <div className="tp-role">
            Trope{mat ? <> · <span className={`tp-mat tp-mat--${tt.maturity}`}>{mat[0]}</span></> : null}
          </div>
          <h1 className="tp-h1">{t.title}</h1>
          {t.laconic ? <p className="tp-laconic">{t.laconic}</p> : null}
          <div className="tp-actions">
            <EntityActions entityType="meta_take" entityId={t.id} />
            <SaveButton entityType="trope" entityRef={slug} label="Save" labelOn="Saved" variant="bookmark" />
          </div>
        </header>

        <div className="tp-stats">
          <a className="tp-stat" href="#members">
            <div className="tp-stat__n">{n}</div>
            <div className="tp-stat__k">{readLabel}</div>
          </a>
          <a className="tp-stat" href="#members">
            <div className="tp-stat__n">{filmCount}</div>
            <div className="tp-stat__k">{filmLabel}</div>
          </a>
        </div>

        {t.thesis ? <p className="tp-thesis">{t.thesis}</p> : null}
        {mat ? <p className="tp-matnote"><span className={`tp-mat tp-mat--${tt.maturity}`}>{mat[0]}</span> — {mat[1]}.</p> : null}

        <div className="tp-map">
          <EntityGraphLoader kind="trope" slug={t.slug} label={t.title} height={420} />
        </div>

        <section className="tp-sec" id="members">
          <h2 className="tp-h2">
            The readings that make {t.title}{" "}
            <span className="tp-h2__n">— {n} {readLabel} across {filmCount} {filmLabel}</span>
          </h2>
          <p className="tp-gloss">
            Every <Link href="/about#strong-misreadings">Strong Misreading</Link> that carries this code — the bold reading each film earns. The shared code is <strong>why</strong> they gather here.
          </p>

          {n === 0 ? (
            <p className="tp-empty">No readings yet.</p>
          ) : (
            <>
              <ListFilter targetId="trope-members" placeholder={`Search ${n} ${readLabel}…`} total={n} />
              <ul className="tp-mlist" id="trope-members">
                {sorted.map((r) => {
                  const figHref = r.figure.slug ? `/film/${r.figure.film.slug}/figure/${r.figure.slug}` : `/film/${r.figure.film.slug}`;
                  const F = fw(r.framework);
                  return (
                    <li
                      key={r.id}
                      className="tp-member"
                      data-filter-item
                      data-filter-text={`${r.figure.film.title} ${r.figure.label} ${r.take_title ?? ""}`.toLowerCase()}
                    >
                      <div className="tp-mhead">
                        <Link href={`/film/${r.figure.film.slug}`} className="tp-fl">{r.figure.film.title}</Link>{" "}
                        {r.figure.film.year != null ? <span className="tp-yr">({r.figure.film.year})</span> : null}{" "}
                        <span className="tp-dash">·</span>{" "}
                        <span className="tp-fwc" style={{ color: F.color }}>{F.label}</span>
                      </div>
                      {r.take_title ? (
                        <Link href={figHref} className="tp-mtitle">{r.take_title}<span className="tp-arrow"> →</span></Link>
                      ) : (
                        <Link href={figHref} className="tp-fig">{r.figure.label}<span className="tp-arrow"> →</span></Link>
                      )}
                      <div className="tp-mvia">via <Link href={figHref}>{r.figure.label}</Link></div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        {related.length > 0 && (
          <section className="tp-rel" aria-labelledby="tp-rel-h">
            <h2 className="tp-h2" id="tp-rel-h">
              Drawn to {t.title}? <span className="tp-h2__n">— follow these</span>
            </h2>
            <p className="tp-gloss">
              The codes nearest this one in meaning-space — computed from the readings each gathers, not hand-linked.
              If <strong>{t.title}</strong> holds you, this is where it leads next.
            </p>
            <div className="tp-rel-grid">
              {related.map((r) => {
                const F = r.sample?.fw ? fw(r.sample.fw) : null;
                const rm = r.maturity ? MATURITY[r.maturity] : null;
                const fc = r.film_count ?? 0;
                const mc = r.member_count ?? 0;
                return (
                  <Link key={r.slug} href={`/trope/${r.slug}`} className="tp-rel-card">
                    <div className="tp-rel-top">
                      {rm ? <span className={`tp-mat tp-mat--${r.maturity}`}>{rm[0]}</span> : <span />}
                      <span className="tp-rel-kin" title="embedding kinship — cosine similarity of the two tropes">
                        {Math.round(r.sim * 100)}<span className="u">% kin</span>
                      </span>
                    </div>
                    <h3 className="tp-rel-title">{r.title}</h3>
                    {r.laconic ? <p className="tp-rel-lac">{r.laconic}</p> : null}
                    <div className="tp-rel-meta">{fc} {fc === 1 ? "film" : "films"} · {mc} {mc === 1 ? "reading" : "readings"}</div>
                    {r.sample?.tt ? (
                      <div className="tp-rel-eg">
                        <span className="tp-rel-eg__k">e.g.</span>{" "}
                        {F ? <span className="tp-rel-eg__fw" style={{ color: F.color }}>{F.label}</span> : null}{" "}
                        <span className="tp-rel-eg__tt">{r.sample.tt}</span>
                        <span className="tp-rel-eg__film"> — {r.sample.film}{r.sample.year ? ` (${r.sample.year})` : ""}</span>
                      </div>
                    ) : null}
                    <span className="tp-rel-go">Open this trope →</span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <Provenance created={t.created_at} updated={t.updated_at} />
      </div>
    </div>
  );
}
