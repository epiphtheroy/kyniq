import { createClient } from "@supabase/supabase-js";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import EntityActions from "@/components/EntityActions";
import SaveButton from "@/components/SaveButton";
import ListFilter from "@/components/ListFilter";
import LensQuickBar from "@/components/LensQuickBar";
import Provenance from "@/components/Provenance";
import Byline from "@/components/Byline";
import { pageRobots } from "@/lib/seo";
import { resolveAlias } from "@/lib/aliases";
import { fw } from "@/lib/frameworks";
import EntityMap from "@/components/EntityMap";
import RelatedBoxes from "@/components/RelatedBoxes";
import { relatedForMetaTake } from "@/lib/related";

export const revalidate = 300;
export async function generateStaticParams() { return []; }

const IMG = "https://image.tmdb.org/t/p";
const SITE = "https://metatake.net";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
interface Props { params: Promise<{ slug: string }> }

// Row shape of trope_members_ranked — members ordered by cosine(take, trope)
// desc, so list order IS the rank. `match` is null only if an embedding is missing.
type Member = {
  take_id: string; take_title: string | null; framework: string | null;
  rationale: string | null; strength: number | null;
  figure_label: string; figure_slug: string | null;
  film_title: string; film_slug: string; film_year: number | null; poster: string | null;
  match: number | null;
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
    .select("id, slug, title, laconic, thesis, seo_phrase, maturity, trope_kind, film_count, member_count, cohesion, created_at, updated_at")
    .eq("slug", slug).eq("kind", "figure_type").eq("status", "published").maybeSingle();
  if (!t) return null;
  // Members ranked live in the DB (cosine of take↔trope embeddings) — never baked,
  // so trope rebuilds and new readings re-rank on the next revalidate.
  const { data: md } = await supabase.rpc("trope_members_ranked", { p_slug: slug, p_limit: 200 });
  const members = ((md as Member[] | null) ?? []);
  const films = new Set(members.map((m) => m.film_slug));
  return { t, members, filmCount: films.size };
}

// Extracts the first 1–2 sentences of a prose field as a plain-text meta
// description: strips markdown/newlines, then truncates to <=155 chars on a
// word boundary with an ellipsis. Falls back to the raw text if no sentence
// boundary is found within the limit.
function descriptionFromThesis(thesis: string | null | undefined): string | null {
  if (!thesis) return null;
  const plain = thesis.replace(/[*_`#>[\]]/g, "").replace(/\s+/g, " ").trim();
  if (!plain) return null;
  const sentences = plain.match(/[^.!?]+[.!?]+/g) ?? [plain];
  let out = sentences[0].trim();
  if (sentences[1] && (out + " " + sentences[1]).length <= 155) {
    out = (out + " " + sentences[1]).trim();
  }
  if (out.length <= 155) return out;
  const truncated = out.slice(0, 155);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated).trim() + "…";
}

// Plain-text excerpt of a reading's rationale for the ranked member list:
// resolves {{film:slug}}-style tokens to words, strips markdown, truncates on
// a sentence/word boundary. Metadata-safe (no renderer in this context).
function excerptPlain(text: string | null | undefined, maxLen = 190): string | null {
  if (!text) return null;
  const plain = text
    .replace(/\{\{(?:film|meta_take|take|figure):([^}]+)\}\}/g, (_m, id: string) => id.replace(/-/g, " "))
    .replace(/[*_`#>[\]]/g, "").replace(/\s+/g, " ").trim();
  if (!plain) return null;
  if (plain.length <= maxLen) return plain;
  const cut = plain.slice(0, maxLen);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (lastStop > maxLen * 0.6) return cut.slice(0, lastStop + 1).trim();
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Trope — Metatake" };
  const phrase = (data.t as { seo_phrase?: string | null }).seo_phrase;
  // Listicle framing only once there's a list worth ranking.
  const ranked = data.filmCount >= 4;
  const title = phrase
    ? `${phrase} — ${data.filmCount} films${ranked ? ", ranked" : ""}`
    : ranked
      ? `${data.t.title} — ${data.filmCount} films that stage this trope, ranked`
      : `${data.t.title} — a trope across ${data.filmCount} films`;
  const fallbackDescription = data.t.thesis ?? data.t.laconic ?? undefined;
  const description = descriptionFromThesis(data.t.thesis) ?? fallbackDescription;
  return {
    title,
    description,
    openGraph: { title, ...(description ? { description } : {}) },
    twitter: { card: "summary_large_image", title, ...(description ? { description } : {}) },
    alternates: { canonical: `/trope/${slug}` },
    robots: pageRobots(true),
  };
}

export default async function TropePage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) {
    // Not a published trope. Resolve mis-kinded / merged slugs (permanent) —
    // mirrors /take/[slug] — but a slug with no row at all is a real 404
    // (redirecting unknown slugs to /tropes reads as a soft-404).
    const sup = db();
    const { data: row } = await sup
      .from("meta_takes").select("kind, status, merged_into").eq("slug", slug).maybeSingle();
    if (row) {
      if (row.kind === "reading" && row.status === "published") permanentRedirect(`/take/${slug}`);
      if (row.merged_into) {
        const { data: tgt } = await sup.from("meta_takes").select("slug, kind").eq("id", row.merged_into).maybeSingle();
        if (tgt?.slug) permanentRedirect(`/${tgt.kind === "figure_type" ? "trope" : "take"}/${tgt.slug}`);
      }
    }
    // Last resort before 404: the URL-permanence ledger (renamed/merged paths).
    const alias = await resolveAlias(`/trope/${slug}`);
    if (alias) permanentRedirect(alias);
    notFound();
  }
  const { t, members, filmCount } = data;
  const [{ data: relRaw }, relatedSections] = await Promise.all([
    db().rpc("trope_related", { p_slug: slug, p_n: 9 }),
    // Related-boxes sections (SEO module) — deterministic, per-trope mix.
    relatedForMetaTake({ metaTakeId: t.id, kind: "figure_type", slug: t.slug }),
  ]);
  const related = (relRaw as Related[] | null) ?? [];
  const tt = t as typeof t & { maturity: string | null; cohesion: number | null };
  const filmLabel = filmCount === 1 ? "film" : "films";
  const n = members.length;
  const readLabel = n === 1 ? "reading" : "readings";
  const mat = tt.maturity ? MATURITY[tt.maturity] : null;
  const coherence = tt.cohesion != null ? Math.round(tt.cohesion * 100) : null;
  const topFilms = Array.from(new Map(members.map((m) => [m.film_slug, m])).values()).slice(0, 5);
  const figHref = (m: Member) => (m.figure_slug ? `/film/${m.film_slug}/figure/${m.figure_slug}` : `/film/${m.film_slug}`);

  const faqLd = n > 0 ? {
    "@context": "https://schema.org", "@type": "FAQPage",
    ...(t.created_at ? { datePublished: t.created_at } : {}),
    ...(t.updated_at ? { dateModified: t.updated_at } : {}),
    mainEntity: [
      {
        "@type": "Question", name: `Which films stage ${t.title}?`,
        acceptedAnswer: { "@type": "Answer", text: `Metatake documents ${n} ${readLabel} across ${filmCount} ${filmLabel} that stage ${t.title}, including ${topFilms.map((m) => `${m.film_title}${m.film_year ? ` (${m.film_year})` : ""}`).join(", ")} — each tied to the exact on-screen figure that carries it.` },
      },
      ...(t.thesis || t.laconic ? [{
        "@type": "Question", name: `What is ${t.title} in film?`,
        acceptedAnswer: { "@type": "Answer", text: excerptPlain(t.thesis ?? t.laconic, 600) },
      }] : []),
    ],
  } : null;

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([
        { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Tropes", item: `${SITE}/tropes` },
          { "@type": "ListItem", position: 2, name: t.title, item: `${SITE}/trope/${t.slug}` },
        ] },
        { "@context": "https://schema.org", "@type": "Article", headline: t.title,
          ...(t.thesis || t.laconic ? { description: t.thesis ?? t.laconic } : {}),
          ...(t.created_at ? { datePublished: t.created_at, dateModified: t.updated_at ?? t.created_at } : {}),
          author: { "@type": "Organization", name: "Metatake" },
          editor: { "@type": "Person", name: "Wonwoo Yoon", url: `${SITE}/editor` },
          publisher: { "@type": "Organization", name: "Metatake" } },
        // The ranked member list, as machine-readable positions (rank = position).
        { "@context": "https://schema.org", "@type": "ItemList",
          name: `Films that stage ${t.title}, ranked`,
          numberOfItems: n,
          itemListElement: members.slice(0, 25).map((m, i) => ({
            "@type": "ListItem", position: i + 1,
            name: `${m.figure_label} — ${m.film_title}${m.film_year ? ` (${m.film_year})` : ""}`,
            url: `${SITE}${figHref(m)}`,
          })) },
        ...(faqLd ? [faqLd] : []),
      ]) }} />

      <div className="tp-wrap">
        <div className="tp-crumb"><Link href="/tropes">Tropes</Link></div>

        <header className="tp-head">
          <div className="tp-role">
            Trope{mat ? <> · <span className={`tp-mat tp-mat--${tt.maturity}`}>{mat[0]}</span></> : null}
          </div>
          <h1 className="tp-h1">{t.title}</h1>
          {t.laconic ? <p className="tp-laconic">{t.laconic}</p> : null}
          <Byline created={t.created_at} updated={t.updated_at} />
          <div className="tp-actions">
            <EntityActions entityType="meta_take" entityId={t.id} />
            <SaveButton entityType="trope" entityRef={slug} label="Save" labelOn="Saved" variant="bookmark" />
          </div>
        </header>

        <LensQuickBar />

        <div className="tp-stats">
          <a className="tp-stat" href="#members">
            <div className="tp-stat__n">{n}</div>
            <div className="tp-stat__k">{readLabel}</div>
          </a>
          <a className="tp-stat" href="#members">
            <div className="tp-stat__n">{filmCount}</div>
            <div className="tp-stat__k">{filmLabel}</div>
          </a>
          {coherence != null ? (
            <Link className="tp-stat" href="/methodology#rankings" title="How tightly this trope's readings cluster in meaning-space — computed from embeddings, explained in the methodology.">
              <div className="tp-stat__n">{coherence}%</div>
              <div className="tp-stat__k">coherence</div>
            </Link>
          ) : null}
        </div>

        {t.thesis ? <p className="tp-thesis">{t.thesis}</p> : null}
        {mat ? <p className="tp-matnote"><span className={`tp-mat tp-mat--${tt.maturity}`}>{mat[0]}</span> — {mat[1]}.</p> : null}

        <section className="tp-sec" id="tp-map">
          <h2 className="tp-h2">{t.title} — connection map</h2>
          <p className="cmap-stat"><b>{n}</b> readings · <b>{filmCount}</b> {filmLabel}</p>
          <p className="cmap-intro">The figures that carry {t.title} and the films they belong to, across Metatake&rsquo;s critical web. Click a node to open it.</p>
          <EntityMap api={`/api/map?type=trope&key=${slug}`} full={`/map?m=critical&t=trope&k=${slug}`} />
        </section>

        <section className="tp-sec" id="members">
          <h2 className="tp-h2">
            Which films stage {t.title}?{" "}
            <span className="tp-h2__n">— {n} {readLabel} across {filmCount} {filmLabel}, ranked</span>
          </h2>
          <p className="tp-gloss">
            Every <Link href="/about#strong-misreadings">Strong Misreading</Link> that carries this code — the bold reading each film earns.
            Ranked by how centrally each reading sits in this trope&rsquo;s meaning-space, recomputed as the corpus grows
            (<Link href="/methodology#rankings">how ranking works</Link>).
          </p>

          {n === 0 ? (
            <p className="tp-empty">No readings yet.</p>
          ) : (
            <>
              <ListFilter targetId="trope-members" placeholder={`Search ${n} ${readLabel}…`} total={n} />
              <ol className="tp-mlist mtl-rows" id="trope-members">
                {members.map((m, i) => {
                  const href = figHref(m);
                  const F = fw(m.framework);
                  const exc = excerptPlain(m.rationale);
                  return (
                    <li
                      key={m.take_id}
                      className="tp-member"
                      data-filter-item
                      data-filter-text={`${m.film_title} ${m.figure_label} ${m.take_title ?? ""}`.toLowerCase()}
                    >
                      <div className="tp-mrow">
                        <span className="tp-rank" aria-hidden="true">{i + 1}</span>
                        {m.poster ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <Link href={`/film/${m.film_slug}`} className="tp-mthumb" tabIndex={-1} aria-hidden="true">
                            <img src={`${IMG}/w92${m.poster}`} alt="" width={46} height={69} loading="lazy" />
                          </Link>
                        ) : null}
                        <div className="tp-mbody">
                          <div className="tp-mhead">
                            <h3 className="tp-mh3">
                              <Link href={href} className="tp-fig">{m.figure_label}</Link>{" "}
                              <span className="tp-in">in</span>{" "}
                              <Link href={`/film/${m.film_slug}`} className="tp-fl">{m.film_title}</Link>{" "}
                              {m.film_year != null ? <span className="tp-yr">({m.film_year})</span> : null}
                            </h3>
                            <span className="tp-dash">·</span>{" "}
                            <span className="tp-fwc" style={{ color: F.color }}>{F.label}</span>
                            {m.match != null ? (
                              <span className="tp-rel-kin tp-match" title="How centrally this reading sits in the trope's meaning-space — cosine similarity of embeddings. See /methodology#rankings.">
                                {Math.round(m.match * 100)}<span className="u">% match</span>
                              </span>
                            ) : null}
                          </div>
                          {m.take_title ? (
                            <Link href={href} className="tp-mtitle">{m.take_title}<span className="tp-arrow"> →</span></Link>
                          ) : null}
                          {exc ? <p className="tp-mexc">{exc}</p> : null}
                          <div className="tp-mvia">the full reading lives at <Link href={href}>{m.figure_label}</Link></div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </section>

        {related.length > 0 && (
          <section className="tp-rel" aria-labelledby="tp-rel-h">
            <h2 className="tp-h2" id="tp-rel-h">
              Drawn to {t.title}? <span className="tp-h2__n">— follow these</span>
            </h2>
            <p className="tp-gloss">
              The codes nearest this one in meaning-space — computed from the readings each gathers, not hand-linked
              (<Link href="/methodology#rankings">how the % is computed</Link>).
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

        {/* Related boxes — appended after the main content, before footer-ish elements */}
        {relatedSections.map((s) => (
          <RelatedBoxes key={s.heading} heading={s.heading} variant={s.variant} boxes={s.boxes} />
        ))}

        <Provenance created={t.created_at} updated={t.updated_at} />
      </div>
    </div>
  );
}
